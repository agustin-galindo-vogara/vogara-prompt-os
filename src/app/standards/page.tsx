import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function StandardsPage() {
  await requireSession();
  const standards = await db.standard.findMany({ orderBy: { name: "asc" }, include: { versions: { where: { isActive: true }, orderBy: [{ major: "desc" },{ minor: "desc" }], take: 1, include: { _count: { select: { prompts: true } } } } } });
  return <><section className="page-heading"><span className="eyebrow">STANDARDS</span><h1>The rules behind every governed prompt.</h1><p className="section-intro">Active requirements imported from the Master Library. They remain reusable, versioned building blocks across brands and prompts.</p></section><section className="catalog-grid">{standards.map((standard) => { const version=standard.versions[0]; return <article className="panel catalog-card" key={standard.id}><div className="prompt-card__meta"><span className="eyebrow">V{version?.major ?? 1}.{version?.minor ?? 0}</span><span className="status status--approved">{version?._count.prompts ?? 0} prompts</span></div><h2>{standard.name}</h2><p>{standard.description}</p>{version && <details><summary>View requirement</summary><pre>{version.requirement}</pre></details>}</article>; })}</section></>;
}
