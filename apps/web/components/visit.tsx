"use client";

import Image from "next/image";
import { HOURS_TABLE, SHOP } from "@/lib/hours";
import { useShopWeekday } from "@/lib/client-state";
import { Reveal } from "./reveal";
import { ServiceStatus } from "./service-status";

export function Visit() {
  // Resolved on the client so "today" follows the shop's clock, not the server's.
  const today = useShopWeekday();

  return (
    <section id="visit" className="relative scroll-mt-24 overflow-hidden py-20 sm:py-28">
      {/* Ember texture, heavily dimmed — it sits behind text so it must stay quiet. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <Image src="/img/grill-embers.jpg" alt="" fill sizes="100vw" className="object-cover opacity-[0.16]" />
        <div className="absolute inset-0 bg-gradient-to-b from-char-950 via-char-950/85 to-char-950" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">Find us</p>
          <h2 className="mt-3 max-w-3xl font-display text-[clamp(2rem,5.5vw,3.75rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-white text-balance">
            Unit FC3, Rushden Lakes
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-5">
          <Reveal className="lg:col-span-3">
            <div className="flex h-full flex-col gap-5 rounded-4xl border border-white/10 bg-char-900/70 p-6 backdrop-blur sm:p-8">
              <ServiceStatus size="lg" className="self-start" />

              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-char-400">Address</h3>
                <address className="mt-2 not-italic font-display text-xl font-bold leading-relaxed text-white sm:text-2xl">
                  {SHOP.addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </div>

              <div className="mt-auto flex flex-col gap-3 sm:flex-row">
                <a
                  href={SHOP.mapsUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-lime px-6 py-3.5 text-sm font-bold text-char-950 transition-transform duration-200 hover:scale-[1.02] active:scale-95"
                >
                  Get directions
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                    <path d="M7 17 17 7M9 7h8v8" />
                  </svg>
                </a>
                <a
                  href={SHOP.phoneHref}
                  className="inline-flex flex-1 items-center justify-center rounded-full border border-white/15 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/35"
                >
                  {SHOP.phone}
                </a>
              </div>
            </div>
          </Reveal>

          <Reveal delay={140} className="lg:col-span-2">
            <div className="h-full rounded-4xl border border-white/10 bg-char-900/70 p-6 backdrop-blur sm:p-8">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-char-400">Opening hours</h3>
              <dl className="mt-4 divide-y divide-white/8">
                {HOURS_TABLE.map((row) => {
                  const isToday = today === row.day;
                  return (
                    <div
                      key={row.day}
                      className={`flex items-center justify-between gap-4 py-3 text-sm ${
                        isToday ? "text-white" : "text-char-200"
                      }`}
                    >
                      <dt className="flex items-center gap-2 font-medium">
                        {row.label}
                        {isToday ? (
                          <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-char-950">
                            Today
                          </span>
                        ) : null}
                      </dt>
                      <dd className={`tabular-nums ${isToday ? "font-bold text-gold" : ""}`}>{row.hours}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
