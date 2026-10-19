import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/firebase/admin";
import { resolveWorkspaceRoles } from "./access";
import type { AppRole } from "./policy";

export const SESSION_COOKIE = "__session";
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  uid: string;
  email: string;
  name?: string;
  roles: AppRole[];
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    const token = await adminAuth.verifySessionCookie(sessionCookie, true);
    const email = token.email?.trim().toLowerCase();
    if (!email || token.email_verified !== true) return null;
    const roles = await resolveWorkspaceRoles(email);
    if (roles.length === 0) return null;

    return {
      uid: token.uid,
      email,
      name: typeof token.name === "string" ? token.name : undefined,
      roles,
    };
  } catch {
    return null;
  }
}

export async function requireSession(roles?: AppRole[]) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (roles && !roles.some((role) => user.roles.includes(role))) redirect("/");
  return user;
}
