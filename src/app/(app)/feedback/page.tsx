import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { requireWorkspaceId } from "@/lib/workspace";
import FeedbackStatusSelect from "@/components/FeedbackStatusSelect";
import { submitFeedback, toggleVote } from "./actions";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In progress",
  done: "Done",
  closed: "Closed",
};

const STATUS_CHIP: Record<string, string> = {
  open: "chip-neutral",
  planned: "chip-active",
  in_progress: "chip-warn",
  done: "chip-success",
  closed: "chip-neutral",
};

const ROADMAP_STATUSES = ["planned", "in_progress", "done"] as const;

function ModeTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="btn btn-sm"
      style={active ? { background: "var(--primary)", color: "var(--on-primary)" } : { background: "var(--surface-1)", border: "1px solid var(--hairline)", color: "var(--ink-muted)" }}
    >
      {children}
    </Link>
  );
}

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const isRoadmap = view === "roadmap";

  // This board is deliberately shared across every SealMe workspace — the
  // page itself still lives under the normal workspace-gated layout (so
  // only signed-in customers can post/vote), requireWorkspaceId() here is
  // just that auth check, not a data filter.
  await requireWorkspaceId();
  const session = await auth();
  const isAdmin = isAdminEmail(session?.user?.email);
  const currentUserId = session?.user?.email
    ? (await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }))?.id
    : undefined;

  const posts = await prisma.feedbackPost.findMany({
    include: {
      author: { select: { name: true } },
      votes: { select: { userId: true } },
    },
    orderBy: [{ votes: { _count: "desc" } }, { createdAt: "desc" }],
  });

  const grouped = isRoadmap
    ? ROADMAP_STATUSES.map((status) => ({ status, posts: posts.filter((p) => p.status === status) }))
    : null;

  return (
    <>
      <div className="mb-6 max-w-[560px]">
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>Feedback</h1>
        <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          Tell us what to build next — upvote what matters most to you.
        </div>
      </div>

      <div className="mb-5 flex gap-2">
        <ModeTab href="/feedback" active={!isRoadmap}>All feedback</ModeTab>
        <ModeTab href="/feedback?view=roadmap" active={isRoadmap}>Roadmap</ModeTab>
      </div>

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3">
          {isRoadmap
            ? grouped!.map(({ status, posts: statusPosts }) => (
                <div key={status} className="card p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-[13px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
                    <span className={`chip ${STATUS_CHIP[status]}`}>
                      <span className="chip-dot" />
                      {STATUS_LABEL[status]}
                    </span>
                    <span>({statusPosts.length})</span>
                  </h2>
                  {statusPosts.length === 0 ? (
                    <p className="text-[13px]" style={{ color: "var(--ink-muted)" }}>Nothing here yet.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {statusPosts.map((post) => (
                        <FeedbackCard key={post.id} post={post} currentUserId={currentUserId} isAdmin={isAdmin} />
                      ))}
                    </div>
                  )}
                </div>
              ))
            : posts.length === 0
              ? (
                <div className="card p-6 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
                  No feedback yet — be the first to suggest something.
                </div>
              )
              : posts.map((post) => (
                  <FeedbackCard key={post.id} post={post} currentUserId={currentUserId} isAdmin={isAdmin} />
                ))}
        </div>

        <div className="flex flex-col gap-4">
          <form action={submitFeedback} className="card flex flex-col gap-3 p-5">
            <h2 className="text-[13px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
              Suggest something
            </h2>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Title</span>
              <input name="title" required maxLength={120} placeholder="Bar code scanning" className="input" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Details <span style={{ color: "var(--ink-muted)", fontWeight: 400 }}>(optional)</span></span>
              <textarea name="description" rows={4} placeholder="What would this help you do?" className="input" />
            </label>
            <button type="submit" className="btn btn-primary w-full justify-center">
              Submit
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

type PostWithVotes = {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: Date;
  author: { name: string };
  votes: { userId: string }[];
};

function FeedbackCard({ post, currentUserId, isAdmin }: { post: PostWithVotes; currentUserId: string | undefined; isAdmin: boolean }) {
  const hasVoted = currentUserId ? post.votes.some((v) => v.userId === currentUserId) : false;
  const voteCount = post.votes.length;

  return (
    <div className="card flex gap-4 p-5">
      <form action={toggleVote.bind(null, post.id)}>
        <button
          type="submit"
          className="flex w-[54px] flex-none flex-col items-center gap-0.5 rounded-[12px] py-2 text-[13px] font-medium transition-colors"
          style={hasVoted
            ? { background: "var(--primary)", color: "var(--on-primary)" }
            : { background: "var(--surface-2)", color: "var(--ink-muted)" }}
        >
          <span aria-hidden="true">▲</span>
          {voteCount}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-[14.5px] font-medium">{post.title}</h3>
          {isAdmin ? (
            <FeedbackStatusSelect postId={post.id} status={post.status} />
          ) : (
            <span className={`chip ${STATUS_CHIP[post.status]}`}>
              <span className="chip-dot" />
              {STATUS_LABEL[post.status]}
            </span>
          )}
        </div>
        {post.description && (
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>{post.description}</p>
        )}
        <div className="mt-2 text-[12px]" style={{ color: "var(--ink-muted)" }}>
          {post.author.name} · {timeAgo(post.createdAt)}
        </div>
      </div>
    </div>
  );
}
