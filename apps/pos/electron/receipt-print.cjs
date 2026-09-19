const { BrowserWindow } = require("electron");
const { encodeReceipt } = require("./escpos.cjs");
const { sendRawReceipt } = require("./windows-raw.cjs");

// 80mm thermal printers put 72mm of ink on the paper at 203dpi = 576 dots per
// line. Tickets are authored in those dots (see lib/receipt-document.ts), so
// the raster path is 1:1 with no scaling and no rounding.
const PRINTER_DOTS = 576;
const SLICE_DOTS = 1024;
const MAX_RECEIPT_DOTS = 40000;
// Blank dots after the last ink, so the cut lands clear of the final line.
const BOTTOM_GUARD_DOTS = 96;
// 576 dots of ink shrink to 72mm when the HTML/PDF path renders on real paper.
const CSS_PIXELS_PER_DOT = ((72 / 25.4) * 96) / PRINTER_DOTS;

/**
 * Where the ticket puts ink, and how tall it is.
 *
 * Runs inside the document that is about to be printed, so the measurement and
 * the print can never come from different layouts. `ink` is every band of rows
 * that must end up black: text runs, rules, the logo and the end bar. The
 * raster is checked against it before anything reaches the printer.
 */
const MEASURE_SCRIPT = `(async () => {
  await document.fonts.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const body = document.body;
  const ink = [];
  const add = (top, bottom) => {
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom - top < 0.5) return;
    ink.push([top, bottom]);
  };

  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (rect.width > 0.5 && rect.height > 0.5) add(rect.top, rect.bottom);
    }
  }
  for (const element of body.querySelectorAll('*')) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0.5) continue;
    const style = getComputedStyle(element);
    const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
    if (borderTop > 0 && style.borderTopStyle !== 'none') add(rect.top, rect.top + borderTop);
    const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
    if (borderLeft > 0 && style.borderLeftStyle !== 'none') add(rect.top, rect.bottom);
    const background = style.backgroundColor;
    if (background && !/^rgba\\(.*,\\s*0\\)$/.test(background) && background !== 'transparent' &&
        background !== 'rgb(255, 255, 255)') {
      add(rect.top, rect.bottom);
    }
    if (element.tagName === 'IMG' && element.naturalWidth > 0) add(rect.top, rect.bottom);
  }

  const endmark = body.querySelector('.endmark');
  if (!endmark) throw new Error('This ticket has no end marker and was not printed.');
  const endRect = endmark.getBoundingClientRect();
  if (endRect.height < 1) throw new Error('This ticket has no end marker and was not printed.');

  // Merge overlapping bands so one wrapped line is one expectation, not twenty.
  ink.sort((a, b) => a[0] - b[0]);
  const bands = [];
  for (const [top, bottom] of ink) {
    const last = bands[bands.length - 1];
    if (last && top <= last[1] + 0.5) last[1] = Math.max(last[1], bottom);
    else bands.push([top, bottom]);
  }

  const deepest = bands.length ? bands[bands.length - 1][1] : 0;
  return {
    // How much of the ticket the window can actually show. The operating
    // system caps a window at the screen, so this is not what was asked for.
    view: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
    height: Math.ceil(Math.max(body.getBoundingClientRect().height, body.scrollHeight, deepest, endRect.bottom)),
    endTop: endRect.top,
    endBottom: endRect.bottom,
    bands,
  };
})()`;

function assertMeasurement(measured) {
  if (!measured || !Number.isFinite(measured.height) || measured.height <= 0) {
    throw new Error("Could not measure the ticket.");
  }
  if (measured.height > MAX_RECEIPT_DOTS) {
    throw new Error(
      "Ticket is too long for one print job. Split this order into smaller tickets.",
    );
  }
  const bands = Array.isArray(measured.bands) ? measured.bands : [];
  // Everything above the end bar is the ticket. Nothing there is a blank slip.
  if (!bands.some(([, bottom]) => bottom <= measured.endTop + 0.5)) {
    throw new Error("This ticket rendered blank and was not printed.");
  }
}

async function loadDocument(win, html) {
  if (typeof html !== "string" || !html.trim()) {
    throw new Error("No ticket was supplied to print.");
  }
  if (!html.includes("endmark")) {
    throw new Error("This ticket has no end marker and was not printed.");
  }
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  win.webContents.setZoomFactor(1);
}

/**
 * The HTML/PDF path, used off Windows. The ticket is authored in printer dots,
 * so the whole body is scaled once to land 576 dots on 72mm of an 80mm page.
 */
async function prepareReceiptWindow(html) {
  const win = new BrowserWindow({
    show: false,
    width: 360,
    height: 600,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      zoomFactor: 1,
    },
  });
  try {
    await loadDocument(win, html);
    await win.webContents.insertCSS(
      `html{width:80mm;overflow:hidden}body{zoom:${CSS_PIXELS_PER_DOT};margin:0 auto}`,
    );
    const measured = await win.webContents.executeJavaScript(MEASURE_SCRIPT);
    assertMeasurement(measured);
    // `zoom` already shrank the measurement to CSS pixels; convert to microns.
    const microns =
      Math.ceil(((measured.height + BOTTOM_GUARD_DOTS * CSS_PIXELS_PER_DOT) * 25400) / 96) + 1000;
    const pageSize = { width: 80000, height: Math.max(50000, microns) };
    await win.webContents.insertCSS(
      `@page{size:80mm ${pageSize.height / 1000}mm;margin:0}`,
    );
    return { win, pageSize, measured };
  } catch (error) {
    win.destroy();
    throw error;
  }
}

async function webContentsPrinters() {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    return await win.webContents.getPrintersAsync();
  } finally {
    win.destroy();
  }
}

/** Row indices that hold at least one black pixel. */
function inkedRows(bitmap, width, height) {
  const rows = new Uint8Array(height);
  for (let y = 0; y < height; y += 1) {
    const start = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if (bitmap[start + x * 4] < 128) {
        rows[y] = 1;
        break;
      }
    }
  }
  return rows;
}

/**
 * Every band the page said would be black must actually be black. This is the
 * check that makes a short ticket impossible: a dropped line, a blank capture
 * slice or a mismeasured page all fail here instead of reaching the kitchen.
 */
function verifyRaster(bitmap, height, measured) {
  const rows = inkedRows(bitmap, PRINTER_DOTS, height);
  const missing = [];
  for (const [top, bottom] of measured.bands) {
    const from = Math.max(0, Math.floor(top) - 1);
    const to = Math.min(height - 1, Math.ceil(bottom));
    let found = false;
    for (let y = from; y <= to; y += 1) {
      if (rows[y]) {
        found = true;
        break;
      }
    }
    if (!found) missing.push(`${Math.round(top)}-${Math.round(bottom)}`);
  }
  if (missing.length > 0) {
    throw new Error(
      `The ticket did not render completely (${missing.length} blank section${missing.length === 1 ? "" : "s"} at ${missing.slice(0, 4).join(", ")}). Nothing was printed.`,
    );
  }
  let lastInk = -1;
  for (let y = height - 1; y >= 0; y -= 1) {
    if (rows[y]) {
      lastInk = y;
      break;
    }
  }
  if (lastInk < Math.floor(measured.endTop)) {
    throw new Error(
      "The end of the ticket is missing from the print. Nothing was printed.",
    );
  }
}

/**
 * One offscreen window, reused for the life of the process.
 *
 * Chromium refuses to start a new offscreen surface immediately after the
 * previous one is torn down, which fails the very next ticket — and an order
 * prints two tickets back to back. Keeping the window alive also skips the
 * surface setup on every order.
 */
let rasterWindow = null;

function rasterSurface() {
  if (rasterWindow && !rasterWindow.isDestroyed()) return rasterWindow;
  rasterWindow = new BrowserWindow({
    show: false,
    width: PRINTER_DOTS,
    height: SLICE_DOTS,
    useContentSize: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      zoomFactor: 1,
      offscreen: { deviceScaleFactor: 1 },
    },
  });
  rasterWindow.on("closed", () => {
    rasterWindow = null;
  });
  return rasterWindow;
}

/** Frees the render surface. Call on quit; the next ticket makes a new one. */
function disposeRasterSurface() {
  if (rasterWindow && !rasterWindow.isDestroyed()) rasterWindow.destroy();
  rasterWindow = null;
}

/**
 * Render at printer resolution offscreen and capture the ticket a screenful at
 * a time.
 *
 * Windows caps a window at the size of the screen, so a till on a 1024x768
 * panel gives a 720-row viewport no matter what was asked for. Slices are
 * therefore as tall as the viewport really is, read back from the page, and a
 * capture that comes back the wrong size is an error: rescaling it to the
 * requested slice stretched the ticket and threw away everything below the
 * fold, which is how a kitchen ticket came out 1.4x too tall and missing its
 * last items.
 */
async function receiptRaster(html, { sliceDots = SLICE_DOTS } = {}) {
  const win = rasterSurface();
  try {
    await loadDocument(win, html);
    const measured = await win.webContents.executeJavaScript(MEASURE_SCRIPT);
    assertMeasurement(measured);

    const view = measured.view || {};
    if (view.width !== PRINTER_DOTS) {
      throw new Error(
        `The ticket needs ${PRINTER_DOTS} dots across but this screen only gives ${view.width}. Use a display at least 1024 pixels wide.`,
      );
    }
    const slice = Math.min(sliceDots, view.height);
    if (!Number.isFinite(slice) || slice < 16) {
      throw new Error("This screen is too small to render a ticket.");
    }

    const height = measured.height + BOTTOM_GUARD_DOTS;
    const bitmap = Buffer.alloc(PRINTER_DOTS * height * 4, 255);
    for (let top = 0; top < height; top += slice) {
      const rows = Math.min(slice, height - top);
      await win.webContents.executeJavaScript(
        `new Promise((resolve) => {
          document.body.style.transform = 'translateY(${-top}px)';
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        })`,
      );
      win.webContents.invalidate();
      const image = await win.webContents.capturePage({
        x: 0,
        y: 0,
        width: PRINTER_DOTS,
        height: rows,
      });
      if (image.isEmpty()) throw new Error("Could not render the ticket.");
      const size = image.getSize();
      const pixels = image.toBitmap();
      if (
        size.width !== PRINTER_DOTS ||
        size.height !== rows ||
        pixels.length !== PRINTER_DOTS * rows * 4
      ) {
        throw new Error(
          `The screen capture came back as ${size.width}x${size.height} instead of ${PRINTER_DOTS}x${rows}. Set the display to 100% scaling and at least 1024x768, then reprint.`,
        );
      }
      pixels.copy(bitmap, top * PRINTER_DOTS * 4);
    }

    verifyRaster(bitmap, height, measured);
    return encodeReceipt(bitmap, PRINTER_DOTS, height);
  } finally {
    // Leave nothing of this order on screen for the next one to capture.
    if (!win.isDestroyed()) {
      await win.webContents
        .loadURL("data:text/html;charset=utf-8,%3Chtml%3E%3C/html%3E")
        .catch(() => {});
    }
  }
}

let queue = Promise.resolve();

/** One ticket, start to finish. Jobs are serialised so slips cannot interleave. */
function printReceipt(html, deviceName) {
  const job = queue.then(async () => {
    let win;
    try {
      if (!deviceName) throw new Error("Choose and save a receipt printer first.");
      if (process.platform === "win32") {
        // Windows POS queues often use the Generic / Text Only driver, which
        // cannot print Chromium pages. Send ESC/POS directly, then feed and cut.
        const printers = await webContentsPrinters();
        if (!printers.some((printer) => printer.name === deviceName)) {
          throw new Error(
            `Printer "${deviceName}" is not available. Reconnect it and refresh the printer list.`,
          );
        }
        return await sendRawReceipt(deviceName, await receiptRaster(html));
      }
      const prepared = await prepareReceiptWindow(html);
      win = prepared.win;
      const printers = await win.webContents.getPrintersAsync();
      if (!printers.some((printer) => printer.name === deviceName)) {
        throw new Error(
          `Printer "${deviceName}" is not available. Reconnect it and refresh the printer list.`,
        );
      }
      return await new Promise((resolve) => {
        const timer = setTimeout(
          () =>
            resolve({
              ok: false,
              error:
                "Printer did not respond within 45 seconds. Check its queue before reprinting to avoid a duplicate.",
            }),
          45000,
        );
        const finish = (result) => {
          clearTimeout(timer);
          resolve(result);
        };
        try {
          win.webContents.print(
            {
              silent: true,
              printBackground: true,
              deviceName,
              margins: { marginType: "none" },
              pageSize: prepared.pageSize,
              scaleFactor: 100,
              copies: 1,
              color: false,
              duplexMode: "simplex",
            },
            (ok, reason) =>
              finish({
                ok,
                error: ok ? undefined : reason || "The printer rejected the job.",
              }),
          );
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

module.exports = {
  disposeRasterSurface,
  prepareReceiptWindow,
  receiptRaster,
  printReceipt,
  PRINTER_DOTS,
  CSS_PIXELS_PER_DOT,
};
