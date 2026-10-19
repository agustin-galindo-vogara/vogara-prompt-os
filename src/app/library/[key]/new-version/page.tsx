import Link from "next/link";
import { notFound } from "next/navigation";
import { createPromptVersion } from "@/app/actions/prompt-governance";
import { PromptVariablesEditor } from "@/components/prompt-variables-editor";
import { canEditPrompt } from "@/lib/auth/policy";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

function dateValue(value: Date | null) {
  const date = value ? new Date(value) : new Date();
  if (!value) date.setUTCDate(date.getUTCDate() + 90);
  return date.toISOString().slice(0, 10);
}

export default async function NewVersionPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ error?: string }> }) {
  const user = await requireSession();
  const { key } = await params;
  const query = await searchParams;
  if (!canEditPrompt(user.roles)) return <section className="panel"><h1>Editor access required</h1><p>Your account can use approved prompts but cannot create versions.</p></section>;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const prompt = await db.prompt.findFirst({
    where: { key, isActive: true, workspace: { key: workspaceKey, isActive: true } },
    include: {
      category: true,
      versions: { orderBy: [{ major: "desc" }, { minor: "desc" }, { patch: "desc" }], include: { inputs: { orderBy: { sequence: "asc" } } } },
    },
  });
  if (!prompt) notFound();
  const open = prompt.versions.find((item) => item.status === "DRAFT" || item.status === "PILOT");
  const source = prompt.versions.find((item) => item.status === "APPROVED") ?? prompt.versions[0];
  if (!source) notFound();
  if (open) return <><section className="page-heading"><span className="eyebrow">VERSION GOVERNANCE</span><h1>{prompt.title}</h1></section><section className="panel"><h2>An open version already exists</h2><p>V{open.major}.{open.minor}.{open.patch} is currently {open.status.toLowerCase()}. Finish that governance cycle before creating another version.</p><Link className="button" href="/reviews">Open review queue</Link></section></>;
  const nextVersion = `${source.major}.${source.minor + 1}.0`;
  return <><section className="page-heading"><span className="eyebrow">CREATE NEW VERSION</span><h1>{prompt.title}</h1><p>Start V{nextVersion} from the approved version. The approved source remains immutable.</p></section>{query.error && <div className="notice notice--error">Review the required fields, variable keys and try again.</div>}<form action={createPromptVersion} className="panel governance-form"><input type="hidden" name="promptKey" value={prompt.key}/><div className="form-grid"><label><span>New version</span><input value={`V${nextVersion}`} disabled/></label><label><span>Next review date</span><input type="date" name="nextReviewAt" defaultValue={dateValue(source.nextReviewAt)} required/></label><label className="form-span"><span>Summary</span><textarea name="summary" defaultValue={source.summary} rows={3} required/></label><label><span>Audience</span><input name="audience" defaultValue={source.audience ?? ""}/></label><label><span>Classification</span><input name="classification" defaultValue={source.classification ?? ""}/></label><label className="form-span"><span>Required inputs</span><textarea name="requiredInputsText" defaultValue={source.requiredInputsText ?? ""} rows={4}/></label><PromptVariablesEditor initialVariables={source.inputs}/><label className="form-span"><span>Expected output</span><textarea name="expectedOutput" defaultValue={source.expectedOutput ?? ""} rows={4}/></label><label className="form-span"><span>Prompt body</span><textarea className="prompt-editor" name="promptBody" defaultValue={source.promptBody} rows={28} required/></label><label className="form-span"><span>Change notes</span><textarea name="changeNotes" rows={4} placeholder="Explain what changed and why." required/></label></div><div className="form-actions"><Link className="button button--ghost" href={`/library/${prompt.key}`}>Cancel</Link><button className="button" type="submit">Create draft V{nextVersion}</button></div></form></>;
}
