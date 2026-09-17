const BUSINESS_TIME_ZONE = "Europe/London";

/** Calendar date used by the Rushden Lakes till, including UK daylight saving. */
export function businessDateAt(timestamp: number): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));

  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (!year || !month || !day) throw new Error("Could not determine business date");
  return `${year}-${month}-${day}`;
}
