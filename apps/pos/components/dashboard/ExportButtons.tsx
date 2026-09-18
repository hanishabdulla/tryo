"use client";

import { useState } from "react";
import { downloadFinancesXlsx, type OrderRow } from "@/lib/finances-excel";

const secondary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/15 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40";

export function ExportButtons({
  orders,
  filenameBase,
  title,
  period,
}: {
  orders: OrderRow[];
  filenameBase: string;
  title: string;
  period: string;
}) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = orders.length === 0;

  async function downloadXlsx() {
    setXlsxBusy(true);
    setError(null);
    try {
      await downloadFinancesXlsx(orders, filenameBase);
    } catch {
      setError("Could not create the Excel file. Try again.");
    } finally {
      setXlsxBusy(false);
    }
  }

  async function downloadPdf() {
    setPdfBusy(true);
    setError(null);
    try {
      const { downloadFinancesPdf } = await import("@/lib/finances-pdf");
      await downloadFinancesPdf(orders, { title, period, filenameBase });
    } catch {
      setError("Could not create the PDF. Try again.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={empty || xlsxBusy}
          onClick={() => void downloadXlsx()}
          className={secondary}
        >
          <span className="rounded bg-emerald-500/15 px-1 text-[10px] font-bold text-emerald-300">XLS</span>
          {xlsxBusy ? "Creating…" : "Excel"}
        </button>
        <button
          type="button"
          disabled={empty || pdfBusy}
          onClick={() => void downloadPdf()}
          className={secondary}
        >
          <span className="rounded bg-red-500/15 px-1 text-[10px] font-bold text-red-300">PDF</span>
          {pdfBusy ? "Creating…" : "PDF"}
        </button>
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
