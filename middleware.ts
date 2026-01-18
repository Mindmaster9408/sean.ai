import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require session auth
const publicRoutes = ["/login", "/api/auth/login"];

// API routes that handle their own auth (API key based)
const apiKeyAuthRoutes = [
  "/api/cron/",
  "/api/allocations/import",
  "/api/allocations/run",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public routes and static files
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Skip middleware for API routes that handle their own auth
  // These routes use x-api-key header authentication
  if (apiKeyAuthRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for session cookie (lightweight check for Edge Runtime)
  const token = request.cookies.get("session")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Session validation will happen in API routes/pages using Node.js runtime
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
