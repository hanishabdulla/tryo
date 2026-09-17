/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as businessDate from "../businessDate.js";
import type * as dashboardAuth from "../dashboardAuth.js";
import type * as menu from "../menu.js";
import type * as menuAdmin from "../menuAdmin.js";
import type * as orders from "../orders.js";
import type * as reports from "../reports.js";
import type * as seed from "../seed.js";
import type * as till from "../till.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  businessDate: typeof businessDate;
  dashboardAuth: typeof dashboardAuth;
  menu: typeof menu;
  menuAdmin: typeof menuAdmin;
  orders: typeof orders;
  reports: typeof reports;
  seed: typeof seed;
  till: typeof till;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
