const { BrowserWindow } = require("electron");
const { encodeReceipt } = require('./escpos.cjs');
const { sendRawReceipt } = require('./windows-raw.cjs');

// Copy only the rendered receipt, not the POS viewport, modals or scroll areas.
async function captureReceipt(contents) {
  return contents.executeJavaScript(`(async () => {
    await document.fonts.ready;
    const source = document.querySelector('#receipt-print-root .receipt-paper');
    if (!source || !source.textContent.trim()) throw new Error('No receipt is available to print.');
    const clone = source.cloneNode(true);
    const originals = [source, ...source.querySelectorAll('*')];
    const copies = [clone, ...clone.querySelectorAll('*')];
    const properties = ['display','font-size','font-weight','line-height','text-align',
      'text-transform','white-space','overflow-wrap','padding','margin','border',
      'border-top','border-bottom','width','height','max-width','box-sizing',
      'flex','flex-direction','flex-shrink','justify-content','align-items','gap'];
    originals.forEach((node, i) => {
      const computed = getComputedStyle(node);
      properties.forEach(key => copies[i].style.setProperty(key, computed.getPropertyValue(key)));
      copies[i].style.color = '#000';
      copies[i].style.fontFamily = 'monospace';
    });
    clone.style.width = '72mm';
    clone.style.height = 'auto';
    clone.style.margin = '0 auto';
    return clone.outerHTML;
  })()`);
}

function receiptDocument(markup) {
  return `<!doctype html><html><head><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; width: 80mm; background: white; color: black; }
      body { font: 12px/1.35 monospace; }
      #paper { display: flow-root; width: 80mm; padding-bottom: 12mm; }
      @page { margin: 0; }
    </style></head><body><main id="paper">${markup}</main></body></html>`;
}

async function prepareReceiptWindow(markup) {
  const win = new BrowserWindow({
    show: false, width: 360, height: 600,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false,
      backgroundThrottling: false },
  });
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(receiptDocument(markup))}`);
    const height = await win.webContents.executeJavaScript(`(async () => {
      await document.fonts.ready;
      const pixels = document.getElementById('paper').getBoundingClientRect().height;
      return Math.ceil(pixels * 25400 / 96) + 1000;
    })()`);
    if (!Number.isFinite(height) || height <= 0) throw new Error('Could not measure the receipt.');
    const pageSize = { width: 80000, height: Math.max(50000, height) };
    await win.webContents.insertCSS(`@page { size: 80mm ${pageSize.height / 1000}mm; margin: 0; }`);
    return { win, pageSize };
  } catch (error) {
    win.destroy();
    throw error;
  }
}

async function webContentsPrinters() {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try { return await win.webContents.getPrintersAsync(); } finally { win.destroy(); }
}

let queue = Promise.resolve();

// 80mm thermal printers print 72mm at 203dpi = 576 dots per line.
const PRINTER_DOTS = 576;
const SLICE_DOTS = 1024;
const MAX_RECEIPT_DOTS = 40000;

// Render at printer resolution offscreen and capture in fixed slices. A normal
// window cannot be taller than the screen, so long receipts would be clipped.
async function receiptRaster(markup) {
  const win = new BrowserWindow({
    show: false, width: PRINTER_DOTS, height: SLICE_DOTS, useContentSize: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false,
      backgroundThrottling: false, offscreen: { deviceScaleFactor: 1 } },
  });
  try {
    const html = `<!doctype html><html><head><meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
      <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; width: ${PRINTER_DOTS}px; overflow: hidden; background: white; color: black; }
        #strip { width: ${PRINTER_DOTS}px; will-change: transform; }
        #paper { display: flow-root; width: 72mm; zoom: ${PRINTER_DOTS / (72 * 96 / 25.4)}; font: 12px/1.35 monospace; }
      </style></head><body><div id="strip"><main id="paper">${markup}</main></div></body></html>`;
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const height = await win.webContents.executeJavaScript(`(async () => {
      await document.fonts.ready;
      return Math.ceil(document.getElementById('strip').getBoundingClientRect().height);
    })()`);
    if (!Number.isFinite(height) || height <= 0) throw new Error('Could not measure the receipt.');
    if (height > MAX_RECEIPT_DOTS) throw new Error('Receipt is too long for one print job. Split this order into smaller receipts.');
    const bitmap = Buffer.alloc(PRINTER_DOTS * height * 4, 255);
    for (let top = 0; top < height; top += SLICE_DOTS) {
      const rows = Math.min(SLICE_DOTS, height - top);
      await win.webContents.executeJavaScript(`new Promise(resolve => {
        document.getElementById('strip').style.transform = 'translateY(-${top}px)';
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })`);
      win.webContents.invalidate();
      let image = await win.webContents.capturePage({ x: 0, y: 0, width: PRINTER_DOTS, height: rows });
      const size = image.getSize();
      if (image.isEmpty()) throw new Error('Could not render the receipt.');
      if (size.width !== PRINTER_DOTS || size.height !== rows) {
        image = image.resize({ width: PRINTER_DOTS, height: rows });
      }
      image.toBitmap().copy(bitmap, top * PRINTER_DOTS * 4);
    }
    return encodeReceipt(bitmap, PRINTER_DOTS, height);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

function printReceipt(markup, deviceName) {
  const job = queue.then(async () => {
    let win;
    try {
      if (!deviceName) throw new Error('Choose and save a receipt printer first.');
      if (process.platform === 'win32') {
        // Windows POS queues often use the Generic / Text Only driver, which cannot
        // print Chromium pages. Send ESC/POS directly, ending with feed and cut.
        const printers = await webContentsPrinters();
        if (!printers.some(printer => printer.name === deviceName)) {
          throw new Error(`Printer "${deviceName}" is not available. Reconnect it and refresh the printer list.`);
        }
        return await sendRawReceipt(deviceName, await receiptRaster(markup));
      }
      const prepared = await prepareReceiptWindow(markup);
      win = prepared.win;
      const printers = await win.webContents.getPrintersAsync();
      if (!printers.some(printer => printer.name === deviceName)) {
        throw new Error(`Printer "${deviceName}" is not available. Reconnect it and refresh the printer list.`);
      }
      return await new Promise(resolve => {
        const timer = setTimeout(() => resolve({ ok: false,
          error: 'Printer did not respond within 45 seconds. Check its queue before reprinting to avoid a duplicate.' }), 45000);
        const finish = result => { clearTimeout(timer); resolve(result); };
        try {
          win.webContents.print({ silent: true, printBackground: true, deviceName,
            margins: { marginType: 'none' }, pageSize: prepared.pageSize,
            scaleFactor: 100, copies: 1, color: false, duplexMode: 'simplex' },
          (ok, reason) => finish({ ok, error: ok ? undefined : reason || 'The printer rejected the job.' }));
        } catch (error) {
          finish({ ok: false, error: error.message });
        }
      });
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    } finally {
      if (win && !win.isDestroyed()) win.destroy();
    }
  });
  queue = job.catch(() => {});
  return job;
}

module.exports = { captureReceipt, prepareReceiptWindow, receiptRaster, printReceipt };
