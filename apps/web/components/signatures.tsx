"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { SIGNATURES } from "@/lib/menu";
import { formatPenceShort } from "@/lib/money";
import { Reveal } from "./reveal";

/**
 * The six dishes the homepage leads with.
 *
 * Mobile gets a snap-scrolling rail (thumb-friendly, no cramped grid); from `md`
 * up it becomes an asymmetric bento grid where the first and fourth tiles run
 * wide, which stops six food photos reading as a uniform catalogue.
 */
export function Signatures() {
  const railRef = useRef<HTMLDivElement>(null);

  const scrollBy = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * (rail.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <section id="signatures" className="relative scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">The hit list</p>
            <h2 className="mt-3 max-w-2xl font-display text-[clamp(2rem,5.5vw,3.75rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-white text-balance">
              Six things people come back for
            </h2>
          </Reveal>

          <Reveal delay={120} className="flex items-center gap-3">
            <div className="hidden gap-2 md:flex">
              <RailButton label="Previous dishes" onClick={() => scrollBy(-1)} flip />
              <RailButton label="Next dishes" onClick={() => scrollBy(1)} />
            </div>
            <Link
              href="/menu"
              className="inline-flex h-12 items-center rounded-full border border-white/15 px-6 text-sm font-semibold text-white transition-colors hover:border-lime hover:text-lime"
            >
              Full menu
            </Link>
          </Reveal>
        </div>

        {/* Mobile rail */}
        <div
          ref={railRef}
          className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:hidden"
        >
          {SIGNATURES.map((dish) => (
            <article key={dish.name} className="w-[78vw] shrink-0 snap-start">
              <DishTile dish={dish} />
            </article>
          ))}
        </div>

        {/* Desktop bento */}
        <div className="mt-12 hidden grid-cols-6 gap-5 md:grid">
          {SIGNATURES.map((dish, index) => {
            // Tiles 0 and 3 span half the row; the rest take a third.
            const wide = index === 0 || index === 3;
            return (
              <Reveal
                key={dish.name}
                as="article"
                delay={(index % 3) * 110}
                className={wide ? "col-span-3" : "col-span-2"}
              >
                <DishTile dish={dish} tall={wide} />
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DishTile({ dish, tall = false }: { dish: (typeof SIGNATURES)[number]; tall?: boolean }) {
  return (
    <Link
      href="/menu"
      className="group relative block h-full overflow-hidden rounded-4xl border border-white/10 bg-char-900"
    >
      <div className={`relative w-full ${tall ? "aspect-[16/11]" : "aspect-[4/3]"}`}>
        <Image
          src={dish.image}
          alt={dish.name}
          fill
          sizes="(max-width: 768px) 78vw, (max-width: 1280px) 45vw, 33vw"
          className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.07]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-char-950 via-char-950/45 to-transparent opacity-95"
        />
        {/* Gold wash on hover, tying the tile back to the brand accent. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-gold/25 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-char-950">
            {dish.kicker}
          </span>
          <span className="font-display text-lg font-bold text-white">{formatPenceShort(dish.price)}</span>
        </div>
        <h3 className="mt-3 font-display text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">
          {dish.name}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-char-200 text-pretty">{dish.copy}</p>
      </div>
    </Link>
  );
}

function RailButton({ label, onClick, flip = false }: { label: string; onClick: () => void; flip?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:border-lime hover:text-lime"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-5 w-5 ${flip ? "rotate-180" : ""}`}
        aria-hidden
      >
        <path d="M5 12h13M12.5 5.5 19 12l-6.5 6.5" />
      </svg>
    </button>
  );
}
