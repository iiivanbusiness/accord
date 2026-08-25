export default function GlassPanel({
  as: Tag = "div",
  className = "",
  children,
}: {
  as?: "div" | "nav";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag className={`glass-nav relative flex-col ${className}`}>
      <div className="glass-nav-blur" aria-hidden="true" />
      <div className="glass-glow-layer" aria-hidden="true">
        <div className="glass-glow glass-glow-1" />
        <div className="glass-glow glass-glow-2" />
        <div className="glass-glow glass-glow-3" />
      </div>
      <div className="relative z-10 flex flex-1 flex-col overflow-y-auto">{children}</div>
    </Tag>
  );
}
