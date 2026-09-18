/**
 * Opening hours for Tryo Rushden Lakes, and the "open now" logic behind the
 * status pill in the header.
 *
 * Everything resolves against Europe/London rather than the visitor's own clock,
 * so someone ordering from a different timezone still sees the shop's real state.
 */

export const SHOP = {
  name: "Tryo",
  locality: "Rushden Lakes",
  addressLines: ["Unit FC3, Rushden Lakes", "Rushden, Northamptonshire", "NN10 6FH"],
  phone: "+44 7825 583940",
  phoneHref: "tel:+447825583940",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Tryo+Rushden+Lakes+NN10+6FH",
  instagram: "https://www.instagram.com/tryoeats",
  facebook: "https://www.facebook.com/tryoeats",
  timeZone: "Europe/London",
} as const;

/** Minutes from midnight, indexed by `Date.getDay()` (0 = Sunday). */
type Window = { open: number; close: number };

const MIN = (h: number, m = 0) => h * 60 + m;

const OPEN = MIN(11);
const CLOSE = MIN(18);

/** Same hours every day: 11am – 6pm. */
const WEEK: Window[] = Array.from({ length: 7 }, () => ({ open: OPEN, close: CLOSE }));

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${m.toString().padStart(2, "0")}${suffix}`;
}

/** 24-hour "HH:MM", for schema.org openingHoursSpecification. */
function iso(minutes: number): string {
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

/**
 * The hours table shown on the Visit section, Monday first. The JSON-LD in
 * app/layout.tsx reads `opens`/`closes` from here so the rich result and the
 * page can never disagree.
 */
export const HOURS_TABLE = [1, 2, 3, 4, 5, 6, 0].map((day) => ({
  day,
  label: DAY_NAMES[day],
  short: DAY_NAMES[day].slice(0, 3),
  hours: `${fmt(WEEK[day].open)} – ${fmt(WEEK[day].close)}`,
  opens: iso(WEEK[day].open),
  closes: iso(WEEK[day].close),
}));

/** Compact summary for headers and marketing copy, e.g. "11am – 6pm". */
export const HOURS_SUMMARY = `${fmt(OPEN)} – ${fmt(CLOSE)}`;

/** Day-of-week and minutes-past-midnight in Europe/London, whatever the caller's clock is. */
function londonNow(now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SHOP.timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday").slice(0, 3);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  // en-GB with hour12:false renders midnight as "24", which must wrap to 0.
  const hour = Number(get("hour")) % 24;
  return { day: day < 0 ? now.getDay() : day, minutes: MIN(hour, Number(get("minute"))) };
}

export type ShopStatus = {
  open: boolean;
  /** True in the last hour of service, so the UI can warn instead of reassure. */
  closingSoon: boolean;
  /** Lead word: "Open", "Closing soon", "Closed". */
  headline: string;
  /** Qualifier: "until 6pm", "opens 11am", "opens tomorrow 11am". */
  detail: string;
};

export function shopStatus(now: Date = new Date()): ShopStatus {
  const { day, minutes } = londonNow(now);
  const today = WEEK[day];

  if (minutes >= today.open && minutes < today.close) {
    const closingSoon = today.close - minutes <= 60;
    return {
      open: true,
      closingSoon,
      headline: closingSoon ? "Closing soon" : "Open",
      detail: `until ${fmt(today.close)}`,
    };
  }

  if (minutes < today.open) {
    return { open: false, closingSoon: false, headline: "Closed", detail: `opens ${fmt(today.open)}` };
  }

  // Shut for the day — point at tomorrow, which keeps the same hours.
  const next = (day + 1) % 7;
  return {
    open: false,
    closingSoon: false,
    headline: "Closed",
    detail: `opens tomorrow ${fmt(WEEK[next].open)}`,
  };
}

/** Rough kitchen turnaround quoted at checkout. Collection only. */
export const PREP_MINUTES = 20;
