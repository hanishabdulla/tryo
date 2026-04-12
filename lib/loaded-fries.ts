/** Convex menu item name + category for customised Loaded Fries. */
export function isLoadedFriesSheet(
  item: { name: string } | null,
  categoryConvex: string | null | undefined,
): boolean {
  return (
    item != null &&
    item.name === "Loaded Fries" &&
    categoryConvex === "Light Bites"
  );
}

export function loadedFriesCartLineKey(
  seasoning: string,
  addons: string[],
): string {
  return `LF::${seasoning}::${[...addons].sort().join("|")}`;
}
