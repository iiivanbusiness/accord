// The setup guide at the top of the Dashboard: the few things a new person
// does first, each one click from the place it's done. Steps tick off on
// their own once done; "look at this" steps tick off once the person has
// opened that place from the guide (seenDone, kept in their browser). Only
// the steps this person can do are shown, so a rep never sees "Connect
// your CRM".

export type GetStartedStep = {
  id: string;
  title: string;
  hint: string;
  cta: string;
  href: string;
  done: boolean;
  // Done once they've opened it from the guide (see GuideTip).
  seenDone?: boolean;
  // Shown under the list and not counted: not every team needs it.
  optional?: boolean;
};

export type GetStartedInput = {
  hasDeal: boolean;
  hasSentContract: boolean;
  readyDealId: string | null; // a deal whose contract can go out now
  prospecting: boolean;
  hasCall: boolean; // this person has a written-up call
  callLeadId: string | null; // the lead their latest call is on
  phoneCalls: boolean; // the SealMe number is set up, so a rep's phone matters
  hasPhone: boolean;
  canManageWorkspace: boolean;
  crmConnected: boolean;
  canManageTeam: boolean;
  hasTeammate: boolean;
};

export function getStartedSteps(i: GetStartedInput): GetStartedStep[] {
  const contract: GetStartedStep = {
    id: "contract",
    title: "Send your first contract",
    hint: "Check the contract SealMe drafted and send it for signature.",
    cta: i.readyDealId ? "Open the contract" : "Go to deals",
    href: i.readyDealId ? `/deals/${i.readyDealId}/contract` : "/deals",
    done: i.hasSentContract,
  };
  const admin: (GetStartedStep | false)[] = [
    i.canManageWorkspace && { id: "crm", title: "Connect your CRM", hint: "Call notes, clients and deals go to HubSpot or Salesforce on their own.", cta: "Connect", href: "/settings#crm", done: i.crmConnected },
    i.canManageTeam && { id: "team", title: "Invite your team", hint: "They get an email to set a password and join.", cta: "Invite", href: "/settings#team", done: i.hasTeammate },
  ];

  // Without prospecting SealMe is deals and contracts only.
  if (!i.prospecting) {
    const steps: (GetStartedStep | false)[] = [
      { id: "deal", title: "Start your first deal", hint: "Paste a call transcript or record a call. SealMe pulls out what was agreed.", cta: "Start a deal", href: "/deals/new", done: i.hasDeal },
      contract,
      ...admin,
    ];
    return steps.filter((s): s is GetStartedStep => Boolean(s));
  }

  // Calls first: every team starts from a call, and contracts only matter
  // to the teams that send them.
  const steps: (GetStartedStep | false)[] = [
    {
      id: "call",
      title: "Add your first call",
      hint: "In Calls, drop a recording or video of a call, keep Notes only and press Process. SealMe writes the notes.",
      cta: "Go to Calls",
      href: "/calls?guide=calls",
      done: i.hasCall || i.hasDeal,
    },
    {
      id: "lead",
      title: "Open the client's file",
      hint: "Every call with a client is on one lead: where things stand, each call's notes, and Copy all notes.",
      cta: "Open it",
      href: i.callLeadId ? `/leads/${i.callLeadId}?guide=lead` : "/leads?guide=lead",
      done: false,
      seenDone: true,
    },
    {
      id: "todo",
      title: "Check your to-do list",
      hint: "Next steps agreed on a call land here on their day, in the order your day happens.",
      cta: "Show me",
      href: "/dashboard?guide=todo#todo",
      done: false,
      seenDone: true,
    },
    {
      id: "leads",
      title: "Find any client in Leads",
      hint: "Search by name or company, see who you talked to last, or import a list you already have.",
      cta: "Go to Leads",
      href: "/leads?guide=leads",
      done: false,
      seenDone: true,
    },
    i.phoneCalls && { id: "phone", title: "Add your phone number", hint: "One time, takes a minute. Then a tap on Call rings you and connects your client.", cta: "Add number", href: "/settings#phone", done: i.hasPhone },
    ...admin,
    // Once they've made a deal, contracts are part of their work.
    i.hasDeal
      ? contract
      : {
          id: "contracts",
          title: "Need contracts too?",
          hint: "On Start a call, pick Notes and contract and SealMe drafts it from what was agreed.",
          cta: "See how",
          href: "/deals/new?guide=contracts",
          done: false,
          optional: true,
        },
  ];
  return steps.filter((s): s is GetStartedStep => Boolean(s));
}

// Where "seen" steps are kept: in the browser, per person, as a list of ids.
export const GUIDE_SEEN_KEY = "sealme.guide.seen";
