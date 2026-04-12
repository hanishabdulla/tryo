export type CategoryDef = {
  id: string;
  label: string;
  /** Convex `menuItems.category` value when live */
  convexCategory: string | null;
};

export const CATEGORIES: CategoryDef[] = [
  {
    id: "all_day_breakfast",
    label: "All Day Breakfast",
    convexCategory: "All Day Breakfast",
  },
  { id: "burgers", label: "Burgers", convexCategory: "Burgers" },
  { id: "wraps", label: "Wraps", convexCategory: "Wraps" },
  { id: "rice", label: "Rice", convexCategory: "Rice" },
  { id: "fries", label: "Fries", convexCategory: "Fries" },
  { id: "light_bites", label: "Light Bites", convexCategory: "Light Bites" },
  { id: "hot_soups", label: "Hot Soups", convexCategory: "Hot Soups" },
  { id: "drinks", label: "Drinks", convexCategory: "Drinks" },
];
