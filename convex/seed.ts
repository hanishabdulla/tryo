import { internalMutationGeneric, mutationGeneric } from "convex/server";
import { v } from "convex/values";

/**
 * Tills up to v0.1.4 call this on every launch. It used to re-create the old
 * menu, so it is now a no-op. The menu is managed from Dashboard → Menu.
 */
export const seed = mutationGeneric({
  args: {},
  returns: v.object({ ok: v.literal(true) }),
  handler: async () => ({ ok: true as const }),
});

type Item = [name: string, pounds: number, description?: string];

const LOADED_TOPPINGS =
  "Loaded with house sauce, creamy cheese sauce & a kick of Cajun seasoning, then topped with crispy onions and melted cheddar";

const MENU: { name: string; mealUpgrade: boolean; items: Item[] }[] = [
  {
    name: "Popcorn Chicken & Chips",
    mealUpgrade: false,
    items: [
      ["Classic Combo", 8.99, "Popcorn chicken & chips"],
      ["Korean Combo", 8.99, "Korean popcorn chicken & chips"],
      ["Classic Bites", 9.99, "Plain popcorn chicken"],
      ["Korean Bites", 9.99, "Korean popcorn chicken"],
    ],
  },
  {
    name: "Loaded Fries & Hot Dogs",
    mealUpgrade: false,
    items: [
      ["Cheesy Fries", 5.99, "Cheddar cheese"],
      ["House Loaded Fries", 6.99, LOADED_TOPPINGS],
      ["Loaded Fries with Chicken Popcorn", 9.99, LOADED_TOPPINGS],
      ["Crispy Chicken Loaded Fries", 8.99, LOADED_TOPPINGS],
      ["Smashed Beef Loaded Fries", 8.99, LOADED_TOPPINGS],
      ["Falafel Loaded Fries", 8.99, "Topped with crispy falafel, hot cheese, gherkins, jalapenos"],
      ["Vegan Falafel Loaded Fries", 8.99, "Topped with crispy falafel, vegan cheese, seasoning, vegan mayo, gherkins, jalapenos"],
      ["The Dirty Fries (Regular)", 10.99, "The ultimate mix of meats, extra cheese sauce, gherkins, jalapenos"],
      ["The Dirty Fries (Spicy)", 10.99, "The ultimate mix of meats, extra cheese sauce, gherkins, jalapenos"],
      ["Classic Hot Dog", 3.99, "Beef sausage in a soft brioche bun with ketchup and mustard"],
      ["Jumbo Hot Dog", 5.99],
      ["Chilli Cheese Nuggets", 3.99],
      ["Regular Fries", 3.99],
    ],
  },
  {
    name: "The Burger Block",
    mealUpgrade: true,
    items: [
      ["Spicy Chicken Burger", 6.99, "Brioche bun, hot and spicy chicken fillet, lettuce, house sauce, cheese"],
      ["Southern Fried Chicken Burger", 7.99, "Brioche bun, chicken fillet, lettuce, mayonnaise, cheese"],
      ["Juicy Smash Burger", 6.99, "Brioche bun, lettuce, beef patty, caramelised onion, house sauce, cheese"],
      ["Double Trouble Burger", 8.99, "Brioche bun, lettuce, double beef patty, caramelised onion, house sauce, double cheese"],
      ["Dirty Burger", 10.99, "Brioche bun, lettuce, mayonnaise, caramelised onion, double beef patty, double cheese, fried egg, turkey rashers"],
      ["Veg Burger", 6.99, "Brioche bun, lettuce, salsa sauce, cheese, veg patty"],
    ],
  },
  {
    name: "Wraps",
    mealUpgrade: true,
    items: [
      ["Spicy Chicken Wrap", 7.99, "Tortilla wrap, lettuce, spicy chicken tenders, cheese, house sauce"],
      ["Southern Fried Chicken Wrap", 7.99, "Tortilla wrap, lettuce, southern fried chicken, cheese, mayonnaise"],
      ["Chicken Tikka Wrap", 7.99, "Tortilla wrap, lettuce, chicken tikka, cheese, mayonnaise"],
      ["Vegan Falafel Wrap", 6.99, "Tortilla wrap, lettuce, vegan mayo, falafel"],
      ["Falafel Wrap", 6.99, "Tortilla wrap, lettuce, garlic mayo, falafel"],
      ["Loaded Wrap", 10.99, "Tortilla wrap, chicken and beef, lettuce, cheese, fries, house sauce"],
    ],
  },
  {
    name: "Rice",
    mealUpgrade: false,
    items: [["Mexican Rice Bowl", 7.99, "Branston pickle, southern fried chicken, salad"]],
  },
  {
    name: "Extras",
    mealUpgrade: false,
    items: [
      ["Cheese", 1.29],
      ["Jalapenos", 1.0],
      ["Gherkins", 1.0],
      ["Caramelised Onion", 1.0],
      ["Crispy Onion", 0.5],
      ["Turkey Rashers", 2.95],
      ["Beef Patty", 2.99],
      ["Chicken Patty", 2.99],
    ],
  },
  {
    name: "Drinks",
    mealUpgrade: false,
    items: [
      ["Soft Drinks", 1.5],
      ["J20", 2.99],
      ["Ginger Beer", 2.99],
      ["Red Bull", 2.49],
      ["Still Water", 1.3],
      ["Karak Tea", 2.49, "Strong black tea brewed with milk, sugar and mild spices"],
    ],
  },
  {
    name: "Mocktails",
    mealUpgrade: false,
    items: [
      ["Mango Tango", 3.99, "Tropical mango, mint, lemon & lime sparkle"],
      ["Blueberry Bliss", 3.99, "Juicy blueberry, mint, lemon & lime sparkle"],
      ["Melon Wave", 3.99, "Refreshing watermelon, mint, lemon & lime sparkle"],
      ["Blue Lagoon Cooler", 3.99, "Blue curacao, mint, lemon & lime sparkle"],
      ["Pure Mint Infusion", 3.99, "Fresh mint, lime & lemon & lime sparkle"],
      ["Strawberry Fields", 3.99, "Sweet strawberry, mint, lemon & lime sparkle"],
      ["Tropical Passion", 3.99, "Tropical passion fruit, mint, lemon & lime sparkle"],
      ["Forest Berry Crush", 3.99, "Mixed berries, mint, lemon & lime sparkle"],
    ],
  },
  {
    name: "Lemonade",
    mealUpgrade: false,
    items: [
      ["Rose Lemonade", 3.99],
      ["Raspberry Lemonade", 3.99],
    ],
  },
];

const CONFIG: Record<string, unknown> = {
  mealUpcharge: 299,
  mealComboLabel: "Fries + Drink",
};

/**
 * Deletes every menu category and item, then loads the menu above.
 * `npx convex run seed:replaceMenu`. Past orders are unaffected.
 */
export const replaceMenu = internalMutationGeneric({
  args: {},
  handler: async (ctx) => {
    for (const row of await ctx.db.query("menuItems").collect()) await ctx.db.delete(row._id);
    for (const row of await ctx.db.query("menuCategories").collect()) await ctx.db.delete(row._id);

    let items = 0;
    for (const [c, category] of MENU.entries()) {
      await ctx.db.insert("menuCategories", {
        name: category.name,
        mealUpgrade: category.mealUpgrade,
        sortOrder: (c + 1) * 10,
      });
      for (const [i, [name, pounds, description]] of category.items.entries()) {
        await ctx.db.insert("menuItems", {
          category: category.name,
          name,
          description: description ?? "",
          basePrice: Math.round(pounds * 100),
          available: true,
          sortOrder: (i + 1) * 10,
        });
        items++;
      }
    }

    for (const [key, value] of Object.entries(CONFIG)) {
      const row = await ctx.db
        .query("menuConfig")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (row) await ctx.db.patch(row._id, { value });
      else await ctx.db.insert("menuConfig", { key, value });
    }
    // Retired: Loaded Fries / Hot Dog option sheets and the separate wraps meal label.
    for (const key of ["mealComboLabelWraps", "loadedFriesSeasonings", "loadedFriesAddons", "loadedFriesSauces", "loadedFriesAddonPricePence"]) {
      const row = await ctx.db
        .query("menuConfig")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (row) await ctx.db.delete(row._id);
    }
    return { categories: MENU.length, items };
  },
});
