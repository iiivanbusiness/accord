export default function BrandLogo({ height = 20, className = "" }: { height?: number; className?: string }) {
  return (
    <>
      <img src="/logo-light.png" alt="SealMe" className={`brand-logo-light w-auto ${className}`} style={{ height }} />
      <img src="/logo-dark.png" alt="SealMe" className={`brand-logo-dark w-auto ${className}`} style={{ height }} />
    </>
  );
}
