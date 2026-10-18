import { PromptCard } from "@/components/prompt-card";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatReviewDate } from "@/lib/prompt-summary";

export default async function LibraryPage() {
  await requireSession();
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const prompts = await db.prompt.findMany({
    where: {
      isActive: true,
      workspace: { key: workspaceKey, isActive: true },
      versions: { some: { status: "APPROVED" } },
    },
    orderBy: { title: "asc" },
    include: {
      category: true,
      versions: {
        where: { status: "APPROVED" },
        orderBy: [{ major: "desc" }, { minor: "desc" }, { patch: "desc" }],
        take: 1,
        include: { stages: { include: { stage: true } } },
      },
    },
  });
  const summaries = prompts.map((prompt) => {
    const version = prompt.versions[0];
    return {
      key: prompt.key,
      title: prompt.title,
      category: prompt.category?.name ?? "Uncategorized",
      version: `${version.major}.${version.minor}${version.patch ? `.${version.patch}` : ""}`,
      status: "Approved",
      stage: version.stages.map(({ stage }) => stage.nameEn).join(" / ") || "Cross-stage",
      summary: version.summary,
      owner: prompt.ownerLabel,
      review: formatReviewDate(version.nextReviewAt),
    };
  });
  return <><section className="page-heading"><div><span className="eyebrow">LIBRARY</span><h1>Approved knowledge, not just prompt text.</h1><p>Search by business intent, category, FlightPath stage, owner or platform.</p></div></section><section className="filters"><div className="search search--wide">Search prompts...</div>{["Category","Stage","Status","Platform","Owner"].map(item=><button className="filter" key={item}>{item} ▾</button>)}</section><section className="cards">{summaries.map(p=><PromptCard key={p.key} prompt={p}/>)}</section></>;
}
