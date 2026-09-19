import type { OrderRow } from "@/lib/finances-excel";

/**
 * Middle value of `values`, averaging the two middle entries when the count is
 * even. Returns 0 for an empty list.
 *
 * The typical customer spend is better described by the median than the mean:
 * one large group booking drags an average up in a way that misrepresents what
 * the next person through the door is likely to pay.
 */
export function medianPence(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function medianOrderPence(orders: OrderRow[]): number {
  return medianPence(orders.map((o) => o.total));
}

export type ItemStat = {
  name: string;
  category: string;
  units: number;
  revenuePence: number;
  orderCount: number;
  mealUnits: number;
};

export type NamedTotal = {
  label: string;
  units: number;
  revenuePence: number;
};

export type BucketTotal = {
  /** Sort key and axis label, e.g. "12:00" or "2026-09-19". */
  key: string;
  label: string;
  orders: number;
  revenuePence: number;
};

export type InsightsSummary = {
  orderCount: number;
  grossPence: number;
  medianPence: number;
  itemsSold: number;
  items: ItemStat[];
  categories: NamedTotal[];
  extras: NamedTotal[];
  mealUnits: number;
  extraAttachedUnits: number;
  byHour: BucketTotal[];
  byWeekday: BucketTotal[];
  byDay: BucketTotal[];
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** `YYYY-MM-DD` for a timestamp, in the machine's local timezone. */
function localYmd(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Every `YYYY-MM-DD` from `fromYmd` to `toYmd`, inclusive. */
function daysBetween(fromYmd: string, toYmd: string): string[] {
  const start = parseYmd(fromYmd);
  const end = parseYmd(toYmd);
  if (!start || !end || start > end) return [];
  const out: string[] = [];
  const cursor = new Date(start);
  // A range longer than this is not something the dashboard charts usefully.
  while (cursor <= end && out.length < 400) {
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    out.push(`${cursor.getFullYear()}-${month}-${day}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function parseYmd(ymd: string): Date | null {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function shortDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

/**
 * Roll a set of orders up into everything the insights page shows.
 *
 * `categoryOf` maps a sold item name back to its menu category. Orders store
 * only the item name, so a renamed or deleted menu item no longer resolves —
 * those units are grouped under "Uncategorised" rather than dropped, so the
 * category totals still add up to the gross figure.
 */
export function buildInsights(
  orders: OrderRow[],
  categoryOf: (itemName: string) => string | undefined,
  /**
   * The range being reported on. Days inside it with no orders are charted as
   * zero rather than dropped, so the time axis stays evenly spaced.
   */
  range?: { fromYmd: string; toYmd: string },
): InsightsSummary {
  const items = new Map<string, ItemStat>();
  const categories = new Map<string, NamedTotal>();
  const extras = new Map<string, NamedTotal>();
  const hours = new Map<number, BucketTotal>();
  const weekdays = new Map<number, BucketTotal>();
  const days = new Map<string, BucketTotal>();

  let grossPence = 0;
  let itemsSold = 0;
  let mealUnits = 0;
  let extraAttachedUnits = 0;

  for (let hour = 0; hour < 24; hour += 1) {
    hours.set(hour, {
      key: String(hour).padStart(2, "0"),
      label: `${String(hour).padStart(2, "0")}:00`,
      orders: 0,
      revenuePence: 0,
    });
  }
  if (range) {
    for (const ymd of daysBetween(range.fromYmd, range.toYmd)) {
      days.set(ymd, {
        key: ymd,
        label: shortDayLabel(ymd),
        orders: 0,
        revenuePence: 0,
      });
    }
  }
  for (let day = 0; day < 7; day += 1) {
    weekdays.set(day, {
      key: String(day),
      label: WEEKDAYS[day],
      orders: 0,
      revenuePence: 0,
    });
  }

  for (const order of orders) {
    grossPence += order.total;

    const when = new Date(order.createdAt);
    const hourBucket = hours.get(when.getHours());
    if (hourBucket) {
      hourBucket.orders += 1;
      hourBucket.revenuePence += order.total;
    }
    const weekdayBucket = weekdays.get(when.getDay());
    if (weekdayBucket) {
      weekdayBucket.orders += 1;
      weekdayBucket.revenuePence += order.total;
    }
    const ymd = localYmd(order.createdAt);
    const dayBucket = days.get(ymd) ?? {
      key: ymd,
      label: shortDayLabel(ymd),
      orders: 0,
      revenuePence: 0,
    };
    dayBucket.orders += 1;
    dayBucket.revenuePence += order.total;
    days.set(ymd, dayBucket);

    for (const line of order.items) {
      const category = categoryOf(line.itemName) ?? "Uncategorised";
      itemsSold += line.quantity;
      if (line.isMeal) mealUnits += line.quantity;
      if (line.addons?.length) extraAttachedUnits += line.quantity;

      const stat = items.get(line.itemName) ?? {
        name: line.itemName,
        category,
        units: 0,
        revenuePence: 0,
        orderCount: 0,
        mealUnits: 0,
      };
      stat.units += line.quantity;
      stat.revenuePence += line.lineTotal;
      stat.orderCount += 1;
      if (line.isMeal) stat.mealUnits += line.quantity;
      items.set(line.itemName, stat);

      const categoryTotal = categories.get(category) ?? {
        label: category,
        units: 0,
        revenuePence: 0,
      };
      categoryTotal.units += line.quantity;
      categoryTotal.revenuePence += line.lineTotal;
      categories.set(category, categoryTotal);

      for (const addon of line.addons ?? []) {
        const extra = extras.get(addon) ?? {
          label: addon,
          units: 0,
          revenuePence: 0,
        };
        extra.units += line.quantity;
        extras.set(addon, extra);
      }
    }
  }

  const byRevenue = (a: NamedTotal, b: NamedTotal) =>
    b.revenuePence - a.revenuePence || b.units - a.units;

  return {
    orderCount: orders.length,
    grossPence,
    medianPence: medianOrderPence(orders),
    itemsSold,
    items: [...items.values()].sort(
      (a, b) => b.units - a.units || b.revenuePence - a.revenuePence,
    ),
    categories: [...categories.values()].sort(byRevenue),
    extras: [...extras.values()].sort((a, b) => b.units - a.units),
    mealUnits,
    extraAttachedUnits,
    byHour: [...hours.values()],
    byWeekday: [...weekdays.values()],
    byDay: [...days.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
}
