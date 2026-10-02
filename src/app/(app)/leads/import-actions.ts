"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProspecting } from "@/lib/prospecting";
import { leadAccess } from "@/lib/lead-visibility";
import { normalizePhone } from "@/lib/phone";
import { IMPORT_CHUNK_SIZE, rowName, type ImportRow } from "@/lib/lead-import";

const SOURCES = new Set(["paste", "csv"]);

function clip(value: string | undefined, max: number): string | null {
  const v = value?.trim();
  return v ? v.slice(0, max) : null;
}

type CleanRow = { name: string; company: string | null; title: string | null; email: string | null; phone: string | null; domain: string | null };

function clean(row: ImportRow): CleanRow | null {
  const name = rowName(row).slice(0, 200);
  if (!name) return null;
  const email = clip(row.email, 254)?.toLowerCase() ?? null;
  const rawPhone = clip(row.phone, 40);
  return {
    name,
    company: clip(row.company, 300),
    title: clip(row.title, 300),
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    phone: normalizePhone(rawPhone) ?? rawPhone,
    domain: clip(row.domain, 253)?.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") || null,
  };
}

export async function startLeadImport(source: string, fileName: string | null): Promise<{ importId: string }> {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  if (!SOURCES.has(source)) throw new Error("Unknown import source");
  const run = await prisma.leadImport.create({
    data: { workspaceId: workspace.id, createdById: access.userId, source, fileName: fileName?.slice(0, 200) ?? null },
    select: { id: true },
  });
  return { importId: run.id };
}

// One batch of an import. New people become leads; someone already in the
// workspace (same email, or same phone) only gets their empty fields filled
// in, never overwritten, since what's there may have come from a call.
export async function importLeadsChunk(
  importId: string,
  rows: ImportRow[],
  ownerChoice: string | null
): Promise<{ created: number; updated: number; skipped: number }> {
  const workspace = await requireProspecting();
  const access = await leadAccess();
  if (!Array.isArray(rows) || rows.length > IMPORT_CHUNK_SIZE) throw new Error("Too many rows in one batch");

  const run = await prisma.leadImport.findFirst({ where: { id: importId, workspaceId: workspace.id, createdById: access.userId }, select: { id: true, source: true } });
  if (!run) throw new Error("Import not found");

  // Only managers pick the owner; a rep's imported leads are theirs.
  let ownerId: string | null = access.userId;
  if (access.canAssign) {
    ownerId = ownerChoice
      ? ((await prisma.user.findFirst({ where: { id: ownerChoice, workspaceId: workspace.id, deactivatedAt: null }, select: { id: true } }))?.id ?? null)
      : null;
  }

  let skipped = 0;
  const cleaned: CleanRow[] = [];
  for (const row of rows) {
    const c = clean(row ?? {});
    if (c) cleaned.push(c);
    else skipped++;
  }

  const emails = [...new Set(cleaned.map((r) => r.email).filter((e): e is string => Boolean(e)))];
  const phones = [...new Set(cleaned.map((r) => r.phone).filter((p): p is string => Boolean(p)))];
  const existing = emails.length || phones.length
    ? await prisma.lead.findMany({
        where: { workspaceId: workspace.id, OR: [...(emails.length ? [{ email: { in: emails } }] : []), ...(phones.length ? [{ phone: { in: phones } }] : [])] },
        select: { id: true, ownerId: true, name: true, company: true, title: true, email: true, phone: true, domain: true },
      })
    : [];
  const byEmail = new Map(existing.filter((l) => l.email).map((l) => [l.email!, l]));
  const byPhone = new Map(existing.filter((l) => l.phone).map((l) => [l.phone!, l]));

  const toCreate: CleanRow[] = [];
  const seen = new Set<string>();
  let updated = 0;
  for (const row of cleaned) {
    const key = row.email ?? row.phone;
    if (key && seen.has(key)) {
      skipped++;
      continue;
    }
    if (key) seen.add(key);

    const match = (row.email && byEmail.get(row.email)) || (row.phone && byPhone.get(row.phone)) || null;
    if (!match) {
      toCreate.push(row);
      continue;
    }
    // A rep can't touch a lead they can't see.
    if (!access.canViewAll && match.ownerId !== access.userId) {
      skipped++;
      continue;
    }
    const fill: Partial<CleanRow> = {};
    for (const field of ["company", "title", "email", "phone", "domain"] as const) {
      if (!match[field] && row[field]) fill[field] = row[field];
    }
    if (Object.keys(fill).length === 0) {
      skipped++;
      continue;
    }
    await prisma.lead.update({ where: { id: match.id }, data: fill });
    updated++;
  }

  if (toCreate.length) {
    await prisma.lead.createMany({
      data: toCreate.map((r) => ({ workspaceId: workspace.id, ownerId, source: run.source, importId: run.id, ...r })),
    });
  }

  await prisma.leadImport.update({
    where: { id: run.id },
    data: { created: { increment: toCreate.length }, updated: { increment: updated }, skipped: { increment: skipped } },
  });
  revalidatePath("/leads");
  return { created: toCreate.length, updated, skipped };
}
