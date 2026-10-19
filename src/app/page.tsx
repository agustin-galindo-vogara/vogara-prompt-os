import Link from "next/link";
import { auditActionLabel, formatDuration, reviewCycleMetrics } from "@/lib/analytics";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

function shortDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "America/Bogota" }).format(value);
}

export default async function DashboardPage() {
  await requireSession();
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const workspaceRecord = await db.workspace.findFirstOrThrow({ where: { key: workspaceKey, isActive: true } });
  const workspace = { key: workspaceKey, isActive: true };
  const now = new Date();
  const start90 = new Date(now);
  start90.setUTCDate(start90.getUTCDate() - 90);
  const [approved, drafts, inReview, overdue, reviewEvents, copyEvents, recentEvents, dueSoon] = await Promise.all([
    db.promptVersion.count({ where: { status: "APPROVED", prompt: { workspace } } }),
    db.promptVersion.count({ where: { status: "DRAFT", prompt: { workspace } } }),
    db.promptVersion.count({ where: { status: "PILOT", prompt: { workspace } } }),
    db.promptVersion.count({ where: { status: "APPROVED", nextReviewAt: { lte: now }, prompt: { workspace } } }),
    db.auditEvent.findMany({ where: { workspaceId: workspaceRecord.id, entityType: "PromptVersion", action: { in: ["SubmittedForApproval", "Approved", "ChangesRequested"] }, occurredAt: { gte: start90 } }, select: { entityId: true, action: true, occurredAt: true } }),
    db.auditEvent.findMany({ where: { workspaceId: workspaceRecord.id, action: "PromptCopied", occurredAt: { gte: start90 } }, select: { entityId: true } }),
    db.auditEvent.findMany({ where: { workspaceId: workspaceRecord.id }, orderBy: { occurredAt: "desc" }, take: 7 }),
    db.promptVersion.findMany({ where: { status: "APPROVED", nextReviewAt: { not: null }, prompt: { workspace } }, orderBy: { nextReviewAt: "asc" }, take: 5, include: { prompt: true } }),
  ]);
  const cycle = reviewCycleMetrics(reviewEvents);
  const copyCounts = new Map<string, number>();
  for (const event of copyEvents) copyCounts.set(event.entityId, (copyCounts.get(event.entityId) ?? 0) + 1);
  const copiedIds = [...copyCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5).map(([id]) => id);
  const activityIds = [...new Set(recentEvents.filter((event) => event.entityType === "PromptVersion").map((event) => event.entityId))];
  const versions = await db.promptVersion.findMany({ where: { id: { in: [...new Set([...copiedIds, ...activityIds])] } }, include: { prompt: true } });
  const versionById = new Map(versions.map((version) => [version.id, version]));
  const topCopied = copiedIds.map((id) => ({ version: versionById.get(id), count: copyCounts.get(id) ?? 0 })).filter((item) => item.version);
  const metrics = [["Approved", approved, "Reusable now"], ["In review", inReview, "Awaiting decision"], ["Drafts", drafts, "Work in progress"], ["Overdue", overdue, "Review date passed"]] as const;

  return <>
    <section className="hero dashboard-hero"><div><span className="eyebrow">VOGARA PROMPT OS</span><h1>Governance that can be measured.</h1><p>Monitor library health, approval flow and real prompt reuse from one operational view.</p></div><div className="hero-actions"><Link className="button" href="/library">Open Library</Link><Link className="button button--ghost" href="/analytics">View analytics</Link></div></section>
    <section className="metrics">{metrics.map(([label,value,detail])=><div className="metric" key={label}><strong>{value}</strong><span>{label}</span><small>{detail}</small></div>)}</section>
    <section className="dashboard-insights">
      <article className="panel insight-card"><span className="eyebrow">90-DAY GOVERNANCE</span><h2>Approval flow</h2><div className="insight-metrics"><div><strong>{cycle.approved}</strong><span>approved</span></div><div><strong>{cycle.approvalRate}%</strong><span>approval rate</span></div><div><strong>{formatDuration(cycle.averageHours)}</strong><span>average cycle</span></div></div><Link href="/analytics">Explore performance →</Link></article>
      <article className="panel"><div className="panel-heading"><h2>Most reused</h2><span>Last 90 days</span></div>{topCopied.length ? <div className="compact-list">{topCopied.map(({ version, count }) => version && <Link className="compact-row" href={`/library/${version.prompt.key}`} key={version.id}><div><strong>{version.prompt.title}</strong><span>V{version.major}.{version.minor}.{version.patch}</span></div><div className="usage-count">{count} copies</div></Link>)}</div> : <div className="empty-state"><strong>Usage tracking is active</strong><p>Copied prompts will appear here from now on.</p></div>}</article>
    </section>
    <section className="dashboard-grid dashboard-grid--operational">
      <article className="panel"><div className="panel-heading"><h2>Recent governance activity</h2><Link href="/analytics/audit">Open Audit Explorer</Link></div><div className="activity-list">{recentEvents.map((event) => { const version=versionById.get(event.entityId); return <div className="activity-row" key={event.id}><span className={`activity-dot activity-dot--${event.action.toLowerCase()}`}/><div><strong>{auditActionLabel(event.action)}</strong><p>{version?.prompt.title ?? event.entityType}</p></div><div><span>{event.actorEmail ?? "System"}</span><time>{shortDate(event.occurredAt)}</time></div></div>})}</div></article>
      <article className="panel"><div className="panel-heading"><h2>Review calendar</h2><Link href="/library">View library</Link></div><div className="compact-list">{dueSoon.map((version) => <Link className="compact-row" href={`/library/${version.prompt.key}`} key={version.id}><div><strong>{version.prompt.title}</strong><span>{version.nextReviewAt && version.nextReviewAt <= now ? "Overdue" : "Scheduled review"}</span></div><div className={version.nextReviewAt && version.nextReviewAt <= now ? "date-pill date-pill--overdue" : "date-pill"}>{version.nextReviewAt ? shortDate(version.nextReviewAt) : "—"}</div></Link>)}</div>{!dueSoon.length && <div className="empty-state">No scheduled reviews.</div>}</article>
    </section>
  </>;
}
