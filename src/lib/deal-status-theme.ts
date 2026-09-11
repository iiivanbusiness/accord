// The Dashboard's per-status color mapping — nothing like this exists
// elsewhere in the app (deals/page.tsx's STATUS_CHIP only varies semantic
// *tone* — warn/active/success/neutral — not a distinct hue per status).
// Deliberately kept Dashboard-local rather than folded into deals/page.tsx's
// canonical maps, which this re-exports rather than duplicates, so there's
// still exactly one source of truth for the label/column-order concern.
export { STATUS_LABEL, BOARD_COLUMNS } from "@/lib/deal-status";

// Folder-icon fill colors — used ONLY by FolderIcon/DealStatusFolders.
// Deliberately fixed hex (not theme-varying CSS vars): the folder grid is
// the one deliberate spot of saturated color on the Dashboard, so it stays
// constant across light/dark instead of picking up the theme toggle. Every
// other Dashboard surface sticks to the two signature accents (green/cyan
// for success, violet for everything else) — see GlowRingStat/DealValueHeroCard.
export const STATUS_COLOR: Record<string, string> = {
  processing: "#4a90e2",
  missing_info: "#e0a72e",
  extraction_failed: "#e0524a",
  ready: "#8b6de0",
  pending_approval: "#e08a3d",
  changes_requested: "#e0568f",
  sent: "#2fb6a8",
  signed: "#4caf6e",
};
