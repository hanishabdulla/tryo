"use client";

import { QRCodeSVG } from "qrcode.react";
import { formatPence } from "@/lib/money";

export type ReceiptLinePrint = {
  name: string;
  quantity: number;
  baseLineTotalPence: number;
  isMeal: boolean;
  mealLabel: string | null;
  mealLineTotalPence: number;
};

export type ReceiptPayload = {
  orderNumber: number;
  createdAt: number;
  lines: ReceiptLinePrint[];
  subtotalPence: number;
  deliveryFeePence: number;
  totalPence: number;
  totalItemCount: number;
  paymentMethod: "card" | "cash";
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessVat: string;
  qrUrl: string;
};

function formatReceiptTimestamp(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function ReceiptStage({ data }: { data: ReceiptPayload | null }) {
  return (
    <div id="receipt-print-root" className="receipt-stage" aria-hidden={!data}>
      {data ? (
        <div className="receipt-paper font-mono text-[11px] leading-snug text-black">
        <div className="text-center font-semibold">{data.businessName}</div>
        <div className="text-center">{data.businessAddress}</div>
        <div className="text-center">Phone: {data.businessPhone}</div>
        <div className="text-center">VAT Number: {data.businessVat}</div>
        <div className="mt-2 text-center">
          Invoice No: #{data.orderNumber}
        </div>
        <div className="text-center">takeaway</div>
        <div className="my-2 border-t border-dashed border-black" />
        <div>date: {formatReceiptTimestamp(data.createdAt)}</div>
        <div>customer: Walk In Customer</div>
        <div>address: NN10 6FH</div>
        <div className="my-2 border-t border-dashed border-black" />
        {data.lines.map((line, idx) => (
          <div key={`${line.name}-${idx}`} className="mb-2">
            <div className="flex justify-between gap-2">
              <span className="min-w-0 flex-1 uppercase">
                {line.quantity} x {line.name}
              </span>
              <span className="shrink-0">{formatPence(line.baseLineTotalPence)}</span>
            </div>
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
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-black" />
        <div className="flex justify-between gap-2">
          <span>Sub Total:</span>
          <span>{formatPence(data.subtotalPence)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Delivery Fee:</span>
          <span>£0.00</span>
        </div>
        <div className="flex justify-between gap-2 font-semibold">
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
        <div className="my-2 border-t border-dashed border-black" />
        <div className="text-center">Thank you for visiting us!</div>
        <div className="my-2 border-t border-dashed border-black" />
        <div className="flex justify-center py-2">
          <QRCodeSVG value={data.qrUrl} size={112} level="M" />
        </div>
        <div className="text-center">Served by: Staff</div>
        </div>
      ) : null}
    </div>
  );
}
