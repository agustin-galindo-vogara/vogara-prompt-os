import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function ComponentsPage() {
  await requireSession();
  const components = await db.component.findMany({ orderBy: { name: "asc" }, include: { versions: { where: { isActive: true }, orderBy: [{ major: "desc" },{ minor: "desc" }], take: 1, include: { _count: { select: { prompts: true } } } } } });
  return <><section className="page-heading"><span className="eyebrow">COMPONENTS</span><h1>Reusable intelligence, with purpose intact.</h1><p className="section-intro">Required analysis sequences are managed independently and linked to the prompts that use them.</p></section><section className="catalog-grid">{components.map((component) => { const version=component.versions[0]; return <article className="panel catalog-card" key={component.id}><div className="prompt-card__meta"><span className="eyebrow">{component.type.replaceAll("_"," ")}</span><span className="status status--approved">{version?._count.prompts ?? 0} prompt</span></div><h2>{component.name}</h2><p>{component.description}</p>{version && <details><summary>View component</summary><pre>{version.content}</pre></details>}</article>; })}</section></>;
}
