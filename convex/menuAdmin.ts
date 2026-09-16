import { mutationGeneric } from "convex/server";
import { v } from "convex/values";
import { requireDashboardSession } from "./dashboardAuth";

// Dashboard-only menu editing. Every mutation requires a signed-in session token,
// which the Next.js server reads from the httpOnly cookie (app/api/dashboard-menu).

function cleanName(name: string, what: string) {
  const trimmed = name.trim().replace(/\s+/g, " ").slice(0, 120);
  if (!trimmed) throw new Error(`${what} name is required`);
  return trimmed;
}

function cleanPrice(pence: number) {
  if (!Number.isInteger(pence) || pence < 0 || pence > 100_000) {
    throw new Error("Invalid price");
  }
  return pence;
}

export const saveItem = mutationGeneric({
  args: {
    token: v.string(),
    id: v.optional(v.id("menuItems")),
    category: v.string(),
    name: v.string(),
    description: v.string(),
    basePrice: v.number(),
    available: v.boolean(),
  },
  handler: async (ctx, { token, id, ...args }) => {
    await requireDashboardSession(ctx, token);
    const category = await ctx.db
      .query("menuCategories")
      .withIndex("by_name", (q) => q.eq("name", args.category))
      .first();
    if (!category) throw new Error("Choose a valid category");
    const fields = {
      category: category.name,
      name: cleanName(args.name, "Item"),
      description: args.description.trim().slice(0, 300),
      basePrice: cleanPrice(args.basePrice),
      available: args.available,
    };
    const siblings = await ctx.db
      .query("menuItems")
      .withIndex("by_category", (q) => q.eq("category", category.name))
      .collect();
    const duplicate = siblings.find(
      (i) => i._id !== id && i.name.toLowerCase() === fields.name.toLowerCase(),
    );
    if (duplicate) throw new Error(`"${fields.name}" already exists in ${category.name}`);

    const existing = id ? await ctx.db.get(id) : null;
    if (id && !existing) throw new Error("Item no longer exists");
    const movedCategory = existing && existing.category !== category.name;
    const nextSort = siblings.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 10;
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...fields,
        ...(movedCategory ? { sortOrder: nextSort } : {}),
      });
      return existing._id;
    }
    return await ctx.db.insert("menuItems", { ...fields, sortOrder: nextSort });
  },
});

export const deleteItem = mutationGeneric({
  args: { token: v.string(), id: v.id("menuItems") },
  handler: async (ctx, { token, id }) => {
    await requireDashboardSession(ctx, token);
    if (await ctx.db.get(id)) await ctx.db.delete(id);
    return null;
  },
});

/** Swap an item with its neighbour in the same category. */
export const moveItem = mutationGeneric({
  args: { token: v.string(), id: v.id("menuItems"), direction: v.union(v.literal(-1), v.literal(1)) },
  handler: async (ctx, { token, id, direction }) => {
    await requireDashboardSession(ctx, token);
    const item = await ctx.db.get(id);
    if (!item) return null;
    const siblings = (
      await ctx.db
        .query("menuItems")
        .withIndex("by_category", (q) => q.eq("category", item.category))
        .collect()
    ).sort((a, b) => a.sortOrder - b.sortOrder);
    const index = siblings.findIndex((i) => i._id === id);
    const target = siblings[index + direction];
    if (!target) return null;
    [siblings[index], siblings[index + direction]] = [target, item];
    // Renumber so equal or duplicate sort values cannot block reordering.
    for (const [i, row] of siblings.entries()) {
      if (row.sortOrder !== (i + 1) * 10) await ctx.db.patch(row._id, { sortOrder: (i + 1) * 10 });
    }
    return null;
  },
});

export const saveCategory = mutationGeneric({
  args: {
    token: v.string(),
    id: v.optional(v.id("menuCategories")),
    name: v.string(),
    mealUpgrade: v.boolean(),
  },
  handler: async (ctx, { token, id, mealUpgrade, ...args }) => {
    await requireDashboardSession(ctx, token);
    const name = cleanName(args.name, "Category");
    const all = await ctx.db.query("menuCategories").collect();
    if (all.some((c) => c._id !== id && c.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Category "${name}" already exists`);
    }
    if (!id) {
      const sortOrder = all.reduce((m, c) => Math.max(m, c.sortOrder), 0) + 10;
      return await ctx.db.insert("menuCategories", { name, mealUpgrade, sortOrder });
    }
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Category no longer exists");
    if (existing.name !== name) {
      const items = await ctx.db
        .query("menuItems")
        .withIndex("by_category", (q) => q.eq("category", existing.name))
        .collect();
      for (const item of items) await ctx.db.patch(item._id, { category: name });
    }
    await ctx.db.patch(id, { name, mealUpgrade });
    return id;
  },
});

export const deleteCategory = mutationGeneric({
  args: { token: v.string(), id: v.id("menuCategories") },
  handler: async (ctx, { token, id }) => {
    await requireDashboardSession(ctx, token);
    const category = await ctx.db.get(id);
    if (!category) return null;
    const item = await ctx.db
      .query("menuItems")
      .withIndex("by_category", (q) => q.eq("category", category.name))
      .first();
    if (item) throw new Error("Move or delete the items in this category first");
    await ctx.db.delete(id);
    return null;
  },
});

export const moveCategory = mutationGeneric({
  args: { token: v.string(), id: v.id("menuCategories"), direction: v.union(v.literal(-1), v.literal(1)) },
  handler: async (ctx, { token, id, direction }) => {
    await requireDashboardSession(ctx, token);
    const all = (await ctx.db.query("menuCategories").collect()).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const index = all.findIndex((c) => c._id === id);
    const target = all[index + direction];
    if (index === -1 || !target) return null;
    [all[index], all[index + direction]] = [target, all[index]];
    for (const [i, row] of all.entries()) {
      if (row.sortOrder !== (i + 1) * 10) await ctx.db.patch(row._id, { sortOrder: (i + 1) * 10 });
    }
    return null;
  },
});

export const saveMealSettings = mutationGeneric({
  args: { token: v.string(), price: v.number(), label: v.string() },
  handler: async (ctx, { token, price, label }) => {
    await requireDashboardSession(ctx, token);
    const values = {
      mealUpcharge: cleanPrice(price),
      mealComboLabel: cleanName(label, "Meal"),
    };
    for (const [key, value] of Object.entries(values)) {
      const row = await ctx.db
        .query("menuConfig")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (row) await ctx.db.patch(row._id, { value });
      else await ctx.db.insert("menuConfig", { key, value });
    }
    return null;
  },
});
