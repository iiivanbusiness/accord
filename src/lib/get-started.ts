// "Get started" at the top of the Dashboard: the few things a new workspace
// does first, each one click from the place it's done, ticked off on its
// own once it's done. Only the steps this person can do are shown, so a
// rep never sees "Connect your CRM".

export type GetStartedStep = { id: string; title: string; hint: string; cta: string; href: string; done: boolean };

export type GetStartedInput = {
  hasDeal: boolean;
  hasSentContract: boolean;
  readyDealId: string | null; // a deal whose contract can go out now
  prospecting: boolean;
  hasLeads: boolean;
  phoneCalls: boolean; // the SealMe number is set up, so a rep's phone matters
  hasPhone: boolean;
  canManageWorkspace: boolean;
  crmConnected: boolean;
  canManageTeam: boolean;
  hasTeammate: boolean;
};

export function getStartedSteps(i: GetStartedInput): GetStartedStep[] {
  const steps: (GetStartedStep | false)[] = [
    { id: "deal", title: "Start your first deal", hint: "Paste a call transcript or record a call. SealMe pulls out what was agreed.", cta: "Start a deal", href: "/deals/new", done: i.hasDeal },
    {
      id: "contract",
      title: "Send your first contract",
      hint: "Check the contract SealMe drafted and send it for signature.",
      cta: i.readyDealId ? "Open the contract" : "Go to deals",
      href: i.readyDealId ? `/deals/${i.readyDealId}/contract` : "/deals",
      done: i.hasSentContract,
    },
    i.prospecting && { id: "leads", title: "Import your leads", hint: "Paste rows from a spreadsheet, or upload an Excel or CSV file.", cta: "Import leads", href: "/leads/import", done: i.hasLeads },
    i.prospecting && i.phoneCalls && { id: "phone", title: "Add your phone number", hint: "One time, takes a minute. Then a tap on Call rings you and connects your client.", cta: "Add number", href: "/settings#phone", done: i.hasPhone },
    i.canManageWorkspace && { id: "crm", title: "Connect your CRM", hint: "Clients and deals go to HubSpot on their own.", cta: "Connect", href: "/settings#crm", done: i.crmConnected },
    i.canManageTeam && { id: "team", title: "Invite a teammate", hint: "They get an email to set a password and join.", cta: "Invite", href: "/settings#team", done: i.hasTeammate },
  ];
  return steps.filter((s): s is GetStartedStep => Boolean(s));
}
