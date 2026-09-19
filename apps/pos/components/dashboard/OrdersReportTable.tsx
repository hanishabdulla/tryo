"use client";

import { useMemo, useState } from "react";
import { formatPence } from "@/lib/money";
import { formatTsLocal } from "@/lib/report-dates";
import type { OrderRow } from "@/lib/finances-excel";
import { OrderDetailModal } from "./OrderDetailModal";

export function OrdersReportTable({
  orders,
  loading = false,
}: {
  orders: OrderRow[];
  loading?: boolean;
}) {
  const sumPence = orders.reduce((s, o) => s + o.total, 0);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const openOrder = orders.find((o) => o._id === openOrderId) ?? null;

  // Newest first: the order someone is looking for is almost always the one
  // that just went through. Exports keep the chronological order.
  const newestFirst = useMemo(
    () =>
      [...orders].sort(
        (a, b) => b.createdAt - a.createdAt || b.orderNumber - a.orderNumber,
      ),
    [orders],
  );

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-xs font-medium text-zinc-500">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Date / time</th>
              <th className="px-4 py-3 text-right font-medium">Items</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 text-right font-medium">Discount</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 text-right font-medium">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading || orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-zinc-500">
                  {loading ? "Loading orders…" : "No orders in this period."}
                </td>
              </tr>
            ) : (
              newestFirst.map((o, i) => (
                <tr
                  key={o._id}
                  tabIndex={0}
                  aria-label={`Order number ${o.orderNumber}, ${formatPence(o.total)}. Open details.`}
                  onClick={() => setOpenOrderId(o._id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenOrderId(o._id);
                    }
                  }}
                  className="cursor-pointer border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.04] focus:bg-white/[0.04] focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#00955e]"
                >
                  <td className="px-4 py-3 text-zinc-600">
                    {newestFirst.length - i}
                  </td>
                  <td className="px-4 py-3 font-semibold text-white">#{o.orderNumber}</td>
                  <td className="px-4 py-3 text-zinc-400">{formatTsLocal(o.createdAt)}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{o.totalItemCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        o.paymentMethod === "card"
                          ? "bg-sky-500/10 text-sky-300"
                          : "bg-amber-500/10 text-amber-300",
                      ].join(" ")}
                    >
                      {o.paymentMethod === "card" ? "Card" : "Cash"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-500">
                    {o.discountAmountPence ? `-${formatPence(o.discountAmountPence)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-white">
                    {formatPence(o.total)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-medium text-zinc-600">
                    View
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {!loading && orders.length > 0 ? (
            <tfoot>
              <tr className="border-t border-white/[0.08]">
                <td colSpan={6} className="px-4 py-3.5 text-right text-sm font-medium text-zinc-400">
                  Period total
                </td>
                <td className="px-4 py-3.5 text-right text-base font-bold text-[#34c68a]">
                  {formatPence(sumPence)}
                </td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <OrderDetailModal order={openOrder} onClose={() => setOpenOrderId(null)} />
    </>
  );
}
