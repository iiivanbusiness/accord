import InstagramIcon from "./InstagramIcon";

export default function AppFooter() {
  return (
    <footer className="mt-10 flex flex-col">
      <div
        className="mx-3.5 flex flex-wrap items-center justify-between gap-3 border-t px-1.5 py-4 text-[12.5px]"
        style={{ borderColor: "var(--hairline)", color: "var(--ink-muted)" }}
      >
        <span>© {new Date().getFullYear()} SealMe</span>
        <div className="flex items-center gap-4">
          <a
            href="mailto:hello@sealme.net"
            className="transition-colors hover:opacity-70"
            style={{ color: "var(--ink-muted)" }}
          >
            hello@sealme.net
          </a>
          <a
            href="https://www.instagram.com/join.sealme/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:opacity-70"
            style={{ color: "var(--ink-muted)" }}
          >
            <InstagramIcon />
            @join.sealme
          </a>
        </div>
      </div>

      <div
        className="relative flex select-none justify-center overflow-hidden"
        style={{ height: "12vw", minHeight: 80, maxHeight: 220, background: "var(--canvas)" }}
        aria-hidden="true"
      >
        <span
          className="font-brand absolute top-0"
          style={{ fontSize: "clamp(72px, 17vw, 260px)", lineHeight: 1, fontWeight: 800, opacity: 0.06, color: "var(--ink)" }}
        >
          SealMe
        </span>
      </div>
    </footer>
  );
}
