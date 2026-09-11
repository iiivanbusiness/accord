// The Dashboard's per-status color mapping — nothing like this exists
// elsewhere in the app (deals/page.tsx's STATUS_CHIP only varies semantic
// *tone* — warn/active/success/neutral — not a distinct hue per status).
// Deliberately kept Dashboard-local rather than folded into deals/page.tsx's
// canonical maps, which this re-exports rather than duplicates, so there's
// still exactly one source of truth for the label/column-order concern.
export { STATUS_LABEL, BOARD_COLUMNS } from "@/lib/deal-status";

// Each resolves to a CSS custom property defined in globals.css (both the
// light .sm-theme block and the :root[data-theme="dark"] .sm-theme block),
// same nesting convention as every other themed token in this app — these
// are not fixed hex values in JS, they pick up the current theme via CSS.
export const STATUS_COLOR: Record<string, string> = {
  processing: "var(--status-processing)",
  missing_info: "var(--status-missing-info)",
  extraction_failed: "var(--status-extraction-failed)",
  ready: "var(--status-ready)",
  pending_approval: "var(--status-pending-approval)",
  changes_requested: "var(--status-changes-requested)",
  sent: "var(--status-sent)",
  signed: "var(--status-signed)",
};
