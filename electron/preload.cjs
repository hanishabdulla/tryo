const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tryoElectron", {
  /** Opens a hidden window, loads /print/menu, then prints (silent if ELECTRON_MENU_PRINTER set). */
  printMenu: () => ipcRenderer.invoke("menu:print"),
  /** System printers (for picking `ELECTRON_MENU_PRINTER` device name). */
  listPrinters: () => ipcRenderer.invoke("print:listPrinters"),
  /**
   * Printer name for silent receipt print (e.g. macOS "EML POS-80C").
   * Set `ELECTRON_RECEIPT_PRINTER` or `ELECTRON_MENU_PRINTER` in `.env.local` or the shell.
   */
  getReceiptPrinter: () =>
    (process.env.ELECTRON_RECEIPT_PRINTER ||
      process.env.ELECTRON_MENU_PRINTER ||
      "").trim(),
  /** Print the current window (uses #receipt-print-root @media print CSS). */
  printReceiptSilent: (deviceName) =>
    ipcRenderer.invoke("receipt-print-silent", deviceName),
});

contextBridge.exposeInMainWorld("tryoMenuPrint", {
  /** Call when menu DOM is ready so the main process can issue `webContents.print`. */
  signalReady: () => {
    ipcRenderer.send("menu-print-content-ready");
  },
});
