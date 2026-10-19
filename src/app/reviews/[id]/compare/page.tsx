import Link from "next/link";
import { notFound } from "next/navigation";
import { canEditPrompt } from "@/lib/auth/policy";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buildLineDiff } from "@/lib/text-diff";

function text(value: string | null) { return value?.trim() || "—"; }
function date(value: Date | null) { return value ? value.toISOString().slice(0, 10) : "—"; }

export default async function CompareVersionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession(["admin", "approver", "editor"]);
  const { id } = await params;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const version = await db.promptVersion.findFirst({ where: { id, prompt: { workspace: { key: workspaceKey, isActive: true } } }, include: { prompt: { include: { category: true } }, previousVersion: true } });
  if (!version?.previousVersion) notFound();
  const activity = await db.auditEvent.findMany({ where: { entityType: "PromptVersion", entityId: version.id }, orderBy: { occurredAt: "desc" } });
  const previous = version.previousVersion;
  const metadata = [
    ["Summary", previous.summary, version.summary],
    ["Audience", text(previous.audience), text(version.audience)],
    ["Classification", text(previous.classification), text(version.classification)],
    ["Required inputs", text(previous.requiredInputsText), text(version.requiredInputsText)],
    ["Expected output", text(previous.expectedOutput), text(version.expectedOutput)],
    ["Next review", date(previous.nextReviewAt), date(version.nextReviewAt)],
    ["Change notes", text(previous.changeNotes), text(version.changeNotes)],
  ] as const;
  const rows = buildLineDiff(previous.promptBody, version.promptBody);
  const changed = rows.filter((row) => row.kind !== "same").length;
  return <><section className="page-heading page-heading--actions"><div><span className="eyebrow">VERSION COMPARISON · {version.prompt.category?.name ?? "PROMPT"}</span><h1>{version.prompt.title}</h1><p>Approved V{previous.major}.{previous.minor}.{previous.patch} compared with proposed V{version.major}.{version.minor}.{version.patch}. {changed} changed line{changed === 1 ? "" : "s"}. Reviewer: {version.approverLabel ?? "not assigned"}.</p></div><div className="inline-actions"><Link className="button button--ghost" href="/reviews">Back to queue</Link>{version.status === "DRAFT" && canEditPrompt(user.roles) && <Link className="button" href={`/reviews/${version.id}/edit`}>Edit draft</Link>}</div></section><section className="panel compare-meta"><div className="compare-header"><strong>Field</strong><strong>Approved V{previous.major}.{previous.minor}.{previous.patch}</strong><strong>Proposed V{version.major}.{version.minor}.{version.patch}</strong></div>{metadata.map(([label, before, after]) => <div className={`compare-meta-row ${before !== after ? "is-changed" : ""}`} key={label}><strong>{label}</strong><div>{before}</div><div>{after}</div></div>)}</section><section className="panel diff-panel"><div className="panel-heading"><h2>Prompt body</h2><span>{changed} changed lines</span></div><div className="diff-grid"><div className="diff-heading">Approved V{previous.major}.{previous.minor}.{previous.patch}</div><div className="diff-heading">Proposed V{version.major}.{version.minor}.{version.patch}</div>{rows.map((row, index) => <div className="diff-row" key={`${index}-${row.leftLine ?? "x"}-${row.rightLine ?? "x"}`}><div className={`diff-cell diff-cell--${row.kind}`}><span>{row.leftLine ?? ""}</span><code>{row.left ?? ""}</code></div><div className={`diff-cell diff-cell--${row.kind}`}><span>{row.rightLine ?? ""}</span><code>{row.right ?? ""}</code></div></div>)}</div></section><section className="panel review-history"><div className="panel-heading"><h2>Decision history</h2><span>{activity.length} events</span></div>{activity.length === 0 ? <p>No activity recorded.</p> : <ol>{activity.map((event) => <li key={event.id}><strong>{event.action}</strong><span>{event.actorEmail ?? "System"} · {event.occurredAt.toISOString().replace("T", " ").slice(0, 16)} UTC</span>{event.reason && <p>{event.reason}</p>}</li>)}</ol>}</section></>;
}
