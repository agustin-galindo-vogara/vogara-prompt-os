import Link from "next/link";
import { requireSession } from "@/lib/auth/session";

const steps = [["01","Draft","Create a new immutable version without changing the approved prompt."],["02","Review","Compare the draft with its approved predecessor and validate the change."],["03","Approve","An authorized approver publishes the new governed version."],["04","Use","Viewers reuse only the latest approved prompt."]];

export default async function WorkflowsPage() {
  await requireSession();
  return <><section className="page-heading"><span className="eyebrow">WORKFLOWS</span><h1>Governed from draft to reuse.</h1><p className="section-intro">The first workflow is already active: controlled version creation, side-by-side review and approval. Additional automation will build on this same governance model.</p></section><section className="workflow-path">{steps.map(([number,title,body]) => <article className="panel workflow-step" key={number}><span className="step-number">{number}</span><h2>{title}</h2><p>{body}</p></article>)}</section><section className="panel version-history"><div className="panel-heading"><h2>Available now</h2><span>MVP foundation</span></div><p>Create and edit drafts, compare versions, and approve or reject through the review queue.</p><div className="inline-actions"><Link className="button" href="/reviews">Open review queue</Link><Link className="button button--ghost" href="/library">Choose a prompt</Link></div></section></>;
}
