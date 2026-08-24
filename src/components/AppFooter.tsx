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
        style={{ height: "9vw", minHeight: 60, maxHeight: 170, background: "var(--canvas)" }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/wordmark.png"
          alt=""
          className="absolute top-0"
          style={{ width: "46vw", minWidth: 320, maxWidth: 620, opacity: 0.06, filter: "invert(var(--wordmark-invert))" }}
        />
      </div>
    </footer>
  );
}
