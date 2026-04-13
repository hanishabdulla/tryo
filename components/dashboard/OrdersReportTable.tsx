"use client";

import { formatPence } from "@/lib/money";
import { formatTsLocal } from "@/lib/report-dates";
import type { OrderRow } from "@/lib/finances-excel";

export function OrdersReportTable({ orders }: { orders: OrderRow[] }) {
  const sumPence = orders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/40">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/90 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            <th className="px-3 py-3">SN</th>
            <th className="px-3 py-3">Order no</th>
            <th className="px-3 py-3">Date / time</th>
            <th className="px-3 py-3">Channel</th>
            <th className="px-3 py-3">Type</th>
            <th className="px-3 py-3 text-right">Total</th>
            <th className="px-3 py-3">Payment</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="px-3 py-8 text-center text-zinc-500"
              >
                No orders in this period.
              </td>
            </tr>
          ) : (
            orders.map((o, i) => (
              <tr
                key={o._id}
                className="border-b border-zinc-800/80 last:border-0 hover:bg-zinc-800/30"
              >
                <td className="px-3 py-2.5 text-zinc-300">{i + 1}</td>
                <td className="px-3 py-2.5 font-mono font-medium text-white">
                  #{o.orderNumber}
                </td>
                <td className="px-3 py-2.5 text-zinc-400">
                  {formatTsLocal(o.createdAt)}
                </td>
                <td className="px-3 py-2.5 text-zinc-300">POS</td>
                <td className="px-3 py-2.5 capitalize text-[#00955e]">
                  {o.orderType}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-white">
                  {formatPence(o.total)}
                </td>
                <td className="px-3 py-2.5 capitalize text-zinc-400">
                  {o.paymentMethod}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {orders.length > 0 ? (
          <tfoot>
            <tr className="border-t border-zinc-700 bg-zinc-900/80">
              <td
                colSpan={5}
                className="px-3 py-3 text-right text-sm font-semibold text-zinc-400"
              >
                Period total
              </td>
              <td className="px-3 py-3 text-right text-base font-bold text-[#00955e] drop-shadow-[0_0_12px_rgba(0,149,94,0.25)]">
                {formatPence(sumPence)}
              </td>
              <td />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
