"use client";

import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { ExportButtons } from "@/components/dashboard/ExportButtons";
import { OrdersReportTable } from "@/components/dashboard/OrdersReportTable";
import { ReportSummary } from "@/components/dashboard/ReportSummary";
import { TillSettlementSummary } from "@/components/dashboard/TillSettlementSummary";
import { dateInputClass } from "@/components/dashboard/styles";
import { api } from "@/lib/convex-api";
import type { OrderRow } from "@/lib/finances-excel";
import type { TillDaySummary } from "@/lib/till";
import {
  localDayBoundsMs,
  parseYmdLocal,
  todayYmdLocal,
} from "@/lib/report-dates";

function longDate(ymd: string) {
  const d = parseYmdLocal(ymd);
  return d
    ? d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : ymd;
}

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
  const tillDay = useQuery(api.till.getDay, { businessDate: ymd }) as
    | TillDaySummary
    | null
    | undefined;

  const rows = orders ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Daily summary</h1>
          <p className="mt-1 text-sm text-zinc-500">{longDate(ymd)}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-500">
            Date
            <input
              type="date"
              value={ymd}
              onChange={(e) => setYmd(e.target.value)}
              className={dateInputClass}
            />
          </label>
          <ExportButtons
            orders={rows}
            filenameBase={`tryo-daily-${ymd}`}
            title="Daily summary"
            period={longDate(ymd)}
          />
        </div>
      </div>

      <ReportSummary orders={orders} />

      <TillSettlementSummary day={tillDay} />

      <section id="daily-summary-print">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Orders</h2>
        <OrdersReportTable orders={rows} loading={orders === undefined} />
      </section>
    </div>
  );
}
