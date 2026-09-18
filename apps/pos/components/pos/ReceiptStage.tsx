"use client";

import Image from "next/image";
import { formatPence } from "@/lib/money";

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
  /** Loaded Fries — printed under main line, no charge */
  seasoning?: string | null;
  /** Loaded Fries — free sauce choice */
  sauce?: string | null;
  /** Loaded Fries — each row shows qty × add-on and line total */
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
  businessAddress: string;
  businessPhone: string;
  businessVat: string;
};

function formatReceiptTimestamp(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function formatTicketTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatInvoiceNumber(orderNumber: number): string {
  return orderNumber.toString().padStart(2, "0");
}

/** Short prep ticket for the kitchen: items and options only, no prices. */
function KitchenTicket({ data }: { data: ReceiptPayload }) {
  return (
    <div className="kitchen-ticket font-mono text-[13px] leading-snug text-black">
      <div className="flex items-baseline justify-between">
        <span className="text-[22px] font-bold">
          #{formatInvoiceNumber(data.orderNumber)}
        </span>
        <span className="text-[16px] font-bold">{formatTicketTime(data.createdAt)}</span>
      </div>
      <div className="font-semibold uppercase">Kitchen · Takeaway</div>
      <div className="my-2 border-t-2 border-black" />
      {data.lines.map((line, idx) => (
        <div key={`${line.name}-${idx}`} className="mb-2">
          <div className="text-[16px] font-bold uppercase">
            {line.quantity} x {line.name}
          </div>
          {line.isMeal && line.mealLabel ? (
            <div className="pl-4">+ {line.mealLabel}</div>
          ) : null}
          {line.seasoning && line.seasoning !== "None" ? (
            <div className="pl-4">Seasoning: {line.seasoning}</div>
          ) : null}
          {line.sauce && line.sauce !== "None" ? (
            <div className="pl-4">Sauce: {line.sauce}</div>
          ) : null}
          {line.addonLines?.map((ad) => (
            <div key={ad.name} className="pl-4 uppercase">
              + {ad.name}
            </div>
          ))}
          {line.note ? (
            <div className="mt-0.5 border-l-4 border-black pl-3 font-bold">
              NOTE: {line.note}
            </div>
          ) : null}
        </div>
      ))}
      <div className="my-2 border-t-2 border-black" />
      <div className="font-semibold">Total item(s): {data.totalItemCount}</div>
    </div>
  );
}

export function ReceiptStage({ data }: { data: ReceiptPayload | null }) {
  return (
    <div id="receipt-print-root" className="receipt-stage" aria-hidden={!data}>
      {data ? (
        <div className="receipt-paper font-mono text-[11px] leading-snug text-black">
        <div
          aria-hidden="true"
          className="mx-auto mb-1"
          style={{ width: "48mm", height: "16.5mm", overflow: "hidden" }}
        >
          <Image
            src="/menulogo.png"
            alt=""
            width={1081}
            height={1081}
            preload
            unoptimized
            style={{
              display: "block",
              width: "48mm",
              height: "48mm",
              transform: "translateY(-16mm)",
            }}
          />
        </div>
        <div className="text-center">{data.businessAddress}</div>
        <div className="text-center">Phone: {data.businessPhone}</div>
        <div className="text-center">VAT Number: {data.businessVat}</div>
        <div className="mt-2 text-center">
          Invoice No: #{formatInvoiceNumber(data.orderNumber)}
        </div>
        <div className="text-center">takeaway</div>
        <div className="my-1 border-t border-dashed border-black" />
        <div>date: {formatReceiptTimestamp(data.createdAt)}</div>
        <div>customer: Walk In Customer</div>
        <div>address: NN10 6FH</div>
        <div className="my-1 border-t border-dashed border-black" />
        {data.lines.map((line, idx) => (
          <div key={`${line.name}-${idx}`} className="mb-1">
            <div className="flex justify-between gap-2">
              <span className="min-w-0 flex-1 uppercase">
                {line.quantity} x {line.name}
              </span>
              <span className="shrink-0">{formatPence(line.baseLineTotalPence)}</span>
            </div>
            {line.seasoning !== undefined && line.seasoning !== null ? (
              <div className="mt-0.5 pl-1 text-[10px] text-black">
                Seasoning: {line.seasoning}
              </div>
            ) : null}
            {line.sauce !== undefined && line.sauce !== null ? (
              <div className="mt-0.5 pl-1 text-[10px] text-black">
                Sauce: {line.sauce}
              </div>
            ) : null}
            {line.isMeal && line.mealLabel ? (
              <div className="mt-0.5 flex justify-between gap-2 pl-3 text-[10px]">
                <span className="min-w-0 flex-1">
                  {line.quantity} x {line.mealLabel}:
                </span>
                <span className="shrink-0">
                  {formatPence(line.mealLineTotalPence)}
                </span>
              </div>
            ) : null}
            {line.addonLines && line.addonLines.length > 0
              ? line.addonLines.map((ad) => (
                  <div
                    key={ad.name}
                    className="mt-0.5 flex justify-between gap-2 pl-3 text-[10px]"
                  >
                    <span className="min-w-0 flex-1 uppercase">
                      {line.quantity} x {ad.name}:
                    </span>
                    <span className="shrink-0">
                      {formatPence(ad.lineTotalPence)}
                    </span>
                  </div>
                ))
              : null}
            {line.note ? (
              <div className="mt-0.5 pl-3 text-[10px]">Note: {line.note}</div>
            ) : null}
          </div>
        ))}
        <div className="my-1 border-t border-dashed border-black" />
        <div className="flex justify-between gap-2">
          <span>Sub Total:</span>
          <span>{formatPence(data.subtotalPence)}</span>
        </div>
        {data.discountAmountPence > 0 && data.discountLabel ? (
          <div className="flex justify-between gap-2">
            <span className="min-w-0 pr-2">{data.discountLabel}</span>
            <span className="shrink-0">
              {formatPence(-data.discountAmountPence)}
            </span>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <span>Delivery Fee:</span>
          <span>£0.00</span>
        </div>
        <div
          className="flex justify-between gap-2 text-[12px] font-bold"
          data-receipt-total
        >
          <span>TOTAL:</span>
          <span>{formatPence(data.totalPence)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Total Item(s):</span>
          <span>{data.totalItemCount}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Payment Mode</span>
          <span>{data.paymentMethod === "card" ? "Card" : "Cash"}</span>
        </div>
        <div className="my-1 border-t border-dashed border-black" />
        <div className="text-center font-semibold" data-receipt-footer>
          Thank you for visiting us!
        </div>
        <div className="my-1 border-t border-dashed border-black" />
        <div className="text-center">Served by: Staff</div>
        </div>
      ) : null}
      {data ? <KitchenTicket data={data} /> : null}
    </div>
  );
}
