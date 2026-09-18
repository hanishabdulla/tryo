"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { formatPence } from "@/lib/money";
import type { DietTag, MenuCategory, MenuItem } from "@/lib/menu";
import { useMenu } from "./providers";
import { ItemSheet, type SheetTarget } from "./item-sheet";

const TAG_STYLES: Record<DietTag, { label: string; className: string }> = {
  vegan: { label: "Vegan", className: "border-lime/40 bg-lime/10 text-lime-soft" },
  veggie: { label: "Veggie", className: "border-lime/30 bg-lime/[0.07] text-lime-soft" },
  spicy: { label: "Spicy", className: "border-gold/40 bg-gold/10 text-gold-soft" },
};

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function MenuBoard() {
  const { categories } = useMenu();
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>("");
  const [sheetTarget, setSheetTarget] = useState<SheetTarget | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  // Suppresses scroll-spy while a nav click is animating to its section.
  const jumpingRef = useRef(false);

  const search = query.trim().toLowerCase();
  const filtered = useMemo<MenuCategory[]>(() => {
    if (!search) return categories;
    return categories
      .map((category) => ({
        ...category,
        items: category.items.filter(
          (item) =>
            item.name.toLowerCase().includes(search) || item.description.toLowerCase().includes(search),
        ),
      }))
      .filter((category) => category.items.length > 0);
  }, [categories, search]);

  const resultCount = filtered.reduce((sum, category) => sum + category.items.length, 0);

  // Scroll-spy: the topmost section intersecting the band under the header wins.
  useEffect(() => {
    if (search) return;
    const sections = categories
      .map((category) => document.getElementById(slugify(category.name)))
      .filter((node): node is HTMLElement => node !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (jumpingRef.current) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      // Band sits just under the sticky header and rail.
      { rootMargin: "-140px 0px -70% 0px", threshold: 0 },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [categories, search]);

  // Keep the active chip in view as you scroll through the menu.
  useEffect(() => {
    if (!activeId) return;
    const chip = railRef.current?.querySelector<HTMLElement>(`[data-chip="${activeId}"]`);
    chip?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeId]);

  const jumpTo = useCallback((id: string) => {
    const section = document.getElementById(id);
    if (!section) return;
    jumpingRef.current = true;
    setActiveId(id);
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      jumpingRef.current = false;
    }, 800);
  }, []);

  return (
    <>
      {/* Sticky controls: category rail + search. Offset by the 72px header. */}
      <div className="sticky top-[72px] z-40 -mx-4 border-b border-white/10 bg-char-950/90 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2.5 py-2.5 sm:gap-3 sm:py-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-char-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the menu…"
                aria-label="Search the menu"
                className="h-12 w-full rounded-full border border-white/10 bg-char-850 pl-11 pr-4 text-base text-white placeholder:text-char-400 focus:border-lime/50 focus:outline-none sm:h-11 sm:text-sm"
              />
            </div>
          </div>

          {!search ? (
            <div ref={railRef} className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {categories.map((category) => {
                const id = slugify(category.name);
                const active = activeId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    data-chip={id}
                    onClick={() => jumpTo(id)}
                    aria-current={active ? "true" : undefined}
                    className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "border-lime bg-lime text-char-950"
                        : "border-white/10 bg-char-850 text-char-200 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {search ? (
        <p className="mt-8 text-sm text-char-400" role="status">
          {resultCount === 0
            ? `Nothing matches “${query.trim()}”.`
            : `${resultCount} ${resultCount === 1 ? "dish" : "dishes"} matching “${query.trim()}”.`}
        </p>
      ) : null}

      <div className="space-y-12 pb-40 pt-8 sm:space-y-20 sm:pt-12">
        {filtered.map((category) => (
          <section key={category.name} id={slugify(category.name)} className="scroll-mt-[150px]">
            <div className="flex items-baseline gap-4">
              <h2 className="font-display text-[clamp(1.6rem,4.5vw,2.75rem)] font-extrabold leading-none tracking-[-0.03em] text-white">
                {category.name}
              </h2>
              <span className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
              {category.mealUpgrade ? (
                <span className="hidden shrink-0 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-semibold text-gold-soft sm:inline">
                  Meal upgrade available
                </span>
              ) : null}
            </div>
            {category.blurb ? <p className="mt-2 text-sm text-char-400">{category.blurb}</p> : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {category.items.map((item) => (
                <ItemCard
                  key={item.name}
                  item={item}
                  category={category}
                  onCustomise={() =>
                    setSheetTarget({ item, category: category.name, mealEligible: category.mealUpgrade })
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {sheetTarget ? (
        <ItemSheet
          key={`${sheetTarget.category}/${sheetTarget.item.name}`}
          target={sheetTarget}
          onClose={() => setSheetTarget(null)}
        />
      ) : null}
    </>
  );
}

function ItemCard({
  item,
  category,
  onCustomise,
}: {
  item: MenuItem;
  category: MenuCategory;
  onCustomise: () => void;
}) {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const quickAdd = () => {
    addItem({ item, category: category.name });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1200);
  };

  if (!item.available) {
    return (
      <article aria-label={`${item.name} — sold out`} className="rounded-3xl border border-white/8 bg-char-900/60 p-3.5 opacity-55">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl grayscale">
            {item.image ? <Image src={item.image} alt="" fill sizes="80px" className="object-cover" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-bold text-white">{item.name}</h3>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-char-400">Sold out today</p>
          </div>
        </div>
      </article>
    );
  }

  return (
    /*
     * The whole card opens the sheet (extras, meal upgrade, notes) and the round
     * button is a one-tap add of the plain item. Two nested interactive elements
     * would be invalid HTML, so the card's hit area is an absolutely positioned
     * button underneath, and the add button sits above it in the stacking order.
     */
    <article className="group relative rounded-3xl border border-white/10 bg-char-900 transition-colors duration-300 focus-within:border-lime/40 hover:border-lime/35">
      <button
        type="button"
        onClick={onCustomise}
        className="absolute inset-0 z-0 rounded-3xl"
        aria-label={`${item.name}, ${formatPence(item.basePrice)} — add extras or make it a meal`}
      />

      <div className="pointer-events-none relative z-10 flex gap-3.5 p-3.5 sm:gap-4 sm:p-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl sm:h-24 sm:w-24">
          {item.image ? (
            <Image
              src={item.image}
              alt=""
              fill
              sizes="(max-width: 640px) 80px, 96px"
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="font-display text-base font-bold leading-snug tracking-[-0.01em] text-white">
            {item.name}
          </h3>

          {item.tags?.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${TAG_STYLES[tag].className}`}
                >
                  {TAG_STYLES[tag].label}
                </span>
              ))}
            </div>
          ) : null}

          {item.description ? (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-char-400 text-pretty">{item.description}</p>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-3 pt-3">
            <span className="font-display text-lg font-bold text-gold">{formatPence(item.basePrice)}</span>

            {/* Re-enable pointer events only on the control itself. */}
            <button
              type="button"
              onClick={quickAdd}
              aria-label={justAdded ? `${item.name} added` : `Add ${item.name} to basket`}
              className={`pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-200 active:scale-90 ${
                justAdded ? "bg-lime text-char-950" : "bg-white/10 text-white hover:bg-lime hover:text-char-950"
              }`}
            >
              {justAdded ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden>
                  <path d="M4 12.5 9.5 18 20 6.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" className="h-5 w-5" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}
