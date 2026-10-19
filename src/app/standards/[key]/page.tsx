import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function StandardDetailPage({ params }: { params: Promise<{ key: string }> }) {
  await requireSession();
  const { key } = await params;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const standard = await db.standard.findUnique({
    where: { key },
    include: {
      versions: {
        orderBy: [{ major: "desc" }, { minor: "desc" }],
        include: {
          prompts: {
            where: { promptVersion: { status: "APPROVED", prompt: { isActive: true, workspace: { key: workspaceKey, isActive: true } } } },
            include: { promptVersion: { include: { prompt: { include: { category: true } } } } },
          },
        },
      },
    },
  });
  if (!standard) notFound();
  const activeVersion = standard.versions.find((version) => version.isActive) ?? standard.versions[0];
  if (!activeVersion) notFound();
  const linkedPrompts = Array.from(new Map(activeVersion.prompts.map((link) => [link.promptVersion.prompt.id, link])).values())
    .sort((a, b) => a.promptVersion.prompt.title.localeCompare(b.promptVersion.prompt.title));

  return <>
    <section className="page-heading page-heading--actions">
      <div><span className="eyebrow">STANDARD · V{activeVersion.major}.{activeVersion.minor}</span><h1>{standard.name}</h1><p>{standard.description ?? "Governed requirement used across approved prompt versions."}</p></div>
      <Link className="button button--ghost" href="/standards">Back to standards</Link>
    </section>
    <section className="detail-grid">
      <article className="panel detail-primary">
        <div className="panel-heading"><h2>Active requirement</h2><span>{linkedPrompts.length} linked {linkedPrompts.length === 1 ? "prompt" : "prompts"}</span></div>
        <pre className="governed-content">{activeVersion.requirement}</pre>
      </article>
      <aside className="panel version-sidebar">
        <h2>Version history</h2>
        {standard.versions.map((version) => <div className="compact-row" key={version.id}><div><strong>V{version.major}.{version.minor}</strong><span>{version.isActive ? "Active requirement" : "Historical version"}</span></div><span className={`status ${version.isActive ? "status--approved" : "status--superseded"}`}>{version.isActive ? "Active" : "Inactive"}</span></div>)}
      </aside>
    </section>
    <section className="linked-section">
      <div className="panel-heading"><h2>Approved prompts using this standard</h2><span>{linkedPrompts.length}</span></div>
      {linkedPrompts.length > 0 ? <div className="linked-prompt-grid">{linkedPrompts.map((link) => {
        const version = link.promptVersion;
        return <Link className="linked-prompt" href={`/library/${version.prompt.key}`} key={version.id}><span className="eyebrow">{version.prompt.category?.name ?? "PROMPT"}</span><strong>{version.prompt.title}</strong><small>V{version.major}.{version.minor}.{version.patch} · {link.isMandatory ? "Mandatory" : "Recommended"}</small></Link>;
      })}</div> : <div className="panel no-results"><p>No approved prompt currently references this active version.</p></div>}
    </section>
  </>;
}
