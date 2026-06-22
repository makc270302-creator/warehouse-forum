import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/forum", "/documents", "/profile", "/admin"];

export function middleware(request: NextRequest) {
  const isProtected = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route));
  const hasSupabaseCookie = request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));

  if (request.nextUrl.pathname === "/") {
    const destination = request.nextUrl.clone();
    destination.pathname = hasSupabaseCookie ? "/dashboard" : "/login";

    return hasSupabaseCookie ? NextResponse.redirect(destination) : NextResponse.rewrite(destination);
  }

  if (isProtected && !hasSupabaseCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/forum/:path*", "/documents/:path*", "/profile/:path*", "/admin/:path*", "/login"]
};
