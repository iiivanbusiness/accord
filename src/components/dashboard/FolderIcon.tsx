// A single glossy, 3D Finder-style folder shape (back panel w/ tab notch +
// an overlapping front flap with its own gradient + highlight stroke),
// reused for every status with only the fill color swapped in — this is
// the literal folder icon the redesign was missing, matching the
// reference image's file-manager grid instead of an abstract icon tile.
function mix(hex: string, target: number, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const m = (c: number) => Math.round(c + (target - c) * amount);
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}

const lighten = (hex: string, amount: number) => mix(hex, 255, amount);
const darken = (hex: string, amount: number) => mix(hex, 0, amount);

export default function FolderIcon({ color, id, size = 56 }: { color: string; id: string; size?: number }) {
  const gradId = `folder-grad-${id}`;
  const shadowId = `folder-shadow-${id}`;

  return (
    <svg width={size} height={(size * 40) / 48} viewBox="0 0 48 40" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradId} x1="6" y1="12" x2="42" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={lighten(color, 0.28)} />
          <stop offset="1" stopColor={darken(color, 0.06)} />
        </linearGradient>
        <filter id={shadowId} x="-20%" y="-10%" width="140%" height="150%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.4" floodColor={color} floodOpacity="0.35" />
        </filter>
      </defs>
      <g filter={`url(#${shadowId})`}>
        {/* back panel — the folder silhouette including the small tab */}
        <path
          d="M6,8 a2,2 0 0 1 2,-2 H17 L21,10 H40 a2,2 0 0 1 2,2 V32 a2,2 0 0 1 -2,2 H8 a2,2 0 0 1 -2,-2 Z"
          fill={darken(color, 0.24)}
        />
        {/* front flap — offset down, glossy gradient */}
        <path
          d="M6,14 a2,2 0 0 1 2,-2 H40 a2,2 0 0 1 2,2 V32 a2,2 0 0 1 -2,2 H8 a2,2 0 0 1 -2,-2 Z"
          fill={`url(#${gradId})`}
        />
        <path d="M9,13.4 H39" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeLinecap="round" />
      </g>
    </svg>
  );
}
