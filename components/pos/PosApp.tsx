"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/convex-api";
import { CATEGORIES, type CategoryDef } from "@/lib/categories";
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
  isMeal: boolean;
  mealLabel: string | null;
  basePricePence: number;
  mealUpchargePence: number;
  unitPricePence: number;
  quantity: number;
};

function lineKey(itemName: string, isMeal: boolean) {
  return `${itemName}::${isMeal ? "meal" : "ind"}`;
}

function useMenuConfigMap() {
  return useQuery(api.menu.getMenuConfig, {});
}

function useBurgerItems(activeCategory: CategoryDef | null) {
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
  const burgerItems = useBurgerItems(activeCategory);

  const seedDb = useMutation(api.seed.seed);
  const submitOrder = useMutation(api.orders.submitOrder);

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
      : "https://tryoeats.co.uk/";

  const [cart, setCart] = useState<CartLine[]>([]);

  const [sheetItem, setSheetItem] = useState<MenuRow | null>(null);
  const [sheetMeal, setSheetMeal] = useState(false);
  const [sheetQty, setSheetQty] = useState(1);

  const [comingSoonLabel, setComingSoonLabel] = useState<string | null>(null);

  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<"card" | "cash">("card");
  const [givenRaw, setGivenRaw] = useState("");

  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);
  const printedOrderRef = useRef<number | null>(null);

  useEffect(() => {
    if (!receipt) return;
    if (printedOrderRef.current === receipt.orderNumber) return;
    printedOrderRef.current = receipt.orderNumber;
    window.print();
  }, [receipt]);

  const subtotalPence = useMemo(
    () =>
      cart.reduce((acc, l) => acc + l.unitPricePence * l.quantity, 0),
    [cart],
  );
  const deliveryFeePence = 0;
  const totalPence = subtotalPence + deliveryFeePence;
  const totalItemCount = useMemo(
    () => cart.reduce((acc, l) => acc + l.quantity, 0),
    [cart],
  );

  const givenPence = parsePenceFromInput(givenRaw);
  const changePence =
    payMethod === "cash" && givenPence !== null
      ? givenPence - totalPence
      : null;
  const changeShort =
    payMethod === "cash" && givenPence !== null && givenPence < totalPence;

  const openItemSheet = useCallback(
    (item: MenuRow) => {
      setSheetItem(item);
      setSheetMeal(false);
      setSheetQty(1);
    },
    [],
  );

  const addFromSheet = useCallback(() => {
    if (!sheetItem) return;
    const isMeal = sheetMeal;
    const up = isMeal ? mealUpchargePence : 0;
    const unit = sheetItem.basePrice + up;
    const label = isMeal ? mealComboLabel : null;
    const key = lineKey(sheetItem.name, isMeal);
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.lineKey === key);
      if (idx === -1) {
        return [
          ...prev,
          {
            lineKey: key,
            itemName: sheetItem.name,
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
  }, [mealComboLabel, mealUpchargePence, sheetItem, sheetMeal, sheetQty]);

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

  const onCategoryTap = useCallback(
    (cat: CategoryDef) => {
      setActiveCategoryId(cat.id);
      if (!cat.convexCategory) {
        setComingSoonLabel(cat.label);
      }
    },
    [],
  );

  const onTileTap = useCallback(
    (item: MenuRow) => {
      if (!activeCategory.convexCategory) {
        setComingSoonLabel(activeCategory.label);
        return;
      }
      openItemSheet(item);
    },
    [activeCategory.convexCategory, activeCategory.label, openItemSheet],
  );

  const submit = useCallback(async () => {
    if (cart.length === 0) return;
    if (payMethod === "cash") {
      if (givenPence === null) return;
      if (givenPence < totalPence) return;
    }

    const items = cart.map((l) => ({
      itemName: l.itemName,
      isMeal: l.isMeal,
      mealLabel: l.mealLabel,
      unitPrice: l.unitPricePence,
      quantity: l.quantity,
      lineTotal: l.unitPricePence * l.quantity,
    }));

    const res = await submitOrder({
      items,
      subtotal: subtotalPence,
      deliveryFee: deliveryFeePence,
      total: totalPence,
      paymentMethod: payMethod,
      givenAmount: payMethod === "cash" ? givenPence : null,
      changeAmount:
        payMethod === "cash" && givenPence !== null
          ? givenPence - totalPence
          : null,
      totalItemCount,
    });

    const lines: ReceiptLinePrint[] = cart.map((l) => ({
      name: l.itemName,
      quantity: l.quantity,
      baseLineTotalPence: l.basePricePence * l.quantity,
      isMeal: l.isMeal,
      mealLabel: l.mealLabel,
      mealLineTotalPence: l.isMeal ? l.mealUpchargePence * l.quantity : 0,
    }));

    setReceipt({
      orderNumber: res.orderNumber,
      createdAt: res.createdAt,
      lines,
      subtotalPence,
      deliveryFeePence,
      totalPence,
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
  }, [
    businessAddress,
    businessName,
    businessPhone,
    businessVat,
    cart,
    deliveryFeePence,
    givenPence,
    payMethod,
    qrUrl,
    subtotalPence,
    submitOrder,
    totalItemCount,
    totalPence,
  ]);

  const itemsForGrid: MenuRow[] = useMemo(() => {
    if (!activeCategory.convexCategory) return [];
    if (!burgerItems) return [];
    return (burgerItems as MenuItemDoc[]).map((r) => ({
      _id: r._id,
      name: r.name,
      basePrice: r.basePrice,
    }));
  }, [activeCategory.convexCategory, burgerItems]);

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
        <div className="text-xs text-zinc-500">Rushden Lakes · Takeaway</div>
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
                        ? "bg-amber-400 text-zinc-950"
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
            {!activeCategory.convexCategory ? (
              <div className="flex h-full min-h-[240px] items-center justify-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-zinc-400">
                <p className="max-w-sm text-base">
                  <span className="font-semibold text-zinc-200">
                    {activeCategory.label}
                  </span>{" "}
                  is coming soon. Switch to Burgers to take orders.
                </p>
              </div>
            ) : burgerItems === undefined ? (
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
                    className="flex min-h-[88px] flex-col items-start justify-between rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-4 text-left transition-transform active:scale-[0.98]"
                  >
                    <span className="text-base font-semibold leading-snug text-white">
                      {item.name}
                    </span>
                    <span className="mt-2 text-lg font-bold text-amber-300">
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
                          {line.isMeal ? (
                            <span>
                              Meal ·{" "}
                              <span className="text-zinc-300">
                                {line.mealLabel}
                              </span>
                            </span>
                          ) : (
                            <span>Individual</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-amber-300">
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
                {formatPence(subtotalPence)}
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
              <span className="text-amber-300">{formatPence(totalPence)}</span>
            </div>
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => {
                setPayOpen(true);
                setPayMethod("card");
                setGivenRaw("");
              }}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-amber-400 text-lg font-bold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
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
                <p className="mt-1 text-sm text-zinc-400">
                  Base {formatPence(sheetItem.basePrice)}
                </p>
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

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSheetMeal(false)}
                className={[
                  "min-h-16 rounded-2xl border px-4 text-left text-sm font-semibold transition-colors",
                  !sheetMeal
                    ? "border-amber-400/70 bg-amber-400/10 text-white"
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
                    ? "border-amber-400/70 bg-amber-400/10 text-white"
                    : "border-zinc-800 bg-zinc-950 text-zinc-300",
                ].join(" ")}
              >
                Make it a Meal
                <div className="mt-1 text-xs font-normal text-zinc-400">
                  + {formatPence(mealUpchargePence)} · {mealComboLabel}
                </div>
              </button>
            </div>

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
                className="min-h-14 rounded-2xl bg-amber-400 font-bold text-zinc-950"
                onClick={addFromSheet}
              >
                Add to Cart
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

            <div className="mt-4 text-center text-4xl font-extrabold text-amber-300">
              {formatPence(totalPence)}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPayMethod("card")}
                className={[
                  "min-h-16 rounded-2xl border text-lg font-bold",
                  payMethod === "card"
                    ? "border-amber-400/70 bg-amber-400/10 text-white"
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
                    ? "border-amber-400/70 bg-amber-400/10 text-white"
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
                  className="h-16 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-2xl font-semibold text-white outline-none focus:border-amber-400/60"
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
                    Given amount is less than the total.
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
                className="min-h-14 rounded-2xl bg-amber-400 font-bold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={
                  payMethod === "cash" &&
                  (givenPence === null || givenPence < totalPence)
                }
                onClick={() => void submit()}
              >
                Submit Order
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {comingSoonLabel ? (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-center">
            <p className="text-lg font-semibold text-white">{comingSoonLabel}</p>
            <p className="mt-2 text-sm text-zinc-400">Coming soon</p>
            <button
              type="button"
              className="mt-6 min-h-14 w-full rounded-2xl bg-amber-400 text-lg font-bold text-zinc-950"
              onClick={() => setComingSoonLabel(null)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      <ReceiptStage data={receipt} />
    </div>
  );
}
