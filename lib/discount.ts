import { parsePenceFromInput } from "@/lib/money";

/** Percentage 0–100; empty or invalid → 0. */
export function parsePercentDiscountInput(raw: string): number {
  const t = raw.trim();
  if (t === "") return 0;
  const n = Number.parseFloat(t.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, n);
}

export function computePaymentDiscountPence(
  kind: "percentage" | "fixed",
  raw: string,
  subtotalPence: number,
): number {
  if (subtotalPence <= 0) return 0;
  if (kind === "percentage") {
    const pct = parsePercentDiscountInput(raw);
    if (pct <= 0) return 0;
    return Math.floor((subtotalPence * pct) / 100);
  }
  const fixed = parsePenceFromInput(raw) ?? 0;
  if (fixed <= 0) return 0;
  return Math.min(subtotalPence, fixed);
}
