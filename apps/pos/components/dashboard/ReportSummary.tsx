"use client";

import type { OrderRow } from "@/lib/finances-excel";
import { formatPence } from "@/lib/money";
import { medianOrderPence } from "@/lib/stats";

export function ReportSummary({ orders }: { orders: OrderRow[] | undefined }) {
  const rows = orders ?? [];
  const gross = rows.reduce((s, o) => s + o.total, 0);
  const card = rows.filter((o) => o.paymentMethod === "card").reduce((s, o) => s + o.total, 0);
  const cash = gross - card;
  const loading = orders === undefined;
  const stats = [
    { label: "Gross sales", value: formatPence(gross), accent: true },
    { label: "Orders", value: String(rows.length) },
    {
      // Median, not mean: one unusually large order should not move the figure
      // that describes what a typical customer spends.
      label: "Median order",
      value: formatPence(medianOrderPence(rows)),
    },
    {
      label: "Card / Cash",
      value: `${formatPence(card)} / ${formatPence(cash)}`,
      small: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3.5"
        >
          <div className="text-xs font-medium text-zinc-500">{stat.label}</div>
          <div
            className={[
              "mt-1.5 font-semibold tracking-tight",
              stat.small ? "text-lg" : "text-2xl",
              stat.accent ? "text-[#34c68a]" : "text-white",
              loading ? "animate-pulse text-zinc-700" : "",
            ].join(" ")}
          >
            {loading ? "—" : stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
