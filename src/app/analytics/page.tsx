import Link from "next/link";
import { formatDuration, reviewCycleMetrics } from "@/lib/analytics";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSession();
  const query = await searchParams;
  const period = query.period === "30" || query.period === "365" ? Number(query.period) : 90;
  const categoryKey = query.category?.trim() || "all";
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - period);
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const workspaceRecord = await db.workspace.findFirstOrThrow({ where: { key: workspaceKey, isActive: true } });
  const categories = await db.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const promptFilter = { workspace: { key: workspaceKey, isActive: true }, ...(categoryKey !== "all" ? { category: { key: categoryKey } } : {}) };
  const scopedVersions = await db.promptVersion.findMany({ where: { prompt: promptFilter }, select: { id: true } });
  const scopedIds = scopedVersions.map((version) => version.id);
  const eventWhere = { workspaceId: workspaceRecord.id, occurredAt: { gte: since }, ...(categoryKey !== "all" ? { entityType: "PromptVersion", entityId: { in: scopedIds } } : {}) };
  const [prompts, approved, openVersions, overdue, events, stages, standards, components] = await Promise.all([
    db.prompt.count({ where: { ...promptFilter, isActive: true } }),
    db.promptVersion.count({ where: { status: "APPROVED", prompt: promptFilter } }),
    db.promptVersion.count({ where: { status: { in: ["DRAFT", "PILOT"] }, prompt: promptFilter } }),
    db.promptVersion.count({ where: { status: "APPROVED", nextReviewAt: { lte: new Date() }, prompt: promptFilter } }),
    db.auditEvent.findMany({ where: eventWhere, orderBy: { occurredAt: "asc" }, select: { entityId: true, action: true, occurredAt: true } }),
    db.flightPathStage.findMany({ orderBy: { stageNumber: "asc" }, include: { _count: { select: { versions: { where: { promptVersion: { status: "APPROVED", prompt: promptFilter } } } } } } }),
    db.standard.findMany({ include: { versions: { where: { isActive: true }, include: { _count: { select: { prompts: { where: { promptVersion: { status: "APPROVED", prompt: promptFilter } } } } } } } } }),
    db.component.findMany({ include: { versions: { where: { isActive: true }, include: { _count: { select: { prompts: { where: { promptVersion: { status: "APPROVED", prompt: promptFilter } } } } } } } } }),
  ]);
  const reviewEvents = events.filter((event) => ["SubmittedForApproval", "Approved", "ChangesRequested"].includes(event.action));
  const cycle = reviewCycleMetrics(reviewEvents);
  const copies = events.filter((event) => event.action === "PromptCopied");
  const copyCounts = new Map<string, number>();
  for (const event of copies) copyCounts.set(event.entityId, (copyCounts.get(event.entityId) ?? 0) + 1);
  const topCopyIds = [...copyCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 8).map(([id]) => id);
  const copiedVersions = await db.promptVersion.findMany({ where: { id: { in: topCopyIds } }, include: { prompt: true } });
  const copiedById = new Map(copiedVersions.map((version) => [version.id, version]));
  const standardRows = standards.map((standard) => ({ name: standard.name, count: standard.versions.reduce((sum, version) => sum + version._count.prompts, 0) })).sort((left, right) => right.count - left.count).slice(0, 8);
  const componentRows = components.map((component) => ({ name: component.name, count: component.versions.reduce((sum, version) => sum + version._count.prompts, 0) })).sort((left, right) => right.count - left.count).slice(0, 8);
  const maxStage = Math.max(1, ...stages.map((stage) => stage._count.versions));
  const maxStandard = Math.max(1, ...standardRows.map((row) => row.count));
  const metrics = [["Prompts", prompts, "Governed library"], ["Approved", approved, "Current versions"], ["Copies", copies.length, `${period}-day reuse`], ["Approval rate", `${cycle.approvalRate}%`, `${cycle.approved + cycle.returned} decisions`], ["Avg. approval", formatDuration(cycle.averageHours), "Submit to publish"], ["Needs attention", overdue + openVersions, `${overdue} overdue · ${openVersions} open`]] as const;

  return <>
    <section className="page-heading page-heading--actions"><div><span className="eyebrow">ANALYTICS</span><h1>Library health and governance performance.</h1><p>Live measures from approved content, review decisions, reuse events and governed relationships.</p></div><Link className="button button--ghost" href="/analytics/audit">Open Audit Explorer</Link></section>
    <form className="panel analytics-filter" action="/analytics" method="get"><label><span>Period</span><select name="period" defaultValue={String(period)}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option></select></label><label><span>Category</span><select name="category" defaultValue={categoryKey}><option value="all">All categories</option>{categories.map((category) => <option value={category.key} key={category.id}>{category.name}</option>)}</select></label><button className="button" type="submit">Apply filters</button></form>
    <section className="metrics metrics--six">{metrics.map(([label,value,detail]) => <div className="metric" key={label}><strong>{value}</strong><span>{label}</span><small>{detail}</small></div>)}</section>
    <section className="analytics-grid">
      <article className="panel"><div className="panel-heading"><h2>FlightPath coverage</h2><span>Approved prompt mappings</span></div><div className="analytics-bars">{stages.map((stage) => <div className="analytics-row" key={stage.id}><strong>{stage.stageNumber}. {stage.nameEn}</strong><div className="analytics-track"><div className="analytics-fill" style={{ width: `${(stage._count.versions / maxStage) * 100}%` }}/></div><span>{stage._count.versions}</span></div>)}</div></article>
      <article className="panel"><div className="panel-heading"><h2>Most reused prompts</h2><span>{period} days</span></div>{topCopyIds.length ? <div className="ranking-list">{topCopyIds.map((id, index) => { const version=copiedById.get(id); return version ? <Link href={`/library/${version.prompt.key}`} key={id}><span>{index + 1}</span><div><strong>{version.prompt.title}</strong><small>V{version.major}.{version.minor}.{version.patch}</small></div><b>{copyCounts.get(id)} copies</b></Link> : null; })}</div> : <div className="empty-state"><strong>No reuse events in this period</strong><p>New copy activity is now being recorded.</p></div>}</article>
      <article className="panel"><div className="panel-heading"><h2>Standard adoption</h2><span>Top active controls</span></div><div className="analytics-bars">{standardRows.map((row) => <div className="analytics-row" key={row.name}><strong>{row.name}</strong><div className="analytics-track"><div className="analytics-fill analytics-fill--gold" style={{ width: `${(row.count / maxStandard) * 100}%` }}/></div><span>{row.count}</span></div>)}</div></article>
      <article className="panel"><div className="panel-heading"><h2>Component adoption</h2><span>Approved links</span></div><div className="ranking-list ranking-list--compact">{componentRows.map((row, index) => <div key={row.name}><span>{index + 1}</span><strong>{row.name}</strong><b>{row.count}</b></div>)}</div></article>
    </section>
  </>;
}
