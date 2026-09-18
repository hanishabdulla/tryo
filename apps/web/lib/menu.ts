/**
 * The menu the site renders before (and if) Convex answers.
 *
 * The live menu lives in Convex and is edited in the POS dashboard; this file
 * mirrors `convex/seed.ts` so the page paints a real menu on first byte instead
 * of a skeleton, and still works if the deployment is unreachable. Prices here
 * are only a fallback — `<LiveMenu>` overwrites them the moment Convex replies.
 *
 * Photography and dietary tags are web-only presentation and never come from the
 * till, so they are matched by keyword in IMAGE_RULES / TAG_RULES below.
 */

export type DietTag = "vegan" | "veggie" | "spicy";

export type MenuItem = {
  name: string;
  description: string;
  /** Integer pence, matching `menuItems.basePrice` in Convex. */
  basePrice: number;
  available: boolean;
  /** Paid extras offered on the item, e.g. Cheese +£1.25. */
  options?: { name: string; price: number }[];
  image?: string;
  tags?: DietTag[];
};

export type MenuCategory = {
  name: string;
  /** Offer the "Make it a meal" upgrade on every item in this category. */
  mealUpgrade: boolean;
  /** Short line used under the category heading on the menu page. */
  blurb: string;
  items: MenuItem[];
};

export const MEAL_UPCHARGE_PENCE = 299;

/**
 * Till-side category of per-dish add-ons. Mirrored in `convex/online.ts`, which
 * accepts these names as `addons` on a food line.
 */
export const EXTRAS_CATEGORY = "Extras";

/** Extras are food-only; these sections never offer them. */
export const DRINK_CATEGORIES = new Set(["Drinks", "Mocktails", "Lemonade"]);
export const MEAL_COMBO_LABEL = "Fries + Drink";

/**
 * Photography is matched by keyword, not by exact item name: the menu is edited
 * in the POS dashboard, so a rename like "Classic Combo" → "Classic Popcorn
 * Chicken Combo" must not silently drop the item back to a generic category
 * shot. Rules are tested in order, first match wins.
 */
const IMAGE_RULES: { image: string; all?: string[]; any?: string[]; not?: string[] }[] = [
  // Falafel wins over the category it appears in (fries, wraps).
  { image: "/img/falafel.jpg", any: ["falafel"] },
  { image: "/img/korean-chicken.jpg", any: ["korean"] },
  { image: "/img/dirty-fries.jpg", all: ["dirty"], any: ["fries", "chips"] },
  { image: "/img/burger-dirty.jpg", any: ["dirty burger", "double trouble"] },
  { image: "/img/cheesy-fries.jpg", any: ["cheesy fries", "regular fries"] },
  { image: "/img/loaded-fries.jpg", all: ["loaded"], any: ["fries", "chips"] },
  { image: "/img/hotdog.jpg", any: ["hot dog", "hotdog"] },
  { image: "/img/popcorn-chicken.jpg", any: ["popcorn", "bites", "nugget"] },
  { image: "/img/burger-fries.jpg", any: ["southern fried chicken burger"] },
  { image: "/img/burger-smash.jpg", any: ["burger"] },
  { image: "/img/wrap.jpg", any: ["wrap"] },
  { image: "/img/rice-bowl.jpg", any: ["rice", "bowl"] },
  { image: "/img/mocktail-tall.jpg", any: ["lemonade", "drink", "j20", "ginger", "red bull", "water", "tea", "cola"] },
  { image: "/img/mocktails.jpg", any: ["mocktail", "mango", "blueberry", "melon", "lagoon", "mint", "strawberry", "passion", "berry"] },
];

const CATEGORY_IMAGES: Record<string, string> = {
  "Popcorn Chicken & Chips": "/img/popcorn-chicken.jpg",
  "Loaded Fries & Hot Dogs": "/img/loaded-fries.jpg",
  "The Burger Block": "/img/burger-dirty.jpg",
  Wraps: "/img/wrap.jpg",
  Rice: "/img/rice-bowl.jpg",
  Extras: "/img/cheesy-fries.jpg",
  Drinks: "/img/mocktail-tall.jpg",
  Mocktails: "/img/mocktails.jpg",
  Lemonade: "/img/mocktail-tall.jpg",
};

function matchRules(haystack: string): string | null {
  for (const rule of IMAGE_RULES) {
    if (rule.not?.some((word) => haystack.includes(word))) continue;
    if (rule.all && !rule.all.every((word) => haystack.includes(word))) continue;
    if (rule.any && !rule.any.some((word) => haystack.includes(word))) continue;
    return rule.image;
  }
  return null;
}

/**
 * Item name first, then name + category, then the category shot.
 *
 * The two passes matter: "Classic Hot Dog" lives in the category "Loaded Fries &
 * Hot Dogs", so a single combined haystack contains both "loaded" and "fries"
 * and would hand a hot dog the loaded-fries photo. The item's own name is the
 * stronger signal, so it gets to win outright before the category is consulted.
 */
export function imageFor(categoryName: string, itemName: string): string {
  return (
    matchRules(itemName.toLowerCase()) ??
    matchRules(`${itemName} ${categoryName}`.toLowerCase()) ??
    CATEGORY_IMAGES[categoryName] ??
    "/img/grill-embers.jpg"
  );
}

/** Dietary flags, also keyword-matched so dashboard renames keep their badges. */
const TAG_RULES: { tag: DietTag; any: string[]; not?: string[] }[] = [
  { tag: "vegan", any: ["vegan"] },
  { tag: "veggie", any: ["falafel", "veg burger", "cheesy fries", "regular fries", "chilli cheese nugget"], not: ["vegan"] },
  { tag: "spicy", any: ["spicy", "korean", "chilli", "jalapeno"] },
];

export function tagsFor(itemName: string): DietTag[] | undefined {
  const haystack = itemName.toLowerCase();
  const tags = TAG_RULES.filter(
    (rule) => rule.any.some((w) => haystack.includes(w)) && !rule.not?.some((w) => haystack.includes(w)),
  ).map((rule) => rule.tag);
  return tags.length ? tags : undefined;
}

const LOADED =
  "Loaded with house sauce, creamy cheese sauce & a kick of Cajun seasoning, then topped with crispy onions and melted cheddar";

/** `[name, pounds, description?, options?]` — the same tuple shape as `convex/seed.ts`. */
type Row = [string, number, string?, { name: string; price: number }[]?];

const RAW: { name: string; mealUpgrade: boolean; blurb: string; items: Row[] }[] = [
  {
    name: "Popcorn Chicken & Chips",
    mealUpgrade: false,
    blurb: "Buttermilk-brined, double-dredged, fried to order.",
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
    blurb: "The messy end of the menu. Napkins provided, dignity is not.",
    items: [
      ["Cheesy Fries", 5.99, "Cheddar cheese"],
      ["House Loaded Fries", 6.99, LOADED],
      ["Loaded Fries with Chicken Popcorn", 9.99, LOADED],
      ["Crispy Chicken Loaded Fries", 8.99, LOADED],
      ["Smashed Beef Loaded Fries", 8.99, LOADED],
      ["Falafel Loaded Fries", 8.99, "Topped with crispy falafel, hot cheese, gherkins, jalapenos"],
      [
        "Vegan Falafel Loaded Fries",
        8.99,
        "Topped with crispy falafel, vegan cheese, seasoning, vegan mayo, gherkins, jalapenos",
      ],
      ["The Dirty Fries (Regular)", 10.99, "The ultimate mix of meats, extra cheese sauce, gherkins, jalapenos"],
      ["The Dirty Fries (Spicy)", 10.99, "The ultimate mix of meats, extra cheese sauce, gherkins, jalapenos"],
      [
        "Classic Hot Dog",
        3.99,
        "Beef sausage in a soft brioche bun with ketchup and mustard",
        [{ name: "Cheese", price: 125 }],
      ],
      ["Jumbo Hot Dog", 5.99],
      ["Chilli Cheese Nuggets", 3.99],
      ["Regular Fries", 3.99],
    ],
  },
  {
    name: "The Burger Block",
    mealUpgrade: true,
    blurb: "Smashed thin on the flat-top for maximum crust. Brioche, always.",
    items: [
      ["Spicy Chicken Burger", 6.99, "Brioche bun, hot and spicy chicken fillet, lettuce, house sauce, cheese"],
      ["Southern Fried Chicken Burger", 7.99, "Brioche bun, chicken fillet, lettuce, mayonnaise, cheese"],
      ["Juicy Smash Burger", 6.99, "Brioche bun, lettuce, beef patty, caramelised onion, house sauce, cheese"],
      [
        "Double Trouble Burger",
        8.99,
        "Brioche bun, lettuce, double beef patty, caramelised onion, house sauce, double cheese",
      ],
      [
        "Dirty Burger",
        10.99,
        "Brioche bun, lettuce, mayonnaise, caramelised onion, double beef patty, double cheese, fried egg, turkey rashers",
      ],
      ["Veg Burger", 6.99, "Brioche bun, lettuce, salsa sauce, cheese, veg patty"],
    ],
  },
  {
    name: "Wraps",
    mealUpgrade: true,
    blurb: "Griddled tortilla, packed tight, folded to survive the walk home.",
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
    blurb: "One bowl, built properly.",
    items: [["Mexican Rice Bowl", 7.99, "Branston pickle, southern fried chicken, salad"]],
  },
  {
    name: "Extras",
    mealUpgrade: false,
    blurb: "Make it worse. In the best way.",
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
    blurb: "Cold, fizzy, or brewed strong.",
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
    blurb: "Shaken over ice, finished with mint. All alcohol-free.",
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
    blurb: "Pressed, poured, done.",
    items: [
      ["Rose Lemonade", 3.99],
      ["Raspberry Lemonade", 3.99],
    ],
  },
];

export const FALLBACK_MENU: MenuCategory[] = RAW.map((category) => ({
  name: category.name,
  mealUpgrade: category.mealUpgrade,
  blurb: category.blurb,
  items: category.items.map(([name, pounds, description, options]) => ({
    name,
    description: description ?? "",
    basePrice: Math.round(pounds * 100),
    available: true,
    ...(options ? { options } : {}),
    image: imageFor(category.name, name),
    tags: tagsFor(name),
  })),
}));

/** Short marketing copy per category, used by the category blurb lookup. */
export const CATEGORY_BLURBS: Record<string, string> = Object.fromEntries(
  RAW.map((c) => [c.name, c.blurb]),
);

/** The six dishes the homepage leads with. */
export const SIGNATURES = [
  {
    name: "The Dirty Fries",
    price: 1099,
    image: "/img/dirty-fries.jpg",
    kicker: "Most ordered",
    copy: "The ultimate mix of meats, extra cheese sauce, gherkins and jalapenos. Built to be shared, rarely is.",
  },
  {
    name: "Dirty Burger",
    price: 1099,
    image: "/img/burger-dirty.jpg",
    kicker: "The big one",
    copy: "Double beef patty, double cheese, fried egg, turkey rashers and caramelised onion in brioche.",
  },
  {
    name: "Korean Bites",
    price: 999,
    image: "/img/korean-chicken.jpg",
    kicker: "Sweet heat",
    copy: "Popcorn chicken tossed in a sticky gochujang glaze. Crunch that survives the drive home.",
  },
  {
    name: "Loaded Wrap",
    price: 1099,
    image: "/img/wrap.jpg",
    kicker: "Chef's pick",
    copy: "Chicken and beef, lettuce, cheese and actual fries, rolled into one tortilla. Yes, really.",
  },
  {
    name: "Mexican Rice Bowl",
    price: 799,
    image: "/img/rice-bowl.jpg",
    kicker: "Lighter",
    copy: "Southern fried chicken over seasoned rice with fresh salad and Branston pickle.",
  },
  {
    name: "Mango Tango",
    price: 399,
    image: "/img/mocktails.jpg",
    kicker: "Alcohol-free",
    copy: "Tropical mango, mint and a lemon-lime sparkle, shaken hard over crushed ice.",
  },
] as const;
