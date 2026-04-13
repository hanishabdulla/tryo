import { queryGeneric } from "convex/server";
import { v } from "convex/values";

/** Orders with `createdAt` in `[startMs, endMs]` (inclusive), oldest first. */
export const listOrdersInRange = queryGeneric({
  args: { startMs: v.number(), endMs: v.number() },
  returns: v.array(v.any()),
  handler: async (ctx, { startMs, endMs }) => {
    const rows = await ctx.db.query("orders").collect();
    return rows
      .filter((o) => o.createdAt >= startMs && o.createdAt <= endMs)
      .sort(
        (a, b) =>
          a.createdAt - b.createdAt || a.orderNumber - b.orderNumber,
      );
  },
});
