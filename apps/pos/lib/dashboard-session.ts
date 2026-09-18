import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex-api";

export const DASHBOARD_COOKIE = "tryo_dashboard_sess";

export function dashboardConvex(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  return new ConvexHttpClient(url);
}

export async function isDashboardSessionValid(token: string | undefined) {
  if (!token) return false;
  return (await dashboardConvex().query(api.dashboardAuth.validateSession, {
    token,
  })) as boolean;
}
