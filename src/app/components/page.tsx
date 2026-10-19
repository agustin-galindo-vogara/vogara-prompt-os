import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function ComponentsPage() {
  await requireSession();
  const components = await db.component.findMany({
    orderBy: { name: "asc" },
    include: {
      versions: {
        where: { isActive: true },
        orderBy: [{ major: "desc" }, { minor: "desc" }],
        take: 1,
        include: { _count: { select: { prompts: true } } },
      },
    },
  });

  return <>
    <section className="page-heading">
      <span className="eyebrow">COMPONENTS</span>
      <h1>Reusable intelligence, with purpose intact.</h1>
      <p className="section-intro">Required analysis sequences and reusable content blocks are managed independently. Open a component to see its content, version history and linked approved prompts.</p>
    </section>
    <div className="results-summary"><strong>{components.length}</strong> reusable {components.length === 1 ? "component" : "components"}</div>
    <section className="catalog-grid">
      {components.map((component) => {
        const version = component.versions[0];
        const promptCount = version?._count.prompts ?? 0;
        return <article className="panel catalog-card" key={component.id}>
          <div className="prompt-card__meta">
            <span className="eyebrow">{component.type.replaceAll("_", " ")}</span>
            <span className="status status--approved">{promptCount} {promptCount === 1 ? "prompt" : "prompts"}</span>
          </div>
          <h2>{component.name}</h2>
          <p>{component.description ?? "Reusable governed content linked to prompt versions."}</p>
          <div className="catalog-card__actions">
            <Link className="button button--ghost" href={`/components/${component.key}`}>Open details</Link>
          </div>
        </article>;
      })}
    </section>
  </>;
}
