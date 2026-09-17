import { mutationGeneric } from "convex/server";
import { v } from "convex/values";
import { businessDateAt } from "./businessDate";

const orderLine = v.object({
  itemName: v.string(),
  isMeal: v.boolean(),
  mealLabel: v.union(v.string(), v.null()),
  unitPrice: v.number(),
  quantity: v.number(),
  lineTotal: v.number(),
  seasoning: v.optional(v.union(v.string(), v.null())),
  sauce: v.optional(v.union(v.string(), v.null())),
  addons: v.optional(v.array(v.string())),
  hotDogOnion: v.optional(v.union(v.string(), v.null())),
  hotDogCheese: v.optional(v.boolean()),
  note: v.optional(v.string()),
});

const discountMode = v.union(
  v.literal("none"),
  v.literal("percentage"),
  v.literal("fixed"),
);

function computeDiscountPence(
  mode: "none" | "percentage" | "fixed",
  input: number,
  subtotal: number,
): number {
  if (mode === "none" || input <= 0 || subtotal <= 0) return 0;
  if (mode === "percentage") {
    const pct = Math.min(100, Math.max(0, input));
    return Math.floor((subtotal * pct) / 100);
  }
  const fixed = Math.floor(input);
  return Math.min(subtotal, Math.max(0, fixed));
}

export const submitOrder = mutationGeneric({
  args: {
    items: v.array(orderLine),
    deliveryFee: v.number(),
    paymentMethod: v.union(v.literal("card"), v.literal("cash")),
    givenAmount: v.union(v.number(), v.null()),
    totalItemCount: v.number(),
    discountMode: discountMode,
    discountInput: v.number(),
  },
  returns: v.object({
    orderNumber: v.number(),
    createdAt: v.number(),
    subtotal: v.number(),
    discountMode: discountMode,
    discountInput: v.number(),
    discountAmountPence: v.number(),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    const subtotal = args.items.reduce((acc, it) => acc + it.lineTotal, 0);
    const discountAmountPence = computeDiscountPence(
      args.discountMode,
      args.discountInput,
      subtotal,
    );
    const total =
      subtotal - discountAmountPence + Math.max(0, args.deliveryFee);

    const counted = args.items.reduce((acc, it) => acc + it.quantity, 0);
    if (counted !== args.totalItemCount) {
      throw new Error("totalItemCount does not match line items");
    }

    if (args.paymentMethod === "cash") {
      if (args.givenAmount === null) {
        throw new Error("givenAmount required for cash");
      }
      if (args.givenAmount < total) {
        throw new Error("givenAmount is less than total");
      }
    }

    const createdAt = Date.now();
    const businessDate = businessDateAt(createdAt);
    const session = await ctx.db
      .query("tillSessions")
      .withIndex("by_businessDate", (q) =>
        q.eq("businessDate", businessDate),
      )
      .unique();
    if (session?.status === "closed") {
      throw new Error("Today's till has been settled and closed");
    }
    if (!session) {
      const previousOpenSession = await ctx.db
        .query("tillSessions")
        .withIndex("by_status", (q) => q.eq("status", "open"))
        .order("desc")
        .first();
      if (previousOpenSession) {
        throw new Error(
          `Settle the open till from ${previousOpenSession.businessDate} first`,
        );
      }
      // Older app versions can keep taking orders during rollout. The current
      // UI always opens the till explicitly before submitting an order.
    }

    // Tie the invoice sequence to the till session, not to the previous global
    // counter. This guarantees that the first order after opening a new day is
    // #1, including on the day an older app version is upgraded.
    const counterScope = session ? String(session._id) : "legacy";
    const counterName = `orders:${businessDate}:${counterScope}`;
    const existing = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", counterName))
      .unique();

    let orderNumber: number;
    if (existing) {
      orderNumber = existing.value + 1;
      await ctx.db.patch(existing._id, { value: orderNumber });
    } else {
      const scopedOrders = (await ctx.db.query("orders").collect()).filter(
        (order) =>
          order.status === "completed" &&
          businessDateAt(order.createdAt) === businessDate &&
          (!session || order.createdAt >= session.openedAt),
      );
      orderNumber = scopedOrders.length + 1;
      await ctx.db.insert("counters", {
        name: counterName,
        value: orderNumber,
      });
    }

    const changeAmount =
      args.paymentMethod === "cash" && args.givenAmount !== null
        ? args.givenAmount - total
        : null;

    await ctx.db.insert("orders", {
      orderNumber,
      businessDate,
      createdAt,
      status: "completed",
      orderType: "takeaway",
      items: args.items,
      subtotal,
      discountMode: args.discountMode,
      discountInput: args.discountInput,
      discountAmountPence,
      deliveryFee: args.deliveryFee,
      total,
      paymentMethod: args.paymentMethod,
      givenAmount: args.paymentMethod === "cash" ? args.givenAmount : null,
      changeAmount,
      totalItemCount: args.totalItemCount,
    });

    return {
      orderNumber,
      createdAt,
      subtotal,
      discountMode: args.discountMode,
      discountInput: args.discountInput,
      discountAmountPence,
      total,
    };
  },
});
