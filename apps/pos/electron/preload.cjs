const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tryoElectron", {
  /** Opens a hidden window, loads /print/menu, then prints (silent if ELECTRON_MENU_PRINTER set). */
  printMenu: () => ipcRenderer.invoke("menu:print"),
  /** Printers registered with the operating system. */
  listPrinters: () => ipcRenderer.invoke("print:listPrinters"),
  getReceiptPrinter: () => ipcRenderer.invoke("print:getReceiptPrinter"),
  setReceiptPrinter: (deviceName) =>
    ipcRenderer.invoke("print:setReceiptPrinter", deviceName),
  testReceiptPrinter: (deviceName) =>
    ipcRenderer.invoke("print:testReceiptPrinter", deviceName),
  /**
   * Print one order. `kitchenHtml` and `customerHtml` are complete documents
   * built by lib/receipt-document.ts. Pass either document as `null` to skip
   * it; at least one document must be supplied.
   */
  printReceiptSilent: (options) =>
    ipcRenderer.invoke("receipt-print-silent", options),
});

contextBridge.exposeInMainWorld("tryoMenuPrint", {
  /** Call when menu DOM is ready so the main process can issue `webContents.print`. */
  signalReady: () => {
    ipcRenderer.send("menu-print-content-ready");
  },
});
