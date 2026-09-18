"use client";

/**
 * Convex + cart context for the whole site.
 *
 * The menu is served from the same Convex deployment the till uses, so a price
 * change in Dashboard → Menu is live here within a tick. Until Convex answers —
 * and permanently, if NEXT_PUBLIC_CONVEX_URL is unset — the bundled
 * FALLBACK_MENU is served instead, so the page is never blank or skeletal.
 */

import { ConvexProvider, ConvexReactClient, useQuery } from "convex/react";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { api, CONVEX_URL, convexEnabled } from "@/lib/convex-api";
import {
  CATEGORY_BLURBS,
  EXTRAS_CATEGORY,
  FALLBACK_MENU,
  imageFor,
  tagsFor,
  type MenuCategory,
  type MenuItem,
} from "@/lib/menu";
import { CartProvider } from "@/lib/cart";

type MenuContextValue = {
  /** Browsable sections. Never includes Extras — see EXTRAS_CATEGORY. */
  categories: MenuCategory[];
  /** Extras offered as add-ons inside the item sheet, not as a section. */
  extras: MenuItem[];
  mealUpcharge: number;
  mealComboLabel: string;
};

const MenuContext = createContext<MenuContextValue>({
  categories: browsable(FALLBACK_MENU),
  extras: extrasFrom(FALLBACK_MENU),
  mealUpcharge: 299,
  mealComboLabel: "Fries + Drink",
});

export function useMenu(): MenuContextValue {
  return useContext(MenuContext);
}

/** Shapes returned by `convex/menu.ts`, which declares them as `v.any()`. */
type RawCategory = { name: string; sortOrder: number; mealUpgrade: boolean };
type RawItem = {
  category: string;
  name: string;
  description?: string;
  options?: { name: string; price: number }[];
  basePrice: number;
  available: boolean;
  sortOrder: number;
};

/**
 * "Extras" is a till-side bookkeeping category — cheese, jalapenos, an extra
 * patty. Customers don't shop for a naked slice of cheese, so the site never
 * shows it as a section; its items surface as add-ons inside the item sheet
 * instead (see ItemSheet), which is what they actually are.
 */
function browsable(menu: MenuCategory[]): MenuCategory[] {
  return menu.filter((category) => category.name !== EXTRAS_CATEGORY);
}

function extrasFrom(menu: MenuCategory[]): MenuItem[] {
  return menu.find((category) => category.name === EXTRAS_CATEGORY)?.items.filter((item) => item.available) ?? [];
}

function buildMenu(categories: RawCategory[], items: RawItem[]): MenuCategory[] {
  const byCategory = new Map<string, RawItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.category);
    if (list) list.push(item);
    else byCategory.set(item.category, [item]);
  }

  return [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((category) => ({
      name: category.name,
      mealUpgrade: category.mealUpgrade,
      blurb: CATEGORY_BLURBS[category.name] ?? "",
      items: (byCategory.get(category.name) ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map<MenuItem>((item) => ({
          name: item.name,
          description: item.description ?? "",
          basePrice: item.basePrice,
          available: item.available,
          ...(item.options?.length ? { options: item.options } : {}),
          image: imageFor(category.name, item.name),
          tags: tagsFor(item.name),
        })),
    }))
    // A category emptied in the dashboard should disappear, not render a gap.
    .filter((category) => category.items.length > 0);
}

/** Subscribes to the live menu. Only mounted when Convex is configured. */
function LiveMenu({ children }: { children: ReactNode }) {
  const categories = useQuery(api.menu.listCategories, {}) as RawCategory[] | undefined;
  const items = useQuery(api.menu.listAllItems, {}) as RawItem[] | undefined;
  const config = useQuery(api.menu.getMenuConfig, {}) as Record<string, unknown> | undefined;

  const value = useMemo<MenuContextValue>(() => {
    const built = categories && items ? buildMenu(categories, items) : null;
    const menu = built && built.length > 0 ? built : FALLBACK_MENU;
    return {
      categories: browsable(menu),
      extras: extrasFrom(menu),
      mealUpcharge: typeof config?.mealUpcharge === "number" ? config.mealUpcharge : 299,
      mealComboLabel: typeof config?.mealComboLabel === "string" ? config.mealComboLabel : "Fries + Drink",
    };
  }, [categories, items, config]);

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  // One client for the lifetime of the tab.
  const client = useMemo(() => (convexEnabled ? new ConvexReactClient(CONVEX_URL) : null), []);

  const tree = <CartProvider>{children}</CartProvider>;

  if (!client) return tree;

  return (
    <ConvexProvider client={client}>
      <LiveMenu>{tree}</LiveMenu>
    </ConvexProvider>
  );
}
