import { queryGeneric } from "convex/server";
import { v } from "convex/values";

export const listCategories = queryGeneric({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const rows = await ctx.db.query("menuCategories").collect();
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

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

/** Every item, including hidden ones, for the dashboard menu editor. */
export const listAllItems = queryGeneric({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const items = await ctx.db.query("menuItems").collect();
    return items.sort((a, b) => a.sortOrder - b.sortOrder);
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
        description: i.description ?? "",
        basePrice: i.basePrice,
        sortOrder: i.sortOrder,
      }));
  },
});
