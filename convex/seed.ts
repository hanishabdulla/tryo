import { mutationGeneric } from "convex/server";
import { v } from "convex/values";

const CONFIG_ENTRIES: Array<{ key: string; value: unknown }> = [
  { key: "mealUpcharge", value: 249 },
  { key: "mealComboLabel", value: "Fries + Coke" },
  { key: "mealComboLabelWraps", value: "Fries + Drink" },
  {
    key: "loadedFriesSeasonings",
    value: ["Cajun", "Peri-Peri", "None"],
  },
  {
    key: "loadedFriesAddons",
    value: [
      "Spicy Chicken",
      "Southern Fried Chicken",
      "Angus Beef",
      "Beef",
      "Falafel",
    ],
  },
  {
    key: "loadedFriesSauces",
    value: [
      "None",
      "Mayo",
      "Burger sauce",
      "Ketchup",
      "Barbecue",
      "Chipotle",
      "Garlic mayo",
    ],
  },
  { key: "loadedFriesAddonPricePence", value: 299 },
  { key: "businessName", value: "Tryo" },
  {
    key: "businessAddress",
    value: "Rushden Lakes, FC3, Rushden, Northamptonshire",
  },
  { key: "businessPhone", value: "+44 7825583940" },
  { key: "businessVat", value: "491891448" },
  { key: "receiptQrUrl", value: "https://www.tryoeats.uk/" },
];

type SeedItem = { name: string; basePrice: number; sortOrder: number };

/** Moved from Light Bites — keep in sync with `MENU_ITEMS_BY_CATEGORY.Fries`. */
const FRIES_MENU_ITEMS: SeedItem[] = [
  { name: "Loaded Fries", basePrice: 599, sortOrder: 10 },
  { name: "Regular Fries", basePrice: 249, sortOrder: 20 },
];

const MENU_ITEMS_BY_CATEGORY: Record<string, SeedItem[]> = {
  "All Day Breakfast": [
    { name: "Baguette with Fried Egg", basePrice: 299, sortOrder: 10 },
    { name: "Baguette with Mushroom", basePrice: 299, sortOrder: 20 },
    {
      name: "Baguette with Southern Fried Chicken with Mayo and Sweet Corn",
      basePrice: 799,
      sortOrder: 30,
    },
    {
      name: "Baguette with Sausage + Fried Egg",
      basePrice: 699,
      sortOrder: 40,
    },
    {
      name: "Baguette with Egg, Sausage and Mushroom",
      basePrice: 799,
      sortOrder: 50,
    },
  ],
  Burgers: [
    { name: "Veg Burger", basePrice: 699, sortOrder: 10 },
    { name: "Spicy Chicken Burger", basePrice: 699, sortOrder: 20 },
    { name: "Southern Fried Chicken Burger", basePrice: 799, sortOrder: 30 },
    { name: "Juicy Smash Burger", basePrice: 699, sortOrder: 40 },
    { name: "Dirty Burger", basePrice: 1099, sortOrder: 50 },
    { name: "Angus Burger", basePrice: 899, sortOrder: 60 },
  ],
  Wraps: [
    { name: "Tuna Crunchy Wrap", basePrice: 699, sortOrder: 10 },
    { name: "Falafel Wrap", basePrice: 699, sortOrder: 20 },
    { name: "Southern Fried Chicken Wrap", basePrice: 799, sortOrder: 30 },
    { name: "Spicy Chicken Wrap", basePrice: 699, sortOrder: 40 },
  ],
  Rice: [{ name: "Mexican Rice Bowl", basePrice: 799, sortOrder: 10 }],
  Fries: FRIES_MENU_ITEMS,
  "Light Bites": [
    { name: "Hot Dog", basePrice: 399, sortOrder: 10 },
    { name: "Chilli Cheese Nuggets", basePrice: 299, sortOrder: 20 },
    { name: "Maska Bun", basePrice: 299, sortOrder: 30 },
  ],
  "Hot Soups": [
    { name: "Chicken Soup", basePrice: 399, sortOrder: 10 },
    { name: "Vegetable Soup", basePrice: 399, sortOrder: 20 },
  ],
  Drinks: [
    { name: "Still Water", basePrice: 129, sortOrder: 10 },
    { name: "Karak Tea", basePrice: 199, sortOrder: 20 },
    { name: "Coca-Cola", basePrice: 149, sortOrder: 30 },
    { name: "Coca-Cola Diet", basePrice: 149, sortOrder: 40 },
    { name: "Fruit Shoot", basePrice: 100, sortOrder: 50 },
    { name: "J20 Orange", basePrice: 299, sortOrder: 60 },
    { name: "J20 Apple", basePrice: 299, sortOrder: 70 },
    { name: "Rose Lemonade", basePrice: 299, sortOrder: 80 },
    { name: "Ginger Beer", basePrice: 299, sortOrder: 90 },
    { name: "Tango Apple", basePrice: 149, sortOrder: 100 },
    { name: "Tango Orange", basePrice: 149, sortOrder: 110 },
  ],
};

/** Idempotent seed: upserts config and all menu categories by name. */
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

    const friesNames = new Set(FRIES_MENU_ITEMS.map((i) => i.name));
    const allMenuRows = await ctx.db.query("menuItems").collect();
    for (const doc of allMenuRows) {
      if (!friesNames.has(doc.name)) continue;
      const def = FRIES_MENU_ITEMS.find((i) => i.name === doc.name);
      if (!def) continue;
      await ctx.db.patch(doc._id, {
        category: "Fries",
        basePrice: def.basePrice,
        sortOrder: def.sortOrder,
        available: true,
      });
    }

    for (const [category, items] of Object.entries(MENU_ITEMS_BY_CATEGORY)) {
      const existingItems = await ctx.db
        .query("menuItems")
        .withIndex("by_category", (q) => q.eq("category", category))
        .collect();
      const byName = new Map(existingItems.map((i) => [i.name, i]));

      for (const item of items) {
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
    }

    return { ok: true as const };
  },
});
