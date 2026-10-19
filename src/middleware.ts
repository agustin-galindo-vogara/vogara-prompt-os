/Users/agustingalindo/.zprofile:export:1: not valid in this context: export HOMEBREW_PREFIX
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (!request.cookies.has("__session")) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!sign-in|api/auth|api/health|_next/static|_next/image|favicon.ico|brand).*)"],
};
