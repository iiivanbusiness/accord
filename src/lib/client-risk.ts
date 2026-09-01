// A plain, explainable rule set — not a black-box score. Every signal here
// already exists elsewhere in the app (action items, clause comments, deal
// activity); this just reads them together and names what they add up to.
export type RiskLevel = "high" | "watch" | "none";

export type ClientRiskInput = {
  deals: {
    status: string;
    updatedAt: Date;
    actionItems: { ownerType: string; status: string; dueDate: Date | null }[];
    contract: { clauseComments: { resolved: boolean }[] } | null;
  }[];
};

export type ClientRisk = { level: RiskLevel; reasons: string[] };

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeClientRisk(client: ClientRiskInput): ClientRisk {
  const now = Date.now();
  const reasons: string[] = [];

  const openClauseComments = client.deals.reduce(
    (sum, d) => sum + (d.contract?.clauseComments.filter((c) => !c.resolved).length ?? 0),
    0
  );
  const overdueClientItems = client.deals.reduce(
    (sum, d) =>
      sum +
      d.actionItems.filter((a) => a.ownerType === "client" && a.status !== "done" && a.dueDate && a.dueDate.getTime() < now).length,
    0
  );
  const stalledChangesRequested = client.deals.filter(
    (d) => d.status === "changes_requested" && now - d.updatedAt.getTime() > 14 * DAY_MS
  ).length;

  if (openClauseComments > 0) reasons.push(`${openClauseComments} open clause change request${openClauseComments === 1 ? "" : "s"}`);
  if (overdueClientItems > 0) reasons.push(`${overdueClientItems} overdue commitment${overdueClientItems === 1 ? "" : "s"} from them`);
  if (stalledChangesRequested > 0) reasons.push(`a deal stuck in "changes requested" for 2+ weeks`);

  const highSignals = (openClauseComments >= 2 ? 1 : 0) + (overdueClientItems >= 2 ? 1 : 0) + stalledChangesRequested;
  const anySignal = openClauseComments > 0 || overdueClientItems > 0 || stalledChangesRequested > 0;

  if (highSignals > 0) return { level: "high", reasons };
  if (anySignal) return { level: "watch", reasons };
  return { level: "none", reasons: [] };
}
