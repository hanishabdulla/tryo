"use client";

/**
 * Small chart primitives for the insights page.
 *
 * Every chart here plots a single series, so it uses one sequential green ramp
 * (more is darker/brighter) rather than a categorical palette — the reader's
 * job is always "compare magnitude", never "tell series apart". The ramp is
 * monotone in lightness and its lightest step clears 3:1 against this
 * dashboard's dark surface.
 */
const RAMP = ["#226f4e", "#2b8a61", "#34a574", "#3dc087", "#46db9a"] as const;

/** Ramp step for a value, scaled against the largest value in the chart. */
function rampStep(value: number, max: number): string {
  if (max <= 0) return RAMP[0];
  const index = Math.min(
    RAMP.length - 1,
    Math.max(0, Math.round((value / max) * (RAMP.length - 1))),
  );
  return RAMP[index];
}

export type ChartDatum = {
  label: string;
  value: number;
  /** Pre-formatted value shown to the reader, e.g. "£124.50" or "18". */
  display: string;
  /** Extra line in the tooltip, e.g. "12 orders". */
  secondary?: string;
};

function Tooltip({ datum }: { datum: ChartDatum }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs shadow-xl group-hover:block group-focus-visible:block"
    >
      <span className="block font-semibold text-white">{datum.label}</span>
      <span className="block text-zinc-400">{datum.display}</span>
      {datum.secondary ? (
        <span className="block text-zinc-500">{datum.secondary}</span>
      ) : null}
    </span>
  );
}

/**
 * Ranked horizontal bars. The label and the value are ordinary text in a
 * fixed column; the bar is the only thing wearing the series colour.
 */
export function BarList({
  data,
  emptyMessage = "Nothing to show for this period.",
}: {
  data: ChartDatum[];
  emptyMessage?: string;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">{emptyMessage}</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 0);

  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((datum) => (
        <li key={datum.label} className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm text-zinc-300">{datum.label}</span>
            </div>
            <div className="mt-1.5 h-2.5 w-full rounded-sm bg-white/[0.04]">
              <div
                className="h-2.5 rounded-l-sm rounded-r"
                style={{
                  width: `${max > 0 ? Math.max((datum.value / max) * 100, 1.5) : 0}%`,
                  backgroundColor: rampStep(datum.value, max),
                }}
              />
            </div>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-white">
            {datum.display}
          </span>
          <Tooltip datum={datum} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Columns over a shared baseline. Only the tallest column is directly
 * labelled; the rest are carried by the axis and the hover tooltip.
 */
export function ColumnChart({
  data,
  height = 160,
  emptyMessage = "Nothing to show for this period.",
}: {
  data: ChartDatum[];
  height?: number;
  emptyMessage?: string;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">{emptyMessage}</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 0);
  const peak = data.reduce(
    (best, d) => (d.value > best.value ? d : best),
    data[0],
  );

  return (
    <div>
      <div
        className="relative flex items-end gap-[2px] border-b border-white/[0.08]"
        style={{ height }}
      >
        {/* Recessive hairline gridlines at a quarter, half and three quarters. */}
        {[0.25, 0.5, 0.75].map((fraction) => (
          <span
            key={fraction}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-white/[0.05]"
            style={{ bottom: `${fraction * 100}%` }}
          />
        ))}
        {data.map((datum) => {
          const isPeak = datum.label === peak.label && datum.value > 0;
          return (
            <div
              key={datum.label}
              tabIndex={0}
              aria-label={`${datum.label}: ${datum.display}`}
              className="group relative flex h-full flex-1 items-end justify-center rounded-t focus:outline-none focus-visible:bg-white/[0.04]"
            >
              {isPeak ? (
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold tabular-nums text-zinc-400">
                  {datum.display}
                </span>
              ) : null}
              <div
                className="w-full max-w-[24px] rounded-t"
                style={{
                  height:
                    max > 0 && datum.value > 0
                      ? `calc(${(datum.value / max) * 100}% - 14px)`
                      : "0px",
                  minHeight: datum.value > 0 ? 3 : 0,
                  backgroundColor: rampStep(datum.value, max),
                }}
              />
              <Tooltip datum={datum} />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[2px]">
        {data.map((datum, index) => (
          <div
            key={datum.label}
            className="flex-1 truncate text-center text-[10px] text-zinc-600"
          >
            {/* Thin out tick labels so they never collide on a narrow card. */}
            {data.length <= 12 || index % Math.ceil(data.length / 12) === 0
              ? datum.label
              : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
