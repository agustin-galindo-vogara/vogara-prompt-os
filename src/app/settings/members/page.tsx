import type { WorkspaceRole } from "@prisma/client";
import { deactivateWorkspaceMember, saveWorkspaceMember } from "@/app/actions/workspace-members";
import { requireSession } from "@/lib/auth/session";
import { isEnvironmentAdmin } from "@/lib/auth/policy";
import { db } from "@/lib/db";

const roleOptions: { value: WorkspaceRole; label: string; description: string }[] = [
  { value: "ADMIN", label: "Admin", description: "Manage members and all governance actions" },
  { value: "APPROVER", label: "Approver", description: "Approve or return versions" },
  { value: "EDITOR", label: "Editor", description: "Create and edit draft versions" },
  { value: "VIEWER", label: "Viewer", description: "Find and reuse approved prompts" },
];

export default async function MembersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireSession(["admin"]);
  const query = await searchParams;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  await db.user.upsert({ where: { email: session.email }, update: { displayName: session.name ?? undefined, isActive: true }, create: { email: session.email, displayName: session.name, isActive: true } });
  const members = await db.user.findMany({
    where: { OR: [{ email: process.env.PROMPT_OS_ADMIN_EMAIL?.trim().toLowerCase() }, { memberships: { some: { workspace: { key: workspaceKey } } } }] },
    orderBy: [{ isActive: "desc" }, { displayName: "asc" }, { email: "asc" }],
    include: { memberships: { where: { workspace: { key: workspaceKey } }, select: { role: true } } },
  });
  const notice = query.saved ? "Member access saved." : query.deactivated ? "Member deactivated and access revoked." : query.error === "protected" ? "The protected administrator cannot be deactivated." : query.error ? "Review the member email and select at least one role." : null;
  return <>
    <section className="page-heading page-heading--actions"><div><span className="eyebrow">WORKSPACE ACCESS</span><h1>Members and roles.</h1><p>Provision Vogara Nova accounts, separate editing from approval, and keep every access change auditable.</p></div><div className="member-count"><strong>{members.filter((member) => member.isActive).length}</strong><span>active members</span></div></section>
    {notice && <div className={`notice ${query.error ? "notice--error" : "notice--success"}`}>{notice}</div>}
    <section className="panel member-create"><div><span className="eyebrow">ADD MEMBER</span><h2>Provision workspace access</h2><p>The person will continue signing in through their verified <strong>@vogaranova.com</strong> Google account.</p></div><form action={saveWorkspaceMember}><div className="member-fields"><label><span>Name</span><input name="displayName" placeholder="Full name"/></label><label><span>Email</span><input type="email" name="email" placeholder="name@vogaranova.com" required/></label></div><fieldset><legend>Roles</legend><div className="role-grid">{roleOptions.map((role) => <label className="role-option" key={role.value}><input type="checkbox" name="roles" value={role.value} defaultChecked={role.value === "VIEWER"}/><span><strong>{role.label}</strong><small>{role.description}</small></span></label>)}</div></fieldset><button className="button" type="submit">Add member</button></form></section>
    <section className="member-list">{members.map((member) => { const protectedAdmin = isEnvironmentAdmin(member.email); const assigned = new Set(member.memberships.map((membership) => membership.role)); return <article className={`panel member-card ${member.isActive ? "" : "is-inactive"}`} key={member.id}><div className="member-identity"><div className="member-avatar">{(member.displayName ?? member.email).slice(0, 2).toUpperCase()}</div><div><h2>{member.displayName ?? member.email.split("@")[0]}</h2><p>{member.email}</p></div><span className={`status ${member.isActive ? "status--approved" : "status--archived"}`}>{member.isActive ? "Active" : "Inactive"}</span></div><form action={saveWorkspaceMember}><input type="hidden" name="email" value={member.email}/><input type="hidden" name="displayName" value={member.displayName ?? ""}/><div className="role-grid role-grid--compact">{roleOptions.map((role) => <label className="role-option" key={role.value}><input type="checkbox" name="roles" value={role.value} defaultChecked={protectedAdmin || assigned.has(role.value)} disabled={protectedAdmin}/>{protectedAdmin && <input type="hidden" name="roles" value={role.value}/>}<span><strong>{role.label}</strong></span></label>)}</div>{protectedAdmin ? <p className="protected-note">Protected administrator · configured through the production secret.</p> : <div className="member-actions"><button className="button button--ghost" type="submit">Save roles</button>{member.isActive && <button className="button button--danger" formAction={deactivateWorkspaceMember} type="submit">Deactivate</button>}</div>}</form></article>; })}</section>
  </>;
}
