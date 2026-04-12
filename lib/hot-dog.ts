/** Convex menu item name + category for customised Hot Dog. */
export const HOT_DOG_ONION_OPTIONS = [
  "None",
  "Caramelized Onions",
  "Crispy Onions",
] as const;

export const HOT_DOG_ONION_PRICE_PENCE = 49;
export const HOT_DOG_CHEESE_PRICE_PENCE = 129;

export function isHotDogSheet(
  item: { name: string } | null,
  categoryConvex: string | null | undefined,
): boolean {
  return item != null && item.name === "Hot Dog" && categoryConvex === "Light Bites";
}

export function hotDogExtrasPence(onion: string, cheese: boolean): number {
  let p = 0;
  if (onion !== "None") p += HOT_DOG_ONION_PRICE_PENCE;
  if (cheese) p += HOT_DOG_CHEESE_PRICE_PENCE;
  return p;
}

export function hotDogCartLineKey(onion: string, cheese: boolean): string {
  return `HD::${onion}::${cheese ? "cheese" : "no-cheese"}`;
}
