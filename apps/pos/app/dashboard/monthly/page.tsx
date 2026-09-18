"use client";

import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { ExportButtons } from "@/components/dashboard/ExportButtons";
import { OrdersReportTable } from "@/components/dashboard/OrdersReportTable";
import { ReportSummary } from "@/components/dashboard/ReportSummary";
import { dateInputClass } from "@/components/dashboard/styles";
import { api } from "@/lib/convex-api";
import type { OrderRow } from "@/lib/finances-excel";
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

function shortDate(ymd: string) {
  const d = parseYmdLocal(ymd);
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ymd;
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
  const a = fromYmd <= toYmd ? fromYmd : toYmd;
  const b = fromYmd <= toYmd ? toYmd : fromYmd;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Sales by date range</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {shortDate(a)} – {shortDate(b)} · Export as Excel or PDF
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
            From
            <input
              type="date"
              value={fromYmd}
              onChange={(e) => setFromYmd(e.target.value)}
              className={dateInputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
            To
            <input
              type="date"
              value={toYmd}
              onChange={(e) => setToYmd(e.target.value)}
              className={dateInputClass}
            />
          </label>
          <ExportButtons
            orders={rows}
            filenameBase={`tryo-finances-${a}_to_${b}`}
            title="Sales report"
            period={`${shortDate(a)} – ${shortDate(b)}`}
          />
        </div>
      </div>

      <ReportSummary orders={orders} />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Orders</h2>
        <OrdersReportTable orders={rows} loading={orders === undefined} />
      </section>
    </div>
  );
}
