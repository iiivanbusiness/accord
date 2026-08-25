import { auth, signOut } from "@/lib/auth";
import { requireWorkspace } from "@/lib/workspace";
import { isAdminEmail } from "@/lib/admin";
import { NAV_ITEMS, ADMIN_ITEM } from "@/lib/nav-config";
import ThemeToggle from "./ThemeToggle";
import BrandLogo from "./BrandLogo";
import MobileNavDrawer from "./MobileNavDrawer";
import AppFooter from "./AppFooter";
import SidebarNav from "./SidebarNav";
import UpgradeCard from "./UpgradeCard";
import ScreenLabel from "./ScreenLabel";
import GlassPanel from "./GlassPanel";

const NAV_ICONS: Record<string, () => React.ReactNode> = {
  "/dashboard": DashboardIcon,
  "/deals": DealsIcon,
  "/calendar": CalendarIcon,
  "/analytics": AnalyticsIcon,
  "/clients": ClientsIcon,
  "/templates": TemplatesIcon,
  "/settings": SettingsIcon,
  "/admin": AdminIcon,
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const [workspace, session] = await Promise.all([requireWorkspace(), auth()]);
  const workspaceName = workspace.name;
  const isAdmin = isAdminEmail(session?.user?.email);
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

  const navItems = items.map((item) => {
    const Icon = NAV_ICONS[item.href];
    return { href: item.href, label: item.label, icon: <Icon /> };
  });

  const navLinks = <SidebarNav items={navItems} />;

  const workspaceFooter = (
    <div className="mt-4 flex flex-col gap-3 border-t pt-4" style={{ borderColor: "var(--hairline-soft)" }}>
      <div className="flex items-center gap-2.5 px-2">
        <div
          className="flex h-[29px] w-[29px] flex-none items-center justify-center rounded-full font-display text-[12px] font-semibold"
          style={{ background: "var(--surface-2)", color: "var(--ink)" }}
        >
          {initials(workspaceName)}
        </div>
        <span className="truncate text-[13px] font-medium" style={{ color: "var(--ink)" }}>{workspaceName}</span>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit" className="w-full rounded-[10px] px-3 py-2 text-left text-[13px] font-medium transition-colors" style={{ color: "var(--ink-muted)" }}>
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <div className="sm-theme min-h-dvh" style={{ background: "var(--canvas)" }}>
      <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[232px_1fr]">
        <GlassPanel
          as="nav"
          className="m-3.5 hidden rounded-[28px] px-3.5 py-[22px] md:flex md:sticky md:top-3.5 md:h-[calc(100dvh-28px)] md:self-start"
        >
          <div className="mb-7 px-2">
            <BrandLogo height={20} />
          </div>
          {navLinks}
          <UpgradeCard />
          {workspaceFooter}
        </GlassPanel>

        <div className="flex min-w-0 flex-col">
          <header
            className="m-3.5 flex items-center justify-between rounded-[20px] px-3.5 py-[13px] md:px-[22px]"
            style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)", boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <MobileNavDrawer>
                <div className="mb-7 px-1">
                  <BrandLogo height={20} />
                </div>
                {navLinks}
                <UpgradeCard />
                {workspaceFooter}
              </MobileNavDrawer>
              <ScreenLabel />
            </div>
            <ThemeToggle />
          </header>

          <main className="mx-auto w-full max-w-[1180px] flex-1 px-3.5 pt-2 md:px-6">{children}</main>
          <AppFooter />
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

function AdminIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M10 2.5l6 2.4v4.4c0 4-2.6 6.6-6 8.2-3.4-1.6-6-4.2-6-8.2V4.9l6-2.4z" />
      <path d="M7.4 10l1.9 1.9L12.7 8" />
    </svg>
  );
}
