import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  await requireSession();
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const workspace = { key: workspaceKey, isActive: true };
  const now = new Date();
  const reviewWindow = new Date(now);
  reviewWindow.setUTCDate(reviewWindow.getUTCDate() + 90);
  const [approved, drafts, reviewDue, attentionNeeded, recent, pending] = await Promise.all([
    db.promptVersion.count({ where: { status: "APPROVED", prompt: { workspace } } }),
    db.promptVersion.count({ where: { status: "DRAFT", prompt: { workspace } } }),
    db.promptVersion.count({ where: { status: "APPROVED", nextReviewAt: { gt: now, lte: reviewWindow }, prompt: { workspace } } }),
    db.promptVersion.count({ where: { status: "APPROVED", nextReviewAt: { lte: now }, prompt: { workspace } } }),
    db.prompt.findMany({
      where: { isActive: true, workspace, versions: { some: { status: "APPROVED" } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        category: true,
        versions: { where: { status: "APPROVED" }, orderBy: [{ major: "desc" }, { minor: "desc" }, { patch: "desc" }], take: 1 },
      },
    }),
    db.promptVersion.count({ where: { status: { in: ["DRAFT", "PILOT"] }, prompt: { workspace } } }),
  ]);
  const metrics = [["Approved", approved], ["Draft", drafts], ["Review Due", reviewDue], ["Attention Needed", attentionNeeded]] as const;
  return <><section className="hero"><div><span className="eyebrow">VOGARA PROMPT OS</span><h1>Governed intelligence, ready to use.</h1><p>Find the right approved prompt, understand where it fits, and move work forward without searching a spreadsheet.</p></div><Link className="button" href="/library">Open Library</Link></section><section className="metrics">{metrics.map(([label,value])=><div className="metric" key={label}><strong>{value}</strong><span>{label}</span></div>)}</section><section className="dashboard-grid"><div className="panel"><div className="panel-heading"><h2>Recently updated</h2><Link href="/library">View all</Link></div><div className="compact-list">{recent.map(prompt=>{const version=prompt.versions[0];return <div key={prompt.key} className="compact-row"><div><strong>{prompt.title}</strong><span>{prompt.category?.name ?? "Uncategorized"}</span></div><div className="version-pill">V{version.major}.{version.minor}{version.patch ? `.${version.patch}` : ""}</div></div>})}</div></div><div className="panel"><div className="panel-heading"><h2>Review queue</h2><span>{pending} pending</span></div><div className="empty-state"><strong>Governance at a glance</strong><p>Drafts, upcoming reviews and approval actions will surface here.</p></div></div></section></>;
}
