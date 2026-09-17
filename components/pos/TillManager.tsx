"use client";

import { useMutation } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/convex-api";
import { formatPence, parsePenceFromInput } from "@/lib/money";
import { todayBusinessDate, type TillDaySummary } from "@/lib/till";

type Props = {
  businessDate: string;
  day: TillDaySummary | null | undefined;
  isOpen: boolean;
  onClose: () => void;
};

function displayDate(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function displayTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function TillManager({ businessDate, day, isOpen, onClose }: Props) {
  const openDay = useMutation(api.till.openDay);
  const recordMovement = useMutation(api.till.recordMovement);
  const closeDay = useMutation(api.till.closeDay);
  const [openingRaw, setOpeningRaw] = useState("");
  const [movementType, setMovementType] = useState<"cash_in" | "cash_out">(
    "cash_out",
  );
  const [movementRaw, setMovementRaw] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [countedRaw, setCountedRaw] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMessage(null);
  }, [day?.status, isOpen]);

  const openingPence = parsePenceFromInput(openingRaw);
  const movementPence = parsePenceFromInput(movementRaw);
  const countedPence = parsePenceFromInput(countedRaw);
  const recentMovements = useMemo(
    () => [...(day?.movements ?? [])].reverse(),
    [day?.movements],
  );

  if (!isOpen) return null;

  const closeAllowed = day !== null;
  const isPreviousDay = businessDate !== todayBusinessDate();

  async function handleOpenDay() {
    if (openingPence === null) return;
    setBusy(true);
    setMessage(null);
    try {
      await openDay({ openingFloatPence: openingPence });
      setOpeningRaw("");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleMovement() {
    if (
      movementPence === null ||
      movementPence <= 0 ||
      !movementReason.trim()
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await recordMovement({
        businessDate: day?.businessDate ?? businessDate,
        type: movementType,
        amountPence: movementPence,
        reason: movementReason,
      });
      setMovementRaw("");
      setMovementReason("");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseDay() {
    if (countedPence === null) return;
    const confirmed = window.confirm(
      isPreviousDay
        ? `Settle and close the till from ${displayDate(businessDate)}?`
        : "Settle and close today's till? New orders will be blocked until tomorrow.",
    );
    if (!confirmed) return;
    setBusy(true);
    setMessage(null);
    try {
      await closeDay({
        businessDate: day?.businessDate ?? businessDate,
        countedCashPence: countedPence,
        closingNote,
      });
      setCountedRaw("");
      setClosingNote("");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="till-manager-title"
    >
      <div className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/[0.08] bg-[#111114] shadow-2xl shadow-black/70">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#111114]/95 px-6 py-5 backdrop-blur">
          <div>
            <div className="flex items-center gap-2">
              <h2
                id="till-manager-title"
                className="text-xl font-bold tracking-tight text-white"
              >
                {day?.status === "closed"
                  ? "Day settled"
                  : isPreviousDay
                    ? "Settle previous till"
                  : day
                    ? "Today's till"
                    : "Start today's till"}
              </h2>
              {day ? (
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    day.status === "open"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-zinc-700/60 text-zinc-300"
                  }`}
                >
                  {day.status}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {displayDate(businessDate)}
            </p>
          </div>
          {closeAllowed ? (
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 min-w-11 rounded-xl bg-white/[0.05] text-lg text-zinc-300 hover:bg-white/[0.09] hover:text-white"
              aria-label="Close till manager"
            >
              ×
            </button>
          ) : null}
        </div>

        {day === undefined ? (
          <div className="flex min-h-72 items-center justify-center text-zinc-500">
            Loading till…
          </div>
        ) : day === null ? (
          <div className="p-6 sm:p-8">
            <div className="rounded-2xl border border-[#00955e]/25 bg-[#00955e]/[0.07] p-5">
              <div className="text-sm font-semibold text-emerald-300">
                First invoice today will be #1
              </div>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                Count the cash already in the drawer before taking the first
                order. This becomes today&apos;s opening float.
              </p>
            </div>
            <label className="mt-6 block text-sm font-semibold text-zinc-200">
              Opening cash float
              <input
                inputMode="decimal"
                autoFocus
                value={openingRaw}
                onChange={(event) => setOpeningRaw(event.target.value)}
                placeholder="0.00"
                className="mt-2 h-16 w-full rounded-2xl border border-white/[0.08] bg-zinc-950 px-4 text-2xl font-bold text-white outline-none focus:border-[#00955e]/70"
              />
            </label>
            <p className="mt-2 text-xs text-zinc-500">
              Enter zero if the drawer starts empty.
            </p>
            {message ? (
              <p role="alert" className="mt-4 text-sm text-red-300">
                {message}
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy || openingPence === null}
              onClick={() => void handleOpenDay()}
              className="mt-6 min-h-14 w-full rounded-2xl bg-[#00955e] text-base font-bold text-white shadow-[var(--tryo-glow)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Opening till…" : "Open till for today"}
            </button>
          </div>
        ) : (
          <div className="space-y-6 p-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Gross sales", day.totals.grossSalesPence],
                ["Card sales", day.totals.cardSalesPence],
                ["Cash sales", day.totals.cashSalesPence],
                ["Orders", day.totals.orderCount],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4"
                >
                  <div className="text-xs font-medium text-zinc-500">
                    {label}
                  </div>
                  <div className="mt-1 text-xl font-bold text-white">
                    {label === "Orders"
                      ? String(value)
                      : formatPence(value as number)}
                  </div>
                </div>
              ))}
            </div>

            <section className="rounded-2xl border border-white/[0.07] bg-zinc-950/70 p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Expected in drawer
                  </div>
                  <div className="mt-1 text-3xl font-extrabold text-[#34c68a]">
                    {formatPence(day.totals.expectedCashPence)}
                  </div>
                </div>
                <div className="text-right text-xs leading-5 text-zinc-500">
                  Opened {displayTime(day.openedAt)}
                  <br />
                  Float {formatPence(day.openingFloatPence)}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-4 text-center sm:grid-cols-4">
                <div>
                  <div className="text-[11px] text-zinc-500">Cash received</div>
                  <div className="mt-1 text-sm font-semibold text-emerald-300">
                    +{formatPence(day.totals.cashReceivedPence)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-500">Change given</div>
                  <div className="mt-1 text-sm font-semibold text-amber-300">
                    −{formatPence(day.totals.changeGivenPence)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-500">Cash added</div>
                  <div className="mt-1 text-sm font-semibold text-emerald-300">
                    +{formatPence(day.totals.cashInPence)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-500">Cash removed</div>
                  <div className="mt-1 text-sm font-semibold text-amber-300">
                    −{formatPence(day.totals.cashOutPence)}
                  </div>
                </div>
              </div>
            </section>

            {day.status === "open" ? (
              <>
                <section>
                  <h3 className="text-sm font-bold text-white">
                    Cash movement
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Record petty cash, bank drops, or extra change added to the
                    drawer. Customer change is tracked automatically above.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMovementType("cash_in")}
                      className={`min-h-12 rounded-xl border text-sm font-bold ${
                        movementType === "cash_in"
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                          : "border-white/[0.07] bg-zinc-950 text-zinc-400"
                      }`}
                    >
                      Add cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setMovementType("cash_out")}
                      className={`min-h-12 rounded-xl border text-sm font-bold ${
                        movementType === "cash_out"
                          ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                          : "border-white/[0.07] bg-zinc-950 text-zinc-400"
                      }`}
                    >
                      Remove cash
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr_auto]">
                    <input
                      inputMode="decimal"
                      value={movementRaw}
                      onChange={(event) => setMovementRaw(event.target.value)}
                      placeholder="Amount"
                      aria-label="Cash movement amount"
                      className="h-12 rounded-xl border border-white/[0.07] bg-zinc-950 px-4 font-semibold text-white outline-none focus:border-[#00955e]/70"
                    />
                    <input
                      value={movementReason}
                      onChange={(event) =>
                        setMovementReason(event.target.value.slice(0, 120))
                      }
                      placeholder="Reason, e.g. cash taken to safe"
                      aria-label="Cash movement reason"
                      className="h-12 rounded-xl border border-white/[0.07] bg-zinc-950 px-4 text-white outline-none focus:border-[#00955e]/70"
                    />
                    <button
                      type="button"
                      disabled={
                        busy ||
                        movementPence === null ||
                        movementPence <= 0 ||
                        !movementReason.trim()
                      }
                      onClick={() => void handleMovement()}
                      className="min-h-12 rounded-xl bg-zinc-800 px-5 text-sm font-bold text-white disabled:opacity-40"
                    >
                      Record
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border border-red-500/15 bg-red-500/[0.035] p-5">
                  <h3 className="text-sm font-bold text-white">
                    Settle and close day
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    Count every note and coin currently in the drawer. Closing
                    records the difference and stops new orders for today.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-zinc-400">
                      Counted cash
                      <input
                        inputMode="decimal"
                        value={countedRaw}
                        onChange={(event) => setCountedRaw(event.target.value)}
                        placeholder="0.00"
                        className="mt-2 h-12 w-full rounded-xl border border-white/[0.07] bg-zinc-950 px-4 text-lg font-bold text-white outline-none focus:border-red-400/60"
                      />
                    </label>
                    <label className="text-xs font-semibold text-zinc-400">
                      Closing note (optional)
                      <input
                        value={closingNote}
                        onChange={(event) =>
                          setClosingNote(event.target.value.slice(0, 240))
                        }
                        placeholder="Anything to explain"
                        className="mt-2 h-12 w-full rounded-xl border border-white/[0.07] bg-zinc-950 px-4 text-white outline-none focus:border-red-400/60"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={busy || countedPence === null}
                    onClick={() => void handleCloseDay()}
                    className="mt-4 min-h-12 w-full rounded-xl border border-red-500/30 bg-red-500/10 text-sm font-bold text-red-200 hover:bg-red-500/15 disabled:opacity-40"
                  >
                    {busy ? "Closing…" : "Settle & close today"}
                  </button>
                </section>
              </>
            ) : (
              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-xs text-zinc-500">Expected</div>
                    <div className="mt-1 text-lg font-bold text-white">
                      {formatPence(
                        day.expectedCashPence ?? day.totals.expectedCashPence,
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Counted</div>
                    <div className="mt-1 text-lg font-bold text-white">
                      {formatPence(day.countedCashPence ?? 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Difference</div>
                    <div
                      className={`mt-1 text-lg font-bold ${
                        (day.variancePence ?? 0) === 0
                          ? "text-emerald-300"
                          : "text-amber-300"
                      }`}
                    >
                      {formatPence(day.variancePence ?? 0)}
                    </div>
                  </div>
                </div>
                {day.closingNote ? (
                  <p className="mt-4 border-t border-white/[0.06] pt-4 text-sm text-zinc-400">
                    {day.closingNote}
                  </p>
                ) : null}
              </section>
            )}

            {recentMovements.length > 0 ? (
              <section>
                <h3 className="text-sm font-bold text-white">Cash history</h3>
                <div className="mt-3 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07] bg-zinc-950/60">
                  {recentMovements.map((movement) => (
                    <div
                      key={movement._id}
                      className="flex items-center justify-between gap-4 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-200">
                          {movement.reason}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-600">
                          {displayTime(movement.createdAt)}
                        </div>
                      </div>
                      <div
                        className={`shrink-0 text-sm font-bold ${
                          movement.type === "cash_in"
                            ? "text-emerald-300"
                            : "text-amber-300"
                        }`}
                      >
                        {movement.type === "cash_in" ? "+" : "−"}
                        {formatPence(movement.amountPence)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {message ? (
              <p role="alert" className="text-sm text-red-300">
                {message}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
