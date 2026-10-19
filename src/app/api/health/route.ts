/Users/agustingalindo/.zprofile:export:1: not valid in this context: export HOMEBREW_PREFIX
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "reachable", checkedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "health_check_failed", checkedAt, error: error instanceof Error ? error.name : "UnknownError" }));
    return NextResponse.json({ status: "degraded", database: "unreachable", checkedAt }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
