import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const orderLine = v.object({
  itemName: v.string(),
  isMeal: v.boolean(),
  mealLabel: v.union(v.string(), v.null()),
  unitPrice: v.number(),
  quantity: v.number(),
  lineTotal: v.number(),
});

export default defineSchema({
  menuConfig: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),

  menuItems: defineTable({
    category: v.string(),
    name: v.string(),
    basePrice: v.number(),
    available: v.boolean(),
    sortOrder: v.number(),
  }).index("by_category", ["category"]),

  counters: defineTable({
    name: v.string(),
    value: v.number(),
  }).index("by_name", ["name"]),

  orders: defineTable({
    orderNumber: v.number(),
    createdAt: v.number(),
    status: v.string(),
    orderType: v.string(),
    items: v.array(orderLine),
    subtotal: v.number(),
    discountMode: v.optional(
      v.union(
        v.literal("none"),
        v.literal("percentage"),
        v.literal("fixed"),
      ),
    ),
    discountInput: v.optional(v.number()),
    discountAmountPence: v.optional(v.number()),
    deliveryFee: v.number(),
    total: v.number(),
    paymentMethod: v.string(),
    givenAmount: v.union(v.number(), v.null()),
    changeAmount: v.union(v.number(), v.null()),
    totalItemCount: v.number(),
  }).index("by_orderNumber", ["orderNumber"]),
});
