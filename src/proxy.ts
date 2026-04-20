import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const AUTH_PAGES = [
  "/auth/sign-in",
  "/auth/sign-up",
  "/auth/error",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/invite",
  "/auth/2fa",
];

// Marketing/legal pages that must remain accessible without a session.
// Paths are compared after the locale segment has been stripped.
const PUBLIC_PATHS = ["/", "/demo", "/contact", "/privacy", "/terms"];

const LOCALE_PREFIX_REGEX = /^\/(en|fr)(?=\/|$)/;

function stripLocale(pathname: string): string {
  const stripped = pathname.replace(LOCALE_PREFIX_REGEX, "");
  return stripped.length === 0 ? "/" : stripped;
}

function isAuthPage(pathname: string): boolean {
  const path = stripLocale(pathname);
  return AUTH_PAGES.some((page) => path === page || path.startsWith(`${page}/`));
}

function isPublicPage(pathname: string): boolean {
  const path = stripLocale(pathname);
  return PUBLIC_PATHS.includes(path);
}

const IS_DEV = process.env.NODE_ENV === "development";

function applySecurityHeaders(response: NextResponse): NextResponse {
  // 'unsafe-eval' is required by React in development mode for call-stack reconstruction.
  // It is omitted in production (Fix #4).
  const scriptSrc = IS_DEV
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com"
    : "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com";

  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      "connect-src 'self' https:",
      "frame-src https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ")
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), payment=()"
  );
  return response;
}

export const proxy = auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // 1. Run next-intl locale routing first so the locale is resolved before
  //    any redirect URL is constructed by the auth layer.
  const intlResponse = intlMiddleware(req);
  if (intlResponse) {
    return applySecurityHeaders(intlResponse);
  }

  // 2. Auth redirect logic
  if (session && isAuthPage(pathname)) {
    const response = NextResponse.redirect(new URL("/dashboard", req.url));
    return applySecurityHeaders(response);
  }

  if (!session && !isAuthPage(pathname) && !isPublicPage(pathname)) {
    const signInUrl = new URL("/auth/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", req.url);
    const response = NextResponse.redirect(signInUrl);
    return applySecurityHeaders(response);
  }

  return applySecurityHeaders(NextResponse.next());
});

export const config = {
  matcher: [
    // Run on all routes except static assets, Next.js internals, PWA files,
    // and API routes that use their own auth.
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|api/auth|api/webhooks|api/crons).*)",
  ],
};
