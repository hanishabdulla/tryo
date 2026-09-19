"use client";

import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/convex-api";
import {
  computePaymentDiscountPence,
  parsePercentDiscountInput,
} from "@/lib/discount";
import { formatPence, parsePenceFromInput } from "@/lib/money";
import { todayBusinessDate, type TillDaySummary } from "@/lib/till";
import {
  ReceiptStage,
  type ReceiptLinePrint,
  type ReceiptPayload,
} from "./ReceiptStage";
import { CollectionQueue } from "./CollectionQueue";
import { TillManager } from "./TillManager";

type ItemOption = { name: string; price: number };

type MenuRow = {
  _id: string;
  name: string;
  description?: string;
  basePrice: number;
  options?: ItemOption[];
};

type MenuCategory = {
  _id: string;
  name: string;
  mealUpgrade: boolean;
};

type CartLine = {
  lineKey: string;
  itemName: string;
  sourceCategory: string;
  /** Category offered "Make it a meal" when the line was added. */
  mealEligible: boolean;
  isMeal: boolean;
  mealLabel: string | null;
  basePricePence: number;
  mealUpchargePence: number;
  unitPricePence: number;
  quantity: number;
  options: ItemOption[];
  note: string;
};

/** Same item, meal choice, options and instructions stack into one line. */
function lineKey(
  itemName: string,
  isMeal: boolean,
  options: ItemOption[],
  note: string,
) {
  const names = options.map((o) => o.name).sort().join("|");
  return `${itemName}::${isMeal ? "meal" : "ind"}::${names}::${note}`;
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

export default function PosApp() {
  const categories = useQuery(api.menu.listCategories, {}) as
    | MenuCategory[]
    | undefined;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const activeCategory =
    categories?.find((c) => c.name === selectedCategory) ?? categories?.[0] ?? null;

  const config = useMenuConfigMap();
  const categoryMenuItems = useQuery(
    api.menu.listItemsByCategory,
    activeCategory ? { category: activeCategory.name } : "skip",
  );

  const mealEligible = activeCategory?.mealUpgrade ?? false;

  const submitOrder = useMutation(api.orders.submitOrder);

  const mealUpchargePence = useMemo(() => {
    const v = config?.mealUpcharge;
    return typeof v === "number" && Number.isFinite(v) ? v : 299;
  }, [config]);

  const activeMealComboLabel = useMemo(() => {
    const v = config?.mealComboLabel;
    return typeof v === "string" && v.length > 0 ? v : "Fries + Drink";
  }, [config]);

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

  const [businessDate, setBusinessDate] = useState(todayBusinessDate);
  const todayTill = useQuery(api.till.getDay, { businessDate }) as
    | TillDaySummary
    | null
    | undefined;
  const openSession = useQuery(api.till.findOpenSession, {}) as
    | { businessDate: string; openedAt: number }
    | null
    | undefined;
  const activeTillDate =
    todayTill || openSession === undefined
      ? businessDate
      : openSession?.businessDate ?? businessDate;
  const activeTill = useQuery(api.till.getDay, {
    businessDate: activeTillDate,
  }) as TillDaySummary | null | undefined;
  const tillDay =
    todayTill === undefined || openSession === undefined
      ? undefined
      : todayTill ?? activeTill;
  const tillTakingOrders =
    tillDay?.status === "open" && tillDay.businessDate === businessDate;
  const previousTillNeedsSettlement =
    tillDay?.status === "open" && tillDay.businessDate !== businessDate;
  const [tillManagerOpen, setTillManagerOpen] = useState(false);

  useEffect(() => {
    const updateDate = () => setBusinessDate(todayBusinessDate());
    const timer = window.setInterval(updateDate, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const [cart, setCart] = useState<CartLine[]>([]);

  const [sheetItem, setSheetItem] = useState<MenuRow | null>(null);
  const [sheetMeal, setSheetMeal] = useState(false);
  const [sheetQty, setSheetQty] = useState(1);
  const [sheetOptions, setSheetOptions] = useState<string[]>([]);
  const [sheetNote, setSheetNote] = useState("");
  const [sheetNoteOpen, setSheetNoteOpen] = useState(false);
  const [customItemOpen, setCustomItemOpen] = useState(false);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPriceRaw, setCustomItemPriceRaw] = useState("");

  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<"card" | "cash">("card");
  const [givenRaw, setGivenRaw] = useState("");
  const [discountKind, setDiscountKind] = useState<"percentage" | "fixed">(
    "percentage",
  );
  const [discountRaw, setDiscountRaw] = useState("");
  const [printCustomerReceipt, setPrintCustomerReceipt] = useState(true);

  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);
  const [orderBusy, setOrderBusy] = useState(false);
  const orderInFlight = useRef(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const receiptInFlight = useRef(false);
  const printedOrderRef = useRef<string | null>(null);
  const [printerOpen, setPrinterOpen] = useState(false);
  const [printers, setPrinters] = useState<
    { name: string; description?: string; isDefault?: boolean }[]
  >([]);
  const [configuredPrinter, setConfiguredPrinter] = useState("");
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [printerBusy, setPrinterBusy] = useState(false);
  const [printerMessage, setPrinterMessage] = useState<string | null>(null);

  const refreshPrinters = useCallback(async () => {
    const electron = window.tryoElectron;
    if (!electron) return;
    setPrinterBusy(true);
    setPrinterMessage(null);
    try {
      const [available, saved] = await Promise.all([
        electron.listPrinters(),
        electron.getReceiptPrinter(),
      ]);
      setPrinters(available);
      setConfiguredPrinter(saved);
      setSelectedPrinter(
        saved || available.find((printer) => printer.isDefault)?.name || "",
      );
      if (available.length === 0) {
        setPrinterMessage(
          "No printers found. Install the Windows printer driver, then refresh.",
        );
      }
    } catch {
      setPrinterMessage("Could not read printers from the operating system.");
    } finally {
      setPrinterBusy(false);
    }
  }, []);

  useEffect(() => {
    const electron = window.tryoElectron;
    if (!electron) return;
    void electron.getReceiptPrinter().then(setConfiguredPrinter).catch(() => {});
  }, []);

  const printCurrentReceipt = useCallback(async (customerCopy = true) => {
    if (receiptInFlight.current) return false;
    receiptInFlight.current = true;
    setReceiptBusy(true);
    try {
    const electron = window.tryoElectron;
    if (!electron) {
      window.print();
      return true;
    }
    const device = await electron.getReceiptPrinter();
    setConfiguredPrinter(device);
    if (!device) {
      setPrinterOpen(true);
      await refreshPrinters();
      setPrinterMessage("Choose and test a receipt printer before taking orders.");
      return false;
    }
    const result = await electron.printReceiptSilent({ customerCopy });
    if (!result.ok) {
      setPrinterMessage(result.error || "Receipt printing failed.");
      setPrinterOpen(true);
      return false;
    }
    return true;
    } catch (error) {
      setPrinterMessage(`Order saved; receipt was not printed. ${error instanceof Error ? error.message : "Check the printer connection."} Use Reprint last after fixing it.`);
      setPrinterOpen(true);
      return false;
    } finally {
      receiptInFlight.current = false;
      setReceiptBusy(false);
    }
  }, [refreshPrinters]);

  useEffect(() => {
    if (!receipt) return;
    const receiptKey = `${receipt.createdAt}:${receipt.orderNumber}`;
    if (printedOrderRef.current === receiptKey) return;
    printedOrderRef.current = receiptKey;
    void printCurrentReceipt(receipt.printCustomerReceipt);
  }, [printCurrentReceipt, receipt]);

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

  const openItemSheet = useCallback((item: MenuRow) => {
    setSheetItem(item);
    setSheetMeal(false);
    setSheetQty(1);
    setSheetOptions([]);
    setSheetNote("");
    setSheetNoteOpen(false);
  }, []);

  const sheetOptionsPence = (sheetItem?.options ?? [])
    .filter((o) => sheetOptions.includes(o.name))
    .reduce((sum, o) => sum + o.price, 0);

  const addFromSheet = useCallback(() => {
    if (!sheetItem || !activeCategory) return;
    const isMeal = mealEligible && sheetMeal;
    const up = isMeal ? mealUpchargePence : 0;
    const options = (sheetItem.options ?? []).filter((o) =>
      sheetOptions.includes(o.name),
    );
    const note = sheetNote.trim().replace(/\s+/g, " ").slice(0, 200);
    const unit =
      sheetItem.basePrice + up + options.reduce((sum, o) => sum + o.price, 0);
    const label = isMeal ? activeMealComboLabel : null;
    const key = lineKey(sheetItem.name, isMeal, options, note);
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.lineKey === key);
      if (idx === -1) {
        return [
          ...prev,
          {
            lineKey: key,
            itemName: sheetItem.name,
            sourceCategory: activeCategory.name,
            mealEligible,
            isMeal,
            mealLabel: label,
            basePricePence: sheetItem.basePrice,
            mealUpchargePence: up,
            unitPricePence: unit,
            quantity: sheetQty,
            options,
            note,
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
    activeCategory,
    activeMealComboLabel,
    mealEligible,
    mealUpchargePence,
    sheetItem,
    sheetMeal,
    sheetNote,
    sheetOptions,
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
            mealEligible: false,
            isMeal: false,
            mealLabel: null,
            basePricePence: price,
            mealUpchargePence: 0,
            unitPricePence: price,
            quantity: 1,
            options: [],
            note: "",
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

  const onTileTap = useCallback(
    (item: MenuRow) => {
      openItemSheet(item);
    },
    [openItemSheet],
  );

  const submit = useCallback(async () => {
    if (cart.length === 0) return;
    if (!tillTakingOrders) {
      setPayOpen(false);
      setTillManagerOpen(true);
      return;
    }
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

    const items = cart.map((l) => ({
      itemName: l.itemName,
      isMeal: l.isMeal,
      mealLabel: l.mealLabel,
      unitPrice: l.unitPricePence,
      quantity: l.quantity,
      lineTotal: l.unitPricePence * l.quantity,
      ...(l.options.length ? { addons: l.options.map((o) => o.name) } : {}),
      ...(l.note ? { note: l.note } : {}),
    }));

    if (orderInFlight.current) return;
    orderInFlight.current = true;
    setOrderBusy(true);
    setOrderError(null);
    let res;
    try {
      res = await submitOrder({
      items,
      deliveryFee: deliveryFeePence,
      paymentMethod: payMethod,
      givenAmount: payMethod === "cash" ? givenPence : null,
      totalItemCount,
      discountMode: serverDiscountMode,
      discountInput: serverDiscountInput,
      });
    } catch (error) {
      setOrderError(`Order could not be saved: ${error instanceof Error ? error.message : "Check your internet connection and try again."}`);
      return;
    } finally {
      orderInFlight.current = false;
      setOrderBusy(false);
    }

    const lines: ReceiptLinePrint[] = cart.map((l) => ({
      name: l.itemName,
      quantity: l.quantity,
      baseLineTotalPence: l.basePricePence * l.quantity,
      isMeal: l.isMeal,
      mealLabel: l.mealLabel,
      mealLineTotalPence: l.isMeal ? l.mealUpchargePence * l.quantity : 0,
      addonLines: l.options.length
        ? l.options.map((o) => ({ name: o.name, lineTotalPence: o.price * l.quantity }))
        : undefined,
      note: l.note || undefined,
    }));

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
      printCustomerReceipt,
      businessAddress,
      businessPhone,
      businessVat,
    });

    setCart([]);
    setPayOpen(false);
    setGivenRaw("");
    setPayMethod("card");
    setDiscountKind("percentage");
    setDiscountRaw("");
    setPrintCustomerReceipt(true);
  }, [
    amountDuePence,
    businessAddress,
    businessPhone,
    businessVat,
    cart,
    deliveryFeePence,
    discountKind,
    discountRaw,
    givenPence,
    payMethod,
    printCustomerReceipt,
    submitOrder,
    tillTakingOrders,
    totalItemCount,
  ]);

  const itemsForGrid = (categoryMenuItems ?? []) as MenuRow[];

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col bg-zinc-950 text-zinc-50">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] bg-zinc-950 px-4">
        <div className="flex min-w-0 items-center gap-4">
          <Image
            src="/brand/tryo-wordmark.png"
            alt="Tryo"
            width={485}
            height={240}
            preload
            unoptimized
            className="h-9 w-auto select-none"
          />
          <div className="hidden h-7 w-px bg-white/10 sm:block" />
          <div className="hidden min-w-0 leading-tight sm:block">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Point of sale
            </div>
            <div className="truncate text-sm font-medium text-zinc-300">
              Rushden Lakes · Takeaway
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CollectionQueue />
          <button
            type="button"
            onClick={() => setTillManagerOpen(true)}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-semibold transition-colors ${
              tillTakingOrders
                ? "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-200 hover:bg-emerald-500/10"
                : "border-amber-500/25 bg-amber-500/[0.07] text-amber-200 hover:bg-amber-500/10"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                tillTakingOrders ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            {tillTakingOrders
              ? `Till ${formatPence(tillDay.totals.expectedCashPence)}`
              : previousTillNeedsSettlement
                ? "Settle previous day"
                : tillDay?.status === "closed"
                  ? "Day closed"
                  : "Start day"}
          </button>
          <Link
            href="/dashboard/daily"
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
          >
            Dashboard
          </Link>
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
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
          >
            Print menu
          </button>
          <button
            type="button"
            onClick={() => {
              setPrinterOpen(true);
              void refreshPrinters();
            }}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
          >
            <span
              className={`h-2 w-2 rounded-full ${configuredPrinter ? "bg-[#34c68a] shadow-[0_0_0_3px_rgba(52,198,138,0.18)]" : "bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]"}`}
            />
            Receipt printer
          </button>
          <button
            type="button"
            disabled={!receipt || receiptBusy}
            onClick={() =>
              void printCurrentReceipt(receipt?.printCustomerReceipt ?? true)
            }
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/15 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {receiptBusy ? "Printing…" : "Reprint last"}
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="flex min-h-0 min-w-0 flex-col border-white/[0.07] lg:border-r">
          <div className="shrink-0 border-b border-white/[0.06] px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {(categories ?? []).map((cat) => {
                const active = cat._id === activeCategory?._id;
                return (
                  <button
                    key={cat._id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.name)}
                    className={[
                      "min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold transition-colors",
                      active
                        ? "bg-[#00955e] text-white shadow-[var(--tryo-glow)]"
                        : "bg-white/[0.04] text-zinc-300 ring-1 ring-inset ring-white/[0.06] hover:bg-white/[0.08] hover:text-white",
                    ].join(" ")}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {categories === undefined ||
            (activeCategory && categoryMenuItems === undefined) ? (
              <div className="flex h-full min-h-[240px] items-center justify-center text-zinc-500">
                Loading menu…
              </div>
            ) : itemsForGrid.length === 0 ? (
              <div className="flex h-full min-h-[240px] items-center justify-center text-zinc-500">
                No items in this category. Add them in Dashboard → Menu.
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
                {itemsForGrid.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => onTileTap(item)}
                    className="group flex min-h-[112px] flex-col items-start justify-between rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-4 text-left transition duration-150 hover:border-[#00955e]/40 hover:bg-zinc-900 active:scale-[0.98]"
                  >
                    <span>
                      <span className="block text-base font-semibold leading-snug text-white">
                        {item.name}
                      </span>
                      {item.description ? (
                        <span className="mt-1 line-clamp-2 block text-xs leading-snug text-zinc-500">
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-3 flex w-full items-center justify-between">
                      <span className="text-base font-semibold text-[#34c68a]">
                        {formatPence(item.basePrice)}
                      </span>
                      <span
                        aria-hidden
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.05] text-base leading-none text-zinc-400 transition-colors group-hover:bg-[#00955e] group-hover:text-white"
                      >
                        +
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-t border-white/[0.06] bg-[#0c0c0e] lg:border-t-0">
          <div className="shrink-0 border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Current order</div>
              {totalItemCount > 0 ? (
                <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-semibold text-zinc-300">
                  {totalItemCount} item{totalItemCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">
              Order number is assigned when payment is submitted.
            </div>
            <button
              type="button"
              onClick={() => {
                setCustomItemOpen(true);
                setCustomItemName("");
                setCustomItemPriceRaw("");
              }}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 text-sm font-semibold text-zinc-300 transition-colors hover:border-[#00955e]/60 hover:bg-[#00955e]/[0.06] hover:text-white active:scale-[0.99]"
            >
              <span className="text-xl leading-none text-[#34c68a]">+</span>
              Custom item
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {cart.length === 0 ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center gap-1 text-center">
                <div className="text-sm font-medium text-zinc-400">No items yet</div>
                <div className="text-xs text-zinc-600">Tap a menu item to add it to the order.</div>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {cart.map((line) => (
                  <li
                    key={line.lineKey}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-white">
                          {line.itemName}
                        </div>
                        <div className="mt-1 text-sm text-zinc-400">
                          {isCustomCartLine(line.lineKey) ? (
                            <span className="text-zinc-400">Custom item</span>
                                                    ) : line.isMeal ? (
                            <span>
                              Meal ·{" "}
                              <span className="text-zinc-300">
                                {line.mealLabel}
                              </span>
                            </span>
                          ) : line.mealEligible ? (
                            <span>Individual</span>
                          ) : (
                            <span>Regular</span>
                          )}
                        </div>
                        {line.options.length > 0 ? (
                          <div className="mt-0.5 text-sm text-zinc-400">
                            +{" "}
                            <span className="text-zinc-300">
                              {line.options.map((o) => o.name).join(", ")}
                            </span>
                          </div>
                        ) : null}
                        {line.note ? (
                          <div className="mt-0.5 text-sm text-amber-300">
                            Note: {line.note}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-white">
                          {formatPence(line.unitPricePence * line.quantity)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center rounded-xl bg-white/[0.05] ring-1 ring-inset ring-white/[0.06]">
                        <button
                          type="button"
                          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-medium text-zinc-200 hover:bg-white/[0.06]"
                          onClick={() => bumpQty(line.lineKey, -1)}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <div className="min-w-[2.5rem] text-center text-base font-semibold">
                          {line.quantity}
                        </div>
                        <button
                          type="button"
                          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-medium text-zinc-200 hover:bg-white/[0.06]"
                          onClick={() => bumpQty(line.lineKey, 1)}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="min-h-12 rounded-xl px-4 text-sm font-semibold text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
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

          <div className="shrink-0 space-y-2.5 border-t border-white/[0.07] bg-[#0c0c0e] p-4">
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
            <div className="flex items-baseline justify-between border-t border-white/[0.06] pt-3 text-xl font-bold text-white">
              <span>Total</span>
              <span className="text-[#34c68a]">
                {formatPence(cartSubtotalPence + deliveryFeePence)}
              </span>
            </div>
            <button
              type="button"
              disabled={cart.length === 0 || !tillTakingOrders}
              onClick={() => {
                if (!tillTakingOrders) {
                  setTillManagerOpen(true);
                  return;
                }
                setPayOpen(true);
                setPayMethod("card");
                setGivenRaw("");
                setDiscountKind("percentage");
                setDiscountRaw("");
              }}
              className="mt-1 flex min-h-14 w-full items-center justify-center rounded-xl bg-[#00955e] text-lg font-bold text-white shadow-[var(--tryo-glow)] transition-colors hover:bg-[#007a4c] active:bg-[#007a4c] disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-zinc-500 disabled:shadow-none"
            >
              Save &amp; Pay
            </button>
          </div>
        </aside>
      </main>

      {sheetItem ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="item-sheet-title"
        >
          <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/[0.08] bg-[#131316] p-6 shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="item-sheet-title"
                  className="text-xl font-bold text-white"
                >
                  {sheetItem.name}
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {mealEligible || sheetItem.options?.length ? "Base " : "Price "}
                  {formatPence(sheetItem.basePrice)}
                  {sheetOptionsPence > 0 ? (
                    <span className="font-semibold text-[#34c68a]">
                      {" "}
                      · with extras {formatPence(sheetItem.basePrice + sheetOptionsPence)}
                    </span>
                  ) : null}
                </p>
                {sheetItem.description ? (
                  <p className="mt-2 text-sm text-zinc-500">
                    {sheetItem.description}
                  </p>
                ) : null}
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

            {mealEligible ? (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSheetMeal(false)}
                  className={[
                    "min-h-16 rounded-2xl border px-4 text-left text-sm font-semibold transition-colors",
                    !sheetMeal
                    ? "border-[#00955e]/60 bg-[rgba(0,149,94,0.16)] text-white"
                    : "border-white/[0.07] bg-zinc-950 text-zinc-300",
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
                    : "border-white/[0.07] bg-zinc-950 text-zinc-300",
                ].join(" ")}
              >
                Make it a Meal
                  <div className="mt-1 text-xs font-normal text-zinc-400">
                    + {formatPence(mealUpchargePence)} · {activeMealComboLabel}
                  </div>
                </button>
              </div>
            ) : null}

            {sheetItem.options?.length ? (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Extras
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {sheetItem.options.map((option) => {
                    const on = sheetOptions.includes(option.name);
                    return (
                      <button
                        key={option.name}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setSheetOptions((prev) =>
                            on
                              ? prev.filter((name) => name !== option.name)
                              : [...prev, option.name],
                          )
                        }
                        className={[
                          "flex min-h-14 items-center justify-between rounded-2xl border px-4 text-left text-sm font-semibold transition-colors",
                          on
                            ? "border-[#00955e]/60 bg-[rgba(0,149,94,0.16)] text-white"
                            : "border-white/[0.07] bg-zinc-950 text-zinc-300",
                        ].join(" ")}
                      >
                        <span>
                          {on ? "✓ " : "+ "}
                          {option.name}
                        </span>
                        <span className="text-xs font-normal text-[#34c68a]">
                          +{formatPence(option.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {sheetNoteOpen ? (
              <label className="mt-5 block">
                <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Custom instructions
                </span>
                <textarea
                  value={sheetNote}
                  onChange={(e) => setSheetNote(e.target.value)}
                  maxLength={200}
                  rows={2}
                  autoFocus
                  placeholder="e.g. no onions, sauce on the side"
                  className="mt-2 w-full rounded-2xl border border-white/[0.07] bg-zinc-950 px-4 py-3 text-base text-white outline-none focus:border-[#00955e]/70"
                />
              </label>
            ) : (
              <button
                type="button"
                onClick={() => setSheetNoteOpen(true)}
                className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 text-sm font-semibold text-zinc-200 hover:border-[#00955e]/50"
              >
                <span className="text-lg leading-none text-[#34c68a]">+</span>
                Custom instructions
              </button>
            )}

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

      {customItemOpen ? (
        <div
          className="fixed inset-0 z-[45] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="custom-item-title"
        >
          <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/[0.08] bg-[#131316] p-6 shadow-2xl shadow-black/60">
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
              className="mt-2 h-14 w-full rounded-2xl border border-white/[0.07] bg-zinc-950 px-4 text-lg font-semibold text-white outline-none focus:border-[#00955e]/70"
              value={customItemName}
              onChange={(e) => setCustomItemName(e.target.value)}
              placeholder="e.g. Extra sauce pot"
            />

            <label className="mt-4 block text-sm font-semibold text-zinc-300">
              Price
            </label>
            <input
              inputMode="decimal"
              className="mt-2 h-14 w-full rounded-2xl border border-white/[0.07] bg-zinc-950 px-4 text-xl font-semibold text-white outline-none focus:border-[#00955e]/70"
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pay-title"
        >
          <div className="w-full max-w-lg rounded-3xl border border-white/[0.08] bg-[#131316] p-6 shadow-2xl shadow-black/60">
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
                <div className="flex justify-between gap-3 text-[#34c68a]">
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
            <div className="text-center text-4xl font-extrabold text-[#34c68a]">
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
                    : "border-white/[0.07] bg-zinc-950 text-zinc-300",
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
                    : "border-white/[0.07] bg-zinc-950 text-zinc-300",
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
                className="mt-2 h-14 w-full rounded-2xl border border-white/[0.07] bg-zinc-950 px-4 text-xl font-semibold text-white outline-none focus:border-[#00955e]/70"
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
                    : "border-white/[0.07] bg-zinc-950 text-zinc-300",
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
                    : "border-white/[0.07] bg-zinc-950 text-zinc-300",
                ].join(" ")}
              >
                Cash
              </button>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Receipt
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                The kitchen ticket always prints.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPrintCustomerReceipt(true)}
                  className={[
                    "min-h-14 rounded-2xl border px-3 text-sm font-bold",
                    printCustomerReceipt
                      ? "border-[#00955e]/60 bg-[rgba(0,149,94,0.16)] text-white"
                      : "border-white/[0.07] bg-zinc-950 text-zinc-300",
                  ].join(" ")}
                >
                  Kitchen + customer
                </button>
                <button
                  type="button"
                  onClick={() => setPrintCustomerReceipt(false)}
                  className={[
                    "min-h-14 rounded-2xl border px-3 text-sm font-bold",
                    !printCustomerReceipt
                      ? "border-[#00955e]/60 bg-[rgba(0,149,94,0.16)] text-white"
                      : "border-white/[0.07] bg-zinc-950 text-zinc-300",
                  ].join(" ")}
                >
                  Kitchen only
                </button>
              </div>
            </div>

            {payMethod === "cash" ? (
              <div className="mt-5 space-y-3">
                <label className="block text-sm font-semibold text-zinc-300">
                  Given amount
                </label>
                <input
                  inputMode="decimal"
                  className="h-16 w-full rounded-2xl border border-white/[0.07] bg-zinc-950 px-4 text-2xl font-semibold text-white outline-none focus:border-[#00955e]/70"
                  value={givenRaw}
                  onChange={(e) => setGivenRaw(e.target.value)}
                  placeholder="0.00"
                />
                <div
                  className={[
                    "rounded-2xl border px-4 py-3 text-lg font-bold",
                    changeShort
                      ? "border-red-500/60 bg-red-950/40 text-red-200"
                      : "border-white/[0.07] bg-zinc-950 text-white",
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

            {orderError ? <p role="alert" className="mt-4 text-sm text-red-300">{orderError}</p> : null}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={orderBusy}
                className="min-h-14 rounded-2xl bg-zinc-800 font-semibold text-white"
                onClick={() => setPayOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="min-h-14 rounded-2xl bg-[#00955e] font-bold text-white shadow-[var(--tryo-glow)] hover:bg-[#007a4c] active:bg-[#007a4c] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                disabled={
                  orderBusy || receiptBusy || (payMethod === "cash" &&
                  (givenPence === null || givenPence < amountDuePence))
                }
                onClick={() => void submit()}
              >
                {orderBusy ? "Saving order…" : "Submit Order"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {printerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Receipt printer</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Select the Windows printer exactly as it appears in Settings,
                  then print a test receipt.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPrinterOpen(false)}
                className="rounded-xl px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                Close
              </button>
            </div>

            <label className="mt-6 block text-sm font-semibold text-zinc-300">
              Installed printer
              <select
                value={selectedPrinter}
                onChange={(event) => {
                  setSelectedPrinter(event.target.value);
                  setPrinterMessage(null);
                }}
                disabled={printerBusy}
                className="mt-2 h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-[#00955e]"
              >
                <option value="">Choose a printer…</option>
                {printers.map((printer) => (
                  <option key={printer.name} value={printer.name}>
                    {printer.name}
                    {printer.isDefault ? " (Windows default)" : ""}
                  </option>
                ))}
              </select>
            </label>

            {configuredPrinter ? (
              <p className="mt-3 text-xs text-[#49d69d]">
                Automatic receipt printing: {configuredPrinter}
              </p>
            ) : null}
            {printerMessage ? (
              <p className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">
                {printerMessage}
              </p>
            ) : null}

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                disabled={printerBusy}
                onClick={() => void refreshPrinters()}
                className="min-h-12 rounded-xl border border-zinc-700 bg-zinc-800 px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                Refresh
              </button>
              <button
                type="button"
                disabled={printerBusy || !selectedPrinter}
                onClick={() => {
                  const electron = window.tryoElectron;
                  if (!electron) return;
                  setPrinterBusy(true);
                  setPrinterMessage(null);
                  void electron
                    .testReceiptPrinter(selectedPrinter)
                    .then((result) =>
                      setPrinterMessage(
                        result.ok
                          ? "Test job accepted by the printer. Check that END OF TEST RECEIPT is visible."
                          : result.error || "Test print failed.",
                      ),
                    )
                    .catch((error) => setPrinterMessage(`Test print failed: ${error instanceof Error ? error.message : "Printer unavailable"}`))
                    .finally(() => setPrinterBusy(false));
                }}
                className="min-h-12 rounded-xl border border-[#00955e]/50 bg-[#00955e]/10 px-4 text-sm font-semibold text-[#49d69d] disabled:opacity-40"
              >
                Test print
              </button>
              <button
                type="button"
                disabled={printerBusy || !selectedPrinter}
                onClick={() => {
                  const electron = window.tryoElectron;
                  if (!electron) return;
                  setPrinterBusy(true);
                  setPrinterMessage(null);
                  void electron
                    .setReceiptPrinter(selectedPrinter)
                    .then((result) => {
                      if (result.ok) {
                        setConfiguredPrinter(selectedPrinter);
                        setPrinterMessage(
                          "Saved. Completed orders will print automatically.",
                        );
                      } else {
                        setPrinterMessage(result.error || "Could not save printer.");
                      }
                    })
                    .catch((error) => setPrinterMessage(`Could not save printer: ${error instanceof Error ? error.message : "Printer unavailable"}`))
                    .finally(() => setPrinterBusy(false));
                }}
                className="min-h-12 rounded-xl bg-[#00955e] px-4 text-sm font-bold text-white shadow-[var(--tryo-glow)] disabled:opacity-40"
              >
                Save printer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <TillManager
        businessDate={tillDay?.businessDate ?? activeTillDate}
        day={tillDay}
        isOpen={
          tillManagerOpen ||
          (tillDay !== undefined &&
            (tillDay === null || previousTillNeedsSettlement))
        }
        onClose={() => setTillManagerOpen(false)}
      />

      <ReceiptStage data={receipt} />
    </div>
  );
}
