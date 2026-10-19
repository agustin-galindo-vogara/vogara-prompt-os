/Users/agustingalindo/.zprofile:export:1: not valid in this context: export HOMEBREW_PREFIX
import Link from "next/link";
import { createPrompt } from "@/app/actions/prompt-create";
import { PromptRelationsEditor } from "@/components/prompt-relations-editor";
import { PromptVariablesEditor } from "@/components/prompt-variables-editor";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

function reviewDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 90);
  return date.toISOString().slice(0, 10);
}

export default async function NewPromptPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSession(["admin", "editor"]);
  const query = await searchParams;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const workspace = { key: workspaceKey, isActive: true };
  const [categories, stages, platforms, standards, components, prompts, reviewers] = await Promise.all([
    db.category.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.flightPathStage.findMany({ orderBy: { stageNumber: "asc" } }),
    db.platform.findMany({ orderBy: { name: "asc" } }),
    db.standardVersion.findMany({ where: { isActive: true }, include: { standard: true }, orderBy: [{ standard: { name: "asc" } }, { major: "desc" }, { minor: "desc" }] }),
    db.componentVersion.findMany({ where: { isActive: true }, include: { component: true }, orderBy: [{ component: { name: "asc" } }, { major: "desc" }, { minor: "desc" }] }),
    db.prompt.findMany({ where: { workspace, isActive: true }, select: { id: true, key: true, title: true }, orderBy: { title: "asc" } }),
    db.user.findMany({ where: { isActive: true, OR: [{ email: process.env.PROMPT_OS_ADMIN_EMAIL?.trim().toLowerCase() }, { memberships: { some: { workspace, role: { in: ["ADMIN", "APPROVER"] } } } }] }, orderBy: [{ displayName: "asc" }, { email: "asc" }] }),
  ]);

  return <>
    <section className="page-heading page-heading--actions">
      <div><span className="eyebrow">CREATE PROMPT</span><h1>Start governed from day one.</h1><p>Create the permanent prompt record and its first controlled version, including FlightPath, reusable variables and governance relationships.</p></div>
      <Link className="button button--ghost" href="/library">Back to library</Link>
    </section>
    {query.error && <div className="notice notice--error">{query.error === "reviewer" ? "Select an active Admin or Approver." : query.error === "key" ? "That permanent prompt key already exists. Choose a unique key." : "Review the required fields, prompt key and governance selections."}</div>}
    <form action={createPrompt} className="panel governance-form prompt-create-form">
      <div className="form-grid">
        <label><span>Permanent key</span><input name="key" placeholder="VOG-PROMPT-CATEGORY-NAME" pattern="VOG-PROMPT-[A-Z0-9-]{3,80}" required/><small>Uppercase, stable and never reused.</small></label>
        <label><span>Category</span><select name="categoryId" required defaultValue=""><option value="" disabled>Select category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
        <label className="form-span"><span>Title</span><input name="title" minLength={5} maxLength={180} placeholder="Clear operational name" required/></label>
        <label><span>Owner</span><input name="ownerLabel" defaultValue={user.name ?? user.email} required/></label>
        <label><span>Next review</span><input type="date" name="nextReviewAt" defaultValue={reviewDate()} required/></label>
        <label className="form-span"><span>Purpose</span><textarea name="purpose" rows={3} placeholder="What business outcome does this prompt support?"/></label>
        <label className="form-span"><span>Summary</span><textarea name="summary" rows={3} minLength={10} placeholder="A concise description shown in the library." required/></label>
        <label><span>Audience</span><input name="audience" placeholder="Who should use it?"/></label>
        <label><span>Classification</span><input name="classification" placeholder="Internal, confidential…"/></label>
        <label className="form-span"><span>Required inputs</span><textarea name="requiredInputsText" rows={4} placeholder="Describe the information users need before running the prompt."/></label>
        <PromptVariablesEditor initialVariables={[]}/>
        <label className="form-span"><span>Expected output</span><textarea name="expectedOutput" rows={4} placeholder="Describe the expected structure, format and quality bar."/></label>

        <fieldset className="form-span governance-selection"><legend>FlightPath stages</legend><p>Select at least one. The first selected stage is treated as primary.</p><div className="selection-grid">{stages.map((stage) => <label className="selection-card" key={stage.id}><input type="checkbox" name="stageIds" value={stage.id}/><span><strong>{stage.stageNumber}. {stage.nameEn}</strong><small>{stage.nameEs}</small></span></label>)}</div></fieldset>
        <fieldset className="form-span governance-selection"><legend>Platforms</legend><div className="selection-grid">{platforms.map((platform) => <label className="selection-card" key={platform.id}><input type="checkbox" name="platformIds" value={platform.id}/><span><strong>{platform.name}</strong></span></label>)}</div></fieldset>
        <details className="form-span governance-catalog"><summary>Standards and reusable components</summary><div className="catalog-grid"><fieldset><legend>Standards</legend>{standards.map((version) => <label className="catalog-option" key={version.id}><input type="checkbox" name="standardVersionIds" value={version.id}/><span><strong>{version.standard.name}</strong><small>V{version.major}.{version.minor}</small></span></label>)}</fieldset><fieldset><legend>Components</legend>{components.map((version) => <label className="catalog-option" key={version.id}><input type="checkbox" name="componentVersionIds" value={version.id}/><span><strong>{version.component.name}</strong><small>V{version.major}.{version.minor}</small></span></label>)}</fieldset></div></details>
        <PromptRelationsEditor prompts={prompts}/>
        <label className="form-span"><span>Prompt body</span><textarea className="prompt-editor" name="promptBody" rows={28} minLength={50} placeholder="Write the reusable prompt. Insert variable tokens such as {{client_name}} where appropriate." required/></label>
        <label className="form-span"><span>Creation rationale</span><textarea name="changeNotes" rows={4} minLength={10} placeholder="Explain why this prompt is needed and what reviewers should validate." required/></label>
        <label><span>Reviewer / approver</span><select name="reviewer" defaultValue={reviewers.find((reviewer) => reviewer.email === user.email)?.email ?? reviewers[0]?.email ?? ""}><option value="">Assign when submitting later</option>{reviewers.map((reviewer) => <option value={reviewer.email} key={reviewer.id}>{reviewer.displayName ?? reviewer.email} · {reviewer.email}</option>)}</select></label>
        <label><span>Submission note</span><textarea name="reviewMessage" rows={3} placeholder="Required when submitting directly for review."/></label>
      </div>
      <div className="form-actions"><Link className="button button--ghost" href="/library">Cancel</Link><button className="button button--ghost" type="submit" name="intent" value="draft">Save draft</button><button className="button" type="submit" name="intent" value="review">Create and submit for review</button></div>
    </form>
  </>;
}
