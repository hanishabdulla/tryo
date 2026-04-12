import { mutationGeneric } from "convex/server";
import { v } from "convex/values";

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

    const existing = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", "orders"))
      .unique();

    let orderNumber: number;
    if (existing) {
      orderNumber = existing.value + 1;
      await ctx.db.patch(existing._id, { value: orderNumber });
    } else {
      orderNumber = 1;
      await ctx.db.insert("counters", { name: "orders", value: orderNumber });
    }

    const createdAt = Date.now();
    const changeAmount =
      args.paymentMethod === "cash" && args.givenAmount !== null
        ? args.givenAmount - total
        : null;

    await ctx.db.insert("orders", {
      orderNumber,
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
