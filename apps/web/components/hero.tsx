"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/client-state";
import { Embers } from "./embers";
import { ServiceStatus } from "./service-status";
import { PREP_MINUTES, SHOP } from "@/lib/hours";

/**
 * The words that cycle under "Legendary flavour," in the headline. Kept short so
 * each one fits on a single line inside the fixed-height slot, even on a phone.
 */
const ROTATING = ["charred to perfection.", "smashed & seared.", "fried to order.", "loaded to the edge."];

export function Hero() {
  const [wordIndex, setWordIndex] = useState(0);
  const reduced = usePrefersReducedMotion();
  const parallaxRef = useRef<HTMLDivElement>(null);

  // Rotate the tagline. Held still for anyone who asked for less motion.
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setWordIndex((i) => (i + 1) % ROTATING.length), 2800);
    return () => window.clearInterval(id);
  }, [reduced]);

  // Slow drift on the flame plate as you scroll out of the hero.
  useEffect(() => {
    if (reduced) return;
    const node = parallaxRef.current;
    if (!node) return;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const offset = Math.min(window.scrollY, 700);
        node.style.transform = `translate3d(0, ${offset * 0.22}px, 0) scale(${1 + offset * 0.00018})`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [reduced]);

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden pb-16 pt-32 sm:pb-24">
      {/* Flame plate */}
      <div ref={parallaxRef} className="absolute inset-0 -z-20 will-change-transform">
        <Image
          src="/img/hero-flame.jpg"
          alt=""
          fill
          preload
          sizes="100vw"
          className="scale-110 object-cover object-center opacity-70"
        />
      </div>

      {/* Legibility scrim: dark at the bottom where the copy sits, warm at the top. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(120%_85%_at_50%_0%,rgba(236,177,0,0.20),transparent_58%),linear-gradient(to_top,var(--color-char-950)_16%,rgba(7,8,7,0.82)_46%,rgba(7,8,7,0.42)_100%)]"
      />
      <Embers />

      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10">
        <div className="flex flex-col items-start gap-7">
          {/* One typographic strip: place, then live trading status. */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
              {SHOP.locality}
            </span>
            <span aria-hidden className="h-3 w-px bg-white/20" />
            <ServiceStatus />
          </div>

          {/*
            `w-full` is load-bearing. The hero column is `items-start`, which
            shrink-wraps the h1 to its widest *in-flow* line — "Legendary
            flavour,". The rotating phrases are absolutely positioned, so they
            contribute nothing to that width and were being wrapped and clipped
            inside a box sized for a shorter line. Stretching the h1 to the
            container gives them the full measure.

            `text-balance` is also omitted deliberately: on a shrink-wrapped
            heading it narrows the box further, compounding the same problem.
          */}
          <h1 className="w-full max-w-6xl font-display text-[clamp(2.1rem,6.2vw,5.75rem)] font-extrabold leading-[0.95] tracking-[-0.035em]">
            <span className="block text-white">Legendary flavour,</span>
            {/*
              Fixed height so swapping phrases never reflows the page, but NOT
              `overflow-hidden`: a mask tight enough to hide the outgoing word
              also crops the descender on "edge". The transition is therefore a
              fade plus a short drift, which reads cleanly unclipped, instead of
              a full-height slide that would need one.
            */}
            <span className="relative mt-1 block h-[1.22em]">
              {ROTATING.map((word, index) => {
                const active = index === wordIndex;
                return (
                  <span
                    key={word}
                    aria-hidden={!active}
                    className="foil absolute inset-x-0 top-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{
                      opacity: active ? 1 : 0,
                      transform: `translateY(${active ? "0" : index < wordIndex ? "-0.16em" : "0.16em"})`,
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </span>
          </h1>

          <p className="max-w-xl text-pretty text-base leading-relaxed text-char-200 sm:text-lg">
            Smash burgers, Korean popcorn chicken and fries loaded past the point of reason — cooked to order at
            Rushden Lakes. Crafted for you, enjoyed your way.
          </p>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Link
              href="/menu"
              className="group inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-lime px-8 text-base font-bold text-char-950 green-glow transition-transform duration-200 hover:scale-[1.03] active:scale-95"
            >
              Order online
              <ArrowIcon className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <a
              href={SHOP.phoneHref}
              className="inline-flex h-14 items-center justify-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-8 text-base font-semibold text-white backdrop-blur transition-colors hover:border-white/30 hover:bg-white/10"
            >
              Call {SHOP.phone.replace("+44 ", "0")}
            </a>
          </div>

          <dl className="mt-2 grid w-full max-w-lg grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 text-center">
            {[
              [`${PREP_MINUTES} min`, "Collection"],
              ["11–6", "Every day"],
              ["100%", "Cooked to order"],
            ].map(([value, label]) => (
              <div key={label} className="bg-char-950/70 px-3 py-4 backdrop-blur">
                <dt className="font-display text-xl font-bold text-gold sm:text-2xl">{value}</dt>
                <dd className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-char-400">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-char-950 to-transparent" />
    </section>
  );
}

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 12h13M12.5 5.5 19 12l-6.5 6.5" />
    </svg>
  );
}
