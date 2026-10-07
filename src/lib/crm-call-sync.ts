import { prisma } from "@/lib/db";
import { CALL_OUTCOME_LABEL, UNREACHED_OUTCOMES } from "@/lib/call-outcomes";
import { salesforceGet, salesforceRequest, SALESFORCE_API_VERSION } from "@/lib/salesforce";
import { reportError } from "@/lib/error-report";

const HUBSPOT_API = "https://api.hubapi.com";
// HubSpot's own association type for call -> contact.
const HUBSPOT_CALL_TO_CONTACT = 194;

// HubSpot's built-in Lead Status values, by what happened on the call. A
// portal can switch values off, so each is checked against the portal's
// options before it's written.
export function hubspotLeadStatusFor(outcome: string): string | null {
  if (UNREACHED_OUTCOMES.has(outcome)) return "ATTEMPTED_TO_CONTACT";
  if (outcome === "meeting_booked" || outcome === "interested") return "IN_PROGRESS";
  if (outcome === "follow_up" || outcome === "wrong_person") return "CONNECTED";
  if (outcome === "not_interested") return "UNQUALIFIED";
  return null;
}

// Statuses a call shouldn't move a contact away from: the deal's already
// open, or someone closed it out on purpose.
const HUBSPOT_SETTLED = new Set(["OPEN_DEAL", "UNQUALIFIED"]);

// Salesforce Lead Status values are set up per org, so the target is picked
// from the org's own list by what it says: a "working / contacted" status
// for any call, a "closed, not converted" one when they said no.
export function salesforceLeadStatusFor(outcome: string, available: string[]): string | null {
  const find = (re: RegExp) => available.find((v) => re.test(v)) ?? null;
  if (outcome === "not_interested") return find(/not\s*converted|unqualified|disqualified/i);
  // "Open - Not Contacted" says contacted too, so it's ruled out by name.
  return find(/working/i) ?? available.find((v) => /contacted|attempt/i.test(v) && !/not\s+contacted/i.test(v)) ?? null;
}

// Statuses a call shouldn't overwrite: converted or closed leads.
const SALESFORCE_SETTLED = /converted|closed|qualified/i;

function callTitle(call: { mode: string; outcome: string | null }): string {
  if (call.mode === "sales") return "SealMe sales call";
  return `SealMe call: ${CALL_OUTCOME_LABEL[call.outcome ?? ""] ?? "Call"}`;
}

async function hubspot<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${HUBSPOT_API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers } });
  if (!res.ok) throw new Error(`HubSpot ${path.split("?")[0]} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

type CallForCrm = {
  id: string;
  mode: string;
  outcome: string | null;
  summary: string | null;
  durationSec: number | null;
  startedAt: Date;
  hubspotCallId: string | null;
  salesforceTaskId: string | null;
};

async function logToHubspot(token: string, contactId: string, call: CallForCrm): Promise<string> {
  const created = await hubspot<{ id: string }>(token, "/crm/v3/objects/calls", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        hs_timestamp: call.startedAt.toISOString(),
        hs_call_title: callTitle(call),
        hs_call_body: call.summary ?? "",
        hs_call_direction: "OUTBOUND",
        hs_call_status: "COMPLETED",
        ...(call.durationSec ? { hs_call_duration: String(call.durationSec * 1000) } : {}),
      },
      associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: HUBSPOT_CALL_TO_CONTACT }] }],
    }),
  });

  const target = call.outcome ? hubspotLeadStatusFor(call.outcome) : null;
  if (target) {
    const [property, contact] = await Promise.all([
      hubspot<{ options?: { value: string; hidden?: boolean }[] }>(token, "/crm/v3/properties/contacts/hs_lead_status"),
      hubspot<{ properties: { hs_lead_status?: string | null } }>(token, `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}?properties=hs_lead_status`),
    ]);
    const offered = (property.options ?? []).some((o) => o.value === target && !o.hidden);
    const current = contact.properties.hs_lead_status ?? "";
    if (offered && current !== target && !HUBSPOT_SETTLED.has(current)) {
      await hubspot(token, `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}`, { method: "PATCH", body: JSON.stringify({ properties: { hs_lead_status: target } }) });
    }
  }
  return created.id;
}

async function logToSalesforce(workspaceId: string, recordId: string, recordType: string | null, call: CallForCrm): Promise<string> {
  const base = `/services/data/${SALESFORCE_API_VERSION}/sobjects`;
  const core = {
    WhoId: recordId,
    Subject: callTitle(call),
    Description: call.summary ?? "",
    Status: "Completed",
    ActivityDate: call.startedAt.toISOString().slice(0, 10),
  };
  // The call-specific fields make it show up as a logged call; an org that
  // trimmed the Task picklists still gets a plain completed task.
  let res = await salesforceRequest(workspaceId, `${base}/Task`, {
    method: "POST",
    // No "Type": smaller editions (Starter) don't have that field at all.
    body: JSON.stringify({ ...core, TaskSubtype: "Call", CallType: "Outbound", ...(call.durationSec ? { CallDurationInSeconds: call.durationSec } : {}) }),
  });
  if (res.status === 400) res = await salesforceRequest(workspaceId, `${base}/Task`, { method: "POST", body: JSON.stringify(core) });
  if (!res.ok) throw new Error(`Salesforce Task creation failed: ${res.status} ${await res.text()}`);
  const task = (await res.json()) as { id: string };

  if (recordType !== "Contact" && call.outcome) {
    const describe = await salesforceGet<{ fields: { name: string; picklistValues?: { value: string; active: boolean }[] }[] }>(workspaceId, `${base}/Lead/describe`);
    const available = (describe.fields.find((f) => f.name === "Status")?.picklistValues ?? []).filter((p) => p.active).map((p) => p.value);
    const target = salesforceLeadStatusFor(call.outcome, available);
    if (target) {
      const lead = await salesforceGet<{ Status?: string | null; IsConverted?: boolean }>(workspaceId, `${base}/Lead/${encodeURIComponent(recordId)}?fields=Status,IsConverted`);
      const current = lead.Status ?? "";
      if (!lead.IsConverted && current !== target && !SALESFORCE_SETTLED.test(current)) {
        const patch = await salesforceRequest(workspaceId, `${base}/Lead/${encodeURIComponent(recordId)}`, { method: "PATCH", body: JSON.stringify({ Status: target }) });
        if (!patch.ok && patch.status !== 204) throw new Error(`Salesforce Lead status update failed: ${patch.status} ${await patch.text()}`);
      }
    }
  }
  return task.id;
}

// After a call is processed: the call and its summary go onto the lead in
// the CRM it came from, and its status there moves along. Only for leads
// that came from HubSpot or Salesforce, only while that integration is on,
// and only once per call. Never throws; a failure is reported and the call
// in SealMe is unaffected.
export async function pushCallToCrm(callId: string): Promise<void> {
  const call = await prisma.phoneCall.findUnique({
    where: { id: callId },
    select: {
      id: true,
      status: true,
      source: true,
      mode: true,
      outcome: true,
      summary: true,
      durationSec: true,
      startedAt: true,
      hubspotCallId: true,
      salesforceTaskId: true,
      lead: { select: { hubspotContactId: true, salesforceRecordId: true, salesforceRecordType: true } },
      workspace: { select: { id: true, hubspotEnabled: true, hubspotAccessToken: true, salesforceEnabled: true, salesforceRefreshToken: true } },
    },
  });
  // A call logged through the API came from the customer's own dialer,
  // which logs it to their CRM already.
  if (!call || call.status !== "processed" || !call.lead || call.source === "api") return;
  const { lead, workspace } = call;

  if (lead.hubspotContactId && workspace.hubspotEnabled && workspace.hubspotAccessToken && !call.hubspotCallId) {
    try {
      const hubspotCallId = await logToHubspot(workspace.hubspotAccessToken, lead.hubspotContactId, call);
      await prisma.phoneCall.update({ where: { id: call.id }, data: { hubspotCallId } });
    } catch (err) {
      await reportError(err, "Logging a call to HubSpot", { workspaceId: workspace.id, callId });
    }
  }

  if (lead.salesforceRecordId && workspace.salesforceEnabled && workspace.salesforceRefreshToken && !call.salesforceTaskId) {
    try {
      const salesforceTaskId = await logToSalesforce(workspace.id, lead.salesforceRecordId, lead.salesforceRecordType, call);
      await prisma.phoneCall.update({ where: { id: call.id }, data: { salesforceTaskId } });
    } catch (err) {
      await reportError(err, "Logging a call to Salesforce", { workspaceId: workspace.id, callId });
    }
  }
}
