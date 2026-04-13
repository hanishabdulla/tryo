"use client";

import { useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { CATEGORIES } from "@/lib/categories";
import { api } from "@/lib/convex-api";
import { formatPence } from "@/lib/money";

type MenuPrintRow = {
  category: string;
  name: string;
  basePrice: number;
  sortOrder: number;
};

function MenuPrintBody() {
  const items = useQuery(api.menu.listAllMenuItemsForPrint, {});
  const config = useQuery(api.menu.getMenuConfig, {});

  const businessName =
    typeof config?.businessName === "string" ? config.businessName : "Tryo";

  const sections = useMemo(() => {
    if (!items) return [];
    const byCat = new Map<string, MenuPrintRow[]>();
    for (const row of items as MenuPrintRow[]) {
      const list = byCat.get(row.category) ?? [];
      list.push(row);
      byCat.set(row.category, list);
    }
    for (const [, list] of byCat) {
      list.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    const ordered: { label: string; category: string; rows: MenuPrintRow[] }[] =
      [];
    const seen = new Set<string>();
    for (const c of CATEGORIES) {
      const key = c.convexCategory;
      if (!key) continue;
      const rows = byCat.get(key);
      if (!rows?.length) continue;
      ordered.push({ label: c.label, category: key, rows });
      seen.add(key);
    }
    for (const [category, rows] of byCat) {
      if (seen.has(category) || !rows.length) continue;
      ordered.push({ label: category, category, rows });
    }
    return ordered;
  }, [items]);

  useEffect(() => {
    if (items === undefined) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.tryoMenuPrint?.signalReady();
      });
    });
    return () => cancelAnimationFrame(id);
  }, [items]);

  if (items === undefined) {
    return (
      <div className="menu-print-inner p-4 font-mono text-sm text-black">
        Loading menu…
      </div>
    );
  }

  return (
    <div className="menu-print-inner p-4 font-mono text-sm text-black">
      <div className="text-center text-base font-bold uppercase">
        {businessName}
      </div>
      <div className="mt-1 text-center text-xs">Menu · prices inc. where shown</div>
      <div className="my-3 border-t border-dashed border-black" />
      {sections.length === 0 ? (
        <p className="text-center text-xs">No menu items to print.</p>
      ) : (
        sections.map((sec) => (
          <section key={sec.category} className="mb-4">
            <h2 className="border-b border-black text-xs font-bold uppercase tracking-wide">
              {sec.label}
            </h2>
            <ul className="mt-1 space-y-1">
              {sec.rows.map((r) => (
                <li
                  key={`${sec.category}-${r.name}`}
                  className="flex justify-between gap-2 text-[11px] leading-tight"
                >
                  <span className="min-w-0 flex-1 uppercase">{r.name}</span>
                  <span className="shrink-0 font-semibold">
                    {formatPence(r.basePrice)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <div className="mt-4 border-t border-dashed border-black pt-2 text-center text-[10px] text-zinc-600">
        Printed {new Date().toLocaleString("en-GB")}
      </div>
    </div>
  );
}

export default function MenuPrintPage() {
  return (
    <ConvexClientProvider>
      <div id="menu-print-root" className="menu-print-sheet min-h-screen bg-white">
        <MenuPrintBody />
      </div>
    </ConvexClientProvider>
  );
}
