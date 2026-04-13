"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/convex-api";
import { CATEGORIES, type CategoryDef } from "@/lib/categories";
import {
  computePaymentDiscountPence,
  parsePercentDiscountInput,
} from "@/lib/discount";
import {
  HOT_DOG_CHEESE_PRICE_PENCE,
  HOT_DOG_ONION_OPTIONS,
  HOT_DOG_ONION_PRICE_PENCE,
  hotDogCartLineKey,
  hotDogExtrasPence,
  isHotDogSheet,
} from "@/lib/hot-dog";
import {
  isLoadedFriesSheet,
  loadedFriesCartLineKey,
} from "@/lib/loaded-fries";
import { formatPence, parsePenceFromInput } from "@/lib/money";
import {
  ReceiptStage,
  type ReceiptLinePrint,
  type ReceiptPayload,
} from "./ReceiptStage";

type MenuRow = {
  _id: string;
  name: string;
  basePrice: number;
};

type MenuItemDoc = {
  _id: string;
  name: string;
  basePrice: number;
};

type CartLine = {
  lineKey: string;
  itemName: string;
  sourceCategory: string;
  isMeal: boolean;
  mealLabel: string | null;
  basePricePence: number;
  mealUpchargePence: number;
  unitPricePence: number;
  quantity: number;
  /** Loaded Fries only */
  seasoning?: string | null;
  addons?: string[];
  loadedFriesAddonUnitPence?: number;
  /** Loaded Fries — free sauce choice */
  sauce?: string | null;
  /** Hot Dog — mutually exclusive onion choice ("None" = no onion topping) */
  hotDogOnion?: string | null;
  hotDogCheese?: boolean;
};

function lineKey(itemName: string, isMeal: boolean) {
  return `${itemName}::${isMeal ? "meal" : "ind"}`;
}

/** Stable key for off-menu lines; avoids `|` in stored name for splitting. */
function customCartLineKey(name: string, pricePence: number) {
  const safe = name.trim().replace(/\|/g, " ");
  return `custom|${pricePence}|${safe}`;
}

function isCustomCartLine(lineKey: string) {
  return lineKey.startsWith("custom|");
}

function receiptDiscountLabel(
  mode: "none" | "percentage" | "fixed",
  input: number,
  amountPence: number,
): string | null {
  if (amountPence <= 0) return null;
  if (mode === "percentage") return `Discount (${input}%):`;
  if (mode === "fixed") return `Discount (${formatPence(input)}):`;
  return "Discount:";
}

function useMenuConfigMap() {
  return useQuery(api.menu.getMenuConfig, {});
}

function useCategoryMenuItems(activeCategory: CategoryDef | null) {
  const category = activeCategory?.convexCategory;
  return useQuery(
    api.menu.listItemsByCategory,
    category ? { category } : "skip",
  );
}

export default function PosApp() {
  const [activeCategoryId, setActiveCategoryId] = useState(
    () => CATEGORIES.find((c) => c.convexCategory)?.id ?? CATEGORIES[0].id,
  );
  const activeCategory =
    CATEGORIES.find((c) => c.id === activeCategoryId) ?? CATEGORIES[0];

  const config = useMenuConfigMap();
  const categoryMenuItems = useCategoryMenuItems(activeCategory);

  const mealEligible =
    activeCategory.convexCategory === "Burgers" ||
    activeCategory.convexCategory === "Wraps";

  const seedDb = useMutation(api.seed.seed);
  const submitOrder = useMutation(api.orders.submitOrder);
  const addMenuItemMutation = useMutation(api.menu.addMenuItem);

  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    void seedDb({});
  }, [seedDb]);

  const mealUpchargePence = useMemo(() => {
    const v = config?.mealUpcharge;
    return typeof v === "number" && Number.isFinite(v) ? v : 249;
  }, [config]);

  const mealComboLabel = useMemo(() => {
    const v = config?.mealComboLabel;
    return typeof v === "string" && v.length > 0 ? v : "Fries + Coke";
  }, [config]);

  const mealComboLabelWraps = useMemo(() => {
    const v = config?.mealComboLabelWraps;
    return typeof v === "string" && v.length > 0 ? v : "Fries + Drink";
  }, [config]);

  const activeMealComboLabel =
    activeCategory.convexCategory === "Wraps"
      ? mealComboLabelWraps
      : mealComboLabel;

  const businessName =
    typeof config?.businessName === "string" ? config.businessName : "Tryo";
  const businessAddress =
    typeof config?.businessAddress === "string"
      ? config.businessAddress
      : "Rushden Lakes, FC3, Rushden, Northamptonshire";
  const businessPhone =
    typeof config?.businessPhone === "string"
      ? config.businessPhone
      : "+44 7825583940";
  const businessVat =
    typeof config?.businessVat === "string" ? config.businessVat : "491891448";
  const qrUrl =
    typeof config?.receiptQrUrl === "string"
      ? config.receiptQrUrl
      : "https://www.tryoeats.uk/";

  const loadedFriesAddonPricePence = useMemo(() => {
    const v = config?.loadedFriesAddonPricePence;
    return typeof v === "number" && Number.isFinite(v) ? v : 299;
  }, [config]);

  const loadedFriesSeasonings = useMemo((): string[] => {
    const v = config?.loadedFriesSeasonings;
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      return v as string[];
    }
    return ["Cajun", "Peri-Peri", "None"];
  }, [config]);

  const loadedFriesAddonsList = useMemo((): string[] => {
    const v = config?.loadedFriesAddons;
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      return v as string[];
    }
    return [
      "Spicy Chicken",
      "Southern Fried Chicken",
      "Angus Beef",
      "Beef",
      "Falafel",
    ];
  }, [config]);

  const loadedFriesSauces = useMemo((): string[] => {
    const v = config?.loadedFriesSauces;
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      return v as string[];
    }
    return [
      "None",
      "Mayo",
      "Burger sauce",
      "Ketchup",
      "Barbecue",
      "Chipotle",
      "Garlic mayo",
    ];
  }, [config]);

  const [cart, setCart] = useState<CartLine[]>([]);

  const [sheetItem, setSheetItem] = useState<MenuRow | null>(null);
  const [sheetMeal, setSheetMeal] = useState(false);
  const [sheetQty, setSheetQty] = useState(1);
  const [lfSeasoning, setLfSeasoning] = useState("None");
  const [lfSauce, setLfSauce] = useState("None");
  const [lfAddons, setLfAddons] = useState<string[]>([]);
  const [hdOnion, setHdOnion] = useState("None");
  const [hdCheese, setHdCheese] = useState(false);

  const [customItemOpen, setCustomItemOpen] = useState(false);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPriceRaw, setCustomItemPriceRaw] = useState("");

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuStep, setAddMenuStep] = useState<"category" | "details">(
    "category",
  );
  const [addMenuCategory, setAddMenuCategory] = useState<string | null>(null);
  const [addMenuName, setAddMenuName] = useState("");
  const [addMenuPriceRaw, setAddMenuPriceRaw] = useState("");
  const [addMenuSaving, setAddMenuSaving] = useState(false);
  const [addMenuError, setAddMenuError] = useState<string | null>(null);

  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<"card" | "cash">("card");
  const [givenRaw, setGivenRaw] = useState("");
  const [discountKind, setDiscountKind] = useState<"percentage" | "fixed">(
    "percentage",
  );
  const [discountRaw, setDiscountRaw] = useState("");

  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);
  const printedOrderRef = useRef<number | null>(null);

  useEffect(() => {
    if (!receipt) return;
    if (printedOrderRef.current === receipt.orderNumber) return;
    printedOrderRef.current = receipt.orderNumber;
    const device = window.tryoElectron?.getReceiptPrinter?.() ?? "";
    if (device.length > 0) {
      void window.tryoElectron
        ?.printReceiptSilent?.(device)
        .then((r) => {
          if (r && !r.ok && r.error) {
            console.warn("Receipt print:", r.error);
          }
        });
    } else {
      window.print();
    }
  }, [receipt]);

  const cartSubtotalPence = useMemo(
    () =>
      cart.reduce((acc, l) => acc + l.unitPricePence * l.quantity, 0),
    [cart],
  );
  const deliveryFeePence = 0;
  const discountPence = useMemo(
    () =>
      computePaymentDiscountPence(
        discountKind,
        discountRaw,
        cartSubtotalPence,
      ),
    [cartSubtotalPence, discountKind, discountRaw],
  );
  const amountDuePence = Math.max(
    0,
    cartSubtotalPence - discountPence + deliveryFeePence,
  );
  const totalItemCount = useMemo(
    () => cart.reduce((acc, l) => acc + l.quantity, 0),
    [cart],
  );

  const givenPence = parsePenceFromInput(givenRaw);
  const changePence =
    payMethod === "cash" && givenPence !== null
      ? givenPence - amountDuePence
      : null;
  const changeShort =
    payMethod === "cash" && givenPence !== null && givenPence < amountDuePence;

  const openItemSheet = useCallback(
    (item: MenuRow) => {
      setSheetItem(item);
      setSheetMeal(false);
      setSheetQty(1);
      if (isLoadedFriesSheet(item, activeCategory.convexCategory)) {
        setLfSeasoning("None");
        setLfSauce("None");
        setLfAddons([]);
      }
      if (isHotDogSheet(item, activeCategory.convexCategory)) {
        setHdOnion("None");
        setHdCheese(false);
      }
    },
    [activeCategory.convexCategory],
  );

  const addFromSheet = useCallback(() => {
    if (!sheetItem) return;
    if (isLoadedFriesSheet(sheetItem, activeCategory.convexCategory)) {
      const addonUnit = loadedFriesAddonPricePence;
      const n = lfAddons.length;
      const unit = sheetItem.basePrice + n * addonUnit;
      const key = loadedFriesCartLineKey(lfSeasoning, lfSauce, lfAddons);
      setCart((prev) => {
        const idx = prev.findIndex((l) => l.lineKey === key);
        if (idx === -1) {
          return [
            ...prev,
            {
              lineKey: key,
              itemName: sheetItem.name,
              sourceCategory: activeCategory.convexCategory ?? "",
              isMeal: false,
              mealLabel: null,
              basePricePence: sheetItem.basePrice,
              mealUpchargePence: n * addonUnit,
              unitPricePence: unit,
              quantity: sheetQty,
              seasoning: lfSeasoning,
              sauce: lfSauce,
              addons: [...lfAddons],
              loadedFriesAddonUnitPence: addonUnit,
            },
          ];
        }
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          quantity: next[idx].quantity + sheetQty,
        };
        return next;
      });
      setSheetItem(null);
      return;
    }
    if (isHotDogSheet(sheetItem, activeCategory.convexCategory)) {
      const extras = hotDogExtrasPence(hdOnion, hdCheese);
      const unit = sheetItem.basePrice + extras;
      const key = hotDogCartLineKey(hdOnion, hdCheese);
      setCart((prev) => {
        const idx = prev.findIndex((l) => l.lineKey === key);
        if (idx === -1) {
          return [
            ...prev,
            {
              lineKey: key,
              itemName: sheetItem.name,
              sourceCategory: activeCategory.convexCategory ?? "",
              isMeal: false,
              mealLabel: null,
              basePricePence: sheetItem.basePrice,
              mealUpchargePence: extras,
              unitPricePence: unit,
              quantity: sheetQty,
              hotDogOnion: hdOnion,
              hotDogCheese: hdCheese,
            },
          ];
        }
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          quantity: next[idx].quantity + sheetQty,
        };
        return next;
      });
      setSheetItem(null);
      return;
    }
    const isMeal = mealEligible && sheetMeal;
    const up = isMeal ? mealUpchargePence : 0;
    const unit = sheetItem.basePrice + up;
    const label = isMeal ? activeMealComboLabel : null;
    const key = lineKey(sheetItem.name, isMeal);
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.lineKey === key);
      if (idx === -1) {
        return [
          ...prev,
          {
            lineKey: key,
            itemName: sheetItem.name,
            sourceCategory: activeCategory.convexCategory ?? "",
            isMeal,
            mealLabel: label,
            basePricePence: sheetItem.basePrice,
            mealUpchargePence: up,
            unitPricePence: unit,
            quantity: sheetQty,
          },
        ];
      }
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        quantity: next[idx].quantity + sheetQty,
      };
      return next;
    });
    setSheetItem(null);
  }, [
    activeCategory.convexCategory,
    activeMealComboLabel,
    hdCheese,
    hdOnion,
    lfAddons,
    lfSauce,
    lfSeasoning,
    loadedFriesAddonPricePence,
    mealEligible,
    mealUpchargePence,
    sheetItem,
    sheetMeal,
    sheetQty,
  ]);

  const bumpQty = useCallback((lineKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.lineKey !== lineKey) return l;
          const q = l.quantity + delta;
          return { ...l, quantity: Math.max(0, q) };
        })
        .filter((l) => l.quantity > 0),
    );
  }, []);

  const removeLine = useCallback((lineKey: string) => {
    setCart((prev) => prev.filter((l) => l.lineKey !== lineKey));
  }, []);

  const customPricePence = parsePenceFromInput(customItemPriceRaw);
  const canAddCustom =
    customItemName.trim().length > 0 &&
    customPricePence !== null &&
    customPricePence > 0;

  const addCustomItemToCart = useCallback(() => {
    const name = customItemName.trim().slice(0, 120);
    const price = parsePenceFromInput(customItemPriceRaw);
    if (!name || price === null || price <= 0) return;
    const key = customCartLineKey(name, price);
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.lineKey === key);
      if (idx === -1) {
        return [
          ...prev,
          {
            lineKey: key,
            itemName: name,
            sourceCategory: "Custom",
            isMeal: false,
            mealLabel: null,
            basePricePence: price,
            mealUpchargePence: 0,
            unitPricePence: price,
            quantity: 1,
          },
        ];
      }
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        quantity: next[idx].quantity + 1,
      };
      return next;
    });
    setCustomItemOpen(false);
    setCustomItemName("");
    setCustomItemPriceRaw("");
  }, [customItemName, customItemPriceRaw]);

  const onCategoryTap = useCallback((cat: CategoryDef) => {
    setActiveCategoryId(cat.id);
  }, []);

  const openAddMenu = useCallback(() => {
    setAddMenuOpen(true);
    setAddMenuStep("category");
    setAddMenuCategory(null);
    setAddMenuName("");
    setAddMenuPriceRaw("");
    setAddMenuError(null);
  }, []);

  const addMenuPricePence = parsePenceFromInput(addMenuPriceRaw);
  const canSaveAddMenu =
    addMenuCategory !== null &&
    addMenuName.trim().length > 0 &&
    addMenuPricePence !== null &&
    addMenuPricePence >= 0;

  const saveAddMenuItem = useCallback(async () => {
    if (!addMenuCategory) return;
    const name = addMenuName.trim().slice(0, 200);
    const pence = parsePenceFromInput(addMenuPriceRaw);
    if (!name || pence === null || pence < 0) return;
    setAddMenuSaving(true);
    setAddMenuError(null);
    try {
      await addMenuItemMutation({
        category: addMenuCategory,
        name,
        basePrice: pence,
      });
      setAddMenuOpen(false);
      const cat = CATEGORIES.find((c) => c.convexCategory === addMenuCategory);
      if (cat) setActiveCategoryId(cat.id);
    } catch (e) {
      setAddMenuError(e instanceof Error ? e.message : "Could not save item");
    } finally {
      setAddMenuSaving(false);
    }
  }, [addMenuCategory, addMenuItemMutation, addMenuName, addMenuPriceRaw]);

  const onTileTap = useCallback(
    (item: MenuRow) => {
      openItemSheet(item);
    },
    [openItemSheet],
  );

  const submit = useCallback(async () => {
    if (cart.length === 0) return;
    if (payMethod === "cash") {
      if (givenPence === null) return;
      if (givenPence < amountDuePence) return;
    }

    let serverDiscountMode: "none" | "percentage" | "fixed" = "none";
    let serverDiscountInput = 0;
    if (discountKind === "percentage") {
      const p = parsePercentDiscountInput(discountRaw);
      if (p > 0) {
        serverDiscountMode = "percentage";
        serverDiscountInput = p;
      }
    } else {
      const f = parsePenceFromInput(discountRaw) ?? 0;
      if (f > 0) {
        serverDiscountMode = "fixed";
        serverDiscountInput = f;
      }
    }

    const items = cart.map((l) => {
      const row = {
        itemName: l.itemName,
        isMeal: l.isMeal,
        mealLabel: l.mealLabel,
        unitPrice: l.unitPricePence,
        quantity: l.quantity,
        lineTotal: l.unitPricePence * l.quantity,
      };
      if (l.itemName === "Loaded Fries") {
        return {
          ...row,
          seasoning: l.seasoning ?? "None",
          sauce: l.sauce ?? "None",
          addons: l.addons ?? [],
        };
      }
      if (l.itemName === "Hot Dog") {
        return {
          ...row,
          hotDogOnion: l.hotDogOnion ?? "None",
          hotDogCheese: l.hotDogCheese ?? false,
        };
      }
      return row;
    });

    const res = await submitOrder({
      items,
      deliveryFee: deliveryFeePence,
      paymentMethod: payMethod,
      givenAmount: payMethod === "cash" ? givenPence : null,
      totalItemCount,
      discountMode: serverDiscountMode,
      discountInput: serverDiscountInput,
    });

    const lines: ReceiptLinePrint[] = cart.map((l) => {
      if (l.itemName === "Loaded Fries") {
        const addonUnit =
          l.loadedFriesAddonUnitPence ?? loadedFriesAddonPricePence;
        return {
          name: l.itemName,
          quantity: l.quantity,
          baseLineTotalPence: l.basePricePence * l.quantity,
          isMeal: false,
          mealLabel: null,
          mealLineTotalPence: 0,
          seasoning: l.seasoning ?? "None",
          sauce: l.sauce ?? "None",
          addonLines: (l.addons ?? []).map((name) => ({
            name,
            lineTotalPence: addonUnit * l.quantity,
          })),
        };
      }
      if (l.itemName === "Hot Dog") {
        const onion = l.hotDogOnion ?? "None";
        const addonLines: { name: string; lineTotalPence: number }[] = [];
        if (onion !== "None") {
          addonLines.push({
            name: onion,
            lineTotalPence: HOT_DOG_ONION_PRICE_PENCE * l.quantity,
          });
        }
        if (l.hotDogCheese) {
          addonLines.push({
            name: "Cheese",
            lineTotalPence: HOT_DOG_CHEESE_PRICE_PENCE * l.quantity,
          });
        }
        return {
          name: l.itemName,
          quantity: l.quantity,
          baseLineTotalPence: l.basePricePence * l.quantity,
          isMeal: false,
          mealLabel: null,
          mealLineTotalPence: 0,
          addonLines: addonLines.length > 0 ? addonLines : undefined,
        };
      }
      return {
        name: l.itemName,
        quantity: l.quantity,
        baseLineTotalPence: l.basePricePence * l.quantity,
        isMeal: l.isMeal,
        mealLabel: l.mealLabel,
        mealLineTotalPence: l.isMeal ? l.mealUpchargePence * l.quantity : 0,
      };
    });

    setReceipt({
      orderNumber: res.orderNumber,
      createdAt: res.createdAt,
      lines,
      subtotalPence: res.subtotal,
      discountLabel: receiptDiscountLabel(
        res.discountMode,
        res.discountInput,
        res.discountAmountPence,
      ),
      discountAmountPence: res.discountAmountPence,
      deliveryFeePence,
      totalPence: res.total,
      totalItemCount,
      paymentMethod: payMethod,
      businessName,
      businessAddress,
      businessPhone,
      businessVat,
      qrUrl,
    });

    setCart([]);
    setPayOpen(false);
    setGivenRaw("");
    setPayMethod("card");
    setDiscountKind("percentage");
    setDiscountRaw("");
  }, [
    amountDuePence,
    businessAddress,
    businessName,
    businessPhone,
    businessVat,
    cart,
    deliveryFeePence,
    discountKind,
    discountRaw,
    givenPence,
    loadedFriesAddonPricePence,
    payMethod,
    qrUrl,
    submitOrder,
    totalItemCount,
  ]);

  const itemsForGrid: MenuRow[] = useMemo(() => {
    if (!activeCategory.convexCategory) return [];
    if (!categoryMenuItems) return [];
    return (categoryMenuItems as MenuItemDoc[]).map((r) => ({
      _id: r._id,
      name: r.name,
      basePrice: r.basePrice,
    }));
  }, [activeCategory.convexCategory, categoryMenuItems]);

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col bg-zinc-950 text-zinc-50">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold tracking-tight text-white">
            Tryo
          </span>
          <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            POS
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/daily"
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-xs font-semibold text-zinc-200 hover:border-[#00955e]/40 hover:text-white"
          >
            Dashboard
          </Link>
          <button
            type="button"
            onClick={openAddMenu}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-xs font-semibold text-zinc-200 hover:border-[#00955e]/40 hover:text-white"
          >
            Add item
          </button>
          <button
            type="button"
            onClick={() => {
              const e = window.tryoElectron;
              if (e) {
                void e.printMenu().then((r) => {
                  if (!r.ok && r.error) {
                    console.warn("Menu print:", r.error);
                  }
                });
              } else {
                window.open("/print/menu", "_blank", "noopener,noreferrer");
              }
            }}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-xs font-semibold text-zinc-200 hover:border-[#00955e]/40 hover:text-white"
          >
            Print menu
          </button>
          <span className="hidden self-center text-xs text-zinc-500 sm:inline">
            Rushden Lakes · Takeaway
          </span>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="flex min-h-0 min-w-0 flex-col border-zinc-800 lg:border-r">
          <div className="shrink-0 border-b border-zinc-800 px-3 py-3">
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {CATEGORIES.map((cat) => {
                const active = cat.id === activeCategoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onCategoryTap(cat)}
                    className={[
                      "min-h-14 shrink-0 rounded-2xl px-5 text-sm font-semibold transition-colors",
                      active
                        ? "bg-[#00955e] text-white shadow-[var(--tryo-glow)]"
                        : "bg-zinc-900 text-zinc-200",
                    ].join(" ")}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {categoryMenuItems === undefined ? (
              <div className="flex h-full min-h-[240px] items-center justify-center text-zinc-500">
                Loading menu…
              </div>
            ) : itemsForGrid.length === 0 ? (
              <div className="flex h-full min-h-[240px] items-center justify-center text-zinc-500">
                No items yet. Open Convex and run the seed mutation once if the
                menu is empty.
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                {itemsForGrid.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => onTileTap(item)}
                    className="flex min-h-[88px] flex-col items-start justify-between rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-4 text-left transition-transform hover:border-[#00955e]/35 hover:shadow-[0_0_24px_-8px_rgba(0,149,94,0.25)] active:scale-[0.98]"
                  >
                    <span className="text-base font-semibold leading-snug text-white">
                      {item.name}
                    </span>
                    <span className="mt-2 text-lg font-bold text-[#00955e] drop-shadow-[0_0_14px_rgba(0,149,94,0.35)]">
                      {formatPence(item.basePrice)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-t border-zinc-800 bg-zinc-950 lg:border-t-0">
          <div className="shrink-0 border-b border-zinc-800 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Current order
            </div>
            <div className="mt-1 text-sm text-zinc-400">
              Number is assigned when you submit payment.
            </div>
            <button
              type="button"
              onClick={() => {
                setCustomItemOpen(true);
                setCustomItemName("");
                setCustomItemPriceRaw("");
              }}
              className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#00955e]/50 bg-[rgba(0,149,94,0.12)] text-base font-bold text-white shadow-[0_0_20px_-8px_rgba(0,149,94,0.2)] transition-colors hover:bg-[rgba(0,149,94,0.2)] active:scale-[0.99]"
            >
              <span className="text-xl leading-none text-[#00955e]">+</span>
              Custom item
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {cart.length === 0 ? (
              <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-zinc-800 text-zinc-500">
                Cart is empty
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {cart.map((line) => (
                  <li
                    key={line.lineKey}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-white">
                          {line.itemName}
                        </div>
                        <div className="mt-1 text-sm text-zinc-400">
                          {isCustomCartLine(line.lineKey) ? (
                            <span className="text-zinc-400">Custom item</span>
                          ) : line.itemName === "Loaded Fries" ? (
                            <div className="space-y-0.5">
                              <div>
                                Seasoning:{" "}
                                <span className="text-zinc-300">
                                  {line.seasoning ?? "None"}
                                </span>
                              </div>
                              <div>
                                Sauce:{" "}
                                <span className="text-zinc-300">
                                  {line.sauce ?? "None"}
                                </span>
                              </div>
                              {line.addons && line.addons.length > 0 ? (
                                <div>
                                  Add-ons:{" "}
                                  <span className="text-zinc-300">
                                    {line.addons.join(", ")}
                                  </span>
                                </div>
                              ) : (
                                <div className="text-zinc-500">No add-ons</div>
                              )}
                            </div>
                          ) : line.itemName === "Hot Dog" ? (
                            <div className="space-y-0.5">
                              <div>
                                Onions:{" "}
                                <span className="text-zinc-300">
                                  {(line.hotDogOnion ?? "None") === "None"
                                    ? "None"
                                    : line.hotDogOnion}
                                </span>
                                {(line.hotDogOnion ?? "None") !== "None" ? (
                                  <span className="text-zinc-500">
                                    {" "}
                                    (+{formatPence(HOT_DOG_ONION_PRICE_PENCE)})
                                  </span>
                                ) : null}
                              </div>
                              <div>
                                Cheese:{" "}
                                <span className="text-zinc-300">
                                  {line.hotDogCheese ? "Yes" : "No"}
                                </span>
                                {line.hotDogCheese ? (
                                  <span className="text-zinc-500">
                                    {" "}
                                    (+{formatPence(HOT_DOG_CHEESE_PRICE_PENCE)})
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          ) : line.isMeal ? (
                            <span>
                              Meal ·{" "}
                              <span className="text-zinc-300">
                                {line.mealLabel}
                              </span>
                            </span>
                          ) : line.sourceCategory === "Burgers" ||
                            line.sourceCategory === "Wraps" ? (
                            <span>Individual</span>
                          ) : (
                            <span>Regular</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-[#00955e]">
                          {formatPence(line.unitPricePence * line.quantity)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 text-2xl font-semibold text-white"
                          onClick={() => bumpQty(line.lineKey, -1)}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <div className="min-w-[3rem] text-center text-lg font-bold">
                          {line.quantity}
                        </div>
                        <button
                          type="button"
                          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 text-2xl font-semibold text-white"
                          onClick={() => bumpQty(line.lineKey, 1)}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="min-h-14 rounded-2xl bg-red-950/60 px-4 text-sm font-semibold text-red-200"
                        onClick={() => removeLine(line.lineKey)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="shrink-0 space-y-3 border-t border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur">
            <div className="flex justify-between text-sm text-zinc-400">
              <span>Subtotal</span>
              <span className="font-semibold text-zinc-100">
                {formatPence(cartSubtotalPence)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-zinc-400">
              <span>Delivery fee</span>
              <span className="font-semibold text-zinc-100">
                {formatPence(deliveryFeePence)}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold text-white">
              <span>Total</span>
              <span className="text-[#00955e] drop-shadow-[0_0_12px_rgba(0,149,94,0.3)]">
                {formatPence(cartSubtotalPence + deliveryFeePence)}
              </span>
            </div>
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => {
                setPayOpen(true);
                setPayMethod("card");
                setGivenRaw("");
                setDiscountKind("percentage");
                setDiscountRaw("");
              }}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#00955e] text-lg font-bold text-white shadow-[var(--tryo-glow)] hover:bg-[#007a4c] active:bg-[#007a4c] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              Save &amp; Pay
            </button>
          </div>
        </aside>
      </main>

      {sheetItem ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="item-sheet-title"
        >
          <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="item-sheet-title"
                  className="text-xl font-bold text-white"
                >
                  {sheetItem.name}
                </h2>
                {isLoadedFriesSheet(sheetItem, activeCategory.convexCategory) ? (
                  <div className="mt-1 space-y-1">
                    <p className="text-sm text-zinc-400">
                      Base {formatPence(sheetItem.basePrice)} · Add-on{" "}
                      {formatPence(loadedFriesAddonPricePence)} each · No charge
                      for seasoning or sauce
                    </p>
                    <p className="text-lg font-bold text-[#00955e] drop-shadow-[0_0_14px_rgba(0,149,94,0.35)]">
                      {formatPence(
                        sheetItem.basePrice +
                          lfAddons.length * loadedFriesAddonPricePence,
                      )}{" "}
                      each
                    </p>
                  </div>
                ) : isHotDogSheet(sheetItem, activeCategory.convexCategory) ? (
                  <div className="mt-1 space-y-1">
                    <p className="text-sm text-zinc-400">
                      Base {formatPence(sheetItem.basePrice)} · Onions{" "}
                      {formatPence(HOT_DOG_ONION_PRICE_PENCE)} (one choice) ·
                      Cheese {formatPence(HOT_DOG_CHEESE_PRICE_PENCE)}
                    </p>
                    <p className="text-lg font-bold text-[#00955e] drop-shadow-[0_0_14px_rgba(0,149,94,0.35)]">
                      {formatPence(
                        sheetItem.basePrice +
                          hotDogExtrasPence(hdOnion, hdCheese),
                      )}{" "}
                      each
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-zinc-400">
                    {mealEligible ? "Base " : "Price "}
                    {formatPence(sheetItem.basePrice)}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="min-h-12 min-w-12 rounded-2xl bg-zinc-800 text-lg text-zinc-200"
                onClick={() => setSheetItem(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {isLoadedFriesSheet(sheetItem, activeCategory.convexCategory) ? (
              <div className="mt-5 space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Seasoning
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {loadedFriesSeasonings.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setLfSeasoning(s)}
                        className={[
                          "min-h-14 min-w-[4.5rem] rounded-2xl border px-4 text-sm font-bold",
                          lfSeasoning === s
                            ? "border-[#00955e]/60 bg-[rgba(0,149,94,0.16)] text-white"
                            : "border-zinc-800 bg-zinc-950 text-zinc-300",
                        ].join(" ")}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Sauce
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {loadedFriesSauces.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setLfSauce(s)}
                        className={[
                          "min-h-14 min-w-[4.5rem] rounded-2xl border px-4 text-sm font-bold",
                          lfSauce === s
                            ? "border-[#00955e]/60 bg-[rgba(0,149,94,0.16)] text-white"
                            : "border-zinc-800 bg-zinc-950 text-zinc-300",
                        ].join(" ")}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Add-ons (+{formatPence(loadedFriesAddonPricePence)} each)
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {loadedFriesAddonsList.map((a) => {
                      const on = lfAddons.includes(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() =>
                            setLfAddons((prev) =>
                              on
                                ? prev.filter((x) => x !== a)
                                : [...prev, a],
                            )
                          }
                          className={[
                            "min-h-14 rounded-2xl border px-4 text-left text-sm font-semibold",
                            on
                              ? "border-[#00955e]/60 bg-[rgba(0,149,94,0.16)] text-white"
                              : "border-zinc-800 bg-zinc-950 text-zinc-300",
                          ].join(" ")}
                        >
                          {a}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {isHotDogSheet(sheetItem, activeCategory.convexCategory) ? (
              <div className="mt-5 space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Onions (choose one)
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Caramelized or crispy — not both. None is free.
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    {HOT_DOG_ONION_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setHdOnion(opt)}
                        className={[
                          "flex min-h-14 w-full items-center justify-between rounded-2xl border px-4 text-left text-sm font-semibold",
                          hdOnion === opt
                            ? "border-[#00955e]/60 bg-[rgba(0,149,94,0.16)] text-white"
                            : "border-zinc-800 bg-zinc-950 text-zinc-300",
                        ].join(" ")}
                      >
                        <span>{opt}</span>
                        {opt === "None" ? (
                          <span className="text-xs font-normal text-zinc-500">
                            —
                          </span>
                        ) : (
                          <span className="text-xs font-normal text-[#00955e]">
                            +{formatPence(HOT_DOG_ONION_PRICE_PENCE)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Cheese
                  </p>
                  <button
                    type="button"
                    onClick={() => setHdCheese((c) => !c)}
                    className={[
                      "mt-2 flex min-h-14 w-full items-center justify-between rounded-2xl border px-4 text-left text-sm font-semibold",
                      hdCheese
                        ? "border-[#00955e]/60 bg-[rgba(0,149,94,0.16)] text-white"
                        : "border-zinc-800 bg-zinc-950 text-zinc-300",
                    ].join(" ")}
                  >
                    <span>Add cheese</span>
                    <span className="text-xs font-normal text-[#00955e]">
                      +{formatPence(HOT_DOG_CHEESE_PRICE_PENCE)}
                    </span>
                  </button>
                </div>
              </div>
            ) : null}

            {mealEligible ? (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSheetMeal(false)}
                  className={[
                    "min-h-16 rounded-2xl border px-4 text-left text-sm font-semibold transition-colors",
                    !sheetMeal
                    ? "border-[#00955e]/60 bg-[rgba(0,149,94,0.16)] text-white"
                    : "border-zinc-800 bg-zinc-950 text-zinc-300",
                ].join(" ")}
              >
                Individual
                  <div className="mt-1 text-xs font-normal text-zinc-400">
                    Base price only
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSheetMeal(true)}
                  className={[
                    "min-h-16 rounded-2xl border px-4 text-left text-sm font-semibold transition-colors",
                    sheetMeal
                    ? "border-[#00955e]/60 bg-[rgba(0,149,94,0.16)] text-white"
                    : "border-zinc-800 bg-zinc-950 text-zinc-300",
                ].join(" ")}
              >
                Make it a Meal
                  <div className="mt-1 text-xs font-normal text-zinc-400">
                    + {formatPence(mealUpchargePence)} · {activeMealComboLabel}
                  </div>
                </button>
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-zinc-300">
                Quantity
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 text-2xl font-semibold"
                  onClick={() => setSheetQty((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <div className="min-w-[3rem] text-center text-xl font-bold">
                  {sheetQty}
                </div>
                <button
                  type="button"
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 text-2xl font-semibold"
                  onClick={() => setSheetQty((q) => q + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="min-h-14 rounded-2xl bg-zinc-800 font-semibold text-white"
                onClick={() => setSheetItem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="min-h-14 rounded-2xl bg-[#00955e] font-bold text-white shadow-[var(--tryo-glow)] hover:bg-[#007a4c] active:bg-[#007a4c]"
                onClick={addFromSheet}
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addMenuOpen ? (
        <div
          className="fixed inset-0 z-[46] flex items-end justify-center bg-black/70 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-menu-title"
        >
          <div className="max-h-[min(90dvh,720px)] w-full max-w-lg overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2
                id="add-menu-title"
                className="text-xl font-bold text-white"
              >
                Add item
              </h2>
              <button
                type="button"
                className="min-h-12 min-w-12 rounded-2xl bg-zinc-800 text-lg text-zinc-200"
                onClick={() => {
                  setAddMenuOpen(false);
                  setAddMenuStep("category");
                  setAddMenuCategory(null);
                  setAddMenuName("");
                  setAddMenuPriceRaw("");
                  setAddMenuError(null);
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {addMenuStep === "category"
                ? "Choose a category. The item is saved to your menu and appears on the till and printed menu."
                : "Name and price in pounds. Burgers and Wraps still use meal options like other items in those categories."}
            </p>

            {addMenuStep === "category" ? (
              <>
                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {CATEGORIES.filter((c) => c.convexCategory).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="min-h-14 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-left text-sm font-semibold text-white hover:border-[#00955e]/50 hover:bg-zinc-900"
                      onClick={() => {
                        setAddMenuCategory(c.convexCategory!);
                        setAddMenuStep("details");
                        setAddMenuError(null);
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-5 min-h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-950 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
                  onClick={() => {
                    setAddMenuOpen(false);
                    setAddMenuStep("category");
                    setAddMenuCategory(null);
                    setAddMenuName("");
                    setAddMenuPriceRaw("");
                    setAddMenuError(null);
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <div className="mt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-300">
                    Category:{" "}
                    <span className="text-white">
                      {CATEGORIES.find((x) => x.convexCategory === addMenuCategory)
                        ?.label ?? addMenuCategory}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="text-sm font-semibold text-[#00955e] hover:underline"
                    onClick={() => {
                      setAddMenuStep("category");
                      setAddMenuCategory(null);
                      setAddMenuError(null);
                    }}
                  >
                    Change
                  </button>
                </div>

                <label className="mt-5 block text-sm font-semibold text-zinc-300">
                  Item name
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  maxLength={200}
                  className="mt-2 h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-lg font-semibold text-white outline-none focus:border-[#00955e]/70"
                  value={addMenuName}
                  onChange={(e) => setAddMenuName(e.target.value)}
                  placeholder="e.g. Halloumi wrap"
                />

                <label className="mt-4 block text-sm font-semibold text-zinc-300">
                  Price (£)
                </label>
                <input
                  inputMode="decimal"
                  className="mt-2 h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-xl font-semibold text-white outline-none focus:border-[#00955e]/70"
                  value={addMenuPriceRaw}
                  onChange={(e) => setAddMenuPriceRaw(e.target.value)}
                  placeholder="6.50"
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Type the price in pounds (you can use £ or decimals like 6.5).
                </p>

                {addMenuError ? (
                  <p className="mt-3 text-sm font-medium text-red-400">
                    {addMenuError}
                  </p>
                ) : null}

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    className="min-h-14 rounded-2xl border border-zinc-700 bg-zinc-950 font-semibold text-white hover:bg-zinc-800"
                    onClick={() => {
                      setAddMenuOpen(false);
                      setAddMenuStep("category");
                      setAddMenuCategory(null);
                      setAddMenuName("");
                      setAddMenuPriceRaw("");
                      setAddMenuError(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!canSaveAddMenu || addMenuSaving}
                    className="min-h-14 rounded-2xl bg-[#00955e] font-bold text-white shadow-[var(--tryo-glow)] hover:bg-[#007a4c] active:bg-[#007a4c] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                    onClick={() => void saveAddMenuItem()}
                  >
                    {addMenuSaving ? "Saving…" : "Save to menu"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {customItemOpen ? (
        <div
          className="fixed inset-0 z-[45] flex items-end justify-center bg-black/70 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="custom-item-title"
        >
          <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2
                id="custom-item-title"
                className="text-xl font-bold text-white"
              >
                Custom item
              </h2>
              <button
                type="button"
                className="min-h-12 min-w-12 rounded-2xl bg-zinc-800 text-lg text-zinc-200"
                onClick={() => {
                  setCustomItemOpen(false);
                  setCustomItemName("");
                  setCustomItemPriceRaw("");
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Not on the menu — name and price only.
            </p>

            <label className="mt-5 block text-sm font-semibold text-zinc-300">
              Item
            </label>
            <input
              type="text"
              autoComplete="off"
              maxLength={120}
              className="mt-2 h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-lg font-semibold text-white outline-none focus:border-[#00955e]/70"
              value={customItemName}
              onChange={(e) => setCustomItemName(e.target.value)}
              placeholder="e.g. Extra sauce pot"
            />

            <label className="mt-4 block text-sm font-semibold text-zinc-300">
              Price
            </label>
            <input
              inputMode="decimal"
              className="mt-2 h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-xl font-semibold text-white outline-none focus:border-[#00955e]/70"
              value={customItemPriceRaw}
              onChange={(e) => setCustomItemPriceRaw(e.target.value)}
              placeholder="0.00"
            />

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="min-h-14 rounded-2xl border border-zinc-700 bg-zinc-950 font-semibold text-white hover:bg-zinc-800"
                onClick={() => {
                  setCustomItemOpen(false);
                  setCustomItemName("");
                  setCustomItemPriceRaw("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canAddCustom}
                className="min-h-14 rounded-2xl bg-[#00955e] font-bold text-white shadow-[var(--tryo-glow)] hover:bg-[#007a4c] active:bg-[#007a4c] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                onClick={addCustomItemToCart}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {payOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pay-title"
        >
          <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="pay-title" className="text-xl font-bold text-white">
                  Payment
                </h2>
                <p className="mt-1 text-sm text-zinc-400">Walk-in takeaway</p>
              </div>
              <button
                type="button"
                className="min-h-12 min-w-12 rounded-2xl bg-zinc-800 text-lg text-zinc-200"
                onClick={() => setPayOpen(false)}
                aria-label="Close payment"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-1 text-sm text-zinc-400">
              <div className="flex justify-between gap-3">
                <span>Subtotal</span>
                <span className="font-semibold text-zinc-200">
                  {formatPence(cartSubtotalPence)}
                </span>
              </div>
              {discountPence > 0 ? (
                <div className="flex justify-between gap-3 text-[#00955e]">
                  <span>
                    {discountKind === "percentage"
                      ? `Discount (${parsePercentDiscountInput(discountRaw)}%)`
                      : "Discount"}
                  </span>
                  <span className="shrink-0 font-semibold">
                    {formatPence(-discountPence)}
                  </span>
                </div>
              ) : null}
            </div>
            <p className="mt-2 text-center text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Amount due
            </p>
            <div className="text-center text-4xl font-extrabold text-[#00955e] drop-shadow-[0_0_20px_rgba(0,149,94,0.35)]">
              {formatPence(amountDuePence)}
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Discount
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDiscountKind("percentage");
                    setDiscountRaw("");
                  }}
                  className={[
                    "min-h-14 rounded-2xl border text-sm font-bold",
                    discountKind === "percentage"
                    ? "border-[#00955e]/60 bg-[rgba(0,149,94,0.16)] text-white"
                    : "border-zinc-800 bg-zinc-950 text-zinc-300",
                ].join(" ")}
              >
                Percentage
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiscountKind("fixed");
                    setDiscountRaw("");
                  }}
                  className={[
                    "min-h-14 rounded-2xl border text-sm font-bold",
                    discountKind === "fixed"
                    ? "border-[#00955e]/60 bg-[rgba(0,149,94,0.16)] text-white"
                    : "border-zinc-800 bg-zinc-950 text-zinc-300",
                ].join(" ")}
              >
                Fixed (£)
                </button>
              </div>
              <label className="mt-3 block text-sm font-semibold text-zinc-300">
                {discountKind === "percentage"
                  ? "Percent off subtotal"
                  : "Amount off subtotal"}
              </label>
              <input
                inputMode="decimal"
                className="mt-2 h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-xl font-semibold text-white outline-none focus:border-[#00955e]/70"
                value={discountRaw}
                onChange={(e) => setDiscountRaw(e.target.value)}
                placeholder={discountKind === "percentage" ? "0" : "0.00"}
              />
              <p className="mt-1 text-xs text-zinc-500">
                {discountKind === "percentage"
                  ? "Enter 0–100 (decimals allowed). Leave empty for no discount."
                  : "Enter a pound amount (e.g. 2.50). Capped at subtotal."}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPayMethod("card")}
                className={[
                  "min-h-16 rounded-2xl border text-lg font-bold",
                  payMethod === "card"
                    ? "border-[#00955e]/60 bg-[rgba(0,149,94,0.16)] text-white"
                    : "border-zinc-800 bg-zinc-950 text-zinc-300",
                ].join(" ")}
              >
                Card
              </button>
              <button
                type="button"
                onClick={() => setPayMethod("cash")}
                className={[
                  "min-h-16 rounded-2xl border text-lg font-bold",
                  payMethod === "cash"
                    ? "border-[#00955e]/60 bg-[rgba(0,149,94,0.16)] text-white"
                    : "border-zinc-800 bg-zinc-950 text-zinc-300",
                ].join(" ")}
              >
                Cash
              </button>
            </div>

            {payMethod === "cash" ? (
              <div className="mt-5 space-y-3">
                <label className="block text-sm font-semibold text-zinc-300">
                  Given amount
                </label>
                <input
                  inputMode="decimal"
                  className="h-16 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-2xl font-semibold text-white outline-none focus:border-[#00955e]/70"
                  value={givenRaw}
                  onChange={(e) => setGivenRaw(e.target.value)}
                  placeholder="0.00"
                />
                <div
                  className={[
                    "rounded-2xl border px-4 py-3 text-lg font-bold",
                    changeShort
                      ? "border-red-500/60 bg-red-950/40 text-red-200"
                      : "border-zinc-800 bg-zinc-950 text-white",
                  ].join(" ")}
                >
                  Change due:{" "}
                  {givenPence === null
                    ? "—"
                    : formatPence(changePence ?? 0)}
                </div>
                {changeShort ? (
                  <p className="text-sm font-semibold text-red-300">
                    Given amount is less than the amount due.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-5 text-sm text-zinc-400">
                Card is recorded for the till. Customer completes payment on the
                separate card terminal.
              </p>
            )}

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="min-h-14 rounded-2xl bg-zinc-800 font-semibold text-white"
                onClick={() => setPayOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="min-h-14 rounded-2xl bg-[#00955e] font-bold text-white shadow-[var(--tryo-glow)] hover:bg-[#007a4c] active:bg-[#007a4c] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                disabled={
                  payMethod === "cash" &&
                  (givenPence === null || givenPence < amountDuePence)
                }
                onClick={() => void submit()}
              >
                Submit Order
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ReceiptStage data={receipt} />
    </div>
  );
}
