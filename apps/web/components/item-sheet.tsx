"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useCart, type CartOption } from "@/lib/cart";
import { useMenu } from "./providers";
import { formatPence } from "@/lib/money";
import { DRINK_CATEGORIES, type MenuItem } from "@/lib/menu";

export type SheetTarget = { item: MenuItem; category: string; mealEligible: boolean };

/**
 * Bottom sheet for building a line: meal upgrade, paid extras, a note and a
 * quantity. Opened for any item that has something to choose; items with no
 * options and no meal upgrade are added straight from the card instead.
 */
export function ItemSheet({ target, onClose }: { target: SheetTarget | null; onClose: () => void }) {
  const { addItem } = useCart();
  const { mealUpcharge, mealComboLabel, extras } = useMenu();

  const [isMeal, setIsMeal] = useState(false);
  const [options, setOptions] = useState<CartOption[]>([]);
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState(1);
  const closeRef = useRef<HTMLButtonElement>(null);

  // No reset effect: MenuBoard keys this component by item, so opening a
  // different dish remounts it and every useState above starts fresh.
  useEffect(() => {
    if (!target) return;
    closeRef.current?.focus();
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [target, onClose]);

  if (!target) return null;

  const { item, category, mealEligible } = target;

  // Add-ons are the item's own options plus the shared Extras list, which the
  // site offers on food but not on drinks. Names are deduplicated so an item
  // that already declares "Cheese" doesn't show it twice at two prices.
  const declared = item.options ?? [];
  const declaredNames = new Set(declared.map((o) => o.name));
  const shared = DRINK_CATEGORIES.has(category)
    ? []
    : extras
        .filter((extra) => !declaredNames.has(extra.name))
        .map((extra) => ({ name: extra.name, price: extra.basePrice }));
  const addOns = [...declared, ...shared];

  const extrasTotal = options.reduce((sum, o) => sum + o.price, 0);
  const unit = item.basePrice + (isMeal ? mealUpcharge : 0) + extrasTotal;

  const toggleOption = (option: CartOption) => {
    setOptions((current) =>
      current.some((o) => o.name === option.name)
        ? current.filter((o) => o.name !== option.name)
        : [...current, option],
    );
  };

  const confirm = () => {
    addItem({ item, category, isMeal, options, note: note.trim(), quantity });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-char-950/80 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        className="relative flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-t-4xl border border-white/10 bg-char-900 shadow-2xl animate-rise sm:rounded-4xl"
      >
        <div className="relative h-44 shrink-0 sm:h-52">
          {item.image ? (
            <Image src={item.image} alt="" fill sizes="512px" className="object-cover" />
          ) : null}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-char-900 via-char-900/30 to-transparent" />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-char-950/70 text-white backdrop-blur transition-colors hover:bg-char-950"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-5 w-5" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="scroll-lock min-h-0 flex-1 overflow-y-auto px-5 pb-4 sm:px-7">
          <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">
            {item.name}
          </h2>
          {item.description ? (
            <p className="mt-2 text-sm leading-relaxed text-char-200 text-pretty">{item.description}</p>
          ) : null}

          {mealEligible ? (
            <label className="mt-6 flex cursor-pointer items-center gap-4 rounded-2xl border border-gold/30 bg-gold/[0.07] p-4 transition-colors hover:bg-gold/[0.12]">
              <input
                type="checkbox"
                checked={isMeal}
                onChange={(event) => setIsMeal(event.target.checked)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  isMeal ? "border-gold bg-gold text-char-950" : "border-white/25"
                }`}
              >
                {isMeal ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <path d="M4 12.5 9.5 18 20 6.5" />
                  </svg>
                ) : null}
              </span>
              <span className="flex-1">
                <span className="block font-display text-base font-bold text-white">Make it a meal</span>
                <span className="block text-sm text-char-200">{mealComboLabel}</span>
              </span>
              <span className="font-display text-base font-bold text-gold">+{formatPence(mealUpcharge)}</span>
            </label>
          ) : null}

          {addOns.length ? (
            <div className="mt-6">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-char-400">Add extras</h3>
              <div className="mt-3 space-y-2">
                {addOns.map((option) => {
                  const checked = options.some((o) => o.name === option.name);
                  return (
                    <label
                      key={option.name}
                      className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition-colors ${
                        checked ? "border-lime/50 bg-lime/10" : "border-white/10 hover:bg-white/5"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOption(option)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          checked ? "border-lime bg-lime text-char-950" : "border-white/25"
                        }`}
                      >
                        {checked ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                            <path d="M4 12.5 9.5 18 20 6.5" />
                          </svg>
                        ) : null}
                      </span>
                      <span className="flex-1 text-sm font-medium text-white">{option.name}</span>
                      <span className="font-display text-sm font-bold text-lime">+{formatPence(option.price)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <label htmlFor="item-note" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-char-400">
              Anything else?
            </label>
            <input
              id="item-note"
              type="text"
              value={note}
              maxLength={120}
              onChange={(event) => setNote(event.target.value)}
              placeholder="No jalapenos, extra crispy…"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-char-850 px-4 py-3.5 text-sm text-white placeholder:text-char-400 focus:border-lime/60 focus:outline-none"
            />
            <p className="mt-2 text-xs text-char-400">Notes print on the kitchen ticket. We&apos;ll do our best.</p>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 bg-char-850/80 p-4 backdrop-blur sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-14 items-center gap-1 rounded-full border border-white/12 bg-char-900 px-1.5">
              <Stepper label="Decrease quantity" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}>
                −
              </Stepper>
              <span className="w-8 text-center font-display text-lg font-bold text-white" aria-live="polite">
                {quantity}
              </span>
              <Stepper label="Increase quantity" onClick={() => setQuantity((q) => Math.min(99, q + 1))}>
                +
              </Stepper>
            </div>

            <button
              type="button"
              onClick={confirm}
              className="flex h-14 flex-1 items-center justify-between rounded-full bg-lime px-6 font-display text-base font-bold text-char-950 transition-transform duration-200 hover:scale-[1.02] active:scale-95"
            >
              <span>Add to basket</span>
              <span>{formatPence(unit * quantity)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stepper({
  children,
  label,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
