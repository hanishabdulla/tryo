/**
 * Receipt and kitchen-ticket documents, built from order data.
 *
 * Both tickets are generated here and nowhere else. The output is a complete,
 * self-contained HTML document: no Tailwind, no web fonts, no styles copied out
 * of the till's DOM. The document that gets measured is byte-for-byte the
 * document that gets printed, so the printer can never disagree with the layout
 * the till measured — the failure that silently dropped the tail of a ticket.
 *
 * Lengths are printer dots, not CSS millimetres. An 80mm thermal head prints
 * 72mm of ink at 203dpi, which is exactly 576 dots, so `1px === 1 dot` and the
 * raster needs no scaling or rounding. The HTML/PDF fallback scales the whole
 * body once with `zoom`.
 */

export const PAPER_DOTS = 576;

/** 576 dots of ink is 72mm; the CSS page is the full 80mm of paper. */
export const CSS_PIXELS_PER_DOT = (72 / 25.4) * 96 / PAPER_DOTS;

export type ReceiptAddonLine = {
  name: string;
  lineTotalPence: number;
};

export type ReceiptLinePrint = {
  name: string;
  quantity: number;
  baseLineTotalPence: number;
  isMeal: boolean;
  mealLabel: string | null;
  mealLineTotalPence: number;
  /** Loaded Fries — printed under the main line, no charge */
  seasoning?: string | null;
  /** Loaded Fries — free sauce choice */
  sauce?: string | null;
  /** Loaded Fries — each row shows the add-on and its line total */
  addonLines?: ReceiptAddonLine[];
  /** Custom instructions typed on the till. */
  note?: string;
};

export type ReceiptPayload = {
  orderNumber: number;
  createdAt: number;
  lines: ReceiptLinePrint[];
  subtotalPence: number;
  discountLabel: string | null;
  discountAmountPence: number;
  deliveryFeePence: number;
  totalPence: number;
  totalItemCount: number;
  paymentMethod: "card" | "cash";
  /** Whether this order prints a customer copy as well as the kitchen ticket. */
  printCustomerReceipt: boolean;
  businessAddress: string;
  businessPhone: string;
  businessVat: string;
};

export type ReceiptKind = "kitchen" | "customer";

export type ReceiptDocumentOptions = {
  /** `data:image/png;base64,…` for the header logo. Omitted logos just print text. */
  logoDataUrl?: string | null;
  /** Scales the whole ticket. 1 renders at printer resolution; the HTML/PDF path shrinks to CSS millimetres. */
  scale?: number;
};

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

/** Pence as `£12.34`, matching the till and the dashboard exactly. */
function money(pence: number): string {
  const sign = pence < 0 ? "-" : "";
  const abs = Math.abs(Math.round(pence));
  return `${sign}£${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, "0")}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function formatInvoiceNumber(orderNumber: number): string {
  return orderNumber.toString().padStart(2, "0");
}

export function formatReceiptTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatTicketTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A chosen option only prints when the customer actually chose something. */
function chosen(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "none") return null;
  return trimmed;
}

/**
 * Fonts that exist on every machine this runs on. Every candidate is a real
 * fixed-pitch face, so a missing one changes the column count and nothing else.
 */
const MONO_STACK =
  '"Consolas","Menlo","DejaVu Sans Mono","Liberation Mono","Courier New",monospace';

function documentShell(scale: number, css: string, body: string): string {
  const zoom = scale === 1 ? "" : `body{zoom:${scale};margin:0 auto}html{width:80mm}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<style>
*{box-sizing:border-box;margin:0;padding:0}
/* A classic Windows scrollbar would steal columns from the 576-dot page. */
html{background:#fff;overflow:hidden}
body{width:${PAPER_DOTS}px;background:#fff;color:#000;font-family:${MONO_STACK};
  font-variant-ligatures:none;text-rendering:geometricPrecision;-webkit-font-smoothing:none}
.rule{border-top:4px solid #000}
.dash{border-top:2px dashed #000}
.row{display:flex;justify-content:space-between;align-items:baseline;gap:16px}
.row>.l{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
.row>.r{flex:0 0 auto;white-space:nowrap}
.up{text-transform:uppercase}
.mid{text-align:center}
/* Printed last on every ticket. The raster is rejected unless this bar survives. */
.endmark{height:4px;background:#000}
${css}
${zoom}
@page{margin:0}
</style></head><body data-receipt-kind="__KIND__">${body}</body></html>`;
}

function kitchenBody(data: ReceiptPayload): string {
  const lines = data.lines
    .map((line) => {
      const parts: string[] = [
        `<div class="k-name">${esc(`${line.quantity} x ${line.name}`)}</div>`,
      ];
      if (line.isMeal && line.mealLabel) {
        parts.push(`<div class="k-opt">+ ${esc(line.mealLabel)}</div>`);
      }
      const seasoning = chosen(line.seasoning);
      if (seasoning) parts.push(`<div class="k-opt">Seasoning: ${esc(seasoning)}</div>`);
      const sauce = chosen(line.sauce);
      if (sauce) parts.push(`<div class="k-opt">Sauce: ${esc(sauce)}</div>`);
      for (const addon of line.addonLines ?? []) {
        parts.push(`<div class="k-opt up">+ ${esc(addon.name)}</div>`);
      }
      if (line.note) {
        parts.push(`<div class="k-note">NOTE: ${esc(line.note)}</div>`);
      }
      return `<div class="k-line">${parts.join("")}</div>`;
    })
    .join("");

  return `<div class="row k-head">
<span class="l k-no">#${esc(formatInvoiceNumber(data.orderNumber))}</span>
<span class="r k-time">${esc(formatTicketTime(data.createdAt))}</span>
</div>
<div class="k-sub up">Kitchen &middot; Takeaway</div>
<div class="rule k-gap"></div>
${lines}
<div class="rule k-gap"></div>
<div class="k-total">Total item(s): ${data.totalItemCount}</div>
<div class="endmark k-end"></div>`;
}

const KITCHEN_CSS = `
body{padding:64px 32px;font-size:27px;line-height:1.4}
.k-head{align-items:baseline}
.k-no{font-size:46px;font-weight:700;letter-spacing:1px}
.k-time{font-size:34px;font-weight:700}
.k-sub{font-weight:700}
.k-gap{margin:17px 0}
.k-line{margin-bottom:17px}
.k-line:last-of-type{margin-bottom:0}
.k-name{font-size:34px;font-weight:700;text-transform:uppercase;overflow-wrap:anywhere}
.k-opt{padding-left:34px;overflow-wrap:anywhere}
.k-note{margin-top:4px;padding-left:20px;border-left:8px solid #000;font-weight:700;overflow-wrap:anywhere}
.k-total{font-weight:700}
.k-end{margin-top:24px}`;

function customerBody(data: ReceiptPayload, logoDataUrl?: string | null): string {
  const logo = logoDataUrl
    ? `<div class="logo-window" aria-hidden="true"><img class="logo" src="${esc(logoDataUrl)}" alt=""></div>`
    : "";

  const lines = data.lines
    .map((line) => {
      const parts: string[] = [
        `<div class="row"><span class="l up">${esc(`${line.quantity} x ${line.name}`)}</span><span class="r">${money(line.baseLineTotalPence)}</span></div>`,
      ];
      const seasoning = chosen(line.seasoning);
      if (seasoning) parts.push(`<div class="sub">Seasoning: ${esc(seasoning)}</div>`);
      const sauce = chosen(line.sauce);
      if (sauce) parts.push(`<div class="sub">Sauce: ${esc(sauce)}</div>`);
      if (line.isMeal && line.mealLabel) {
        parts.push(
          `<div class="row sub"><span class="l">${esc(`${line.quantity} x ${line.mealLabel}`)}:</span><span class="r">${money(line.mealLineTotalPence)}</span></div>`,
        );
      }
      for (const addon of line.addonLines ?? []) {
        parts.push(
          `<div class="row sub"><span class="l up">${esc(`${line.quantity} x ${addon.name}`)}:</span><span class="r">${money(addon.lineTotalPence)}</span></div>`,
        );
      }
      if (line.note) parts.push(`<div class="sub">Note: ${esc(line.note)}</div>`);
      return `<div class="c-line">${parts.join("")}</div>`;
    })
    .join("");

  const hasAdjustments =
    data.discountAmountPence > 0 || data.deliveryFeePence > 0;

  const adjustments = [
    hasAdjustments
      ? `<div class="row"><span class="l">Sub Total:</span><span class="r">${money(data.subtotalPence)}</span></div>`
      : "",
    data.discountAmountPence > 0 && data.discountLabel
      ? `<div class="row"><span class="l">${esc(data.discountLabel)}</span><span class="r">${money(-data.discountAmountPence)}</span></div>`
      : "",
    data.deliveryFeePence > 0
      ? `<div class="row"><span class="l">Delivery Fee:</span><span class="r">${money(data.deliveryFeePence)}</span></div>`
      : "",
  ].join("");

  return `${logo}
<div class="mid">${esc(data.businessAddress)}</div>
<div class="mid">Phone: ${esc(data.businessPhone)}</div>
<div class="mid">VAT Number: ${esc(data.businessVat)}</div>
<div class="mid c-invoice">Invoice No: #${esc(formatInvoiceNumber(data.orderNumber))}</div>
<div class="mid">takeaway</div>
<div class="dash c-gap"></div>
<div>date: ${esc(formatReceiptTimestamp(data.createdAt))}</div>
<div>customer: Walk In Customer</div>
<div>address: NN10 6FH</div>
<div class="dash c-gap"></div>
${lines}
<div class="dash c-gap"></div>
${adjustments}
<div class="row c-total"><span class="l">TOTAL:</span><span class="r">${money(data.totalPence)}</span></div>
<div class="row"><span class="l">Total Item(s):</span><span class="r">${data.totalItemCount}</span></div>
<div class="row"><span class="l">Payment Mode</span><span class="r">${data.paymentMethod === "card" ? "Card" : "Cash"}</span></div>
<div class="dash c-gap"></div>
<div class="mid c-thanks">Thank you for visiting us!</div>
<div class="dash c-gap"></div>
<div class="mid">Served by: Staff</div>
<div class="endmark c-end"></div>`;
}

const CUSTOMER_CSS = `
body{padding:24px 32px 32px;font-size:23px;line-height:1.4}
.logo-window{width:384px;height:132px;overflow:hidden;margin:0 auto 8px}
.logo{display:block;width:384px;height:384px;transform:translateY(-128px)}
.c-invoice{margin-top:17px}
.c-gap{margin:10px 0}
.c-line{margin-bottom:10px}
.sub{font-size:21px;padding-left:24px;margin-top:2px;overflow-wrap:anywhere}
.c-total{font-size:26px;font-weight:700}
.c-thanks{font-weight:700}
.c-end{margin-top:24px}`;

/** A complete, standalone print document for one ticket. */
export function buildReceiptDocument(
  data: ReceiptPayload,
  kind: ReceiptKind,
  options: ReceiptDocumentOptions = {},
): string {
  const scale = options.scale ?? 1;
  const [css, body] =
    kind === "kitchen"
      ? [KITCHEN_CSS, kitchenBody(data)]
      : [CUSTOMER_CSS, customerBody(data, options.logoDataUrl)];
  return documentShell(scale, css, body).replace("__KIND__", kind);
}
