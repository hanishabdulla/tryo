"use client";

import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { BarList, ColumnChart, type ChartDatum } from "@/components/dashboard/charts";
import { dateInputClass } from "@/components/dashboard/styles";
import { TouchInput } from "@/components/touch/TouchKeyboard";
import { api } from "@/lib/convex-api";
import type { OrderRow } from "@/lib/finances-excel";
import { formatPence } from "@/lib/money";
import {
  localRangeBoundsMs,
  parseYmdLocal,
  todayYmdLocal,
} from "@/lib/report-dates";
import { buildInsights } from "@/lib/stats";

type MenuItemRow = { name: string; category: string };

function addDaysYmd(ymd: string, days: number): string {
  const date = parseYmdLocal(ymd);
  if (!date) return ymd;
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function shortDate(ymd: string) {
  const date = parseYmdLocal(ymd);
  return date
    ? date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : ymd;
}

const PRESETS: { label: string; days: number }[] = [
  { label: "Today", days: 0 },
  { label: "Last 7 days", days: 6 },
  { label: "Last 30 days", days: 29 },
  { label: "Last 90 days", days: 89 },
];

function Card({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 ${className}`}
    >
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3.5">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div
        className={`mt-1.5 text-2xl font-semibold tracking-tight ${
          accent ? "text-[#34c68a]" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const today = todayYmdLocal();
  const [fromYmd, setFromYmd] = useState(() => addDaysYmd(today, -6));
  const [toYmd, setToYmd] = useState(today);
  const [itemQuery, setItemQuery] = useState("");
  const [itemSort, setItemSort] = useState<"units" | "revenue">("units");

  const bounds = useMemo(() => {
    const from = parseYmdLocal(fromYmd);
    const to = parseYmdLocal(toYmd);
    if (!from || !to) return null;
    return localRangeBoundsMs(from, to);
  }, [fromYmd, toYmd]);

  const orders = useQuery(
    api.reports.listOrdersInRange,
    bounds ? { startMs: bounds.startMs, endMs: bounds.endMs } : "skip",
  ) as OrderRow[] | undefined;

  const menuItems = useQuery(api.menu.listAllItems, {}) as
    | MenuItemRow[]
    | undefined;

  const categoryByItem = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of menuItems ?? []) map.set(item.name, item.category);
    return map;
  }, [menuItems]);

  const loading = orders === undefined;
  const a = fromYmd <= toYmd ? fromYmd : toYmd;
  const b = fromYmd <= toYmd ? toYmd : fromYmd;

  const insights = useMemo(
    () =>
      buildInsights(orders ?? [], (name) => categoryByItem.get(name), {
        fromYmd: a,
        toYmd: b,
      }),
    [orders, categoryByItem, a, b],
  );

  const filteredItems = useMemo(() => {
    const needle = itemQuery.trim().toLowerCase();
    const rows = needle
      ? insights.items.filter((item) => item.name.toLowerCase().includes(needle))
      : insights.items;
    return [...rows].sort((x, y) =>
      itemSort === "units"
        ? y.units - x.units || y.revenuePence - x.revenuePence
        : y.revenuePence - x.revenuePence || y.units - x.units,
    );
  }, [insights.items, itemQuery, itemSort]);

  const topItemChart: ChartDatum[] = filteredItems.slice(0, 10).map((item) => ({
    label: item.name,
    value: itemSort === "units" ? item.units : item.revenuePence,
    display:
      itemSort === "units"
        ? `${item.units} sold`
        : formatPence(item.revenuePence),
    secondary:
      itemSort === "units"
        ? `${formatPence(item.revenuePence)} of sales`
        : `${item.units} sold`,
  }));

  const categoryChart: ChartDatum[] = insights.categories.map((category) => ({
    label: category.label,
    value: category.revenuePence,
    display: formatPence(category.revenuePence),
    secondary: `${category.units} items`,
  }));

  const extrasChart: ChartDatum[] = insights.extras.slice(0, 8).map((extra) => ({
    label: extra.label,
    value: extra.units,
    display: `${extra.units} added`,
  }));

  // Trading hours only: a 24-column chart is mostly empty for a takeaway.
  const activeHours = insights.byHour.filter((bucket) => bucket.orders > 0);
  const firstHour = activeHours.length
    ? insights.byHour.findIndex((bucket) => bucket.orders > 0)
    : 0;
  const lastHour = activeHours.length
    ? insights.byHour.length -
      1 -
      [...insights.byHour].reverse().findIndex((bucket) => bucket.orders > 0)
    : 0;
  const hourChart: ChartDatum[] = (
    activeHours.length ? insights.byHour.slice(firstHour, lastHour + 1) : []
  ).map((bucket) => ({
    label: bucket.label,
    value: bucket.revenuePence,
    display: formatPence(bucket.revenuePence),
    secondary: `${bucket.orders} order${bucket.orders === 1 ? "" : "s"}`,
  }));

  // Monday-first reads more naturally than the JavaScript Sunday-first order.
  const weekdayChart: ChartDatum[] = [1, 2, 3, 4, 5, 6, 0]
    .map((index) => insights.byWeekday[index])
    .map((bucket) => ({
      label: bucket.label.slice(0, 3),
      value: bucket.revenuePence,
      display: formatPence(bucket.revenuePence),
      secondary: `${bucket.orders} order${bucket.orders === 1 ? "" : "s"}`,
    }));

  const dayChart: ChartDatum[] = insights.byDay.map((bucket) => ({
    label: bucket.label,
    value: bucket.revenuePence,
    display: formatPence(bucket.revenuePence),
    secondary: `${bucket.orders} order${bucket.orders === 1 ? "" : "s"}`,
  }));

  const bestDay = insights.byDay.reduce<(typeof insights.byDay)[number] | null>(
    (best, day) => (!best || day.revenuePence > best.revenuePence ? day : best),
    null,
  );
  const topItem = insights.items[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Insights
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {shortDate(a)} – {shortDate(b)} · what sells, and when
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
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const presetFrom = addDaysYmd(today, -preset.days);
          const active = fromYmd === presetFrom && toYmd === today;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setFromYmd(presetFrom);
                setToYmd(today);
              }}
              className={[
                "inline-flex h-10 items-center rounded-xl px-3.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[#00955e] text-white"
                  : "bg-white/[0.04] text-zinc-300 ring-1 ring-inset ring-white/[0.06] hover:bg-white/[0.08] hover:text-white",
              ].join(" ")}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-12 text-center text-sm text-zinc-500">
          Loading sales…
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Gross sales"
              value={formatPence(insights.grossPence)}
              accent
            />
            <Stat label="Orders" value={String(insights.orderCount)} />
            <Stat label="Items sold" value={String(insights.itemsSold)} />
            <Stat
              label="Median order"
              value={formatPence(insights.medianPence)}
            />
          </div>

          {insights.orderCount > 0 ? (
            <p className="rounded-2xl border border-[#00955e]/20 bg-[#00955e]/[0.06] px-4 py-3 text-sm leading-relaxed text-zinc-300">
              Best seller was{" "}
              <strong className="font-semibold text-white">
                {topItem?.name ?? "—"}
              </strong>{" "}
              at {topItem?.units ?? 0} sold
              {bestDay ? (
                <>
                  , and the strongest day was{" "}
                  <strong className="font-semibold text-white">
                    {bestDay.label}
                  </strong>{" "}
                  on {formatPence(bestDay.revenuePence)}
                </>
              ) : null}
              .
            </p>
          ) : null}

          <Card
            title="Sales by day"
            hint="Gross sales for each day in the range. Hover a column for the order count."
          >
            <ColumnChart data={dayChart} />
          </Card>

          <Card
            title="Top items sold"
            hint="Every item rung up in this range. Search for one to see exactly how many went out."
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <TouchInput
                keyboard="text"
                label="Search items"
                value={itemQuery}
                onValueChange={setItemQuery}
                placeholder="Search an item, e.g. Chicken Popcorn"
                aria-label="Search items"
                className="h-11 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-[#00955e]/70"
              />
              <div className="flex gap-1 rounded-xl bg-white/[0.03] p-1 ring-1 ring-inset ring-white/[0.06]">
                {(
                  [
                    ["units", "By units"],
                    ["revenue", "By revenue"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setItemSort(key)}
                    className={[
                      "inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors",
                      itemSort === key
                        ? "bg-white/[0.09] text-white"
                        : "text-zinc-400 hover:text-white",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <BarList
              data={topItemChart}
              emptyMessage={
                itemQuery.trim()
                  ? `No item matching “${itemQuery.trim()}” was sold in this range.`
                  : "No items sold in this range."
              }
            />

            {filteredItems.length > 0 ? (
              <div className="mt-5 overflow-x-auto rounded-xl border border-white/[0.06]">
                <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-xs font-medium text-zinc-500">
                      <th className="px-3 py-2.5 font-medium">Item</th>
                      <th className="px-3 py-2.5 font-medium">Category</th>
                      <th className="px-3 py-2.5 text-right font-medium">Units</th>
                      <th className="px-3 py-2.5 text-right font-medium">
                        As a meal
                      </th>
                      <th className="px-3 py-2.5 text-right font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr
                        key={item.name}
                        className="border-b border-white/[0.04] last:border-0"
                      >
                        <td className="px-3 py-2.5 font-medium text-white">
                          {item.name}
                        </td>
                        <td className="px-3 py-2.5 text-zinc-500">
                          {item.category}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-zinc-200">
                          {item.units}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-zinc-500">
                          {item.mealUnits || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-white">
                          {formatPence(item.revenuePence)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card
              title="Busiest hours"
              hint="Gross sales by hour of the day, across the whole range."
            >
              <ColumnChart data={hourChart} />
            </Card>
            <Card title="Busiest days of the week" hint="Gross sales by weekday.">
              <ColumnChart data={weekdayChart} />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card
              title="Sales by category"
              hint="Items whose menu entry has since been renamed or deleted are grouped under Uncategorised."
            >
              <BarList data={categoryChart} />
            </Card>
            <Card
              title="Meals and extras"
              hint="How often the upsells get taken."
            >
              <div className="grid grid-cols-2 gap-3">
                <Stat
                  label="Sold as a meal"
                  value={
                    insights.itemsSold
                      ? `${Math.round((insights.mealUnits / insights.itemsSold) * 100)}%`
                      : "—"
                  }
                />
                <Stat
                  label="With a paid extra"
                  value={
                    insights.itemsSold
                      ? `${Math.round((insights.extraAttachedUnits / insights.itemsSold) * 100)}%`
                      : "—"
                  }
                />
              </div>
              <div className="mt-4">
                <h3 className="mb-3 text-xs font-medium text-zinc-500">
                  Most added extras
                </h3>
                <BarList
                  data={extrasChart}
                  emptyMessage="No paid extras were added in this range."
                />
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
