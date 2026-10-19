import type { WorkspaceRole } from "@prisma/client";
import { db } from "@/lib/db";
import { expandRoles, resolveRoles, type AppRole } from "./policy";

const roleMap: Record<WorkspaceRole, AppRole> = {
  ADMIN: "admin",
  APPROVER: "approver",
  EDITOR: "editor",
  VIEWER: "viewer",
};

export async function resolveWorkspaceRoles(email: string) {
  const baseRoles = resolveRoles(email);
  if (baseRoles.length === 0) return [];
  const workspaceKey = process.env.DEFAULT_WORKSPACE_KEY ?? "VOGARA_NOVA";
  const record = await db.user.findUnique({
    where: { email },
    include: { memberships: { where: { workspace: { key: workspaceKey, isActive: true } } } },
  });
  if (record?.isActive === false) return [];
  return expandRoles([...baseRoles, ...(record?.memberships.map((membership) => roleMap[membership.role]) ?? [])]);
}
