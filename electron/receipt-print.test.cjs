// Run with Electron: exercises Chromium layout and the real receipt print module.
const { app, BrowserWindow, nativeImage } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { captureReceipt, prepareReceiptWindow, receiptRaster, printReceipt } = require('./receipt-print.cjs');
const { encodeReceipt } = require('./escpos.cjs');
const { sendRawReceipt } = require('./windows-raw.cjs');

// Turn GS v 0 bands back into an image, so tests check the bytes the printer receives.
function decodeRaster(raw) {
  const bands = [];
  for (let i = 0; i < raw.length - 7; i++) {
    if (raw[i] !== 0x1d || raw[i + 1] !== 0x76 || raw[i + 2] !== 0x30) continue;
    const stride = raw[i + 4] | raw[i + 5] << 8;
    const rows = raw[i + 6] | raw[i + 7] << 8;
    bands.push({ stride, rows, data: raw.subarray(i + 8, i + 8 + stride * rows) });
    i += 7 + stride * rows;
  }
  const width = bands[0].stride * 8;
  const height = bands.reduce((sum, band) => sum + band.rows, 0);
  const bitmap = Buffer.alloc(width * height * 4, 255);
  let y0 = 0;
  for (const band of bands) {
    for (let y = 0; y < band.rows; y++) for (let x = 0; x < width; x++) {
      if (band.data[y * band.stride + (x >> 3)] & (0x80 >> (x % 8))) bitmap.fill(0, ((y0 + y) * width + x) * 4, ((y0 + y) * width + x) * 4 + 3);
    }
    y0 += band.rows;
  }
  return nativeImage.createFromBitmap(bitmap, { width, height });
}

function inkRows(image) {
  const { width, height } = image.getSize();
  const bitmap = image.toBitmap();
  const rows = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) if (bitmap[(y * width + x) * 4] === 0) { rows.push(y); break; }
  }
  return rows;
}

app.whenReady().then(async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'tryo-receipt-test-'));
  const source = new BrowserWindow({ show: false });
  try {
    let previousHeight = 0;
    for (const count of [1, 60, 150]) {
      const rows = Array.from({ length: count }, (_, i) => `<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>ITEM ${i + 1}</span><span>£12.34</span></div>`).join('');
      await source.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<html><body style="height:640px;overflow:hidden"><p>DO NOT PRINT THE TILL</p><div id="receipt-print-root" style="position:fixed;left:-10000px;width:72mm"><div class="receipt-paper" style="width:72mm;padding:8mm 4mm;box-sizing:border-box;font:11px/1.4 monospace">${rows}<svg width="112" height="112"><rect width="112" height="112" fill="black"/></svg><p>END OF RECEIPT</p></div></div></body></html>`));
      const markup = await captureReceipt(source.webContents);
      assert(!markup.includes('DO NOT PRINT THE TILL'));
      assert(markup.includes('<svg'));
      const raw = await receiptRaster(markup);
      assert.deepEqual([...raw.subarray(-7)], [0x1b, 0x64, 6, 0x1d, 0x56, 0x42, 0]);
      const image = decodeRaster(raw);
      assert.equal(image.getSize().width, 576);
      fs.writeFileSync(path.join(output, `receipt-${count}.png`), image.toPNG());
      // The last line must survive: ink within the final 20mm (160 dots) of the raster.
      assert(Math.max(...inkRows(image)) > image.getSize().height - 160, `bottom of receipt missing: ${output}`);
      const { win, pageSize } = await prepareReceiptWindow(markup);
      try {
        assert.equal(pageSize.width, 80000);
        assert(pageSize.height > previousHeight);
        previousHeight = pageSize.height;
        const pdf = await win.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true,
          pageSize: { width: pageSize.width / 25400, height: pageSize.height / 25400 },
          margins: { top: 0, bottom: 0, left: 0, right: 0 } });
        // Chromium's PDF page objects are uncompressed. A long order must remain one page.
        assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 1);
        console.log(`PASS ${count} lines: ESC/POS ${image.getSize().height} dots; PDF one 80mm × ${pageSize.height / 1000}mm page`);
      } finally { win.destroy(); }
    }
    const missing = await printReceipt('<p>Test</p>', 'TRYO-NONEXISTENT-PRINTER');
    assert.equal(missing.ok, false);
    assert.match(missing.error, /not available/);
    const blank = new BrowserWindow({ show: false });
    try {
      await blank.loadURL('about:blank');
      await assert.rejects(captureReceipt(blank.webContents), /No receipt/);
    } finally { blank.destroy(); }
    console.log(`PASS missing printer and absent receipt errors. PDFs: ${output}`);
    const black = Buffer.from([0,0,0,255]);
    const encoded = encodeReceipt(black, 1, 1);
    assert.equal(encoded[12], 0x80);
    assert.deepEqual([...encoded.subarray(-7)], [27,100,6,29,86,66,0]);
    if (process.platform === 'win32') {
      const result = await sendRawReceipt('TRYO-NONEXISTENT-PRINTER', encoded);
      assert.equal(result.ok, false);
      assert.match(result.error, /printer name is invalid/i);
      console.log('PASS Windows RAW bridge compiled and returned real spooler error.');
    }
  } finally { source.destroy(); }
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
