"use client";

import {
  buildReceiptDocument,
  CSS_PIXELS_PER_DOT,
  type ReceiptPayload,
} from "@/lib/receipt-document";

/**
 * The header logo, inlined. The print document runs under a strict
 * `img-src data:` policy and has no origin of its own, so the bytes have to
 * travel with the markup.
 */
let logoPromise: Promise<string | null> | null = null;

export function receiptLogoDataUrl(): Promise<string | null> {
  if (!logoPromise) {
    logoPromise = fetch("/menulogo.png")
      .then((response) => (response.ok ? response.blob() : null))
      .then(
        (blob) =>
          new Promise<string | null>((resolve) => {
            if (!blob) {
              resolve(null);
              return;
            }
            const reader = new FileReader();
            reader.onload = () =>
              resolve(
                typeof reader.result === "string" ? reader.result : null,
              );
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          }),
      )
      // A missing logo prints a ticket without one. It never blocks the order.
      .catch(() => null);
  }
  return logoPromise;
}

export type ReceiptDocuments = {
  kitchenHtml: string;
  customerHtml: string | null;
};

export async function buildReceiptDocuments(
  data: ReceiptPayload,
): Promise<ReceiptDocuments> {
  const logoDataUrl = await receiptLogoDataUrl();
  return {
    kitchenHtml: buildReceiptDocument(data, "kitchen"),
    customerHtml: data.printCustomerReceipt
      ? buildReceiptDocument(data, "customer", { logoDataUrl })
      : null,
  };
}

/**
 * Browser fallback for `npm run pos`, where there is no Electron bridge and no
 * thermal printer. Each ticket goes through the browser's own print dialog in
 * a throwaway frame, using the same document the till would have rasterised.
 */
export async function printDocumentsInBrowser(
  documents: ReceiptDocuments,
): Promise<void> {
  const tickets = [documents.kitchenHtml, documents.customerHtml].filter(
    (html): html is string => typeof html === "string" && html.length > 0,
  );
  for (const html of tickets) {
    await printOneInBrowser(html);
  }
}

function printOneInBrowser(html: string): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:80mm;height:0;border:0;visibility:hidden";
    // Shrink printer dots back to millimetres; the raster path does not need this.
    frame.srcdoc = html.replace(
      "</style>",
      `html{width:80mm}body{zoom:${CSS_PIXELS_PER_DOT};margin:0 auto}@page{size:80mm auto;margin:0}</style>`,
    );
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.setTimeout(() => frame.remove(), 1000);
      resolve();
    };
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        // A blocked print dialog must not strand the order.
      }
      finish();
    };
    frame.onerror = finish;
    document.body.appendChild(frame);
    window.setTimeout(finish, 10_000);
  });
}
