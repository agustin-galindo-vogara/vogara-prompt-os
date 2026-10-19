import Link from "next/link";
import { notFound } from "next/navigation";
import { PromptRunner } from "@/components/prompt-runner";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function PromptRunnerPage({ params }: { params: Promise<{ key: string }> }) {
  await requireSession();
  const { key } = await params;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const version = await db.promptVersion.findFirst({
    where: { status: "APPROVED", prompt: { key, isActive: true, workspace: { key: workspaceKey, isActive: true } } },
    orderBy: [{ major: "desc" }, { minor: "desc" }, { patch: "desc" }],
    include: { prompt: { include: { category: true } }, inputs: { orderBy: { sequence: "asc" } } },
  });
  if (!version) notFound();
  return <><section className="page-heading page-heading--actions"><div><span className="eyebrow">PROMPT RUNNER · {version.prompt.category?.name ?? "LIBRARY"}</span><h1>{version.prompt.title}</h1><p>Complete reusable variables, preview the assembled prompt and copy the approved version safely.</p></div><Link className="button button--ghost" href={`/library/${version.prompt.key}`}>Back to prompt</Link></section><div className="runner-version"><span>Approved version</span><strong>V{version.major}.{version.minor}.{version.patch}</strong><span>Variable values are not stored</span></div><PromptRunner promptKey={version.prompt.key} promptBody={version.promptBody} definedVariables={version.inputs}/></>;
}
