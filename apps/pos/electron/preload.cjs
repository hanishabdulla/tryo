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
  /** Print the current window (uses #receipt-print-root @media print CSS). */
  printReceiptSilent: (options) =>
    ipcRenderer.invoke("receipt-print-silent", options),
});

contextBridge.exposeInMainWorld("tryoMenuPrint", {
  /** Call when menu DOM is ready so the main process can issue `webContents.print`. */
  signalReady: () => {
    ipcRenderer.send("menu-print-content-ready");
  },
});
