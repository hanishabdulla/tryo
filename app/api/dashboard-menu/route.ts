import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/convex-api";
import { DASHBOARD_COOKIE, dashboardConvex } from "@/lib/dashboard-session";

const ACTIONS = new Set([
  "saveItem",
  "deleteItem",
  "moveItem",
  "saveCategory",
  "deleteCategory",
  "moveCategory",
  "saveMealSettings",
]);

/** Forwards dashboard menu edits to Convex with the httpOnly session token. */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(DASHBOARD_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Sign in again." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    args?: unknown;
  } | null;
  const action = typeof body?.action === "string" ? body.action : "";
  if (!ACTIONS.has(action) || typeof body?.args !== "object" || body.args === null) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  try {
    const result = await dashboardConvex().mutation(api.menuAdmin[action], {
      ...(body.args as Record<string, unknown>),
      token,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    // Convex prefixes server errors with request details; show only our message.
    const raw = error instanceof Error ? error.message : "";
    const message = raw.match(/Uncaught Error: (.*?)(\n|$)/)?.[1] ?? "Could not save. Check the internet connection.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
