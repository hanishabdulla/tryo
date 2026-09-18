import { anyApi } from "convex/server";

/**
 * Untyped function references, matching `lib/convex-api.ts` in the POS.
 * The website shares the POS's Convex deployment but not its `convex/_generated`
 * output, so functions are addressed by name (`api.menu.listCategories`).
 */
export const api = anyApi;

/** The site renders its bundled menu and hides ordering when this is unset. */
export const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
export const convexEnabled = CONVEX_URL.length > 0;
