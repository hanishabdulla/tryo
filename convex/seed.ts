import { mutationGeneric } from "convex/server";
import { v } from "convex/values";

const CONFIG_ENTRIES: Array<{ key: string; value: unknown }> = [
  { key: "mealUpcharge", value: 249 },
  { key: "mealComboLabel", value: "Fries + Coke" },
  { key: "businessName", value: "Tryo" },
  {
    key: "businessAddress",
    value: "Rushden Lakes, FC3, Rushden, Northamptonshire",
  },
  { key: "businessPhone", value: "+44 7825583940" },
  { key: "businessVat", value: "491891448" },
  { key: "receiptQrUrl", value: "https://tryoeats.co.uk/" },
];

const BURGER_ITEMS: Array<{
  name: string;
  basePrice: number;
  sortOrder: number;
}> = [
  { name: "Veg Burger", basePrice: 699, sortOrder: 10 },
  { name: "Spicy Chicken Burger", basePrice: 699, sortOrder: 20 },
  { name: "Southern Fried Chicken Burger", basePrice: 799, sortOrder: 30 },
  { name: "Juicy Smash Burger", basePrice: 699, sortOrder: 40 },
  { name: "Dirty Burger", basePrice: 1099, sortOrder: 50 },
  { name: "Angus Burger", basePrice: 899, sortOrder: 60 },
];

/** Idempotent seed: upserts config by key; upserts burgers by name+category. */
export const seed = mutationGeneric({
  args: {},
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx) => {
    for (const { key, value } of CONFIG_ENTRIES) {
      const row = await ctx.db
        .query("menuConfig")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (row) {
        await ctx.db.patch(row._id, { value });
      } else {
        await ctx.db.insert("menuConfig", { key, value });
      }
    }

    const category = "Burgers";
    const existingItems = await ctx.db
      .query("menuItems")
      .withIndex("by_category", (q) => q.eq("category", category))
      .collect();
    const byName = new Map(existingItems.map((i) => [i.name, i]));

    for (const item of BURGER_ITEMS) {
      const prev = byName.get(item.name);
      if (prev) {
        await ctx.db.patch(prev._id, {
          basePrice: item.basePrice,
          available: true,
          sortOrder: item.sortOrder,
        });
      } else {
        await ctx.db.insert("menuItems", {
          category,
          name: item.name,
          basePrice: item.basePrice,
          available: true,
          sortOrder: item.sortOrder,
        });
      }
    }

    return { ok: true as const };
  },
});
