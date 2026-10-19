/Users/agustingalindo/.zprofile:export:1: not valid in this context: export HOMEBREW_PREFIX
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const runSchema = z.object({ variableKeys: z.array(z.string().regex(/^[a-zA-Z][\w-]{0,63}$/)).max(50) });

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = runSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid runner metadata" }, { status: 400 });
  const { key } = await params;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const quota = await rateLimit({ actorEmail: user.email, action: "PromptRunPrepared", source: "PROMPT_RUNNER", limit: 120, windowSeconds: 3600, workspaceKey });
  if (!quota.allowed) return NextResponse.json({ error: "Too many runner requests" }, { status: 429, headers: { "Retry-After": String(quota.retryAfter) } });
  const version = await db.promptVersion.findFirst({ where: { status: "APPROVED", prompt: { key, isActive: true, workspace: { key: workspaceKey, isActive: true } } }, orderBy: [{ major: "desc" }, { minor: "desc" }, { patch: "desc" }], include: { prompt: true } });
  if (!version) return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
  const metadata = { promptKey: version.prompt.key, version: `${version.major}.${version.minor}.${version.patch}`, variableKeys: [...new Set(parsed.data.variableKeys)], variableCount: new Set(parsed.data.variableKeys).size, valuesStored: false };
  const [run] = await db.$transaction([
    db.auditEvent.create({ data: { workspaceId: version.prompt.workspaceId, actorEmail: user.email, entityType: "PromptVersion", entityId: version.id, action: "PromptRunPrepared", source: "PROMPT_RUNNER", newState: metadata } }),
    db.auditEvent.create({ data: { workspaceId: version.prompt.workspaceId, actorEmail: user.email, entityType: "PromptVersion", entityId: version.id, action: "PromptCopied", source: "PROMPT_RUNNER", newState: metadata } }),
  ]);
  return NextResponse.json({ ok: true, runId: run.id });
}
