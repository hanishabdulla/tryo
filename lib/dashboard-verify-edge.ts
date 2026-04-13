/**
 * Edge-safe session verification (Web Crypto). Must match signing in
 * `app/api/dashboard-auth/route.ts` (Node `createHmac` hex of `${exp}`).
 */
export async function verifyDashboardToken(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!secret || !token) return false;
  const dot = token.indexOf(".");
  if (dot === -1) return false;
  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const enc = new TextEncoder();
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch {
    return false;
  }
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(String(exp)));
  const hex = [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.length === sig.length && hex === sig;
}
