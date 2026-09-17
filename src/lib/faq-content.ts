import { NAV_ITEMS } from "@/lib/nav-config";

// Canned Q&A for the FAQ chat widget (see FaqChatWidget.tsx). No AI call,
// no cost — this is a static lookup the user clicks through. Answers are
// grounded in what the app actually does; keep this file in sync with real
// behavior instead of writing aspirational copy.

export type FaqQuestion = {
  question: string;
  answer: string;
};

export type FaqCategory = {
  id: string;
  label: string;
  questions: FaqQuestion[];
};

// Flattened into plain text and used as the grounding facts for the
// freeform AI support chat's system prompt (see support-chat/route.ts) —
// one source of truth for what the product actually does, instead of
// letting the model guess at features.
// Where things actually are in the app, so the AI chat can answer
// navigation questions ("where do I connect Salesforce", "where are my
// deals") without needing any account data. This is app structure, not
// account content, so it stays fine under the no-account-access rule.
export function appNavigationText(): string {
  const sidebar = NAV_ITEMS.map((item) => `${item.label} (${item.href})`).join(", ");
  return (
    `Left sidebar, top to bottom: ${sidebar}.\n\n` +
    "Deals: click Deals in the sidebar, or go to /deals. Table and Board views, filterable by status and owner. " +
    "Click + Start a call to begin a new deal, either recording locally, pasting a transcript, or entering details by hand.\n\n" +
    "Clients: Clients in the sidebar lists every client across all deals.\n\n" +
    "Contract templates: Templates in the sidebar, where you create and edit the templates deals are built from.\n\n" +
    "Everything below lives on the Settings page (Settings in the sidebar), as separate sections you scroll through:\n" +
    "- Workspace name and logo\n" +
    "- Team: invite teammates, assign roles, set up teams and approval chains, assign approval backups\n" +
    "- Access & provisioning: restrict sign-ups to an email domain, SCIM provisioning, single sign-on (OIDC)\n" +
    "- Integrations, each its own row with a Connect button: Slack, HubSpot, DocuSign, Salesforce\n" +
    "- Bulk import: bring clients and deals in from a CSV\n" +
    "- API & webhooks: generate API keys, set up webhook endpoints\n" +
    "- Two-factor authentication\n" +
    "- Plan & usage: calls used this month, AI chat messages used this month, request an upgrade\n" +
    "- Sending domain: verify your own domain so contracts go out as you\n" +
    "- Notification toggles: require manual approval before sending, email me when signed, auto-remind clients, signing/reminder timing\n" +
    "- Delete account\n\n" +
    "To connect or check a CRM/integration (Salesforce, HubSpot, Slack, DocuSign): go to Settings and find that " +
    "integration's row, it shows Connect if not linked yet, or who it's connected as if it already is."
  );
}

export function faqKnowledgeText(): string {
  return FAQ_CATEGORIES.map(
    (category) =>
      `## ${category.label}\n` +
      category.questions.map((q) => `Q: ${q.question}\nA: ${q.answer}`).join("\n\n")
  ).join("\n\n");
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "recording",
    label: "Recording calls",
    questions: [
      {
        question: "How does SealMe record a call?",
        answer:
          "Locally, from your computer. It captures your microphone and system audio, so it works with any call platform, Zoom, Meet, Teams, Discord, since nothing joins the call as a visible participant.",
      },
      {
        question: "Does the other person need to install anything?",
        answer: "No. Only you, as the person running the call, need the SealMe desktop app.",
      },
      {
        question: "What happens if my internet drops mid-call?",
        answer:
          "The recording is saved locally and uploaded in the background in short chunks, about once a minute, so a brief connection drop doesn't lose what was already captured.",
      },
      {
        question: "Do I need to tell the other person I'm recording?",
        answer:
          "In most places, yes, the other party needs to know a call is being recorded. Since SealMe no longer joins as a visible bot, that notice is on you to give at the start of the call.",
      },
    ],
  },
  {
    id: "ai-contracts",
    label: "AI and contracts",
    questions: [
      {
        question: "How does SealMe build a contract from a call?",
        answer:
          "AI reads the call transcript and fills in the client, service, price, and other terms into your contract template automatically.",
      },
      {
        question: "What if the AI gets a detail wrong?",
        answer: "Every field can be edited by hand before you send anything. AI fills it in, you confirm it.",
      },
      {
        question: "Can I skip the call and just paste a transcript?",
        answer: "Yes, or you can enter the deal details manually with no call or transcript at all.",
      },
    ],
  },
  {
    id: "approvals",
    label: "Team approvals",
    questions: [
      {
        question: "Who needs to approve a contract before it goes to the client?",
        answer:
          "Whoever you put in the approval chain for that team or deal size. A contract can require one person's approval or several, in order.",
      },
      {
        question: "What if the approver is out of office?",
        answer: "You can assign them a backup teammate who takes over their approvals while they're away.",
      },
    ],
  },
  {
    id: "signing",
    label: "Signing",
    questions: [
      {
        question: "How does the client sign the contract?",
        answer: "Through SealMe's built-in signing flow, or through your own DocuSign account if you connect one in Settings.",
      },
      {
        question: "What happens once a contract is signed?",
        answer:
          "The deal status becomes Signed, your team is notified by email or Slack, and this is also the last time SealMe syncs that deal to your CRM.",
      },
    ],
  },
  {
    id: "crm",
    label: "CRM integrations",
    questions: [
      {
        question: "Does every call sync to Salesforce or HubSpot in real time?",
        answer:
          "No, not while the call is happening. Syncing happens at three points: when the deal is created, when it clears approval, and when it's signed.",
      },
      {
        question: "What happens in the CRM after a contract is signed?",
        answer:
          "Nothing further from SealMe's side. The client becomes a Closed Won opportunity, and any tracking after that point is up to your CRM, not SealMe.",
      },
      {
        question: "Is the sync two-way?",
        answer: "No, it's one-directional. SealMe pushes data to Salesforce or HubSpot; SealMe stays the source of truth until signing.",
      },
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    questions: [
      {
        question: "How do I know when a contract is signed?",
        answer: "By email, if you've turned that on in Settings, and by Slack if you've connected a Slack channel.",
      },
      {
        question: "What is auto-remind?",
        answer: "If a client hasn't signed after a few days, SealMe sends them one automatic reminder.",
      },
    ],
  },
  {
    id: "billing",
    label: "Plan and usage",
    questions: [
      {
        question: "How many calls can I run on my plan?",
        answer:
          "It depends on your plan, for example Growth includes 15 calls a month per workspace. Once you hit that limit, you can't start a new deal until you upgrade.",
      },
      {
        question: "How do I upgrade?",
        answer: "Click Request upgrade in Settings, and your account contact will follow up.",
      },
    ],
  },
  {
    id: "privacy",
    label: "Security and privacy",
    questions: [
      {
        question: "Is my data used to train AI models?",
        answer:
          "No. Anthropic and Deepgram process call audio and transcripts under contract with SealMe, and they're not permitted to use that data to train their own models unless you explicitly opt in.",
      },
      {
        question: "How long is raw call audio kept?",
        answer:
          "Only as long as needed to transcribe it and extract the deal terms. After that it's deleted or reduced to a text transcript, unless you've configured a longer retention period.",
      },
      {
        question: "Is two-factor authentication available?",
        answer: "Yes, you can turn it on in Settings.",
      },
    ],
  },
  {
    id: "account",
    label: "Account and team",
    questions: [
      {
        question: "How do I invite a teammate?",
        answer: "Go to Settings, Team, and send an invite. They'll sign in with Google using that email address.",
      },
      {
        question: "Can I restrict who signs up?",
        answer: "Yes, you can restrict invites and sign-ups to a specific email domain in Settings.",
      },
    ],
  },
];
