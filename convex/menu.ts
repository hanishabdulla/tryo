import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

/** Allowed `menuItems.category` values (keep in sync with `lib/categories.ts`). */
const MENU_ITEM_CATEGORIES = new Set([
  "All Day Breakfast",
  "Burgers",
  "Wraps",
  "Rice",
  "Fries",
  "Add-ons",
  "Light Bites",
  "Hot Soups",
  "Drinks",
]);

export const listItemsByCategory = queryGeneric({
  args: { category: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, { category }) => {
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_category", (q) => q.eq("category", category))
      .collect();
    return items
      .filter((i) => i.available)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const getMenuConfig = queryGeneric({
  args: {},
  returns: v.record(v.string(), v.any()),
  handler: async (ctx) => {
    const rows = await ctx.db.query("menuConfig").collect();
    const map: Record<string, unknown> = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }
    return map;
  },
});

/** All available items for paper / thermal menu print (grouped client-side). */
export const listAllMenuItemsForPrint = queryGeneric({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const items = await ctx.db.query("menuItems").collect();
    return items
      .filter((i) => i.available)
      .map((i) => ({
        category: i.category,
        name: i.name,
        basePrice: i.basePrice,
        sortOrder: i.sortOrder,
      }));
  },
});

export const addMenuItem = mutationGeneric({
  args: {
    category: v.string(),
    name: v.string(),
    basePrice: v.number(),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, { category, name, basePrice }) => {
    if (!MENU_ITEM_CATEGORIES.has(category)) {
      throw new Error("Invalid category");
    }
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Name is required");
    }
    if (!Number.isInteger(basePrice) || basePrice < 0) {
      throw new Error("Invalid price");
    }

    const existing = await ctx.db
      .query("menuItems")
      .withIndex("by_category", (q) => q.eq("category", category))
      .collect();
    const maxSort = existing.reduce((m, r) => Math.max(m, r.sortOrder), -1);

    await ctx.db.insert("menuItems", {
      category,
      name: trimmed.slice(0, 200),
      basePrice: basePrice,
      available: true,
      sortOrder: maxSort + 1,
    });

    return { ok: true as const };
  },
});
