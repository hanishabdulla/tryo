import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyDashboardToken } from "@/lib/dashboard-verify-edge";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/dashboard/login") {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const secret =
    process.env.DASHBOARD_SESSION_SECRET || process.env.DASHBOARD_PASSWORD || "";
  if (!secret || !process.env.DASHBOARD_PASSWORD) {
    return new NextResponse(
      "Dashboard auth is not configured. Set DASHBOARD_PASSWORD in the environment.",
      { status: 503 },
    );
  }

  const token = request.cookies.get("tryo_dashboard_sess")?.value;
  const ok = await verifyDashboardToken(token, secret);
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
