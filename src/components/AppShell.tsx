import Link from "next/link";
import { signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ThemeToggle from "./ThemeToggle";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/deals", label: "Deals", icon: DealsIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/analytics", label: "Analytics", icon: AnalyticsIcon },
  { href: "/clients", label: "Clients", icon: ClientsIcon },
  { href: "/templates", label: "Templates", icon: TemplatesIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default async function AppShell({
  active,
  screenLabel,
  children,
}: {
  active: (typeof NAV_ITEMS)[number]["href"];
  screenLabel: string;
  children: React.ReactNode;
}) {
  const workspace = await prisma.workspace.findFirst();
  const workspaceName = workspace?.name ?? "Workspace";

  return (
    <div className="sm-theme min-h-screen" style={{ background: "var(--canvas)" }}>
      <div className="grid min-h-screen" style={{ gridTemplateColumns: "76px 1fr" }}>
        <nav
          className="m-3.5 flex flex-col items-center gap-2 rounded-[20px] py-[18px]"
          style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)", boxShadow: "var(--shadow-card)" }}
        >
          <div
            className="mb-4 flex h-[34px] w-[34px] items-center justify-center rounded-[10px] font-display text-[15px] font-semibold"
            style={{ background: "var(--primary)", color: "var(--on-primary)" }}
          >
            S
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === active;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] transition-colors"
                style={
                  isActive
                    ? { background: "var(--surface-2)", color: "var(--ink)" }
                    : { color: "var(--ink-muted)" }
                }
              >
                <Icon />
              </Link>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-col">
          <header
            className="m-3.5 flex items-center justify-between rounded-[20px] px-[22px] py-[13px]"
            style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)", boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-center gap-2.5 text-[14px] font-medium" style={{ letterSpacing: "-0.14px" }}>
              <span style={{ color: "var(--ink)" }}>{workspaceName}</span>
              <span style={{ color: "var(--ink-muted)" }}>·</span>
              <span style={{ color: "var(--ink-muted)" }}>{screenLabel}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ThemeToggle />
              <div
                className="flex h-[29px] w-[29px] items-center justify-center rounded-full font-display text-[12px] font-semibold"
                style={{ background: "var(--surface-2)", color: "var(--ink)" }}
              >
                {initials(workspaceName)}
              </div>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button type="submit" className="text-[12.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
                  Sign out
                </button>
              </form>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1180px] flex-1 px-6 pb-16 pt-2">{children}</main>
        </div>
      </div>
    </div>
  );
}

function iconProps() {
  return { viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6, width: 19, height: 19 } as const;
}

function DashboardIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3" width="6.5" height="6.5" rx="1.4" />
      <rect x="10.5" y="3" width="6.5" height="4.2" rx="1.4" />
      <rect x="10.5" y="8.7" width="6.5" height="8.3" rx="1.4" />
      <rect x="3" y="11" width="6.5" height="6" rx="1.4" />
    </svg>
  );
}

function DealsIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3.5" width="14" height="4.2" rx="1.2" />
      <rect x="3" y="9.2" width="14" height="4.2" rx="1.2" />
      <rect x="3" y="14.9" width="9" height="2.6" rx="1.2" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="4.5" width="14" height="12" rx="1.6" />
      <path d="M3 8.5h14M7 2.5v3M13 2.5v3" />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 16V9M10 16V4M16 16v-6.5" />
      <path d="M2.5 16h15" />
    </svg>
  );
}

function ClientsIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="7.2" cy="6.8" r="2.6" />
      <circle cx="13.4" cy="8" r="2.1" />
      <path d="M2.6 16.2c.5-2.8 2.4-4.4 4.6-4.4s4.1 1.6 4.6 4.4" />
      <path d="M12.3 12.4c1.7.2 3 1.6 3.4 3.8" />
    </svg>
  );
}

function TemplatesIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="4.5" y="2.5" width="11" height="15" rx="1.4" />
      <path d="M7 7h6M7 10h6M7 13h3.5" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="10" cy="6" r="1.6" />
      <circle cx="10" cy="14" r="1.6" />
      <path d="M4 6h3.4M12.6 6H16M4 14h3.4M12.6 14H16M10 7.6v4.8" />
    </svg>
  );
}
