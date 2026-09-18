import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DASHBOARD_COOKIE, isDashboardSessionValid } from "@/lib/dashboard-session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/dashboard/login") {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  let ok = false;
  try {
    ok = await isDashboardSessionValid(request.cookies.get(DASHBOARD_COOKIE)?.value);
  } catch {
    return new NextResponse(
      "Could not reach the server to check your dashboard session. Check the internet connection and reload.",
      { status: 503 },
    );
  }
  if (!ok) {
    const login = new URL("/dashboard/login", request.url);
    login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
