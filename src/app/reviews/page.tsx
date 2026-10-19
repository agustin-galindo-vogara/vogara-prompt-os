import Link from "next/link";
import { addReviewComment, approvePromptVersion, rejectPromptVersion, submitPromptVersion } from "@/app/actions/prompt-governance";
import { canApprovePrompt, canEditPrompt } from "@/lib/auth/policy";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const activityLabels: Record<string, string> = {
  VersionCreated: "Draft created",
  DraftUpdated: "Draft updated",
  SubmittedForApproval: "Submitted for approval",
  ReviewCommentAdded: "Review comment",
  ChangesRequested: "Changes requested",
  Approved: "Approved and published",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(value);
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireSession(["admin", "approver", "editor"]);
  const query = await searchParams;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const workspace = { key: workspaceKey, isActive: true };
  const selectedStatus = query.status === "draft" || query.status === "review" ? query.status : "all";
  const selectedOwner = query.mine === "assigned" || query.mine === "created" ? query.mine : "all";
  const search = query.q?.trim() ?? "";
  const actor = await db.user.upsert({ where: { email: user.email }, update: { displayName: user.name ?? undefined, isActive: true }, create: { email: user.email, displayName: user.name, isActive: true } });
  const eligibleReviewers = await db.user.findMany({
    where: { isActive: true, OR: [{ email: process.env.PROMPT_OS_ADMIN_EMAIL?.trim().toLowerCase() }, { memberships: { some: { workspace, role: { in: ["ADMIN", "APPROVER"] } } } }] },
    orderBy: [{ displayName: "asc" }, { email: "asc" }],
  });
  const reviewerNames = new Map(eligibleReviewers.map((reviewer) => [reviewer.email, reviewer.displayName ?? reviewer.email]));
  const allOpen = await db.promptVersion.findMany({
    where: {
      status: { in: ["DRAFT", "PILOT"] },
      prompt: {
        workspace,
        ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { key: { contains: search, mode: "insensitive" } }] } : {}),
      },
    },
    orderBy: [{ status: "desc" }, { updatedAt: "asc" }],
    include: { prompt: { include: { category: true } }, createdBy: true, previousVersion: true },
  });
  const queue = allOpen.filter((version) => {
    const matchesStatus = selectedStatus === "all" || (selectedStatus === "draft" ? version.status === "DRAFT" : version.status === "PILOT");
    const matchesOwner = selectedOwner === "all" || (selectedOwner === "assigned" ? version.approverLabel?.toLowerCase() === user.email : version.createdById === actor.id);
    return matchesStatus && matchesOwner;
  });
  const events = allOpen.length ? await db.auditEvent.findMany({
    where: { entityType: "PromptVersion", entityId: { in: allOpen.map((version) => version.id) } },
    orderBy: { occurredAt: "desc" },
  }) : [];
  const eventsByVersion = new Map<string, typeof events>();
  for (const event of events) eventsByVersion.set(event.entityId, [...(eventsByVersion.get(event.entityId) ?? []), event]);
  const draftCount = allOpen.filter((version) => version.status === "DRAFT").length;
  const reviewCount = allOpen.filter((version) => version.status === "PILOT").length;
  const notice = query.created ? "Draft created." : query.updated ? "Draft changes saved." : query.submitted ? "Version submitted for approval." : query.approved ? "Version approved and published." : query.rejected ? "Changes requested; version returned to draft." : query.commented ? "Review comment added." : query.error === "reason" ? "Add a decision or review note of at least five characters." : query.error === "reviewer" ? "Select an active Admin or Approver." : query.error === "assignment" ? "Only the assigned reviewer or an Admin can decide this version." : query.error ? "The requested transition could not be completed." : null;

  return <>
    <section className="page-heading page-heading--actions">
      <div><span className="eyebrow">REVIEW QUEUE</span><h1>Controlled change, visible decisions.</h1><p>Draft, review, decision and publication remain traceable from one governed queue.</p></div>
      <div className="review-summary" aria-label="Queue summary"><div><strong>{reviewCount}</strong><span>Awaiting decision</span></div><div><strong>{draftCount}</strong><span>Drafts</span></div></div>
    </section>
    {notice && <div className={`notice ${query.error ? "notice--error" : "notice--success"}`}>{notice}</div>}
    <section className="panel review-toolbar">
      <nav className="review-tabs" aria-label="Review status filters">
        <Link className={selectedStatus === "all" ? "active" : ""} href="/reviews">All <span>{allOpen.length}</span></Link>
        <Link className={selectedStatus === "review" ? "active" : ""} href="/reviews?status=review">In review <span>{reviewCount}</span></Link>
        <Link className={selectedStatus === "draft" ? "active" : ""} href="/reviews?status=draft">Drafts <span>{draftCount}</span></Link>
      </nav>
      <nav className="review-tabs review-tabs--personal" aria-label="Personal queue filters">
        <Link className={selectedOwner === "all" ? "active" : ""} href="/reviews">Team</Link>
        <Link className={selectedOwner === "assigned" ? "active" : ""} href="/reviews?mine=assigned">Assigned to me</Link>
        <Link className={selectedOwner === "created" ? "active" : ""} href="/reviews?mine=created">Created by me</Link>
      </nav>
      <form className="review-search" action="/reviews" method="get">
        {selectedStatus !== "all" && <input type="hidden" name="status" value={selectedStatus}/>} {selectedOwner !== "all" && <input type="hidden" name="mine" value={selectedOwner}/>}<input aria-label="Search review queue" name="q" defaultValue={search} placeholder="Search prompt or key"/><button className="button button--ghost" type="submit">Search</button>
      </form>
    </section>
    <section className="review-list">
      {queue.length === 0 && <div className="panel empty-state"><h2>Queue clear</h2><p>No versions match this view.</p></div>}
      {queue.map((version) => {
        const activity = eventsByVersion.get(version.id) ?? [];
        return <article className="panel review-card" key={version.id}>
          <div className="review-card__heading"><div><span className="eyebrow">{version.prompt.category?.name ?? "PROMPT"}</span><h2>{version.prompt.title}</h2><p>{version.prompt.key} · V{version.major}.{version.minor}.{version.patch}</p></div><span className={`status status--${version.status === "PILOT" ? "review" : "draft"}`}>{version.status === "PILOT" ? "In review" : "Draft"}</span></div>
          <p>{version.summary}</p>
          <dl className="review-meta"><div><dt>Author</dt><dd>{version.createdBy?.displayName ?? version.createdBy?.email ?? "Migration"}</dd></div><div><dt>Assigned reviewer</dt><dd>{version.approverLabel ? reviewerNames.get(version.approverLabel) ?? version.approverLabel : "Not assigned"}</dd></div><div><dt>Change rationale</dt><dd>{version.changeNotes ?? "Not provided"}</dd></div></dl>
          <div className="review-layout">
            <div className="review-primary">
              <details><summary>Review prompt content</summary><pre className="prompt-body">{version.promptBody}</pre></details>
              <div className="review-actions">{version.previousVersion && <Link className="button button--ghost" href={`/library/${version.prompt.key}`}>Approved version</Link>}{version.previousVersion && <Link className="button button--ghost" href={`/reviews/${version.id}/compare`}>Compare versions</Link>}{version.status === "DRAFT" && canEditPrompt(user.roles) && <Link className="button button--ghost" href={`/reviews/${version.id}/edit`}>Edit draft</Link>}</div>
              {version.status === "DRAFT" && canEditPrompt(user.roles) && <form action={submitPromptVersion} className="decision-form decision-form--submit"><input type="hidden" name="versionId" value={version.id}/><label><span>Reviewer / approver</span><select name="reviewer" defaultValue={version.approverLabel?.includes("@") ? version.approverLabel : user.email} required>{eligibleReviewers.map((reviewer) => <option value={reviewer.email} key={reviewer.id}>{reviewer.displayName ?? reviewer.email} · {reviewer.email}</option>)}</select></label><label><span>Submission note</span><textarea name="message" placeholder="What should the reviewer validate?" required minLength={5} rows={2}/></label><button className="button" type="submit">Submit for approval</button></form>}
              {version.status === "PILOT" && canApprovePrompt(user.roles) && (user.roles.includes("admin") || version.approverLabel?.toLowerCase() === user.email) && <div className="decision-grid"><form action={approvePromptVersion} className="decision-form decision-form--approve"><input type="hidden" name="versionId" value={version.id}/><label><span>Approval note</span><textarea name="message" placeholder="Record why this version is ready." required minLength={5} rows={2}/></label><button className="button" type="submit">Approve & publish</button></form><form action={rejectPromptVersion} className="decision-form decision-form--reject"><input type="hidden" name="versionId" value={version.id}/><label><span>Required changes</span><textarea name="reason" placeholder="Explain what must change." required minLength={5} rows={2}/></label><button className="button button--ghost" type="submit">Request changes</button></form></div>}
              <form action={addReviewComment} className="comment-form"><input type="hidden" name="versionId" value={version.id}/><input aria-label="Review comment" name="message" placeholder="Add a review comment" required minLength={5}/><button className="button button--ghost" type="submit">Comment</button></form>
            </div>
            <aside className="review-timeline"><h3>Decision history</h3>{activity.length === 0 ? <p>No activity recorded yet.</p> : <ol>{activity.slice(0, 6).map((event) => <li key={event.id}><strong>{activityLabels[event.action] ?? event.action}</strong><span>{event.actorEmail ?? "System"} · {formatDate(event.occurredAt)}</span>{event.reason && <p>{event.reason}</p>}</li>)}</ol>}</aside>
          </div>
        </article>;
      })}
    </section>
  </>;
}
