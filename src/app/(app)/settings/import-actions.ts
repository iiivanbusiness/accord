"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission, currentUserWithRole } from "@/lib/permissions";
import { parseCsvWithHeader } from "@/lib/csv";
import { logAudit } from "@/lib/audit";

const MAX_ROWS = 1000;
const VALID_STATUSES = new Set(["signed", "sent", "ready", "missing_info"]);

export type ImportResult = {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

// One-shot: parse, validate, and create in the same call rather than a
// separate preview step — a failed row is reported with its line number
// so the admin can fix just those rows and re-upload the rest (already-
// imported rows are unaffected either way, since nothing here is
// transactional across rows).
//
// Expected columns (header row, any order): client_name, client_company,
// client_email, service, fee, status, signed_date. Only client_name (or
// client_company), service, and fee are required.
export async function importClientsAndDeals(formData: FormData): Promise<ImportResult> {
  const user = await requirePermission("canManageWorkspace");
  const currentUser = await currentUserWithRole();
  const text = String(formData.get("csv") ?? "");
  if (!text.trim()) throw new Error("Paste or upload CSV data first");

  const rows = parseCsvWithHeader(text);
  if (rows.length === 0) throw new Error("No data rows found — check the header row is included");
  if (rows.length > MAX_ROWS) throw new Error(`Too many rows (${rows.length}) — split into batches of ${MAX_ROWS} or fewer`);

  const result: ImportResult = { created: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // +1 for 0-index, +1 for the header row
    const r = rows[i];
    const clientName = r.client_name || r.client_company;
    const clientCompany = r.client_company || r.client_name;
    const clientEmail = r.client_email || null;
    const service = r.service;
    const fee = r.fee;
    const rawStatus = (r.status || "").toLowerCase();
    const signedDateRaw = r.signed_date;

    if (!clientName) {
      result.errors.push({ row: rowNum, message: "Missing client_name/client_company" });
      result.skipped++;
      continue;
    }
    if (!service) {
      result.errors.push({ row: rowNum, message: "Missing service" });
      result.skipped++;
      continue;
    }
    if (!fee) {
      result.errors.push({ row: rowNum, message: "Missing fee" });
      result.skipped++;
      continue;
    }

    let signedDate: Date | null = null;
    if (signedDateRaw) {
      signedDate = new Date(signedDateRaw);
      if (Number.isNaN(signedDate.getTime())) {
        result.errors.push({ row: rowNum, message: `Invalid signed_date "${signedDateRaw}" — use YYYY-MM-DD` });
        result.skipped++;
        continue;
      }
    }

    const status = VALID_STATUSES.has(rawStatus) ? rawStatus : signedDate ? "signed" : "ready";

    try {
      // Match an existing client by email first (the more reliable key),
      // falling back to an exact name+company match — otherwise create a
      // new one. This keeps a re-run of the same file (or a file that
      // covers several deals per client) from spawning duplicate clients.
      let client = clientEmail
        ? await prisma.client.findFirst({ where: { workspaceId: user.workspaceId, email: clientEmail } })
        : await prisma.client.findFirst({ where: { workspaceId: user.workspaceId, name: clientName, company: clientCompany } });

      if (!client) {
        client = await prisma.client.create({
          data: { workspaceId: user.workspaceId, name: clientName, company: clientCompany, email: clientEmail },
        });
      }

      await prisma.deal.create({
        data: {
          workspaceId: user.workspaceId,
          clientId: client.id,
          ownerId: currentUser.id,
          teamId: currentUser.teamId,
          service,
          feeDisplay: fee,
          status,
          source: "import",
          ...(status === "signed"
            ? { contract: { create: { status: "signed", signedAt: signedDate ?? new Date() } } }
            : {}),
        },
      });

      result.created++;
    } catch (err) {
      result.errors.push({ row: rowNum, message: err instanceof Error ? err.message : "Unknown error" });
      result.skipped++;
    }
  }

  const session = await auth();
  await logAudit({
    workspaceId: user.workspaceId,
    actorEmail: session?.user?.email,
    action: "data.bulk_imported",
    metadata: { created: result.created, skipped: result.skipped },
  });

  revalidatePath("/deals");
  revalidatePath("/clients");
  return result;
}
