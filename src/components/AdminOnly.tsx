import Link from "next/link";
import { prisma } from "@/lib/db";

// What someone without admin rights sees on an admin-only settings page
// (reached from a shared link or a bookmark): who can do it for them,
// instead of an error page.
export default async function AdminOnly({ workspaceId, title, what }: { workspaceId: string; title: string; what: string }) {
  const admins = await prisma.user.findMany({
    where: { workspaceId, deactivatedAt: null, role: { canManageWorkspace: true } },
    select: { id: true, name: true, email: true },
    orderBy: [{ role: { isOwner: "desc" } }, { name: "asc" }],
    take: 3,
  });

  return (
    <>
      <div className="mb-6">
        <Link href="/settings" className="text-[12.5px] font-medium" style={{ color: "var(--accent-blue)" }}>← Settings</Link>
        <h1 className="mt-2 text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>{title}</h1>
      </div>

      <div className="card max-w-[560px] px-[22px] py-5">
        <h2 className="text-[15px] font-medium">Only workspace admins can {what}</h2>
        <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          {admins.length === 0 ? (
            "Ask an admin of your workspace to do it for you, or to give you admin access."
          ) : (
            <>
              Ask{" "}
              {admins.map((a, i) => (
                <span key={a.id}>
                  {i > 0 && (i === admins.length - 1 ? " or " : ", ")}
                  <a href={`mailto:${a.email}`} className="font-medium" style={{ color: "var(--accent-blue)" }}>{a.name}</a>
                </span>
              ))}{" "}
              to do it for you, or to give you admin access.
            </>
          )}
        </p>
        <Link href="/settings" className="btn btn-secondary btn-sm mt-4 inline-flex">Back to Settings</Link>
      </div>
    </>
  );
}
