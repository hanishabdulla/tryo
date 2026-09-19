"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/convex-api";
import type { OrderRow } from "@/lib/finances-excel";
import { formatPence } from "@/lib/money";
import type { ReceiptPayload } from "@/lib/receipt-document";
import {
  buildCustomerReceiptDocument,
  printDocumentsInBrowser,
} from "@/lib/receipt-printing";
import { formatTsLocal } from "@/lib/report-dates";

type OrderItem = OrderRow["items"][number];

/** How the discount was rung up, not just what it came to. */
function discountDescription(order: OrderRow): string | null {
  const amount = order.discountAmountPence ?? 0;
  if (amount <= 0) return null;
  const mode = order.discountMode ?? "none";
  if (mode === "percentage") return `Discount (${order.discountInput ?? 0}%)`;
  if (mode === "fixed") return `Discount (${formatPence(order.discountInput ?? 0)})`;
  return "Discount";
}

/** Everything chosen on a line, in the order the till asks for it. */
function itemOptions(item: OrderItem): string[] {
  const options: string[] = [];
  if (item.isMeal && item.mealLabel) options.push(`Meal: ${item.mealLabel}`);
  const chosen = (value: string | null | undefined) =>
    typeof value === "string" && value.trim() && value.trim().toLowerCase() !== "none"
      ? value.trim()
      : null;
  const seasoning = chosen(item.seasoning);
  if (seasoning) options.push(`Seasoning: ${seasoning}`);
  const sauce = chosen(item.sauce);
  if (sauce) options.push(`Sauce: ${sauce}`);
  const onion = chosen(item.hotDogOnion);
  if (onion) options.push(`Onion: ${onion}`);
  if (item.hotDogCheese) options.push("Cheese");
  for (const addon of item.addons ?? []) options.push(`+ ${addon}`);
  return options;
}

function receiptDiscountLabel(order: OrderRow): string | null {
  const amount = order.discountAmountPence ?? 0;
  if (amount <= 0) return null;
  if (order.discountMode === "percentage") {
    return `Discount (${order.discountInput ?? 0}%):`;
  }
  if (order.discountMode === "fixed") {
    return `Discount (${formatPence(order.discountInput ?? 0)}):`;
  }
  return "Discount:";
}

function customerReceiptPayload(
  order: OrderRow,
  config: Record<string, unknown> | undefined,
): ReceiptPayload {
  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    // Historical orders retain their final line totals, but not the old price
    // split for each option. Keep the total exact and print choices as details.
    lines: order.items.map((item) => ({
      name: item.itemName,
      quantity: item.quantity,
      baseLineTotalPence: item.lineTotal,
      isMeal: false,
      mealLabel: null,
      mealLineTotalPence: 0,
      details: itemOptions(item),
      note: item.note,
    })),
    subtotalPence: order.subtotal,
    discountLabel: receiptDiscountLabel(order),
    discountAmountPence: order.discountAmountPence ?? 0,
    deliveryFeePence: order.deliveryFee,
    totalPence: order.total,
    totalItemCount: order.totalItemCount,
    paymentMethod: order.paymentMethod === "cash" ? "cash" : "card",
    printCustomerReceipt: true,
    businessAddress:
      typeof config?.businessAddress === "string"
        ? config.businessAddress
        : "Rushden Lakes, FC3, Rushden, Northamptonshire",
    businessPhone:
      typeof config?.businessPhone === "string"
        ? config.businessPhone
        : "+44 7825583940",
    businessVat:
      typeof config?.businessVat === "string"
        ? config.businessVat
        : "491891448",
  };
}

function Row({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "muted" | "total";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span
        className={
          tone === "total"
            ? "text-sm font-semibold text-white"
            : "text-sm text-zinc-400"
        }
      >
        {label}
      </span>
      <span
        className={[
          "text-right tabular-nums",
          tone === "total"
            ? "text-lg font-bold text-[#34c68a]"
            : tone === "muted"
              ? "text-sm text-zinc-500"
              : "text-sm font-medium text-white",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

export function OrderDetailModal({
  order,
  onClose,
}: {
  order: OrderRow | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const config = useQuery(api.menu.getMenuConfig, {}) as
    | Record<string, unknown>
    | undefined;
  const [printBusy, setPrintBusy] = useState(false);
  const [printResult, setPrintResult] = useState<{
    orderId: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!order) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, order]);

  if (!order) return null;

  const discount = discountDescription(order);
  const itemsTotal = order.items.reduce((sum, item) => sum + item.lineTotal, 0);
  const isWeb = order.source === "web";

  const reprintCustomerBill = async () => {
    if (printBusy) return;
    setPrintBusy(true);
    setPrintResult(null);
    try {
      const customerHtml = await buildCustomerReceiptDocument(
        customerReceiptPayload(order, config),
      );
      const electron = window.tryoElectron;
      if (!electron) {
        await printDocumentsInBrowser({ kitchenHtml: null, customerHtml });
      } else {
        const printer = await electron.getReceiptPrinter();
        if (!printer) {
          throw new Error("No receipt printer is configured. Set one up from the till first.");
        }
        const result = await electron.printReceiptSilent({
          kitchenHtml: null,
          customerHtml,
        });
        if (!result.ok) {
          throw new Error(result.error || "The printer rejected the bill.");
        }
      }
      setPrintResult({
        orderId: order._id,
        message: "Customer bill sent to the printer.",
      });
    } catch (error) {
      setPrintResult({
        orderId: order._id,
        message:
          error instanceof Error
            ? error.message
            : "The customer bill could not be printed.",
      });
    } finally {
      setPrintBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Order number ${order.orderNumber}`}
        className="my-auto w-full max-w-2xl rounded-3xl border border-white/[0.08] bg-zinc-900 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Order #{order.orderNumber}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {formatTsLocal(order.createdAt)} · {order.orderType}
              {isWeb ? " · online" : " · till"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={printBusy}
              onClick={() => void reprintCustomerBill()}
              className="min-h-10 rounded-xl border border-[#00955e]/50 bg-[#00955e]/15 px-4 text-sm font-semibold text-[#55d9a5] transition-colors hover:bg-[#00955e]/25 hover:text-white disabled:cursor-wait disabled:opacity-60"
            >
              {printBusy ? "Printing…" : "Reprint bill"}
            </button>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-xl px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              Close
            </button>
          </div>
        </header>

        {printResult?.orderId === order._id ? (
          <p
            className="border-b border-white/[0.06] bg-white/[0.025] px-6 py-3 text-sm text-zinc-300"
            role="status"
          >
            {printResult.message}
          </p>
        ) : null}

        <div className="space-y-6 px-6 py-5">
          {isWeb && (order.customerName || order.customerPhone) ? (
            <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <h3 className="text-xs font-medium text-zinc-500">Customer</h3>
              <div className="mt-1.5 space-y-0.5 text-sm text-zinc-300">
                {order.customerName ? <div>{order.customerName}</div> : null}
                {order.customerPhone ? <div>{order.customerPhone}</div> : null}
                {order.customerAddress ? <div>{order.customerAddress}</div> : null}
                {order.customerNote ? (
                  <div className="text-zinc-400">Note: {order.customerNote}</div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 text-xs font-medium text-zinc-500">
              Items ({order.totalItemCount})
            </h3>
            <ul className="divide-y divide-white/[0.05] rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              {order.items.map((item, index) => {
                const options = itemOptions(item);
                return (
                  <li
                    key={`${item.itemName}-${index}`}
                    className="flex items-start justify-between gap-4 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white">
                        {item.quantity} × {item.itemName}
                      </div>
                      {options.length > 0 ? (
                        <div className="mt-1 text-xs text-zinc-500">
                          {options.join(" · ")}
                        </div>
                      ) : null}
                      {item.note ? (
                        <div className="mt-1 text-xs text-amber-300/80">
                          Note: {item.note}
                        </div>
                      ) : null}
                      <div className="mt-1 text-xs text-zinc-600 tabular-nums">
                        {formatPence(item.unitPrice)} each
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-white tabular-nums">
                      {formatPence(item.lineTotal)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <Row label="Subtotal" value={formatPence(order.subtotal)} />
            {itemsTotal !== order.subtotal ? (
              <Row
                label="Line items"
                value={formatPence(itemsTotal)}
                tone="muted"
              />
            ) : null}
            {discount ? (
              <Row
                label={discount}
                value={`-${formatPence(order.discountAmountPence ?? 0)}`}
              />
            ) : (
              <Row label="Discount" value="None" tone="muted" />
            )}
            {order.deliveryFee > 0 ? (
              <Row label="Delivery fee" value={formatPence(order.deliveryFee)} />
            ) : null}
            <div className="mt-1 border-t border-white/[0.08] pt-2">
              <Row label="Total paid" value={formatPence(order.total)} tone="total" />
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <h3 className="text-xs font-medium text-zinc-500">Payment</h3>
              <div className="mt-1.5 text-sm font-medium text-white">
                {order.paymentMethod === "card" ? "Card" : "Cash"}
              </div>
              {order.paymentMethod === "cash" && order.givenAmount !== null ? (
                <div className="mt-1 space-y-0.5 text-xs text-zinc-400 tabular-nums">
                  <div>Given {formatPence(order.givenAmount)}</div>
                  <div>
                    Change{" "}
                    {formatPence(
                      order.changeAmount ?? order.givenAmount - order.total,
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <h3 className="text-xs font-medium text-zinc-500">Status</h3>
              <div className="mt-1.5 text-sm font-medium capitalize text-white">
                {order.status}
              </div>
              {isWeb && order.fulfilment ? (
                <div className="mt-1 text-xs capitalize text-zinc-400">
                  {order.fulfilment}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
