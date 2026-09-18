"use client";

import { useSyncExternalStore } from "react";
import { SHOP } from "./hours";

/**
 * Hooks for values that only exist in the browser (media queries, the local
 * clock).
 *
 * These use `useSyncExternalStore` rather than the `useState` + `useEffect`
 * pattern. Setting state synchronously inside an effect makes React render
 * twice on every mount, and `react-hooks/set-state-in-effect` rejects it.
 * `useSyncExternalStore` also gives an explicit server snapshot, so SSR and the
 * first client render agree and hydration stays clean.
 *
 * Every `getSnapshot` below returns a primitive that is stable between renders
 * — returning a fresh object would spin React in an infinite loop.
 */

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToMediaQuery(query: string) {
  return (onChange: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  };
}

/** True when the visitor has asked the OS to reduce animation. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToMediaQuery(REDUCED_MOTION),
    () => window.matchMedia(REDUCED_MOTION).matches,
    // On the server, assume motion is fine: the animations this gates are all
    // client-only anyway, so the honest answer arrives on the first client read.
    () => false,
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const noopSubscribe = () => () => {};

/**
 * Day of the week in the shop's timezone (0 = Sunday), or `null` on the server
 * and during hydration. Callers use `null` to mean "don't highlight a day yet".
 */
export function useShopWeekday(): number | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      const short = new Intl.DateTimeFormat("en-GB", {
        timeZone: SHOP.timeZone,
        weekday: "short",
      }).format(new Date());
      const index = WEEKDAYS.indexOf(short);
      return index < 0 ? null : index;
    },
    () => null,
  );
}
