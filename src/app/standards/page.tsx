import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function StandardsPage() {
  await requireSession();
  const standards = await db.standard.findMany({
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
      <span className="eyebrow">STANDARDS</span>
      <h1>The rules behind every governed prompt.</h1>
      <p className="section-intro">Active, versioned requirements from the Master Library. Open a standard to inspect its full requirement, history and every approved prompt that depends on it.</p>
    </section>
    <div className="results-summary"><strong>{standards.length}</strong> governed {standards.length === 1 ? "standard" : "standards"}</div>
    <section className="catalog-grid">
      {standards.map((standard) => {
        const version = standard.versions[0];
        const promptCount = version?._count.prompts ?? 0;
        return <article className="panel catalog-card" key={standard.id}>
          <div className="prompt-card__meta">
            <span className="eyebrow">V{version?.major ?? 1}.{version?.minor ?? 0}</span>
            <span className="status status--approved">{promptCount} {promptCount === 1 ? "prompt" : "prompts"}</span>
          </div>
          <h2>{standard.name}</h2>
          <p>{standard.description ?? "Governed requirement shared by linked prompt versions."}</p>
          <div className="catalog-card__actions">
            <Link className="button button--ghost" href={`/standards/${standard.key}`}>Open details</Link>
          </div>
        </article>;
      })}
    </section>
  </>;
}
