import {
  type GenericDataModel,
  type GenericMutationCtx,
  internalMutationGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v } from "convex/values";

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const ITERATIONS = 100_000;

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(byteCount: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(byteCount)));
}

async function hashPassword(password: string, salt: string, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations },
    key,
    256,
  );
  return toHex(bits);
}

async function hashToken(token: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Throws unless `token` is a live dashboard session. For dashboard-only mutations. */
export async function requireDashboardSession(
  ctx: GenericMutationCtx<GenericDataModel>,
  token: string,
) {
  const tokenHash = await hashToken(token);
  const session = await ctx.db
    .query("dashboardSessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .first();
  if (!session || (session.expiresAt as number) <= Date.now()) {
    throw new Error("Dashboard session expired. Sign in again.");
  }
}

/** Set or change the password: `npx convex run dashboardAuth:setPassword '{"password":"..."}'` */
export const setPassword = internalMutationGeneric({
  args: { password: v.string() },
  handler: async (ctx, { password }) => {
    if (password.length < 4) throw new Error("Password is too short");
    const salt = randomHex(16);
    const hash = await hashPassword(password, salt, ITERATIONS);
    for (const row of await ctx.db.query("dashboardPassword").collect()) {
      await ctx.db.delete(row._id);
    }
    // Changing the password signs out every existing session.
    for (const row of await ctx.db.query("dashboardSessions").collect()) {
      await ctx.db.delete(row._id);
    }
    await ctx.db.insert("dashboardPassword", { salt, hash, iterations: ITERATIONS });
    return null;
  },
});

/** Returns a session token on success, or null for a wrong password. */
export const login = mutationGeneric({
  args: { password: v.string() },
  handler: async (ctx, { password }) => {
    const stored = await ctx.db.query("dashboardPassword").first();
    if (!stored) throw new Error("Dashboard password has not been set");
    const hash = await hashPassword(password, stored.salt, stored.iterations);
    if (!sameString(hash, stored.hash)) return null;

    const now = Date.now();
    for (const row of await ctx.db.query("dashboardSessions").collect()) {
      if (row.expiresAt < now) await ctx.db.delete(row._id);
    }
    const token = randomHex(32);
    await ctx.db.insert("dashboardSessions", {
      tokenHash: await hashToken(token),
      expiresAt: now + SESSION_MS,
    });
    return { token, maxAgeSeconds: SESSION_MS / 1000 };
  },
});

export const validateSession = queryGeneric({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const tokenHash = await hashToken(token);
    const session = await ctx.db
      .query("dashboardSessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    return session !== null && session.expiresAt > Date.now();
  },
});

export const logout = mutationGeneric({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const tokenHash = await hashToken(token);
    const session = await ctx.db
      .query("dashboardSessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (session) await ctx.db.delete(session._id);
    return null;
  },
});
