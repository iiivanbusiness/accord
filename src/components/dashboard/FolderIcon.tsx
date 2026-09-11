// A single glossy, 3D Finder-style folder — one neutral chrome material
// (white/silver in light theme, dark charcoal in dark theme, via the
// --folder-* tokens in globals.css), not colored per status: every
// folder in the grid uses this exact same icon, matching the reference
// image where all folders share one material and only the label differs.
// Includes the white paper-corner detail peeking out of the front flap.
export default function FolderIcon({ id, size = 64 }: { id: string; size?: number }) {
  const gradId = `folder-grad-${id}`;
  const shadowId = `folder-shadow-${id}`;

  return (
    <svg width={size} height={(size * 40) / 48} viewBox="0 0 48 40" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradId} x1="6" y1="12" x2="42" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--folder-front-top)" }} />
          <stop offset="1" style={{ stopColor: "var(--folder-front-bottom)" }} />
        </linearGradient>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.4" floodColor="var(--folder-shadow)" floodOpacity="1" />
        </filter>
      </defs>
      <g filter={`url(#${shadowId})`}>
        {/* back panel — the folder silhouette including the small tab */}
        <path
          d="M6,8 a2,2 0 0 1 2,-2 H17 L21,10 H40 a2,2 0 0 1 2,2 V32 a2,2 0 0 1 -2,2 H8 a2,2 0 0 1 -2,-2 Z"
          style={{ fill: "var(--folder-back)" }}
        />
        {/* paper corner peeking out from behind the front flap */}
        <path d="M12,10.5 L27,8.5 L28.5,14 L13.5,15.8 Z" style={{ fill: "var(--folder-paper)" }} opacity="0.92" />
        {/* front flap — offset down, glossy gradient */}
        <path
          d="M6,14 a2,2 0 0 1 2,-2 H40 a2,2 0 0 1 2,2 V32 a2,2 0 0 1 -2,2 H8 a2,2 0 0 1 -2,-2 Z"
          fill={`url(#${gradId})`}
        />
        <path d="M9,13.4 H39" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round" />
      </g>
    </svg>
  );
}
