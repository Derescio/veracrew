import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_PAGES = ["/auth/sign-in", "/auth/sign-up", "/auth/error"];

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((page) => pathname.startsWith(page));
}

export const proxy = auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Authenticated users visiting auth pages → redirect to dashboard.
  if (session && isAuthPage(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Unauthenticated users visiting protected pages → redirect to sign-in.
  if (!session && !isAuthPage(pathname)) {
    const signInUrl = new URL("/auth/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Run on all routes except static assets, Next.js internals, and
    // API routes that use their own auth (Stripe signature, CRON_SECRET).
    "/((?!_next/static|_next/image|favicon.ico|api/auth|api/webhooks|api/crons).*)",
  ],
};
