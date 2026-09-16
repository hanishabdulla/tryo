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
  printReceiptSilent: () => {
    const result = ipcRenderer.invoke("receipt-print-silent");
    queueMicrotask(() => ipcRenderer.send("receipt-print-content-ready"));
    return result;
  },
});

contextBridge.exposeInMainWorld("tryoReceiptPrint", {
  /** Call when #receipt-print-root has been painted for the current order. */
  signalReady: () => {
    ipcRenderer.send("receipt-print-content-ready");
  },
});

contextBridge.exposeInMainWorld("tryoMenuPrint", {
  /** Call when menu DOM is ready so the main process can issue `webContents.print`. */
  signalReady: () => {
    ipcRenderer.send("menu-print-content-ready");
  },
});
