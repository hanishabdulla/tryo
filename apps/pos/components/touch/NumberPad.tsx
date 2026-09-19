"use client";

/**
 * Twelve-key money pad. Presentational: it reports the key that was pressed and
 * lets the caller decide which field the digits land in, so the same pad drives
 * the inline payment keypad and the docked keyboard.
 */
export type NumberPadKey = string | "backspace" | "clear";

const KEY_CLASS =
  "flex items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.04] text-2xl font-semibold text-white transition-colors select-none hover:bg-white/[0.08] active:scale-[0.97] active:bg-white/[0.12]";

export function NumberPad({
  onKey,
  decimal = true,
  size = "regular",
  className = "",
}: {
  onKey: (key: NumberPadKey) => void;
  /** Show the decimal point. Percentages and money both need it. */
  decimal?: boolean;
  size?: "regular" | "compact";
  className?: string;
}) {
  const keyHeight = size === "compact" ? "h-12" : "h-14";
  const press = (key: NumberPadKey) => () => onKey(key);

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((digit) => (
        <button
          key={digit}
          type="button"
          onClick={press(digit)}
          className={`${KEY_CLASS} ${keyHeight}`}
        >
          {digit}
        </button>
      ))}
      <button
        type="button"
        onClick={press(".")}
        disabled={!decimal}
        className={`${KEY_CLASS} ${keyHeight} disabled:opacity-30`}
      >
        .
      </button>
      <button type="button" onClick={press("0")} className={`${KEY_CLASS} ${keyHeight}`}>
        0
      </button>
      <button
        type="button"
        onClick={press("backspace")}
        aria-label="Delete last digit"
        className={`${KEY_CLASS} ${keyHeight} text-xl`}
      >
        ⌫
      </button>
      <button
        type="button"
        onClick={press("clear")}
        className={`${KEY_CLASS} ${keyHeight} col-span-3 text-base font-bold tracking-wide text-zinc-300`}
      >
        Clear
      </button>
    </div>
  );
}

/**
 * Apply a pad press to a raw text field value.
 *
 * Guards the things a physical keyboard would let through and a cashier should
 * not: a second decimal point, more than two decimal places, and a runaway
 * number of digits.
 */
export function applyNumberKey(
  current: string,
  key: NumberPadKey,
  { decimal = true, maxIntegerDigits = 6 }: { decimal?: boolean; maxIntegerDigits?: number } = {},
): string {
  if (key === "clear") return "";
  if (key === "backspace") return current.slice(0, -1);
  if (key === ".") {
    if (!decimal || current.includes(".")) return current;
    return current === "" ? "0." : `${current}.`;
  }
  if (!/^[0-9]$/.test(key)) return current;

  const [whole, fraction] = current.split(".");
  if (current.includes(".")) {
    if ((fraction ?? "").length >= 2) return current;
    return `${current}${key}`;
  }
  if (whole.length >= maxIntegerDigits) return current;
  // Avoid "007" while still allowing a leading zero before a decimal point.
  if (whole === "0") return key;
  return `${current}${key}`;
}
