import { queryGeneric } from "convex/server";
import { v } from "convex/values";

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
