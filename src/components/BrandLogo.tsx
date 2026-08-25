import Image from "next/image";

export default function BrandLogo({ height = 20, className = "" }: { height?: number; className?: string }) {
  const width = Math.round((height * 1055) / 240);
  return (
    <>
      <Image src="/logo-light.png" alt="SealMe" width={width} height={height} priority className={`brand-logo-light ${className}`} />
      <Image src="/logo-dark.png" alt="SealMe" width={width} height={height} priority className={`brand-logo-dark ${className}`} />
    </>
  );
}
