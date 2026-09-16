"use client";

import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/lib/convex-api";
import { formatPence, parsePenceFromInput } from "@/lib/money";

type Category = {
  _id: string;
  name: string;
  mealUpgrade: boolean;
};

type Item = {
  _id: string;
  category: string;
  name: string;
  description?: string;
  basePrice: number;
  available: boolean;
  options?: { name: string; price: number }[];
};

type ItemDraft = {
  id?: string;
  category: string;
  name: string;
  description: string;
  price: string;
  available: boolean;
  options: { name: string; price: string }[];
};

type CategoryDraft = { id?: string; name: string; mealUpgrade: boolean };

async function menuAction(action: string, args: Record<string, unknown>) {
  const response = await fetch("/api/dashboard-menu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, args }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Could not save");
  }
}

const inputClass =
  "mt-2 h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-[#00955e]/70";
const smallButton =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs font-semibold text-zinc-200 hover:border-[#00955e]/40 hover:text-white disabled:opacity-40";

export default function MenuPage() {
  const categories = useQuery(api.menu.listCategories, {}) as
    | Category[]
    | undefined;
  const items = useQuery(api.menu.listAllItems, {}) as Item[] | undefined;
  const config = useQuery(api.menu.getMenuConfig, {});

  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mealPrice, setMealPrice] = useState("");
  const [mealLabel, setMealLabel] = useState("");
  const [mealSaved, setMealSaved] = useState(false);

  useEffect(() => {
    if (!config) return;
    if (typeof config.mealUpcharge === "number") {
      setMealPrice((config.mealUpcharge / 100).toFixed(2));
    }
    if (typeof config.mealComboLabel === "string") {
      setMealLabel(config.mealComboLabel);
    }
  }, [config]);

  async function run(action: string, args: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await menuAction(action, args);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveItem() {
    if (!itemDraft) return;
    const price = parsePenceFromInput(itemDraft.price);
    if (price === null) {
      setError("Enter a price in pounds, for example 6.99");
      return;
    }
    const options = [];
    for (const option of itemDraft.options) {
      if (!option.name.trim() && !option.price.trim()) continue;
      const optionPrice = parsePenceFromInput(option.price);
      if (!option.name.trim() || optionPrice === null) {
        setError("Each extra needs a name and a price, for example Cheese 1.25");
        return;
      }
      options.push({ name: option.name, price: optionPrice });
    }
    const ok = await run("saveItem", {
      ...(itemDraft.id ? { id: itemDraft.id } : {}),
      category: itemDraft.category,
      name: itemDraft.name,
      description: itemDraft.description,
      basePrice: price,
      available: itemDraft.available,
      options,
    });
    if (ok) setItemDraft(null);
  }

  async function saveCategory() {
    if (!categoryDraft) return;
    const ok = await run("saveCategory", {
      ...(categoryDraft.id ? { id: categoryDraft.id } : {}),
      name: categoryDraft.name,
      mealUpgrade: categoryDraft.mealUpgrade,
    });
    if (ok) setCategoryDraft(null);
  }

  async function saveMeal() {
    const price = parsePenceFromInput(mealPrice);
    if (price === null) {
      setError("Enter the meal upgrade price in pounds, for example 2.99");
      return;
    }
    setMealSaved(false);
    if (await run("saveMealSettings", { price, label: mealLabel })) {
      setMealSaved(true);
    }
  }

  function toggleAvailable(item: Item) {
    void run("saveItem", {
      id: item._id,
      category: item.category,
      name: item.name,
      description: item.description ?? "",
      basePrice: item.basePrice,
      available: !item.available,
    });
  }

  if (categories === undefined || items === undefined) {
    return <p className="text-sm text-zinc-500">Loading menu…</p>;
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Menu</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Changes appear on the till and printed menu straight away.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setCategoryDraft({ name: "", mealUpgrade: false });
            }}
            className="min-h-11 rounded-xl border border-zinc-600 bg-zinc-800 px-4 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            Add category
          </button>
          <button
            type="button"
            disabled={categories.length === 0}
            onClick={() => {
              setError(null);
              setItemDraft({
                category: categories[0]?.name ?? "",
                name: "",
                description: "",
                price: "",
                available: true,
                options: [],
              });
            }}
            className="min-h-11 rounded-xl bg-[#00955e] px-4 text-sm font-bold text-white shadow-[var(--tryo-glow)] hover:bg-[#007a4c] disabled:opacity-40"
          >
            Add item
          </button>
        </div>
      </div>

      {error && !itemDraft && !categoryDraft ? (
        <p role="alert" className="mb-4 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
          Make it a meal
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Offered on items in categories marked “Meal upgrade”.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-zinc-400">
            Upgrade price (£)
            <input
              inputMode="decimal"
              value={mealPrice}
              onChange={(e) => {
                setMealPrice(e.target.value);
                setMealSaved(false);
              }}
              className={`${inputClass} w-32`}
            />
          </label>
          <label className="text-xs font-medium text-zinc-400">
            Meal includes
            <input
              value={mealLabel}
              onChange={(e) => {
                setMealLabel(e.target.value);
                setMealSaved(false);
              }}
              className={`${inputClass} w-56`}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveMeal()}
            className="min-h-12 rounded-xl border border-zinc-600 bg-zinc-800 px-4 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40"
          >
            {mealSaved ? "Saved" : "Save"}
          </button>
        </div>
      </section>

      {categories.length === 0 ? (
        <p className="text-sm text-zinc-500">No categories yet. Add one to start.</p>
      ) : null}

      <div className="space-y-6">
        {categories.map((category, categoryIndex) => {
          const rows = items.filter((i) => i.category === category.name);
          return (
            <section
              key={category._id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/50"
            >
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-white">{category.name}</h2>
                  <span className="text-xs text-zinc-500">
                    {rows.length} item{rows.length === 1 ? "" : "s"}
                  </span>
                  {category.mealUpgrade ? (
                    <span className="rounded-full border border-[#00955e]/40 bg-[#00955e]/10 px-2 py-0.5 text-xs font-semibold text-[#49d69d]">
                      Meal upgrade
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={smallButton}
                    disabled={busy || categoryIndex === 0}
                    onClick={() => void run("moveCategory", { id: category._id, direction: -1 })}
                    aria-label={`Move ${category.name} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={smallButton}
                    disabled={busy || categoryIndex === categories.length - 1}
                    onClick={() => void run("moveCategory", { id: category._id, direction: 1 })}
                    aria-label={`Move ${category.name} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={smallButton}
                    onClick={() => {
                      setError(null);
                      setCategoryDraft({
                        id: category._id,
                        name: category.name,
                        mealUpgrade: category.mealUpgrade,
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={smallButton}
                    disabled={busy}
                    onClick={() => {
                      if (rows.length > 0) {
                        setError(`Move or delete the items in ${category.name} first.`);
                        return;
                      }
                      if (window.confirm(`Delete the ${category.name} category?`)) {
                        void run("deleteCategory", { id: category._id });
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </header>
              {rows.length === 0 ? (
                <p className="p-4 text-sm text-zinc-500">No items.</p>
              ) : (
                <ul className="divide-y divide-zinc-800">
                  {rows.map((item, index) => (
                    <li
                      key={item._id}
                      className="flex flex-wrap items-center justify-between gap-3 p-4"
                    >
                      <div className={`min-w-0 flex-1 ${item.available ? "" : "opacity-50"}`}>
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-semibold text-white">{item.name}</span>
                          <span className="font-semibold text-[#00955e]">
                            {formatPence(item.basePrice)}
                          </span>
                          {!item.available ? (
                            <span className="text-xs font-semibold uppercase text-amber-400">
                              Hidden from till
                            </span>
                          ) : null}
                        </div>
                        {item.description ? (
                          <p className="mt-1 text-sm text-zinc-500">{item.description}</p>
                        ) : null}
                        {item.options?.length ? (
                          <p className="mt-1 text-xs text-zinc-400">
                            Extras:{" "}
                            {item.options
                              .map((o) => `${o.name} +${formatPence(o.price)}`)
                              .join(", ")}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={smallButton}
                          disabled={busy || index === 0}
                          onClick={() => void run("moveItem", { id: item._id, direction: -1 })}
                          aria-label={`Move ${item.name} up`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={smallButton}
                          disabled={busy || index === rows.length - 1}
                          onClick={() => void run("moveItem", { id: item._id, direction: 1 })}
                          aria-label={`Move ${item.name} down`}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className={smallButton}
                          disabled={busy}
                          onClick={() => toggleAvailable(item)}
                        >
                          {item.available ? "Hide" : "Show"}
                        </button>
                        <button
                          type="button"
                          className={smallButton}
                          onClick={() => {
                            setError(null);
                            setItemDraft({
                              id: item._id,
                              category: item.category,
                              name: item.name,
                              description: item.description ?? "",
                              price: (item.basePrice / 100).toFixed(2),
                              available: item.available,
                              options: (item.options ?? []).map((o) => ({
                                name: o.name,
                                price: (o.price / 100).toFixed(2),
                              })),
                            });
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {itemDraft ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="item-editor-title"
        >
          <form
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
            onSubmit={(e) => {
              e.preventDefault();
              void saveItem();
            }}
          >
            <h2 id="item-editor-title" className="text-xl font-bold text-white">
              {itemDraft.id ? "Edit item" : "Add item"}
            </h2>
            <label className="mt-4 block text-sm font-medium text-zinc-300">
              Category
              <select
                value={itemDraft.category}
                onChange={(e) => setItemDraft({ ...itemDraft, category: e.target.value })}
                className={inputClass}
              >
                {categories.map((c) => (
                  <option key={c._id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium text-zinc-300">
              Name
              <input
                value={itemDraft.name}
                maxLength={120}
                onChange={(e) => setItemDraft({ ...itemDraft, name: e.target.value })}
                className={inputClass}
                autoFocus
              />
            </label>
            <label className="mt-4 block text-sm font-medium text-zinc-300">
              Description <span className="text-zinc-500">(optional)</span>
              <textarea
                value={itemDraft.description}
                maxLength={300}
                rows={3}
                onChange={(e) => setItemDraft({ ...itemDraft, description: e.target.value })}
                className={`${inputClass} h-auto py-2`}
              />
            </label>
            <label className="mt-4 block text-sm font-medium text-zinc-300">
              Price (£)
              <input
                inputMode="decimal"
                value={itemDraft.price}
                onChange={(e) => setItemDraft({ ...itemDraft, price: e.target.value })}
                className={inputClass}
                placeholder="6.99"
              />
            </label>
            <fieldset className="mt-4">
              <legend className="text-sm font-medium text-zinc-300">
                Extras <span className="text-zinc-500">(optional, shown as add-ons on the till)</span>
              </legend>
              {itemDraft.options.map((option, index) => (
                <div key={index} className="mt-2 flex gap-2">
                  <input
                    aria-label="Extra name"
                    value={option.name}
                    maxLength={120}
                    placeholder="Cheese"
                    onChange={(e) => {
                      const options = [...itemDraft.options];
                      options[index] = { ...option, name: e.target.value };
                      setItemDraft({ ...itemDraft, options });
                    }}
                    className={`${inputClass} mt-0 flex-1`}
                  />
                  <input
                    aria-label="Extra price in pounds"
                    inputMode="decimal"
                    value={option.price}
                    placeholder="1.25"
                    onChange={(e) => {
                      const options = [...itemDraft.options];
                      options[index] = { ...option, price: e.target.value };
                      setItemDraft({ ...itemDraft, options });
                    }}
                    className={`${inputClass} mt-0 w-24`}
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${option.name || "extra"}`}
                    onClick={() =>
                      setItemDraft({
                        ...itemDraft,
                        options: itemDraft.options.filter((_, i) => i !== index),
                      })
                    }
                    className="h-12 rounded-xl bg-zinc-800 px-3 text-sm text-zinc-300"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setItemDraft({
                    ...itemDraft,
                    options: [...itemDraft.options, { name: "", price: "" }],
                  })
                }
                className={`${smallButton} mt-2`}
              >
                + Add extra
              </button>
            </fieldset>
            <label className="mt-4 flex items-center gap-3 text-sm font-medium text-zinc-300">
              <input
                type="checkbox"
                checked={itemDraft.available}
                onChange={(e) => setItemDraft({ ...itemDraft, available: e.target.checked })}
                className="h-5 w-5 accent-[#00955e]"
              />
              Show on the till
            </label>
            {error ? (
              <p role="alert" className="mt-4 text-sm font-medium text-red-400">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-between gap-3">
              {itemDraft.id ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Delete ${itemDraft.name}? Past orders are kept.`)) return;
                    void run("deleteItem", { id: itemDraft.id }).then((ok) => {
                      if (ok) setItemDraft(null);
                    });
                  }}
                  className="min-h-12 rounded-xl bg-red-950/60 px-4 text-sm font-semibold text-red-200 disabled:opacity-40"
                >
                  Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setItemDraft(null)}
                  className="min-h-12 rounded-xl bg-zinc-800 px-4 text-sm font-semibold text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !itemDraft.name.trim() || !itemDraft.price.trim()}
                  className="min-h-12 rounded-xl bg-[#00955e] px-5 text-sm font-bold text-white shadow-[var(--tryo-glow)] disabled:opacity-40"
                >
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {categoryDraft ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-editor-title"
        >
          <form
            className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
            onSubmit={(e) => {
              e.preventDefault();
              void saveCategory();
            }}
          >
            <h2 id="category-editor-title" className="text-xl font-bold text-white">
              {categoryDraft.id ? "Edit category" : "Add category"}
            </h2>
            <label className="mt-4 block text-sm font-medium text-zinc-300">
              Name
              <input
                value={categoryDraft.name}
                maxLength={120}
                onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })}
                className={inputClass}
                autoFocus
              />
            </label>
            <label className="mt-4 flex items-center gap-3 text-sm font-medium text-zinc-300">
              <input
                type="checkbox"
                checked={categoryDraft.mealUpgrade}
                onChange={(e) =>
                  setCategoryDraft({ ...categoryDraft, mealUpgrade: e.target.checked })
                }
                className="h-5 w-5 accent-[#00955e]"
              />
              Offer “Make it a meal” on these items
            </label>
            {error ? (
              <p role="alert" className="mt-4 text-sm font-medium text-red-400">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCategoryDraft(null)}
                className="min-h-12 rounded-xl bg-zinc-800 px-4 text-sm font-semibold text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !categoryDraft.name.trim()}
                className="min-h-12 rounded-xl bg-[#00955e] px-5 text-sm font-bold text-white shadow-[var(--tryo-glow)] disabled:opacity-40"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
