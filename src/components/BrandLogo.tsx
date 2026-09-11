import Image from "next/image";

// Icon + wordmark, side by side — the icon is the seal mark (its own
// light/dark PNG pair, swapped by theme via the brand-logo-light/dark CSS
// classes below), the wordmark is live text so it stays crisp at any size
// and picks up the theme's ink color automatically instead of needing a
// third baked image.
export default function BrandLogo({ height = 20, className = "" }: { height?: number; className?: string }) {
  const iconWidth = Math.round((height * 1261) / 619);
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: Math.round(height * 0.32) }}>
      <Image src="/logo-light.png" alt="" width={iconWidth} height={height} priority className="brand-logo-light" />
      <Image src="/logo-dark.png" alt="" width={iconWidth} height={height} priority className="brand-logo-dark" />
      <span
        className="font-brand"
        style={{ fontSize: Math.round(height * 0.85), lineHeight: 1, fontWeight: 800, color: "var(--ink)" }}
      >
        SealMe
      </span>
    </span>
  );
}
