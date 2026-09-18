"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { ServiceStatus } from "./service-status";

const NAV = [
  { href: "/#signatures", label: "Signatures" },
  { href: "/menu", label: "Menu" },
  { href: "/#visit", label: "Visit" },
];

export function SiteHeader() {
  const { count, openCart, bumpToken } = useCart();
  const [scrolled, setScrolled] = useState(false);

  // Solid backdrop only once the hero is behind us, so the logo sits on flames at rest.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        scrolled ? "border-b border-white/10 bg-char-950/85 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="shrink-0" aria-label="Tryo — home">
          <Image
            src="/brand/tryo-wordmark-light.png"
            alt="Tryo"
            width={1034}
            height={512}
            preload
            className="h-9 w-auto sm:h-10"
          />
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-char-200 transition-colors hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {/* Wrapped rather than styled directly: ServiceStatus sets its own
              `inline-flex`, and two display utilities of equal specificity resolve
              by stylesheet order, not class order. */}
          <span className="hidden sm:block">
            <ServiceStatus />
          </span>

          <button
            type="button"
            onClick={openCart}
            className="group relative inline-flex h-11 items-center gap-2.5 rounded-full bg-lime pl-4 pr-5 text-sm font-semibold text-char-950 transition-transform duration-200 hover:scale-[1.03] active:scale-95"
          >
            <BasketIcon className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">Basket</span>
            {/* Re-keying on bumpToken remounts the span, which restarts the pop
                animation — cheaper than a timer and a second render. */}
            <span
              key={bumpToken}
              className="inline-flex h-6 min-w-6 animate-bump items-center justify-center rounded-full bg-char-950 px-1.5 text-xs font-bold text-lime"
            >
              {count}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

function BasketIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 7h18l-1.6 11.2A2 2 0 0 1 17.4 20H6.6a2 2 0 0 1-2-1.8L3 7Z" />
      <path d="M8.5 7 12 2.8 15.5 7" />
    </svg>
  );
}
