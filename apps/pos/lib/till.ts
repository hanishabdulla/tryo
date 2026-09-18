export type TillMovement = {
  _id: string;
  createdAt: number;
  type: "cash_in" | "cash_out";
  amountPence: number;
  reason: string;
};

export function todayBusinessDate(timestamp = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export type TillDaySummary = {
  _id: string;
  businessDate: string;
  status: "open" | "closed";
  openedAt: number;
  openingFloatPence: number;
  closedAt?: number;
  countedCashPence?: number;
  expectedCashPence?: number;
  variancePence?: number;
  closingNote?: string;
  totals: {
    orderCount: number;
    grossSalesPence: number;
    cashSalesPence: number;
    cashReceivedPence: number;
    changeGivenPence: number;
    cardSalesPence: number;
    cashInPence: number;
    cashOutPence: number;
    expectedCashPence: number;
  };
  movements: TillMovement[];
};
