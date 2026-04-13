"use client";

import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { OrdersReportTable } from "@/components/dashboard/OrdersReportTable";
import { api } from "@/lib/convex-api";
import { downloadFinancesXlsx, type OrderRow } from "@/lib/finances-excel";
import { formatPence } from "@/lib/money";
import {
  localRangeBoundsMs,
  parseYmdLocal,
  todayYmdLocal,
} from "@/lib/report-dates";

function firstOfMonthYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export default function MonthlyRangePage() {
  const [fromYmd, setFromYmd] = useState(firstOfMonthYmd());
  const [toYmd, setToYmd] = useState(todayYmdLocal());

  const bounds = useMemo(() => {
    const a = parseYmdLocal(fromYmd);
    const b = parseYmdLocal(toYmd);
    if (!a || !b) return null;
    return localRangeBoundsMs(a, b);
  }, [fromYmd, toYmd]);

  const orders = useQuery(
    api.reports.listOrdersInRange,
    bounds ? { startMs: bounds.startMs, endMs: bounds.endMs } : "skip",
  ) as OrderRow[] | undefined;

  const rows = orders ?? [];
  const sumPence = rows.reduce((s, o) => s + o.total, 0);

  const exportXlsx = () => {
    if (rows.length === 0) return;
    const a = fromYmd <= toYmd ? fromYmd : toYmd;
    const b = fromYmd <= toYmd ? toYmd : fromYmd;
    downloadFinancesXlsx(rows, `tryo-finances-${a}_to_${b}`);
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Date range export</h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Choose two dates (inclusive) to load orders and download an Excel
            workbook with orders, line items, and a short summary sheet.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-400">
            From
            <input
              type="date"
              value={fromYmd}
              onChange={(e) => setFromYmd(e.target.value)}
              className="h-11 min-w-[11rem] rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-400">
            To
            <input
              type="date"
              value={toYmd}
              onChange={(e) => setToYmd(e.target.value)}
              className="h-11 min-w-[11rem] rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white"
            />
          </label>
          <button
            type="button"
            onClick={exportXlsx}
            disabled={rows.length === 0}
            className="min-h-11 rounded-xl bg-[#00955e] px-4 text-sm font-bold text-white shadow-[var(--tryo-glow)] hover:bg-[#007a4c] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Download Excel
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
        {orders === undefined ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <p className="text-sm text-zinc-400">
            <span className="font-medium text-zinc-200">{rows.length}</span>{" "}
            order{rows.length === 1 ? "" : "s"} in range · Total{" "}
            <span className="font-semibold text-[#00955e]">
              {formatPence(sumPence)}
            </span>
          </p>
        )}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-500">
        Orders list
      </h2>
      <OrdersReportTable orders={rows} />
    </div>
  );
}
