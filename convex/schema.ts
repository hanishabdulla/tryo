import { defineSchema, defineTable } from "convex/server";
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
  hotDogOnion: v.optional(v.union(v.string(), v.null())),
  hotDogCheese: v.optional(v.boolean()),
});

export default defineSchema({
  menuConfig: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),

  menuCategories: defineTable({
    name: v.string(),
    sortOrder: v.number(),
    /** Offer "Make it a meal" on items in this category. */
    mealUpgrade: v.boolean(),
  }).index("by_name", ["name"]),

  menuItems: defineTable({
    category: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    basePrice: v.number(),
    available: v.boolean(),
    sortOrder: v.number(),
  }).index("by_category", ["category"]),

  counters: defineTable({
    name: v.string(),
    value: v.number(),
  }).index("by_name", ["name"]),

  // Dashboard password: PBKDF2 hash only, never the plain password.
  dashboardPassword: defineTable({
    salt: v.string(),
    hash: v.string(),
    iterations: v.number(),
  }),

  // Signed-in dashboard sessions. Only a SHA-256 of each token is stored.
  dashboardSessions: defineTable({
    tokenHash: v.string(),
    expiresAt: v.number(),
  }).index("by_tokenHash", ["tokenHash"]),

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
