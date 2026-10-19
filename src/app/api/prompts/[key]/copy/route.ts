import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { key } = await params;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const quota = await rateLimit({ actorEmail: user.email, action: "PromptCopied", source: "PROMPT_OS", limit: 180, windowSeconds: 3600, workspaceKey });
  if (!quota.allowed) return NextResponse.json({ error: "Too many copy requests" }, { status: 429, headers: { "Retry-After": String(quota.retryAfter) } });
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
