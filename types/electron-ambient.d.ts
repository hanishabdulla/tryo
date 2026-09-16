export type TryoPrinterInfo = {
  name: string;
  description?: string;
  status?: number;
  isDefault?: boolean;
};

export type MenuPrintResult = { ok: true } | { ok: false; error?: string };

export type ReceiptPrintResult = { ok: true } | { ok: false; error?: string };

declare global {
  interface Window {
    tryoElectron?: {
      printMenu: () => Promise<MenuPrintResult>;
      listPrinters: () => Promise<TryoPrinterInfo[]>;
      getReceiptPrinter: () => Promise<string>;
      setReceiptPrinter: (deviceName: string) => Promise<ReceiptPrintResult>;
      testReceiptPrinter: (deviceName: string) => Promise<ReceiptPrintResult>;
      printReceiptSilent: () => Promise<ReceiptPrintResult>;
    };
    tryoMenuPrint?: {
      signalReady: () => void;
    };
    tryoReceiptPrint?: {
      signalReady: () => void;
    };
  }
}

export {};
