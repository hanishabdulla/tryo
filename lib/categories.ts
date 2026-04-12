export type CategoryDef = {
  id: string;
  label: string;
  /** Convex `menuItems.category` value when live */
  convexCategory: string | null;
};

export const CATEGORIES: CategoryDef[] = [
  { id: "all_day_breakfast", label: "All Day Breakfast", convexCategory: null },
  { id: "burgers", label: "Burgers", convexCategory: "Burgers" },
  { id: "wraps", label: "Wraps", convexCategory: null },
  { id: "rice", label: "Rice", convexCategory: null },
  { id: "light_bites", label: "Light Bites", convexCategory: null },
  { id: "hot_soups", label: "Hot Soups", convexCategory: null },
  { id: "drinks", label: "Drinks", convexCategory: null },
];
