import Link from "next/link";
import { auditActionLabel } from "@/lib/analytics";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

function timestamp(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(value);
}

export default async function AuditExplorerPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSession(["admin", "approver"]);
  const query = await searchParams;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const workspace = await db.workspace.findFirstOrThrow({ where: { key: workspaceKey, isActive: true } });
  const action = query.action?.trim() || "all";
  const entityType = query.entity?.trim() || "all";
  const q = query.q?.trim() ?? "";
  const period = query.period === "30" || query.period === "365" || query.period === "all" ? query.period : "90";
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const since = period === "all" ? undefined : new Date(Date.now() - Number(period) * 86_400_000);
  const where = {
    workspaceId: workspace.id,
    ...(action !== "all" ? { action } : {}),
    ...(entityType !== "all" ? { entityType } : {}),
    ...(since ? { occurredAt: { gte: since } } : {}),
    ...(q ? { OR: [{ actorEmail: { contains: q, mode: "insensitive" as const } }, { reason: { contains: q, mode: "insensitive" as const } }, { action: { contains: q, mode: "insensitive" as const } }, { entityType: { contains: q, mode: "insensitive" as const } }, { entityId: { contains: q, mode: "insensitive" as const } }] } : {}),
  };
  const [events, total, actionRows, entityRows] = await Promise.all([
    db.auditEvent.findMany({ where, orderBy: { occurredAt: "desc" }, skip: (page - 1) * 50, take: 50 }),
    db.auditEvent.count({ where }),
    db.auditEvent.findMany({ where: { workspaceId: workspace.id }, distinct: ["action"], orderBy: { action: "asc" }, select: { action: true } }),
    db.auditEvent.findMany({ where: { workspaceId: workspace.id }, distinct: ["entityType"], orderBy: { entityType: "asc" }, select: { entityType: true } }),
  ]);
  const versionIds = events.filter((event) => event.entityType === "PromptVersion").map((event) => event.entityId);
  const versions = await db.promptVersion.findMany({ where: { id: { in: versionIds } }, include: { prompt: true } });
  const versionById = new Map(versions.map((version) => [version.id, version]));
  const pages = Math.max(1, Math.ceil(total / 50));
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (action !== "all") params.set("action", action);
  if (entityType !== "all") params.set("entity", entityType);
  if (period !== "90") params.set("period", period);
  const pageHref = (target: number) => { const next = new URLSearchParams(params); next.set("page", String(target)); return `/analytics/audit?${next.toString()}`; };

  return <>
    <section className="page-heading page-heading--actions"><div><span className="eyebrow">AUDIT EXPLORER</span><h1>Every governed action, traceable.</h1><p>Inspect who changed access, submitted work, made a decision, synchronized governance or reused an approved prompt.</p></div><Link className="button button--ghost" href="/analytics">Back to analytics</Link></section>
    <form className="panel audit-filter" action="/analytics/audit" method="get"><label className="audit-search"><span>Search</span><input name="q" defaultValue={q} placeholder="Actor, reason, action or entity ID"/></label><label><span>Action</span><select name="action" defaultValue={action}><option value="all">All actions</option>{actionRows.map((row) => <option value={row.action} key={row.action}>{auditActionLabel(row.action)}</option>)}</select></label><label><span>Entity</span><select name="entity" defaultValue={entityType}><option value="all">All entities</option>{entityRows.map((row) => <option value={row.entityType} key={row.entityType}>{row.entityType}</option>)}</select></label><label><span>Period</span><select name="period" defaultValue={period}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option><option value="all">All history</option></select></label><button className="button" type="submit">Apply</button></form>
    <div className="audit-summary"><strong>{total}</strong> matching events · page {page} of {pages}</div>
    <section className="panel audit-table"><div className="audit-row audit-row--header"><span>Action</span><span>Entity</span><span>Actor</span><span>When</span></div>{events.map((event) => { const version=versionById.get(event.entityId); return <article className="audit-row" key={event.id}><div><span className={`audit-action audit-action--${event.action.toLowerCase()}`}>{auditActionLabel(event.action)}</span>{event.reason && <p>{event.reason}</p>}{(event.previousState || event.newState) && <details><summary>State change</summary><pre>{JSON.stringify({ before: event.previousState, after: event.newState }, null, 2)}</pre></details>}</div><div>{version ? <Link href={`/library/${version.prompt.key}`}><strong>{version.prompt.title}</strong><small>V{version.major}.{version.minor}.{version.patch}</small></Link> : <><strong>{event.entityType}</strong><small>{event.entityId}</small></>}</div><div><strong>{event.actorEmail ?? "System"}</strong><small>{event.source ?? "—"}</small></div><time>{timestamp(event.occurredAt)}</time></article>})}{events.length === 0 && <div className="empty-state">No audit events match these filters.</div>}</section>
    {pages > 1 && <nav className="pagination" aria-label="Audit pages">{page > 1 && <Link className="button button--ghost" href={pageHref(page - 1)}>Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link className="button button--ghost" href={pageHref(page + 1)}>Next</Link>}</nav>}
  </>;
}
