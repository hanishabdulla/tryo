"use client";

import { useState } from "react";

/**
 * Compact on-screen QWERTY for the till. Deliberately small: the POS panel is
 * 1366×768 and the keyboard must leave the dialog it belongs to on screen.
 */
const LETTER_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const SYMBOL_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "/", ":", ";", "(", ")", "£", "&", "@"],
  [".", ",", "?", "!", "'", "\"", "+", "="],
];

const KEY_CLASS =
  "flex h-12 min-w-11 flex-1 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.05] text-lg font-semibold text-white transition-colors select-none hover:bg-white/[0.09] active:scale-[0.97] active:bg-white/[0.14]";
const MOD_CLASS =
  "flex h-12 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 text-sm font-bold text-zinc-300 transition-colors select-none hover:bg-white/[0.08] active:scale-[0.97]";

export function TextKeyboard({
  onKey,
  onBackspace,
  onDone,
}: {
  onKey: (character: string) => void;
  onBackspace: () => void;
  onDone: () => void;
}) {
  const [shift, setShift] = useState(true);
  const [symbols, setSymbols] = useState(false);
  const rows = symbols ? SYMBOL_ROWS : LETTER_ROWS;

  const tap = (character: string) => {
    onKey(shift && !symbols ? character.toUpperCase() : character);
    // Shift behaves like a phone keyboard: one capital, then back to lower case.
    if (shift && !symbols) setShift(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-1.5">
      {rows.map((row, index) => (
        <div key={index} className="flex justify-center gap-1.5">
          {index === 2 && !symbols ? (
            <button
              type="button"
              aria-pressed={shift}
              onClick={() => setShift((on) => !on)}
              className={`${MOD_CLASS} ${shift ? "bg-[#00955e]/25 text-white" : ""}`}
            >
              ⇧ Shift
            </button>
          ) : null}
          {row.map((character) => (
            <button
              key={character}
              type="button"
              onClick={() => tap(character)}
              className={KEY_CLASS}
            >
              {shift && !symbols ? character.toUpperCase() : character}
            </button>
          ))}
          {index === 2 ? (
            <button
              type="button"
              onClick={onBackspace}
              aria-label="Delete last character"
              className={MOD_CLASS}
            >
              ⌫ Delete
            </button>
          ) : null}
        </div>
      ))}
      <div className="flex justify-center gap-1.5">
        <button
          type="button"
          aria-pressed={symbols}
          onClick={() => setSymbols((on) => !on)}
          className={`${MOD_CLASS} ${symbols ? "bg-[#00955e]/25 text-white" : ""}`}
        >
          {symbols ? "ABC" : "?123"}
        </button>
        <button
          type="button"
          onClick={() => tap(" ")}
          aria-label="Space"
          className={`${KEY_CLASS} max-w-xl`}
        >
          space
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex h-12 items-center justify-center rounded-xl bg-[#00955e] px-6 text-sm font-bold text-white shadow-[var(--tryo-glow)] transition-colors hover:bg-[#007a4c] active:scale-[0.97]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
