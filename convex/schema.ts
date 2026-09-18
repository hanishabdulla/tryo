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
  /** Custom instructions typed on the till. */
  note: v.optional(v.string()),
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
    /** Paid extras offered in the till popup, e.g. Cheese +125p. */
    options: v.optional(v.array(v.object({ name: v.string(), price: v.number() }))),
    basePrice: v.number(),
    available: v.boolean(),
    sortOrder: v.number(),
  }).index("by_category", ["category"]),

  counters: defineTable({
    name: v.string(),
    value: v.number(),
  }).index("by_name", ["name"]),

  tillSessions: defineTable({
    businessDate: v.string(),
    status: v.union(v.literal("open"), v.literal("closed")),
    openedAt: v.number(),
    openingFloatPence: v.number(),
    closedAt: v.optional(v.number()),
    countedCashPence: v.optional(v.number()),
    expectedCashPence: v.optional(v.number()),
    variancePence: v.optional(v.number()),
    closingNote: v.optional(v.string()),
  })
    .index("by_businessDate", ["businessDate"])
    .index("by_status", ["status", "openedAt"]),

  tillMovements: defineTable({
    sessionId: v.id("tillSessions"),
    businessDate: v.string(),
    createdAt: v.number(),
    type: v.union(v.literal("cash_in"), v.literal("cash_out")),
    amountPence: v.number(),
    reason: v.string(),
  })
    .index("by_session", ["sessionId", "createdAt"])
    .index("by_businessDate", ["businessDate", "createdAt"]),

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
    businessDate: v.optional(v.string()),
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

    // --- Online orders (tryoeats.uk) ---------------------------------------
    // Every field below is optional so that orders rung up on the till, which
    // never set them, still validate against this schema.

    /** "till" for counter orders, "web" for ones placed on the website. */
    source: v.optional(v.string()),
    /** "collection" | "delivery". Only set on web orders. */
    fulfilment: v.optional(v.string()),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerAddress: v.optional(v.union(v.string(), v.null())),
    customerNote: v.optional(v.union(v.string(), v.null())),
    /** When the kitchen last moved this order along, for the POS queue. */
    statusUpdatedAt: v.optional(v.number()),
  })
    .index("by_orderNumber", ["orderNumber"])
    .index("by_businessDate", ["businessDate"])
    // Lets the till subscribe to just the live web queue.
    .index("by_source_status", ["source", "status", "createdAt"]),
});
