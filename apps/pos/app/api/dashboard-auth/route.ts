import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/convex-api";
import { DASHBOARD_COOKIE, dashboardConvex } from "@/lib/dashboard-session";

function setSessionCookie(res: NextResponse, value: string, maxAge: number) {
  res.cookies.set(DASHBOARD_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const p =
    typeof body === "object" &&
    body !== null &&
    "password" in body &&
    typeof (body as { password: unknown }).password === "string"
      ? (body as { password: string }).password
      : "";

  let session: { token: string; maxAgeSeconds: number } | null;
  try {
    session = await dashboardConvex().mutation(api.dashboardAuth.login, {
      password: p,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        ok: false,
        error: message.includes("has not been set")
          ? "Dashboard password has not been set"
          : "Could not reach the server. Check the internet connection.",
      },
      { status: 503 },
    );
  }
  if (!session) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, session.token, session.maxAgeSeconds);
  return res;
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(DASHBOARD_COOKIE)?.value;
  if (token) {
    await dashboardConvex()
      .mutation(api.dashboardAuth.logout, { token })
      .catch(() => {});
  }
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, "", 0);
  return res;
}
