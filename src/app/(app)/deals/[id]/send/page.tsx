import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";
import { requireWorkspace, requireWorkspaceId } from "@/lib/workspace";
import { sendContractEmail } from "../actions";

export default async function SendContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const workspaceId = await requireWorkspaceId();
  const [deal, workspace] = await Promise.all([
    prisma.deal.findFirst({
      where: { id, workspaceId },
      include: { client: true, template: true, contract: true },
    }),
    requireWorkspace(),
  ]);
  if (!deal || !deal.contract || !deal.template) notFound();

  const workspaceName = workspace?.name ?? "Your workspace";
  const configured = isEmailConfigured();

  const defaultSubject = `${deal.template.name} from ${workspaceName}`;
  const defaultMessage = `Hi ${deal.client.name.split(" ")[0]},\n\nThanks again for the call — here's the ${deal.template.name.toLowerCase()} we discussed. Take a look and sign whenever you're ready.\n\nLet me know if anything needs adjusting.`;

  return (
    <>
    <Link href={`/deals/${deal.id}/contract`} className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
      ← Contract review
    </Link>

    <div className="mb-6 max-w-[560px]">
      <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Send to {deal.client.name}</h1>
      <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
        Review and edit before it goes out — the sign link is added automatically.
      </div>
    </div>

    {error && (
      <div className="chip chip-warn mb-4 max-w-[560px] w-full justify-start px-4 py-2.5 text-[12.5px]">
        {error}
      </div>
    )}

    {!configured && (
      <div className="chip chip-warn mb-4 max-w-[560px] w-full justify-start px-4 py-2.5 text-[12.5px]">
        Email sending isn&apos;t set up yet — add a <span className="font-mono-tab">RESEND_API_KEY</span> to <span className="font-mono-tab">.env</span> first.
      </div>
    )}

    <form action={sendContractEmail.bind(null, deal.id)} className="card flex max-w-[560px] flex-col gap-4 p-6">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">To</span>
        <input name="to" type="email" required defaultValue={deal.client.email ?? ""} placeholder="client@company.com" className="input" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Subject</span>
        <input name="subject" required defaultValue={defaultSubject} className="input" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Message</span>
        <textarea name="message" required rows={7} defaultValue={defaultMessage} className="input" />
        <span className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
          The sign link is appended below your message automatically.
        </span>
      </label>
      <button type="submit" disabled={!configured} className="btn btn-primary mt-2 w-full justify-center">
        Send email
      </button>
    </form>
    </>
  );
}
