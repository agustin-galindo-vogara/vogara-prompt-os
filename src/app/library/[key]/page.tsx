import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function PromptDetailPage({ params }: { params: Promise<{ key: string }> }) {
  await requireSession();
  const { key } = await params;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const prompt = await db.prompt.findFirst({
    where: { key, isActive: true, workspace: { key: workspaceKey, isActive: true } },
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
  const version = prompt?.versions[0];
  if (!prompt || !version) notFound();

  return <><section className="page-heading"><span className="eyebrow">{prompt.category?.name ?? "PROMPT"}</span><h1>{prompt.title}</h1><p>{version.summary}</p></section><section className="panel"><div className="panel-heading"><h2>Approved prompt</h2><span>V{version.major}.{version.minor}.{version.patch}</span></div><p><strong>Owner:</strong> {prompt.ownerLabel}</p><p><strong>FlightPath:</strong> {version.stages.map(item => item.stage.nameEn).join(", ") || "Not assigned"}</p><pre className="prompt-body">{version.promptBody}</pre></section></>;
}
