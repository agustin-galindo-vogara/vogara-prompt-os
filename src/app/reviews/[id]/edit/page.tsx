import Link from "next/link";
import { notFound } from "next/navigation";
import { updatePromptDraft } from "@/app/actions/prompt-governance";
import { canEditPrompt } from "@/lib/auth/policy";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

function dateValue(value: Date | null) {
  return (value ?? new Date()).toISOString().slice(0, 10);
}

export default async function EditDraftPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const user = await requireSession(["admin", "editor"]);
  const { id } = await params;
  const query = await searchParams;
  if (!canEditPrompt(user.roles)) notFound();
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const version = await db.promptVersion.findFirst({ where: { id, prompt: { workspace: { key: workspaceKey, isActive: true } } }, include: { prompt: true } });
  if (!version) notFound();
  if (version.status !== "DRAFT") return <><section className="page-heading"><span className="eyebrow">DRAFT EDITOR</span><h1>{version.prompt.title}</h1></section><section className="panel"><h2>Editing is locked</h2><p>V{version.major}.{version.minor}.{version.patch} is already in review. An approver must request changes before editing can resume.</p><div className="form-actions"><Link className="button button--ghost" href="/reviews">Back to queue</Link><Link className="button" href={`/reviews/${version.id}/compare`}>Compare versions</Link></div></section></>;
  return <><section className="page-heading"><span className="eyebrow">EDIT DRAFT</span><h1>{version.prompt.title}</h1><p>Update V{version.major}.{version.minor}.{version.patch}. Saving keeps the same governed draft and records an audit event.</p></section>{query.error && <div className="notice notice--error">Review the required fields and try again.</div>}<form action={updatePromptDraft} className="panel governance-form"><input type="hidden" name="versionId" value={version.id}/><input type="hidden" name="promptKey" value={version.prompt.key}/><div className="form-grid"><label><span>Draft version</span><input value={`V${version.major}.${version.minor}.${version.patch}`} disabled/></label><label><span>Next review date</span><input type="date" name="nextReviewAt" defaultValue={dateValue(version.nextReviewAt)} required/></label><label className="form-span"><span>Summary</span><textarea name="summary" defaultValue={version.summary} rows={3} required/></label><label><span>Audience</span><input name="audience" defaultValue={version.audience ?? ""}/></label><label><span>Classification</span><input name="classification" defaultValue={version.classification ?? ""}/></label><label className="form-span"><span>Required inputs</span><textarea name="requiredInputsText" defaultValue={version.requiredInputsText ?? ""} rows={4}/></label><label className="form-span"><span>Expected output</span><textarea name="expectedOutput" defaultValue={version.expectedOutput ?? ""} rows={4}/></label><label className="form-span"><span>Prompt body</span><textarea className="prompt-editor" name="promptBody" defaultValue={version.promptBody} rows={28} required/></label><label className="form-span"><span>Change notes</span><textarea name="changeNotes" defaultValue={version.changeNotes ?? ""} rows={4} required/></label></div><div className="form-actions"><Link className="button button--ghost" href="/reviews">Cancel</Link><Link className="button button--ghost" href={`/reviews/${version.id}/compare`}>Compare versions</Link><button className="button" type="submit">Save draft</button></div></form></>;
}
