import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function POST(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { key } = await params;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const version = await db.promptVersion.findFirst({
    where: { status: "APPROVED", prompt: { key, isActive: true, workspace: { key: workspaceKey, isActive: true } } },
    orderBy: [{ major: "desc" }, { minor: "desc" }, { patch: "desc" }],
    include: { prompt: true },
  });
  if (!version) return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
  await db.auditEvent.create({
    data: {
      workspaceId: version.prompt.workspaceId,
      actorEmail: user.email,
      entityType: "PromptVersion",
      entityId: version.id,
      action: "PromptCopied",
      source: "PROMPT_OS",
      newState: { promptKey: version.prompt.key, version: `${version.major}.${version.minor}.${version.patch}` },
    },
  });
  return NextResponse.json({ ok: true });
}
