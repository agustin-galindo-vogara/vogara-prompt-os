"use server";

import type { WorkspaceRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { isAllowedDomain, isEnvironmentAdmin } from "@/lib/auth/policy";
import { db } from "@/lib/db";

const memberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  displayName: z.string().trim().max(200).optional(),
  roles: z.array(z.enum(["ADMIN", "APPROVER", "EDITOR", "VIEWER"])).min(1),
});

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

export async function saveWorkspaceMember(formData: FormData) {
  const actor = await requireSession(["admin"]);
  const parsed = memberSchema.safeParse({
    email: value(formData, "email"),
    displayName: value(formData, "displayName") || undefined,
    roles: formData.getAll("roles").filter((role): role is string => typeof role === "string"),
  });
  if (!parsed.success || !isAllowedDomain(parsed.data.email)) redirect("/settings/members?error=invalid");
  const roles: WorkspaceRole[] = isEnvironmentAdmin(parsed.data.email)
    ? ["ADMIN", "APPROVER", "EDITOR", "VIEWER"]
    : parsed.data.roles;
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  await db.$transaction(async (tx) => {
    const workspace = await tx.workspace.findFirst({ where: { key: workspaceKey, isActive: true } });
    if (!workspace) throw new Error("WORKSPACE_NOT_FOUND");
    const member = await tx.user.upsert({
      where: { email: parsed.data.email },
      update: { displayName: parsed.data.displayName, isActive: true },
      create: { email: parsed.data.email, displayName: parsed.data.displayName, isActive: true },
    });
    const previous = await tx.workspaceMembership.findMany({ where: { workspaceId: workspace.id, userId: member.id }, select: { role: true } });
    await tx.workspaceMembership.deleteMany({ where: { workspaceId: workspace.id, userId: member.id } });
    await tx.workspaceMembership.createMany({ data: roles.map((role) => ({ workspaceId: workspace.id, userId: member.id, role })) });
    await tx.auditEvent.create({
      data: {
        workspaceId: workspace.id,
        actorEmail: actor.email,
        entityType: "WorkspaceMember",
        entityId: member.id,
        action: previous.length ? "MemberRolesUpdated" : "MemberProvisioned",
        source: "PROMPT_OS",
        previousState: { email: member.email, roles: previous.map((item) => item.role) },
        newState: { email: member.email, displayName: member.displayName, roles, active: true },
      },
    });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/settings/members");
  revalidatePath("/reviews");
  redirect("/settings/members?saved=1");
}

export async function deactivateWorkspaceMember(formData: FormData) {
  const actor = await requireSession(["admin"]);
  const email = value(formData, "email").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success || isEnvironmentAdmin(email) || email === actor.email) redirect("/settings/members?error=protected");
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  await db.$transaction(async (tx) => {
    const workspace = await tx.workspace.findFirst({ where: { key: workspaceKey, isActive: true } });
    const member = await tx.user.findUnique({ where: { email } });
    if (!workspace || !member) throw new Error("MEMBER_NOT_FOUND");
    const previous = await tx.workspaceMembership.findMany({ where: { workspaceId: workspace.id, userId: member.id }, select: { role: true } });
    await tx.workspaceMembership.deleteMany({ where: { workspaceId: workspace.id, userId: member.id } });
    await tx.user.update({ where: { id: member.id }, data: { isActive: false } });
    await tx.auditEvent.create({
      data: {
        workspaceId: workspace.id,
        actorEmail: actor.email,
        entityType: "WorkspaceMember",
        entityId: member.id,
        action: "MemberDeactivated",
        source: "PROMPT_OS",
        previousState: { email, roles: previous.map((item) => item.role), active: true },
        newState: { email, roles: [], active: false },
      },
    });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/settings/members");
  revalidatePath("/reviews");
  redirect("/settings/members?deactivated=1");
}
