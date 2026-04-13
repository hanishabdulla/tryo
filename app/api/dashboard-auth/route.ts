import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

const COOKIE = "tryo_dashboard_sess";
const MAX_AGE_SEC = 7 * 24 * 60 * 60;

function sessionSecret(): string {
  return (
    process.env.DASHBOARD_SESSION_SECRET ||
    process.env.DASHBOARD_PASSWORD ||
    ""
  );
}

function signToken(exp: number, secret: string): string {
  const sig = createHmac("sha256", secret)
    .update(String(exp))
    .digest("hex");
  return `${exp}.${sig}`;
}

function constantTimePasswordOk(input: string, expected: string): boolean {
  if (input.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(input, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { ok: false, error: "DASHBOARD_PASSWORD is not set" },
      { status: 503 },
    );
  }

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

  if (!constantTimePasswordOk(p, password)) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  const secret = sessionSecret();
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const token = signToken(exp, secret);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
