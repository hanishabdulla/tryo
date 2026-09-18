"use client";

import { formatPence } from "@/lib/money";
import type { TillDaySummary } from "@/lib/till";

export function TillSettlementSummary({
  day,
}: {
  day: TillDaySummary | null | undefined;
}) {
  if (day === undefined) {
    return (
      <div className="h-40 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025]" />
    );
  }
  if (day === null) {
    return (
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
        <h2 className="text-sm font-semibold text-zinc-300">Till settlement</h2>
        <p className="mt-2 text-sm text-zinc-500">
          No till session was opened on this date.
        </p>
      </section>
    );
  }

  const difference = day.variancePence;
  const figures = [
    ["Opening float", day.openingFloatPence],
    ["Cash sales", day.totals.cashSalesPence],
    ["Cash received", day.totals.cashReceivedPence],
    ["Change given", -day.totals.changeGivenPence],
    ["Cash added", day.totals.cashInPence],
    ["Cash removed", -day.totals.cashOutPence],
    ["Expected drawer", day.expectedCashPence ?? day.totals.expectedCashPence],
    ["Counted drawer", day.countedCashPence],
  ] as const;

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">
            Till settlement
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Cash drawer activity and end-of-day count
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            day.status === "closed"
              ? "bg-zinc-700/60 text-zinc-300"
              : "bg-emerald-500/15 text-emerald-300"
          }`}
        >
          {day.status}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4 lg:grid-cols-8">
        {figures.map(([label, value]) => (
          <div key={label}>
            <div className="text-[11px] font-medium text-zinc-500">{label}</div>
            <div className="mt-1 text-base font-semibold text-white">
              {value === undefined ? "—" : formatPence(value)}
            </div>
          </div>
        ))}
      </div>
      {day.status === "closed" ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
          <span className="text-sm text-zinc-400">Over / short difference</span>
          <span
            className={`text-lg font-bold ${
              difference === 0 ? "text-emerald-300" : "text-amber-300"
            }`}
          >
            {formatPence(difference ?? 0)}
          </span>
        </div>
      ) : null}
      {day.closingNote ? (
        <p className="mt-3 text-sm text-zinc-500">Note: {day.closingNote}</p>
      ) : null}
    </section>
  );
}
