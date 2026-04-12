import { mutationGeneric } from "convex/server";
import { v } from "convex/values";

const orderLine = v.object({
  itemName: v.string(),
  isMeal: v.boolean(),
  mealLabel: v.union(v.string(), v.null()),
  unitPrice: v.number(),
  quantity: v.number(),
  lineTotal: v.number(),
});

export const submitOrder = mutationGeneric({
  args: {
    items: v.array(orderLine),
    subtotal: v.number(),
    deliveryFee: v.number(),
    total: v.number(),
    paymentMethod: v.union(v.literal("card"), v.literal("cash")),
    givenAmount: v.union(v.number(), v.null()),
    changeAmount: v.union(v.number(), v.null()),
    totalItemCount: v.number(),
  },
  returns: v.object({
    orderNumber: v.number(),
    createdAt: v.number(),
  }),
  handler: async (ctx, args) => {
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
    await ctx.db.insert("orders", {
      orderNumber,
      createdAt,
      status: "completed",
      orderType: "takeaway",
      items: args.items,
      subtotal: args.subtotal,
      deliveryFee: args.deliveryFee,
      total: args.total,
      paymentMethod: args.paymentMethod,
      givenAmount: args.givenAmount,
      changeAmount: args.changeAmount,
      totalItemCount: args.totalItemCount,
    });

    return { orderNumber, createdAt };
  },
});
