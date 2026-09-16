import type { OrderRow } from "@/lib/finances-excel";
import { formatPence } from "@/lib/money";
import { formatTsLocal } from "@/lib/report-dates";

const GREEN: [number, number, number] = [0, 149, 94];
const INK: [number, number, number] = [24, 24, 27];
const MUTED: [number, number, number] = [113, 113, 122];
const LINE: [number, number, number] = [228, 228, 231];

async function loadImage(src: string) {
  const blob = await (await fetch(src)).blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
  return { dataUrl, ...size };
}

function itemSales(orders: OrderRow[]) {
  const byName = new Map<string, { quantity: number; revenue: number }>();
  for (const order of orders) {
    for (const line of order.items) {
      const row = byName.get(line.itemName) ?? { quantity: 0, revenue: 0 };
      row.quantity += line.quantity;
      row.revenue += line.lineTotal;
      byName.set(line.itemName, row);
    }
  }
  return [...byName.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
}

/** A4 finance report: summary figures, item sales and the full order list. */
export async function downloadFinancesPdf(
  orders: OrderRow[],
  { title, period, filenameBase }: { title: string; period: string; filenameBase: string },
) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;

  // Header: logo left, report title and period right.
  try {
    const logo = await loadImage("/brand/tryo-wordmark-dark.png");
    const logoHeight = 13;
    doc.addImage(logo.dataUrl, "PNG", margin, 12, (logo.width / logo.height) * logoHeight, logoHeight);
  } catch {
    doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...INK).text("Tryo", margin, 22);
  }
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...INK);
  doc.text(title, pageWidth - margin, 17, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...MUTED);
  doc.text(period, pageWidth - margin, 22.5, { align: "right" });
  doc.text(`Generated ${formatTsLocal(Date.now())}`, pageWidth - margin, 27, { align: "right" });
  doc.setDrawColor(...LINE).setLineWidth(0.3).line(margin, 32, pageWidth - margin, 32);

  // Summary figures.
  const gross = orders.reduce((s, o) => s + o.total, 0);
  const card = orders.filter((o) => o.paymentMethod === "card").reduce((s, o) => s + o.total, 0);
  const cash = orders.filter((o) => o.paymentMethod === "cash").reduce((s, o) => s + o.total, 0);
  const discounts = orders.reduce((s, o) => s + (o.discountAmountPence ?? 0), 0);
  const items = orders.reduce((s, o) => s + o.totalItemCount, 0);
  const stats: [string, string][] = [
    ["Gross sales", formatPence(gross)],
    ["Orders", String(orders.length)],
    ["Average order", orders.length ? formatPence(Math.round(gross / orders.length)) : "£0.00"],
    ["Items sold", String(items)],
    ["Card", formatPence(card)],
    ["Cash", formatPence(cash)],
    ["Discounts", formatPence(discounts)],
  ];
  const columns = 4;
  const gap = 4;
  const boxWidth = (pageWidth - margin * 2 - gap * (columns - 1)) / columns;
  const boxHeight = 17;
  stats.forEach(([label, value], i) => {
    const x = margin + (i % columns) * (boxWidth + gap);
    const y = 38 + Math.floor(i / columns) * (boxHeight + gap);
    doc.setFillColor(250, 250, 250).setDrawColor(...LINE).roundedRect(x, y, boxWidth, boxHeight, 2, 2, "FD");
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED).text(label.toUpperCase(), x + 4, y + 6);
    doc.setFont("helvetica", "bold").setFontSize(i === 0 ? 13 : 12).setTextColor(...(i === 0 ? GREEN : INK));
    doc.text(value, x + 4, y + 13);
  });

  const tableStyles = {
    theme: "plain" as const,
    margin: { left: margin, right: margin, bottom: 18 },
    styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 }, textColor: INK, lineColor: LINE },
    headStyles: { fillColor: [244, 244, 245] as [number, number, number], textColor: MUTED, fontStyle: "bold" as const, fontSize: 8 },
    footStyles: { fillColor: [244, 244, 245] as [number, number, number], textColor: INK, fontStyle: "bold" as const },
    bodyStyles: { lineWidth: { bottom: 0.2 } },
  };
  const sectionTitle = (text: string, y: number) => {
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...INK).text(text, margin, y);
    return y + 3;
  };
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  let y = 38 + Math.ceil(stats.length / columns) * (boxHeight + gap) + 6;
  const sales = itemSales(orders);
  if (sales.length) {
    autoTable(doc, {
      ...tableStyles,
      startY: sectionTitle("Item sales", y),
      head: [["Item", "Qty", "Revenue"]],
      body: sales.map(([name, row]) => [name, String(row.quantity), formatPence(row.revenue)]),
      columnStyles: { 1: { halign: "right", cellWidth: 20 }, 2: { halign: "right", cellWidth: 32 } },
      didParseCell: (data) => {
        if (data.section === "head" && data.column.index > 0) data.cell.styles.halign = "right";
      },
    });
    y = lastY() + 10;
  }

  autoTable(doc, {
    ...tableStyles,
    startY: sectionTitle("Orders", y),
    head: [["Order", "Date / time", "Items", "Payment", "Discount", "Total"]],
    body: orders.length
      ? orders.map((o) => [
          `#${o.orderNumber}`,
          formatTsLocal(o.createdAt),
          String(o.totalItemCount),
          o.paymentMethod === "card" ? "Card" : "Cash",
          o.discountAmountPence ? `-${formatPence(o.discountAmountPence)}` : "",
          formatPence(o.total),
        ])
      : [[{ content: "No orders in this period.", colSpan: 6, styles: { halign: "center", textColor: MUTED } }]],
    showFoot: "lastPage",
    foot: orders.length ? [["", "", String(items), "", discounts ? `-${formatPence(discounts)}` : "", formatPence(gross)]] : undefined,
    columnStyles: {
      0: { cellWidth: 22, fontStyle: "bold" },
      2: { halign: "right", cellWidth: 16 },
      4: { halign: "right", cellWidth: 26 },
      5: { halign: "right", cellWidth: 28 },
    },
    didParseCell: (data) => {
      if (data.section !== "body" && [2, 4, 5].includes(data.column.index)) data.cell.styles.halign = "right";
    },
  });

  // Footer on every page.
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(...LINE).setLineWidth(0.3).line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    doc.text("Tryo · Rushden Lakes", margin, pageHeight - 7);
    doc.text(`Page ${page} of ${pages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
  }

  doc.save(`${filenameBase.replace(/[^\w.-]+/g, "_")}.pdf`);
}
