import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/forum", "/documents", "/profile", "/admin"];

export function proxy(request: NextRequest) {
  const isProtected = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route));
  const hasSessionCookie = Boolean(request.cookies.get("warehouse_session")?.value);

  if (request.nextUrl.pathname === "/") {
    const destination = request.nextUrl.clone();
    destination.pathname = hasSessionCookie ? "/dashboard" : "/login";
    return hasSessionCookie ? NextResponse.redirect(destination) : NextResponse.rewrite(destination);
  }

  if (isProtected && !hasSessionCookie) {
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
