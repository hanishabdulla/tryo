"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "@/lib/convex-api";
import { formatPence } from "@/lib/money";

type CollectionOrderStatus = "pending" | "accepted" | "ready";

type CollectionOrderLine = {
  itemName: string;
  isMeal: boolean;
  mealLabel: string | null;
  quantity: number;
  lineTotal: number;
  addons?: string[];
  note?: string;
};

type CollectionOrder = {
  _id: string;
  orderNumber: number;
  createdAt: number;
  status: CollectionOrderStatus;
  items: CollectionOrderLine[];
  total: number;
  totalItemCount: number;
  customerName?: string;
  customerPhone?: string;
  customerNote?: string | null;
};

const statusDetails: Record<
  CollectionOrderStatus,
  { label: string; accent: string; rail: string }
> = {
  pending: {
    label: "New",
    accent: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    rail: "bg-amber-400",
  },
  accepted: {
    label: "Preparing",
    accent: "border-sky-400/25 bg-sky-400/10 text-sky-200",
    rail: "bg-sky-400",
  },
  ready: {
    label: "Ready",
    accent: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    rail: "bg-emerald-400",
  },
};

function orderTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export function CollectionQueue() {
  const orders = useQuery(api.online.listLiveOnlineOrders, {}) as
    | CollectionOrder[]
    | undefined;
  const setStatus = useMutation(api.online.setOnlineOrderStatus);
  const [open, setOpen] = useState(false);
  const [busyOrder, setBusyOrder] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const pending = useMemo(
    () => orders?.filter((order) => order.status === "pending") ?? [],
    [orders],
  );
  const newestPending = pending.at(-1);

  async function updateStatus(
    orderNumber: number,
    status: "accepted" | "ready" | "completed" | "rejected",
  ) {
    if (busyOrder !== null) return;
    setBusyOrder(orderNumber);
    setActionError(null);
    try {
      await setStatus({ orderNumber, status });
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not update this collection order.",
      );
    } finally {
      setBusyOrder(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          "relative inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-semibold transition-colors",
          pending.length > 0
            ? "border-amber-400/35 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15"
            : "border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:border-white/15 hover:bg-white/[0.06] hover:text-white",
        ].join(" ")}
      >
        <span
          className={[
            "h-2 w-2 rounded-full",
            pending.length > 0
              ? "animate-pulse bg-amber-300 shadow-[0_0_0_4px_rgba(252,211,77,0.12)]"
              : orders === undefined
                ? "bg-zinc-600"
                : "bg-emerald-400",
          ].join(" ")}
        />
        Collections
        {(orders?.length ?? 0) > 0 ? (
          <span className="flex min-w-5 items-center justify-center rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-black text-white">
            {orders?.length}
          </span>
        ) : null}
      </button>

      {newestPending && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed left-1/2 top-20 z-40 flex w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-4 overflow-hidden rounded-2xl border border-amber-300/35 bg-[#19160d] p-4 text-left shadow-2xl shadow-black/60 transition hover:border-amber-300/60"
          aria-live="assertive"
        >
          <span className="absolute inset-y-0 left-0 w-1.5 bg-amber-300" />
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-300 text-lg font-black text-zinc-950">
            {pending.length}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">
              New collection order
            </span>
            <span className="mt-0.5 block truncate text-sm font-bold text-white">
              #{newestPending.orderNumber} · {newestPending.customerName || "Customer"} · {formatPence(newestPending.total)}
            </span>
          </span>
          <span className="shrink-0 text-xs font-bold text-amber-200">
            View order →
          </span>
        </button>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex justify-end bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="collection-queue-title"
        >
          <div className="flex h-full w-full max-w-2xl flex-col border-l border-white/10 bg-[#0d0d0f] shadow-2xl shadow-black/80">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.07] px-6 py-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2
                    id="collection-queue-title"
                    className="text-2xl font-black tracking-tight text-white"
                  >
                    Collection queue
                  </h2>
                  {(orders?.length ?? 0) > 0 ? (
                    <span className="rounded-lg bg-white/[0.07] px-2 py-1 text-xs font-bold text-zinc-300">
                      {orders?.length} live
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Web orders · payment is taken at the counter
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.06] text-xl text-zinc-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Close collection queue"
              >
                ×
              </button>
            </div>

            {actionError ? (
              <div
                role="alert"
                className="mx-6 mt-4 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200"
              >
                {actionError}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {orders === undefined ? (
                <div className="flex min-h-64 items-center justify-center text-sm font-medium text-zinc-500">
                  Loading collection orders…
                </div>
              ) : orders.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.015] px-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] text-2xl text-emerald-300">
                    ✓
                  </div>
                  <div className="mt-4 text-base font-bold text-zinc-200">
                    Collection queue is clear
                  </div>
                  <div className="mt-1 max-w-sm text-sm leading-relaxed text-zinc-500">
                    New website orders will appear here immediately.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => {
                    const details = statusDetails[order.status];
                    const busy = busyOrder === order.orderNumber;
                    return (
                      <article
                        key={order._id}
                        className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141417] shadow-lg shadow-black/20"
                      >
                        <div className={`absolute inset-y-0 left-0 w-1.5 ${details.rail}`} />
                        <div className="p-5 pl-6">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-2xl font-black text-white">
                                  #{order.orderNumber}
                                </span>
                                <span
                                  className={`rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-[0.15em] ${details.accent}`}
                                >
                                  {details.label}
                                </span>
                                <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">
                                  Web
                                </span>
                              </div>
                              <div className="mt-1 text-sm font-semibold text-zinc-300">
                                {order.customerName || "Customer"} · {orderTime(order.createdAt)}
                              </div>
                              {order.customerPhone ? (
                                <a
                                  href={`tel:${order.customerPhone}`}
                                  className="mt-1 inline-block text-sm font-semibold text-sky-300 hover:text-sky-200"
                                >
                                  {order.customerPhone}
                                </a>
                              ) : null}
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-2xl font-black text-[#49d69d]">
                                {formatPence(order.total)}
                              </div>
                              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300">
                                Pay on collection
                              </div>
                            </div>
                          </div>

                          <div className="my-4 h-px bg-white/[0.07]" />

                          <ul className="space-y-3">
                            {order.items.map((line, index) => (
                              <li
                                key={`${line.itemName}-${index}`}
                                className="flex items-start gap-3"
                              >
                                <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-white/[0.07] px-1.5 text-xs font-black text-white">
                                  {line.quantity}×
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex justify-between gap-3">
                                    <span className="font-bold text-zinc-100">
                                      {line.itemName}
                                    </span>
                                    <span className="shrink-0 text-sm font-semibold text-zinc-400">
                                      {formatPence(line.lineTotal)}
                                    </span>
                                  </div>
                                  {line.isMeal && line.mealLabel ? (
                                    <div className="mt-0.5 text-sm text-zinc-400">
                                      + {line.mealLabel}
                                    </div>
                                  ) : null}
                                  {line.addons?.length ? (
                                    <div className="mt-0.5 text-sm text-zinc-400">
                                      + {line.addons.join(", ")}
                                    </div>
                                  ) : null}
                                  {line.note ? (
                                    <div className="mt-1 rounded-lg border-l-2 border-amber-300 bg-amber-300/[0.06] px-2 py-1.5 text-sm font-semibold text-amber-100">
                                      Note: {line.note}
                                    </div>
                                  ) : null}
                                </div>
                              </li>
                            ))}
                          </ul>

                          {order.customerNote ? (
                            <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2.5 text-sm text-amber-100">
                              <span className="font-black">Customer note:</span>{" "}
                              {order.customerNote}
                            </div>
                          ) : null}

                          <div className="mt-5 flex flex-wrap justify-end gap-2">
                            {order.status === "pending" ? (
                              <>
                                <button
                                  type="button"
                                  disabled={busyOrder !== null}
                                  onClick={() =>
                                    void updateStatus(order.orderNumber, "rejected")
                                  }
                                  className="min-h-12 rounded-xl border border-red-400/20 px-4 text-sm font-bold text-red-300 transition hover:bg-red-400/10 disabled:opacity-40"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  disabled={busyOrder !== null}
                                  onClick={() =>
                                    void updateStatus(order.orderNumber, "accepted")
                                  }
                                  className="min-h-12 rounded-xl bg-amber-300 px-5 text-sm font-black text-zinc-950 transition hover:bg-amber-200 disabled:opacity-40"
                                >
                                  {busy ? "Updating…" : "Accept order"}
                                </button>
                              </>
                            ) : order.status === "accepted" ? (
                              <button
                                type="button"
                                disabled={busyOrder !== null}
                                onClick={() =>
                                  void updateStatus(order.orderNumber, "ready")
                                }
                                className="min-h-12 rounded-xl bg-sky-400 px-5 text-sm font-black text-sky-950 transition hover:bg-sky-300 disabled:opacity-40"
                              >
                                {busy ? "Updating…" : "Mark ready"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busyOrder !== null}
                                onClick={() =>
                                  void updateStatus(order.orderNumber, "completed")
                                }
                                className="min-h-12 rounded-xl bg-[#00955e] px-5 text-sm font-black text-white shadow-[var(--tryo-glow)] transition hover:bg-[#007a4c] disabled:opacity-40"
                              >
                                {busy ? "Updating…" : "Complete collection"}
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
