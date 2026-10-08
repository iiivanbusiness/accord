"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LeadJoinPicker, { type JoinPick } from "@/components/LeadJoinPicker";

// Two leads for the same client: this one, its calls and tasks go into the
// one picked.
export default function MergeLeadCard({
  leadName,
  calls,
  searchLeads,
  mergeAction,
}: {
  leadName: string;
  calls: number;
  searchLeads: (q: string) => Promise<JoinPick[]>;
  mergeAction: (targetId: string) => Promise<{ leadId: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="card flex flex-col gap-2.5 p-5">
      <div className="text-[14px] font-medium">Same client as another lead?</div>
      {!open ? (
        <>
          <div className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>Merge them so every call with this client is in one place.</div>
          <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary btn-sm self-start">
            Merge with…
          </button>
        </>
      ) : (
        <LeadJoinPicker
          search={searchLeads}
          confirmText={(pick) => {
            const target = pick === "new" ? "" : pick.name;
            const what = calls ? `${calls} ${calls === 1 ? "call" : "calls"} and the tasks` : "The tasks";
            return `${what} from ${leadName} move to ${target}, and ${leadName} is removed. This can't be undone.`;
          }}
          confirmLabel="Merge"
          onConfirm={async (pick) => {
            if (pick === "new") return;
            const { leadId } = await mergeAction(pick.id);
            router.push(`/leads/${leadId}`);
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}
