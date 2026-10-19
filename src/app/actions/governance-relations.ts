"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { reconcileGovernanceRelations } from "@/lib/governance-relations";

export async function syncGovernanceMap() {
  const user = await requireSession(["admin"]);
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const workspace = await db.workspace.findUnique({ where: { key: workspaceKey } });
  if (!workspace) redirect("/workflows?sync=missing-workspace");

  const result = await db.$transaction(async (tx) => {
    const synced = await reconcileGovernanceRelations(tx, workspaceKey);
    await tx.auditEvent.create({
      data: {
        workspaceId: workspace.id,
        actorEmail: user.email,
        entityType: "GovernanceMap",
        entityId: workspace.id,
        action: "RelationshipsReconciled",
        reason: "Aligned Standard and Component links with governed applicability rules from the Master Library.",
        source: "PROMPT_OS",
        newState: synced,
      },
    });
    return synced;
  });

  revalidatePath("/workflows");
  revalidatePath("/standards");
  revalidatePath("/components");
  for (const standard of await db.standard.findMany({ select: { key: true } })) revalidatePath(`/standards/${standard.key}`);
  for (const component of await db.component.findMany({ select: { key: true } })) revalidatePath(`/components/${component.key}`);
  redirect(`/workflows?sync=complete&corrected=${result.correctedVersions}`);
}
