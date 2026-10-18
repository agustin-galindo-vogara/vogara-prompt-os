import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { key } = await context.params;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const prompt = await db.prompt.findFirst({
    where: { key, isActive: true, workspace: { key: workspaceKey, isActive: true } },
    select: {
      key: true,
      title: true,
      purpose: true,
      ownerLabel: true,
      versions: {
        where: { status: "APPROVED" },
        orderBy: [{ major: "desc" }, { minor: "desc" }, { patch: "desc" }],
        take: 1,
        select: {
          canonicalVersionId: true,
          major: true,
          minor: true,
          patch: true,
          summary: true,
          audience: true,
          expectedOutput: true,
          requiredInputsText: true,
          promptBody: true,
          approvedAt: true,
          nextReviewAt: true,
        },
      },
    },
  });

  const version = prompt?.versions[0];
  if (!prompt || !version) return NextResponse.json({ error: "No approved version found." }, { status: 404 });

  return NextResponse.json({
    prompt: {
      key: prompt.key,
      title: prompt.title,
      purpose: prompt.purpose,
      owner: prompt.ownerLabel,
      version: `${version.major}.${version.minor}.${version.patch}`,
      ...version,
    },
  });
}
