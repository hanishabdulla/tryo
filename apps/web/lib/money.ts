/** Money is integer pence everywhere, exactly as the POS and Convex store it. */

export function formatPence(pence: number): string {
  const sign = pence < 0 ? "-" : "";
  const abs = Math.abs(pence);
  return `${sign}£${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, "0")}`;
}

/** Drops the ".00" on whole pounds — used on menu cards where it reads cleaner. */
export function formatPenceShort(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : formatPence(pence);
}
