import * as XLSX from "xlsx";
import { formatPence } from "@/lib/money";
import { formatTsLocal } from "@/lib/report-dates";

export type OrderRow = {
  _id: string;
  orderNumber: number;
  createdAt: number;
  status: string;
  orderType: string;
  subtotal: number;
  discountMode?: "none" | "percentage" | "fixed";
  discountInput?: number;
  discountAmountPence?: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  givenAmount: number | null;
  changeAmount: number | null;
  totalItemCount: number;
  items: Array<{
    itemName: string;
    isMeal: boolean;
    mealLabel: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    seasoning?: string | null;
    sauce?: string | null;
    addons?: string[];
    hotDogOnion?: string | null;
    hotDogCheese?: boolean;
  }>;
};

function penceToPoundsCell(pence: number): number {
  return Math.round(pence) / 100;
}

function discountLabel(o: OrderRow): string {
  const mode = o.discountMode ?? "none";
  if (mode === "none") return "none";
  if (mode === "percentage") return `percentage (${o.discountInput ?? 0}%)`;
  if (mode === "fixed") return `fixed (${formatPence(o.discountInput ?? 0)})`;
  return String(mode);
}

export function buildFinancesWorkbook(orders: OrderRow[]): XLSX.WorkBook {
  const orderRows = orders.map((o, i) => ({
    SN: i + 1,
    OrderNo: o.orderNumber,
    DateTime: formatTsLocal(o.createdAt),
    CreatedAtMs: o.createdAt,
    Status: o.status,
    OrderType: o.orderType,
    SubtotalGBP: penceToPoundsCell(o.subtotal),
    DiscountMode: o.discountMode ?? "none",
    DiscountInput: o.discountInput ?? "",
    DiscountAmountGBP: penceToPoundsCell(o.discountAmountPence ?? 0),
    DeliveryFeeGBP: penceToPoundsCell(o.deliveryFee),
    TotalGBP: penceToPoundsCell(o.total),
    PaymentMethod: o.paymentMethod,
    GivenGBP:
      o.givenAmount === null ? "" : penceToPoundsCell(o.givenAmount),
    ChangeGBP:
      o.changeAmount === null ? "" : penceToPoundsCell(o.changeAmount),
    ItemCount: o.totalItemCount,
    DiscountLabel: discountLabel(o),
  }));

  const lineRows: Record<string, string | number | boolean>[] = [];
  for (const o of orders) {
    for (const line of o.items) {
      const extras: string[] = [];
      if (line.seasoning != null && line.seasoning !== "")
        extras.push(`seasoning=${line.seasoning}`);
      if (line.sauce != null && line.sauce !== "")
        extras.push(`sauce=${line.sauce}`);
      if (line.addons?.length)
        extras.push(`addons=${line.addons.join("; ")}`);
      if (line.hotDogOnion != null && line.hotDogOnion !== "None")
        extras.push(`onion=${line.hotDogOnion}`);
      if (line.hotDogCheese) extras.push("cheese=yes");
      lineRows.push({
        OrderNo: o.orderNumber,
        DateTime: formatTsLocal(o.createdAt),
        ItemName: line.itemName,
        Quantity: line.quantity,
        UnitPriceGBP: penceToPoundsCell(line.unitPrice),
        LineTotalGBP: penceToPoundsCell(line.lineTotal),
        IsMeal: line.isMeal,
        MealLabel: line.mealLabel ?? "",
        Extras: extras.join(" · "),
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const wsOrders = XLSX.utils.json_to_sheet(orderRows);
  XLSX.utils.book_append_sheet(wb, wsOrders, "Orders");

  const wsLines =
    lineRows.length > 0
      ? XLSX.utils.json_to_sheet(lineRows)
      : XLSX.utils.json_to_sheet([{ Note: "No line items in range" }]);
  XLSX.utils.book_append_sheet(wb, wsLines, "Line items");

  const totalPence = orders.reduce((s, o) => s + o.total, 0);
  const wsSummary = XLSX.utils.json_to_sheet([
    { Metric: "Order count", Value: orders.length },
    { Metric: "Gross total (sum of order totals) GBP", Value: penceToPoundsCell(totalPence) },
  ]);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  return wb;
}

export function downloadFinancesXlsx(
  orders: OrderRow[],
  filenameBase: string,
): void {
  const wb = buildFinancesWorkbook(orders);
  const safe = filenameBase.replace(/[^\w.-]+/g, "_");
  XLSX.writeFile(wb, `${safe}.xlsx`);
}
