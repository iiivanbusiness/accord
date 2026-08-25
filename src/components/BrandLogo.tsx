import Image from "next/image";

export default function BrandLogo({ height = 20, className = "" }: { height?: number; className?: string }) {
  const width = Math.round((height * 1055) / 240);
  return (
    <>
      <Image src="/logo-light.png" alt="SealMe" width={width} height={height} priority className={`brand-logo-light w-auto ${className}`} style={{ height }} />
      <Image src="/logo-dark.png" alt="SealMe" width={width} height={height} priority className={`brand-logo-dark w-auto ${className}`} style={{ height }} />
    </>
  );
}
