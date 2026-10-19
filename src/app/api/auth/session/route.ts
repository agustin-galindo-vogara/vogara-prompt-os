import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveWorkspaceRoles } from "@/lib/auth/access";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/auth/session";
import { adminAuth } from "@/lib/firebase/admin";

const payloadSchema = z.object({ idToken: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const decoded = await adminAuth.verifyIdToken(parsed.data.idToken, true);
    const email = decoded.email?.trim().toLowerCase();
    if (!email || decoded.email_verified !== true || (await resolveWorkspaceRoles(email)).length === 0) {
      return NextResponse.json({ error: "Use an approved Vogara Nova account." }, { status: 403 });
    }

    const sessionCookie = await adminAuth.createSessionCookie(parsed.data.idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Authentication failed." }, { status: 401 });
  }
}
