"use client";

import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { OrdersReportTable } from "@/components/dashboard/OrdersReportTable";
import { api } from "@/lib/convex-api";
import { downloadFinancesXlsx, type OrderRow } from "@/lib/finances-excel";
import { formatPence } from "@/lib/money";
import {
  localDayBoundsMs,
  parseYmdLocal,
  todayYmdLocal,
} from "@/lib/report-dates";

export default function DailySummaryPage() {
  const [ymd, setYmd] = useState(todayYmdLocal);
  const bounds = useMemo(() => {
    const d = parseYmdLocal(ymd);
    if (!d) return null;
    return localDayBoundsMs(d);
  }, [ymd]);

  const orders = useQuery(
    api.reports.listOrdersInRange,
    bounds ? { startMs: bounds.startMs, endMs: bounds.endMs } : "skip",
  ) as OrderRow[] | undefined;

  const rows = orders ?? [];
  const sumPence = rows.reduce((s, o) => s + o.total, 0);

  const exportXlsx = () => {
    if (rows.length === 0) return;
    downloadFinancesXlsx(rows, `tryo-daily-${ymd}`);
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Daily summary</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Orders and totals for one calendar day (your device timezone).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-400">
            Date
            <input
              type="date"
              value={ymd}
              onChange={(e) => setYmd(e.target.value)}
              className="h-11 min-w-[11rem] rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white"
            />
          </label>
          <button
            type="button"
            onClick={exportXlsx}
            disabled={rows.length === 0}
            className="min-h-11 rounded-xl border border-zinc-600 bg-zinc-800 px-4 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export Excel
          </button>
          <button
            type="button"
            onClick={printReport}
            disabled={rows.length === 0}
            className="min-h-11 rounded-xl bg-[#00955e] px-4 text-sm font-bold text-white shadow-[var(--tryo-glow)] hover:bg-[#007a4c] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Print
          </button>
        </div>
      </div>

      <div id="daily-summary-print" className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
        <div className="mb-4 border-b border-zinc-800 pb-3">
          <p className="text-sm text-zinc-500">Date</p>
          <p className="text-lg font-semibold text-white">{ymd}</p>
          {orders === undefined ? (
            <p className="mt-2 text-sm text-zinc-500">Loading…</p>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">
              {rows.length} order{rows.length === 1 ? "" : "s"} · Total{" "}
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
    </div>
  );
}
