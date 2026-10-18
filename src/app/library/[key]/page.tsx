import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyPromptButton } from "@/components/copy-prompt-button";
import { canEditPrompt } from "@/lib/auth/policy";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function PromptDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const user = await requireSession();
  const { key } = await params;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const prompt = await db.prompt.findFirst({
    where: { key, isActive: true, workspace: { key: workspaceKey, isActive: true } },
    include: {
      category: true,
      versions: {
        orderBy: [{ major: "desc" }, { minor: "desc" }, { patch: "desc" }],
        include: { stages: { include: { stage: true } } },
      },
    },
  });
  const version = prompt?.versions.find((item) => item.status === "APPROVED");
  if (!prompt || !version) notFound();
  const openVersion = prompt.versions.find((item) => item.status === "DRAFT" || item.status === "PILOT");

  return <><section className="page-heading page-heading--actions"><div><span className="eyebrow">{prompt.category?.name ?? "PROMPT"}</span><h1>{prompt.title}</h1><p>{version.summary}</p></div>{canEditPrompt(user.roles) && (openVersion ? <Link className="button" href="/reviews">Open V{openVersion.major}.{openVersion.minor}.{openVersion.patch}</Link> : <Link className="button" href={`/library/${prompt.key}/new-version`}>Create new version</Link>)}</section><section className="panel"><div className="panel-heading"><h2>Approved prompt</h2><div className="inline-actions"><span>V{version.major}.{version.minor}.{version.patch}</span><CopyPromptButton body={version.promptBody}/></div></div><p><strong>Owner:</strong> {prompt.ownerLabel}</p><p><strong>FlightPath:</strong> {version.stages.map(item => item.stage.nameEn).join(", ") || "Not assigned"}</p><pre className="prompt-body">{version.promptBody}</pre></section><section className="panel version-history"><h2>Version history</h2>{prompt.versions.map((item) => <div className="compact-row" key={item.id}><div><strong>V{item.major}.{item.minor}.{item.patch}</strong><span>{item.changeNotes ?? "Imported governed version"}</span></div><span className={`status status--${item.status.toLowerCase()}`}>{item.status}</span></div>)}</section></>;
}
