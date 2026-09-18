import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { businessDateAt } from "./businessDate";

/**
 * Online orders placed on tryoeats.uk.
 *
 * These are deliberately NOT routed through `orders:submitOrder`. That mutation
 * is the till's: it requires a cash/card tender, records the order as already
 * `completed`, and consumes the till session's invoice counter. A web order is
 * none of those things — it is unpaid, it arrives before anyone has touched it,
 * and it may land before the till has even been opened for the day.
 *
 * The prices in `args.items` are treated as untrusted. Every line is repriced
 * against `menuItems` here, and the client's figure is only used to detect a
 * mismatch. Nothing a browser sends can change what an order costs.
 */

const orderLine = v.object({
  itemName: v.string(),
  isMeal: v.boolean(),
  mealLabel: v.union(v.string(), v.null()),
  unitPrice: v.number(),
  quantity: v.number(),
  lineTotal: v.number(),
  addons: v.optional(v.array(v.string())),
  note: v.optional(v.string()),
});

/** Web order numbers start here so they never collide with the till's 1..n run. */
const WEB_ORDER_NUMBER_BASE = 500;

/**
 * Category whose items are per-dish add-ons rather than a section customers
 * browse. Its items are accepted as `addons` on any food line, priced from the
 * menu like any other item.
 */
const EXTRAS_CATEGORY = "Extras";

/** Categories that are drinks, so the food-only extras are not offered on them. */
const DRINK_CATEGORIES = new Set(["Drinks", "Mocktails", "Lemonade"]);

const MAX_LINES = 40;
const MAX_QUANTITY_PER_LINE = 20;

export const placeOnlineOrder = mutation({
  args: {
    items: v.array(orderLine),
    totalItemCount: v.number(),
    customerName: v.string(),
    customerPhone: v.string(),
    customerNote: v.union(v.string(), v.null()),
  },
  returns: v.object({
    orderNumber: v.number(),
    createdAt: v.number(),
    subtotal: v.number(),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.items.length === 0) throw new Error("Your basket is empty");
    if (args.items.length > MAX_LINES) throw new Error("That's too many separate items — please call us instead");

    const name = args.customerName.trim();
    const phone = args.customerPhone.trim();
    if (name.length < 2) throw new Error("Please give us a name for the order");
    if (phone.replace(/\D/g, "").length < 10) throw new Error("Please give us a valid mobile number");

    // --- Reprice every line from the live menu --------------------------------
    const menuItems = await ctx.db.query("menuItems").collect();
    const itemsByName = new Map(menuItems.map((row) => [row.name, row]));

    // Extras are add-ons, priced from their own menu rows.
    const extrasByName = new Map(
      menuItems.filter((row) => row.category === EXTRAS_CATEGORY && row.available).map((row) => [row.name, row.basePrice]),
    );

    const categories = await ctx.db.query("menuCategories").collect();
    const mealUpgradeByCategory = new Map(categories.map((row) => [row.name, row.mealUpgrade]));

    const configRow = await ctx.db
      .query("menuConfig")
      .withIndex("by_key", (q) => q.eq("key", "mealUpcharge"))
      .unique();
    const mealUpcharge = typeof configRow?.value === "number" ? configRow.value : 299;

    const labelRow = await ctx.db
      .query("menuConfig")
      .withIndex("by_key", (q) => q.eq("key", "mealComboLabel"))
      .unique();
    const mealComboLabel = typeof labelRow?.value === "string" ? labelRow.value : "Fries + Drink";

    let subtotal = 0;
    let countedItems = 0;

    const pricedLines = args.items.map((line) => {
      const menuItem = itemsByName.get(line.itemName);
      if (!menuItem) throw new Error(`"${line.itemName}" is no longer on the menu`);
      if (!menuItem.available) throw new Error(`"${line.itemName}" has sold out today`);

      const quantity = Math.floor(line.quantity);
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_LINE) {
        throw new Error(`Invalid quantity for "${line.itemName}"`);
      }

      // Meal upgrades are only offered on categories flagged for them.
      if (line.isMeal && !mealUpgradeByCategory.get(menuItem.category)) {
        throw new Error(`"${line.itemName}" can't be made into a meal`);
      }

      // Addons are either an option declared on the item itself, or an item from
      // the Extras category. Either way the price comes from the menu, never the
      // browser. Extras are food-only, matching what the site offers.
      const offered = new Map((menuItem.options ?? []).map((o) => [o.name, o.price]));
      const extrasAllowed = !DRINK_CATEGORIES.has(menuItem.category) && menuItem.category !== EXTRAS_CATEGORY;
      const addons = line.addons ?? [];
      let addonTotal = 0;
      for (const addon of addons) {
        const price = offered.get(addon) ?? (extrasAllowed ? extrasByName.get(addon) : undefined);
        if (price === undefined) throw new Error(`"${addon}" isn't available on ${line.itemName}`);
        addonTotal += price;
      }

      const unitPrice = menuItem.basePrice + (line.isMeal ? mealUpcharge : 0) + addonTotal;
      if (unitPrice !== line.unitPrice) {
        // Almost always a stale basket after a dashboard price change.
        throw new Error("Our prices have just changed — please refresh and check your basket");
      }

      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;
      countedItems += quantity;

      return {
        itemName: menuItem.name,
        isMeal: line.isMeal,
        mealLabel: line.isMeal ? mealComboLabel : null,
        unitPrice,
        quantity,
        lineTotal,
        ...(addons.length ? { addons } : {}),
        ...(line.note ? { note: line.note.slice(0, 200) } : {}),
      };
    });

    if (countedItems !== args.totalItemCount) {
      throw new Error("Your basket changed while ordering — please try again");
    }

    // --- Totals, computed here rather than trusted --------------------------
    // Collection only: no delivery fee, so the total is the subtotal.
    const total = subtotal;

    const createdAt = Date.now();
    const businessDate = businessDateAt(createdAt);

    // Web orders keep their own counter, so they neither consume nor depend on
    // the till session's invoice run.
    const counterName = `online:${businessDate}`;
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", counterName))
      .unique();

    let sequence: number;
    if (counter) {
      sequence = counter.value + 1;
      await ctx.db.patch(counter._id, { value: sequence });
    } else {
      sequence = 1;
      await ctx.db.insert("counters", { name: counterName, value: sequence });
    }
    const orderNumber = WEB_ORDER_NUMBER_BASE + sequence;

    await ctx.db.insert("orders", {
      orderNumber,
      businessDate,
      createdAt,
      status: "pending",
      orderType: "collection",
      items: pricedLines,
      subtotal,
      discountMode: "none",
      discountInput: 0,
      discountAmountPence: 0,
      deliveryFee: 0,
      total,
      // Unpaid until the customer hands over cash or card in person. Leaving this
      // out of the cash/card tenders keeps the till's expected-cash maths correct.
      paymentMethod: "unpaid",
      givenAmount: null,
      changeAmount: null,
      totalItemCount: countedItems,

      source: "web",
      fulfilment: "collection",
      customerName: name.slice(0, 80),
      customerPhone: phone.slice(0, 32),
      customerAddress: null,
      customerNote: args.customerNote?.trim().slice(0, 300) || null,
      statusUpdatedAt: createdAt,
    });

    return { orderNumber, createdAt, subtotal, total };
  },
});

/** Live queue of web orders the kitchen hasn't finished, newest last. */
export const listLiveOnlineOrders = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const open = [];
    for (const status of ["pending", "accepted", "ready"]) {
      const rows = await ctx.db
        .query("orders")
        .withIndex("by_source_status", (q) => q.eq("source", "web").eq("status", status))
        .collect();
      open.push(...rows);
    }
    return open.sort((a, b) => a.createdAt - b.createdAt);
  },
});

/** Status lookup for the customer's confirmation screen. */
export const getOnlineOrder = query({
  args: { orderNumber: v.number() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", args.orderNumber))
      .order("desc")
      .first();
    if (!order || order.source !== "web") return null;
    // Only what the confirmation screen needs — no customer PII echoed back.
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
      fulfilment: order.fulfilment,
      createdAt: order.createdAt,
      totalItemCount: order.totalItemCount,
    };
  },
});

/** Moves a web order along from the till. */
export const setOnlineOrderStatus = mutation({
  args: {
    orderNumber: v.number(),
    status: v.union(
      v.literal("accepted"),
      v.literal("ready"),
      v.literal("completed"),
      v.literal("rejected"),
    ),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", args.orderNumber))
      .order("desc")
      .first();
    if (!order || order.source !== "web") throw new Error("Unknown online order");
    await ctx.db.patch(order._id, { status: args.status, statusUpdatedAt: Date.now() });
    return { ok: true };
  },
});
