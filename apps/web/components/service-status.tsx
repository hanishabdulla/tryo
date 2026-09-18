"use client";

import { useEffect, useState } from "react";
import { shopStatus, type ShopStatus } from "@/lib/hours";

/**
 * Live trading status, set as type rather than as a bordered pill: a lead word
 * in the state colour, a hairline, then the qualifier in muted text. Nothing
 * here is chrome, so it sits inside the header and the hero without competing
 * with the logo or the headline.
 *
 * Renders nothing on the server. The answer depends on the current minute, so
 * server HTML would either hydrate into a mismatch or be cached at the wrong
 * time of day; it appears on mount and re-checks every 30s.
 */
export function ServiceStatus({
  size = "sm",
  className = "",
}: {
  /** `sm` for the header and hero, `lg` for the Visit panel. */
  size?: "sm" | "lg";
  className?: string;
}) {
  const [status, setStatus] = useState<ShopStatus | null>(null);

  useEffect(() => {
    const update = () => setStatus(shopStatus());
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const large = size === "lg";

  if (!status) {
    // Hold the line's height so the header doesn't shift when it resolves.
    return <span aria-hidden className={`block ${large ? "h-6" : "h-4"} ${className}`} />;
  }

  const accent = status.open ? (status.closingSoon ? "text-gold" : "text-lime") : "text-char-400";

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap ${large ? "gap-3" : "gap-2.5"} ${className}`}
      // One readable sentence for assistive tech, instead of two loose fragments.
      aria-label={`${status.headline} — ${status.detail}`}
    >
      <span
        aria-hidden
        className={`font-semibold uppercase ${accent} ${
          large ? "text-sm tracking-[0.2em]" : "text-[11px] tracking-[0.18em]"
        }`}
      >
        {status.headline}
      </span>
      <span aria-hidden className={`w-px bg-white/20 ${large ? "h-4" : "h-3"}`} />
      <span
        aria-hidden
        className={`uppercase text-char-400 ${
          large ? "text-sm tracking-[0.14em]" : "text-[11px] tracking-[0.12em]"
        }`}
      >
        {status.detail}
      </span>
    </span>
  );
}
