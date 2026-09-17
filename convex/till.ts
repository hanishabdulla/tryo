import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { businessDateAt } from "./businessDate";

function assertPence(value: number, label: string, allowZero = true) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    (!allowZero && value === 0)
  ) {
    throw new Error(`${label} must be a valid positive money amount`);
  }
}

export const getDay = queryGeneric({
  args: { businessDate: v.string() },
  returns: v.any(),
  handler: async (ctx, { businessDate }) => {
    const session = await ctx.db
      .query("tillSessions")
      .withIndex("by_businessDate", (q) => q.eq("businessDate", businessDate))
      .unique();
    if (!session) return null;

    const [orders, movements] = await Promise.all([
      ctx.db
        .query("orders")
        .withIndex("by_businessDate", (q) =>
          q.eq("businessDate", businessDate),
        )
        .collect(),
      ctx.db
        .query("tillMovements")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect(),
    ]);
    const completed = orders.filter(
      (order) =>
        order.status === "completed" &&
        order.createdAt >= session.openedAt &&
        (session.closedAt === undefined || order.createdAt <= session.closedAt),
    );
    const cashOrders = completed.filter(
      (order) => order.paymentMethod === "cash",
    );
    const cashSalesPence = cashOrders.reduce(
      (sum, order) => sum + order.total,
      0,
    );
    const cashReceivedPence = cashOrders.reduce(
      (sum, order) => sum + (order.givenAmount ?? order.total),
      0,
    );
    const changeGivenPence = cashOrders.reduce(
      (sum, order) => sum + (order.changeAmount ?? 0),
      0,
    );
    const cardSalesPence = completed
      .filter((order) => order.paymentMethod === "card")
      .reduce((sum, order) => sum + order.total, 0);
    const cashInPence = movements
      .filter((movement) => movement.type === "cash_in")
      .reduce((sum, movement) => sum + movement.amountPence, 0);
    const cashOutPence = movements
      .filter((movement) => movement.type === "cash_out")
      .reduce((sum, movement) => sum + movement.amountPence, 0);
    const expectedCashPence =
      session.openingFloatPence +
      cashReceivedPence -
      changeGivenPence +
      cashInPence -
      cashOutPence;

    return {
      ...session,
      totals: {
        orderCount: completed.length,
        grossSalesPence: cashSalesPence + cardSalesPence,
        cashSalesPence,
        cashReceivedPence,
        changeGivenPence,
        cardSalesPence,
        cashInPence,
        cashOutPence,
        expectedCashPence,
      },
      movements,
    };
  },
});

export const findOpenSession = queryGeneric({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ businessDate: v.string(), openedAt: v.number() }),
  ),
  handler: async (ctx) => {
    const latest = await ctx.db
      .query("tillSessions")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .first();
    return latest
      ? { businessDate: latest.businessDate, openedAt: latest.openedAt }
      : null;
  },
});

export const openDay = mutationGeneric({
  args: { openingFloatPence: v.number() },
  returns: v.id("tillSessions"),
  handler: async (ctx, { openingFloatPence }) => {
    assertPence(openingFloatPence, "Opening float");
    const now = Date.now();
    const businessDate = businessDateAt(now);
    const existing = await ctx.db
      .query("tillSessions")
      .withIndex("by_businessDate", (q) => q.eq("businessDate", businessDate))
      .unique();
    if (existing) {
      if (existing.status === "closed") {
        throw new Error("Today's till has already been settled");
      }
      return existing._id;
    }
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
    return ctx.db.insert("tillSessions", {
      businessDate,
      status: "open",
      openedAt: now,
      openingFloatPence,
    });
  },
});

export const recordMovement = mutationGeneric({
  args: {
    businessDate: v.string(),
    type: v.union(v.literal("cash_in"), v.literal("cash_out")),
    amountPence: v.number(),
    reason: v.string(),
  },
  returns: v.id("tillMovements"),
  handler: async (ctx, args) => {
    assertPence(args.amountPence, "Cash movement", false);
    const reason = args.reason.trim().replace(/\s+/g, " ").slice(0, 120);
    if (!reason) throw new Error("Enter a reason for the cash movement");
    const now = Date.now();
    const session = await ctx.db
      .query("tillSessions")
      .withIndex("by_businessDate", (q) =>
        q.eq("businessDate", args.businessDate),
      )
      .unique();
    if (!session || session.status !== "open") {
      throw new Error("Open today's till before recording cash movements");
    }
    return ctx.db.insert("tillMovements", {
      sessionId: session._id,
      businessDate: args.businessDate,
      createdAt: now,
      type: args.type,
      amountPence: args.amountPence,
      reason,
    });
  },
});

export const closeDay = mutationGeneric({
  args: {
    businessDate: v.string(),
    countedCashPence: v.number(),
    closingNote: v.string(),
  },
  returns: v.object({
    expectedCashPence: v.number(),
    countedCashPence: v.number(),
    variancePence: v.number(),
  }),
  handler: async (ctx, { businessDate, countedCashPence, closingNote }) => {
    assertPence(countedCashPence, "Counted cash");
    const now = Date.now();
    const session = await ctx.db
      .query("tillSessions")
      .withIndex("by_businessDate", (q) => q.eq("businessDate", businessDate))
      .unique();
    if (!session || session.status !== "open") {
      throw new Error("The selected till day is not open");
    }
    const [orders, movements] = await Promise.all([
      ctx.db
        .query("orders")
        .withIndex("by_businessDate", (q) =>
          q.eq("businessDate", businessDate),
        )
        .collect(),
      ctx.db
        .query("tillMovements")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect(),
    ]);
    const cashOrders = orders.filter(
      (order) =>
        order.status === "completed" &&
        order.paymentMethod === "cash" &&
        order.createdAt >= session.openedAt,
    );
    const cashReceivedPence = cashOrders.reduce(
      (sum, order) => sum + (order.givenAmount ?? order.total),
      0,
    );
    const changeGivenPence = cashOrders.reduce(
      (sum, order) => sum + (order.changeAmount ?? 0),
      0,
    );
    const cashInPence = movements
      .filter((movement) => movement.type === "cash_in")
      .reduce((sum, movement) => sum + movement.amountPence, 0);
    const cashOutPence = movements
      .filter((movement) => movement.type === "cash_out")
      .reduce((sum, movement) => sum + movement.amountPence, 0);
    const expectedCashPence =
      session.openingFloatPence +
      cashReceivedPence -
      changeGivenPence +
      cashInPence -
      cashOutPence;
    const variancePence = countedCashPence - expectedCashPence;
    const note = closingNote.trim().replace(/\s+/g, " ").slice(0, 240);
    await ctx.db.patch(session._id, {
      status: "closed",
      closedAt: now,
      countedCashPence,
      expectedCashPence,
      variancePence,
      ...(note ? { closingNote: note } : {}),
    });
    return { expectedCashPence, countedCashPence, variancePence };
  },
});
