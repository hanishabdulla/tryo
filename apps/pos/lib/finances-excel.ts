import writeExcelFile, {
  type Cell,
  type SheetData,
} from "write-excel-file/browser";
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
    note?: string;
  }>;
  // Set on tryoeats.uk orders only; till orders leave them undefined.
  source?: string;
  fulfilment?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string | null;
  customerNote?: string | null;
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

type ExportRow = Record<string, string | number | boolean>;

const HEADER_STYLE = {
  fontWeight: "bold" as const,
  backgroundColor: "#E7F5EF",
};

function rowsToSheet(headers: string[], rows: ExportRow[]): SheetData {
  const headerRow: Cell[] = headers.map((value) => ({
    value,
    ...HEADER_STYLE,
  }));

  return [
    headerRow,
    ...rows.map((row) =>
      headers.map((header): Cell => {
        const value = row[header] ?? "";
        if (header.endsWith("GBP") && typeof value === "number") {
          return { value, type: Number, format: "£#,##0.00" };
        }
        return value;
      }),
    ),
  ];
}

export function buildFinancesWorkbook(orders: OrderRow[]) {
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
      if (line.note) extras.push(`note=${line.note}`);
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

  const totalPence = orders.reduce((s, o) => s + o.total, 0);
  const summaryRows: ExportRow[] = [
    { Metric: "Order count", Value: orders.length },
    { Metric: "Gross total (sum of order totals) GBP", Value: penceToPoundsCell(totalPence) },
  ];

  const orderHeaders = Object.keys(orderRows[0] ?? {
    SN: "",
    OrderNo: "",
    DateTime: "",
    CreatedAtMs: "",
    Status: "",
    OrderType: "",
    SubtotalGBP: "",
    DiscountMode: "",
    DiscountInput: "",
    DiscountAmountGBP: "",
    DeliveryFeeGBP: "",
    TotalGBP: "",
    PaymentMethod: "",
    GivenGBP: "",
    ChangeGBP: "",
    ItemCount: "",
    DiscountLabel: "",
  });
  const lineHeaders = [
    "OrderNo",
    "DateTime",
    "ItemName",
    "Quantity",
    "UnitPriceGBP",
    "LineTotalGBP",
    "IsMeal",
    "MealLabel",
    "Extras",
  ];

  return [
    {
      sheet: "Orders",
      data: rowsToSheet(orderHeaders, orderRows),
      stickyRowsCount: 1,
    },
    {
      sheet: "Line items",
      data:
        lineRows.length > 0
          ? rowsToSheet(lineHeaders, lineRows)
          : rowsToSheet(["Note"], [{ Note: "No line items in range" }]),
      stickyRowsCount: 1,
    },
    {
      sheet: "Summary",
      data: rowsToSheet(["Metric", "Value"], summaryRows),
      stickyRowsCount: 1,
    },
  ];
}

export async function downloadFinancesXlsx(
  orders: OrderRow[],
  filenameBase: string,
): Promise<void> {
  const wb = buildFinancesWorkbook(orders);
  const safe = filenameBase.replace(/[^\w.-]+/g, "_");
  await writeExcelFile(wb).toFile(`${safe}.xlsx`);
}
