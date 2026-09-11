// A single glossy, 3D Finder-style folder — one neutral chrome material
// (white/silver in light theme, dark charcoal in dark theme, via the
// --folder-* tokens in globals.css), not colored per status: every
// folder in the grid uses this exact same icon, matching the reference
// image where all folders share one material and only the label differs.
// Multiple gradient/highlight layers (not just a flat two-tone fill) are
// what sell the glossy/3D read the flatter first pass was missing.
export default function FolderIcon({ id, size = 64 }: { id: string; size?: number }) {
  const gradId = `folder-grad-${id}`;
  const sheenId = `folder-sheen-${id}`;
  const shadowId = `folder-shadow-${id}`;

  return (
    <svg width={size} height={(size * 42) / 48} viewBox="0 0 48 42" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradId} x1="6" y1="12" x2="43" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--folder-front-top)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--folder-front-mid)" }} />
          <stop offset="1" style={{ stopColor: "var(--folder-front-bottom)" }} />
        </linearGradient>
        <radialGradient id={sheenId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(16 17) rotate(35) scale(17 9)">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.6" floodColor="var(--folder-shadow)" floodOpacity="1" />
        </filter>
      </defs>
      <g filter={`url(#${shadowId})`}>
        {/* back panel — the folder silhouette including the small tab */}
        <path
          d="M6,9 a3,3 0 0 1 3,-3 H17 L21.5,10.5 H39 a3,3 0 0 1 3,3 V33 a3,3 0 0 1 -3,3 H9 a3,3 0 0 1 -3,-3 Z"
          style={{ fill: "var(--folder-back)" }}
        />
        {/* paper corner peeking out from behind the front flap */}
        <path d="M12,11 L28,9 L29.5,14.5 L13.5,16.5 Z" style={{ fill: "var(--folder-paper)" }} opacity="0.92" />
        {/* front flap — offset down, glossy multi-stop gradient */}
        <path
          d="M6,15 a3,3 0 0 1 3,-3 H39 a3,3 0 0 1 3,3 V33 a3,3 0 0 1 -3,3 H9 a3,3 0 0 1 -3,-3 Z"
          fill={`url(#${gradId})`}
        />
        {/* glossy sheen — a soft highlight blob, not a flat fill */}
        <path
          d="M6,15 a3,3 0 0 1 3,-3 H39 a3,3 0 0 1 3,3 V33 a3,3 0 0 1 -3,3 H9 a3,3 0 0 1 -3,-3 Z"
          fill={`url(#${sheenId})`}
        />
        <path d="M9.5,14.2 H38.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1" strokeLinecap="round" />
      </g>
    </svg>
  );
}
