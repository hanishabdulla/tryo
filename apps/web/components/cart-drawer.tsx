"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { describeLine, lineTotal, unitPrice, useCart, type CartLine } from "@/lib/cart";
import { formatPence } from "@/lib/money";
import { api, convexEnabled } from "@/lib/convex-api";
import { PREP_MINUTES, SHOP, shopStatus } from "@/lib/hours";

type Step = "basket" | "details" | "done";

type PlaceOrderFn = (args: Record<string, unknown>) => Promise<unknown>;

/** Mounted only when Convex is configured, so `useMutation` always has a provider. */
function ConnectedCartDrawer() {
  const placeOrder = useMutation(api.online.placeOnlineOrder) as unknown as PlaceOrderFn;
  return <CartDrawerBody placeOrder={placeOrder} />;
}

/**
 * `useMutation` throws without a ConvexProvider ancestor, and `<Providers>` only
 * mounts one when NEXT_PUBLIC_CONVEX_URL is set. `convexEnabled` is a build-time
 * constant, so this branch never flips at runtime and never reorders hooks.
 */
export function CartDrawer() {
  return convexEnabled ? <ConnectedCartDrawer /> : <CartDrawerBody placeOrder={null} />;
}

function CartDrawerBody({ placeOrder }: { placeOrder: PlaceOrderFn | null }) {
  const { lines, count, subtotal, isOpen, closeCart, setQuantity, remove, clear } = useCart();

  const [step, setStep] = useState<Step>("basket");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<{ orderNumber: number; total: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Guards against a double-tap submitting the order twice.
  const inFlight = useRef(false);

  // Collection only — there is no delivery fee to add, so the basket total is
  // the subtotal.
  const total = subtotal;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closeCart]);

  // Derived, not corrected in an effect: emptying the basket while on the form
  // should fall back to the basket view on the very same render.
  const activeStep: Step = count === 0 && step === "details" ? "basket" : step;

  const phoneValid = useMemo(() => phone.replace(/\D/g, "").length >= 10, [phone]);
  const detailsValid = name.trim().length >= 2 && phoneValid;

  const submit = async () => {
    if (inFlight.current || !detailsValid || count === 0) return;
    if (!placeOrder) {
      setError("Online ordering isn't switched on yet — please give us a call and we'll take it over the phone.");
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const result = (await placeOrder({
        items: lines.map((line) => ({
          itemName: line.itemName,
          isMeal: line.isMeal,
          mealLabel: line.isMeal ? "Fries + Drink" : null,
          unitPrice: unitPrice(line),
          quantity: line.quantity,
          lineTotal: lineTotal(line),
          ...(line.options.length ? { addons: line.options.map((o) => o.name) } : {}),
          ...(line.note ? { note: line.note } : {}),
        })),
        totalItemCount: count,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerNote: note.trim() || null,
      })) as { orderNumber: number; total: number };

      setPlaced(result);
      setStep("done");
      clear();
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message.replace(/^\[.*?\]\s*/, "")
          : "We couldn't place that order. Please try again or give us a call.",
      );
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  };

  const closeAndReset = () => {
    closeCart();
    // Let the exit transition finish before resetting to the basket step.
    window.setTimeout(() => {
      if (step === "done") {
        setStep("basket");
        setPlaced(null);
        setName("");
        setPhone("");
        setNote("");
      }
    }, 300);
  };

  return (
    <>
      {/* Persistent mobile bar — the fastest route back to the basket. */}
      {count > 0 && !isOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <BasketBar count={count} subtotal={subtotal} />
        </div>
      ) : null}

      <div
        className={`fixed inset-0 z-[65] transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!isOpen}
      >
        <button type="button" aria-label="Close basket" onClick={closeAndReset} className="absolute inset-0 bg-char-950/80 backdrop-blur-sm" />

        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Your basket"
          className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/10 bg-char-900 shadow-2xl transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-4">
            {activeStep === "details" ? (
              <button
                type="button"
                onClick={() => setStep("basket")}
                aria-label="Back to basket"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                  <path d="M19 12H6M11.5 5.5 5 12l6.5 6.5" />
                </svg>
              </button>
            ) : null}

            <h2 className="font-display text-xl font-extrabold tracking-[-0.02em] text-white">
              {activeStep === "basket" ? "Your basket" : activeStep === "details" ? "Your details" : "Order placed"}
            </h2>

            <button
              type="button"
              onClick={closeAndReset}
              aria-label="Close basket"
              className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-5 w-5" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          {activeStep === "done" && placed ? (
            <Confirmation orderNumber={placed.orderNumber} total={placed.total} onClose={closeAndReset} />
          ) : (
            <>
              <div className="scroll-lock min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {count === 0 ? (
                  <EmptyBasket onClose={closeAndReset} />
                ) : activeStep === "basket" ? (
                  <ul className="space-y-3">
                    {lines.map((line) => (
                      <li key={line.key}>
                        <BasketRow line={line} onQuantity={(q) => setQuantity(line.key, q)} onRemove={() => remove(line.key)} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <DetailsForm
                    name={name}
                    setName={setName}
                    phone={phone}
                    setPhone={setPhone}
                    note={note}
                    setNote={setNote}
                  />
                )}
              </div>

              {count > 0 ? (
                <footer className="shrink-0 space-y-3 border-t border-white/10 bg-char-850/80 p-5 backdrop-blur">
                  {/* Collection only, so there is no fee line to break out —
                      a subtotal identical to the total is just noise. */}
                  <dl className="flex items-baseline justify-between">
                    <dt className="font-display text-lg font-bold text-white">Total</dt>
                    <dd className="font-display text-2xl font-extrabold text-white">{formatPence(total)}</dd>
                  </dl>

                  {error ? (
                    <p role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {error}
                    </p>
                  ) : null}

                  {activeStep === "basket" ? (
                    <button
                      type="button"
                      onClick={() => setStep("details")}
                      className="flex h-14 w-full items-center justify-center rounded-full bg-lime font-display text-base font-bold text-char-950 transition-transform duration-200 hover:scale-[1.02] active:scale-95"
                    >
                      Checkout
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={submit}
                      disabled={!detailsValid || submitting}
                      className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-lime font-display text-base font-bold text-char-950 transition-transform duration-200 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                    >
                      {submitting ? "Sending to the kitchen…" : `Place order · ${formatPence(total)}`}
                    </button>
                  )}

                  <p className="text-center text-xs text-char-400">
                    Pay when you collect. We&apos;ll ring if anything&apos;s unavailable.
                  </p>
                </footer>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function BasketBar({ count, subtotal }: { count: number; subtotal: number }) {
  const { openCart } = useCart();
  return (
    <button
      type="button"
      onClick={openCart}
      className="flex h-14 w-full items-center justify-between rounded-full bg-lime px-5 font-display text-base font-bold text-char-950 shadow-[0_12px_40px_-12px_rgba(25,201,128,0.8)] active:scale-95"
    >
      <span className="inline-flex items-center gap-2.5">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-char-950 px-2 text-sm text-lime">
          {count}
        </span>
        View basket
      </span>
      <span>{formatPence(subtotal)}</span>
    </button>
  );
}

function BasketRow({
  line,
  onQuantity,
  onRemove,
}: {
  line: CartLine;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const modifiers = describeLine(line);
  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-char-850 p-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
        {line.image ? <Image src={line.image} alt="" fill sizes="64px" className="object-cover" /> : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold leading-snug text-white">{line.itemName}</h3>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${line.itemName}`}
            className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-char-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-4 w-4" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {modifiers ? <p className="mt-0.5 text-xs leading-snug text-char-400">{modifiers}</p> : null}

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex h-9 items-center gap-0.5 rounded-full border border-white/12 px-1">
            <button
              type="button"
              onClick={() => onQuantity(line.quantity - 1)}
              aria-label={`Decrease ${line.itemName}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
            >
              −
            </button>
            <span className="w-6 text-center text-sm font-bold text-white">{line.quantity}</span>
            <button
              type="button"
              onClick={() => onQuantity(line.quantity + 1)}
              aria-label={`Increase ${line.itemName}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
            >
              +
            </button>
          </div>
          <span className="font-display text-sm font-bold text-gold">{formatPence(lineTotal(line))}</span>
        </div>
      </div>
    </div>
  );
}

function DetailsForm(props: {
  name: string;
  setName: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
}) {
  // Read once on mount: the banner shouldn't change under the customer mid-form.
  const [status] = useState(() => shopStatus());

  return (
    <div className="space-y-5">
      {!status.open ? (
        <p className="rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm leading-relaxed text-gold-soft">
          We&apos;re closed right now — {status.detail}. Send the order anyway and we&apos;ll start it the moment the
          kitchen opens.
        </p>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-char-850 px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-char-400">Collect from</p>
        <p className="mt-1.5 text-sm leading-relaxed text-white">{SHOP.addressLines.join(", ")}</p>
        <p className="mt-2 text-xs text-char-400">Ready in about {PREP_MINUTES} minutes once the kitchen starts it.</p>
      </div>

      <Field label="Name" value={props.name} onChange={props.setName} autoComplete="name" placeholder="Who's collecting?" />
      <Field
        label="Mobile number"
        value={props.phone}
        onChange={props.setPhone}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="07…"
        hint="So we can ring you when it's ready."
      />
      <Field label="Order notes (optional)" value={props.note} onChange={props.setNote} placeholder="Allergies, parking, anything else" />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  placeholder,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.18em] text-char-400">
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        /* 16px on mobile: anything smaller makes iOS Safari zoom the page on focus. */
        className="mt-2 w-full rounded-2xl border border-white/10 bg-char-850 px-4 py-3.5 text-base text-white placeholder:text-char-400 focus:border-lime/60 focus:outline-none sm:text-sm"
      />
      {hint ? <p className="mt-1.5 text-xs text-char-400">{hint}</p> : null}
    </div>
  );
}

function EmptyBasket({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-char-850">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-9 w-9 text-char-400" aria-hidden>
          <path d="M3 7h18l-1.6 11.2A2 2 0 0 1 17.4 20H6.6a2 2 0 0 1-2-1.8L3 7Z" />
          <path d="M8.5 7 12 2.8 15.5 7" />
        </svg>
      </div>
      <div>
        <p className="font-display text-lg font-bold text-white">Nothing in here yet</p>
        <p className="mt-1.5 text-sm text-char-400">The Dirty Fries are right there, waiting.</p>
      </div>
      <Link
        href="/menu"
        onClick={onClose}
        className="inline-flex h-12 items-center rounded-full bg-lime px-7 text-sm font-bold text-char-950"
      >
        Browse the menu
      </Link>
    </div>
  );
}

function Confirmation({
  orderNumber,
  total,
  onClose,
}: {
  orderNumber: number;
  total: number;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-lime/15">
        <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full bg-lime/30" />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="relative h-11 w-11 text-lime" aria-hidden>
          <path d="M4 12.5 9.5 18 20 6.5" />
        </svg>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-char-400">Order</p>
        <p className="mt-1 font-display text-5xl font-extrabold tracking-[-0.03em] text-gold">#{orderNumber}</p>
      </div>

      <p className="max-w-xs text-pretty text-sm leading-relaxed text-char-200">
        It&apos;s on the kitchen screen now. We&apos;ll ring you when it&apos;s ready to collect — roughly{" "}
        {PREP_MINUTES} minutes. Pay at the counter: {formatPence(total)}.
      </p>

      <div className="flex w-full flex-col gap-2">
        <a
          href={SHOP.phoneHref}
          className="inline-flex h-12 w-full items-center justify-center rounded-full border border-white/15 text-sm font-semibold text-white transition-colors hover:border-white/30"
        >
          Call the shop
        </a>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-lime text-sm font-bold text-char-950"
        >
          Done
        </button>
      </div>
    </div>
  );
}
