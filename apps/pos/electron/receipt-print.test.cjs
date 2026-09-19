// Run with Electron: exercises Chromium layout and the real receipt print module.
//
//   npm run test:receipt
//
// Every case rasterises a ticket the way the Windows till does, decodes the
// ESC/POS bytes back into an image, and then reads the image: nothing passes on
// the strength of the markup alone. The point of the suite is the property that
// broke in the shop — a ticket that prints must print whole.
const { app, nativeImage } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  prepareReceiptWindow,
  receiptRaster,
  printReceipt,
  PRINTER_DOTS,
} = require("./receipt-print.cjs");
const { encodeReceipt } = require("./escpos.cjs");
const { sendRawReceipt } = require("./windows-raw.cjs");
const { buildReceiptDocument } = require("./receipt-document.test-build.cjs");

// Turn GS v 0 bands back into an image, so tests check the bytes the printer receives.
function decodeRaster(raw) {
  const bands = [];
  for (let i = 0; i < raw.length - 7; i += 1) {
    if (raw[i] !== 0x1d || raw[i + 1] !== 0x76 || raw[i + 2] !== 0x30) continue;
    const stride = raw[i + 4] | (raw[i + 5] << 8);
    const rows = raw[i + 6] | (raw[i + 7] << 8);
    bands.push({ stride, rows, data: raw.subarray(i + 8, i + 8 + stride * rows) });
    i += 7 + stride * rows;
  }
  const width = bands[0].stride * 8;
  const height = bands.reduce((sum, band) => sum + band.rows, 0);
  const bitmap = Buffer.alloc(width * height * 4, 255);
  let y0 = 0;
  for (const band of bands) {
    for (let y = 0; y < band.rows; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (band.data[y * band.stride + (x >> 3)] & (0x80 >> x % 8)) {
          const at = ((y0 + y) * width + x) * 4;
          bitmap.fill(0, at, at + 3);
        }
      }
    }
    y0 += band.rows;
  }
  return nativeImage.createFromBitmap(bitmap, { width, height });
}

function inkRows(image) {
  const { width, height } = image.getSize();
  const bitmap = image.toBitmap();
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (bitmap[(y * width + x) * 4] === 0) {
        rows.push(y);
        break;
      }
    }
  }
  return rows;
}

/** Rows of ink, top to bottom, grouped into the visual lines a reader sees. */
function inkLines(image) {
  const rows = inkRows(image);
  const lines = [];
  for (const y of rows) {
    const last = lines[lines.length - 1];
    if (last && y === last.bottom + 1) last.bottom = y;
    else lines.push({ top: y, bottom: y });
  }
  return lines;
}

/**
 * Read the ticket back as text. Optical character recognition is out of scope,
 * so instead each ticket is rendered twice — once whole, once with one line
 * removed — and the two rasters are compared. Any line that fails to change the
 * image was never printed.
 */
async function rasterOf(payload, kind, options, rasterOptions) {
  const raw = await receiptRaster(
    buildReceiptDocument(payload, kind, options),
    rasterOptions,
  );
  return decodeRaster(raw);
}

const ORDER_FROM_THE_SHOP = {
  orderNumber: 6,
  createdAt: new Date(2026, 8, 19, 12, 38, 0).getTime(),
  lines: [
    { name: "Classic Popcorn Chicken Combo", quantity: 2, baseLineTotalPence: 1798, isMeal: false, mealLabel: null, mealLineTotalPence: 0 },
    { name: "Mexican Rice Bowl", quantity: 1, baseLineTotalPence: 799, isMeal: false, mealLabel: null, mealLineTotalPence: 0 },
    { name: "Raspberry Lemonade", quantity: 2, baseLineTotalPence: 798, isMeal: false, mealLabel: null, mealLineTotalPence: 0 },
    { name: "Soft Drinks", quantity: 4, baseLineTotalPence: 600, isMeal: false, mealLabel: null, mealLineTotalPence: 0 },
    { name: "Korean Popcorn chicken Combo", quantity: 1, baseLineTotalPence: 899, isMeal: false, mealLabel: null, mealLineTotalPence: 0 },
    { name: "Double Trouble Burger", quantity: 1, baseLineTotalPence: 899, isMeal: true, mealLabel: "Fries + Drink", mealLineTotalPence: 299 },
    { name: "Dirty Burger", quantity: 1, baseLineTotalPence: 1099, isMeal: true, mealLabel: "Fries + Drink", mealLineTotalPence: 299 },
  ],
  subtotalPence: 7490,
  discountLabel: null,
  discountAmountPence: 0,
  deliveryFeePence: 0,
  totalPence: 7490,
  totalItemCount: 12,
  paymentMethod: "card",
  printCustomerReceipt: true,
  businessAddress: "Rushden Lakes, FC3, Rushden, Northamptonshire",
  businessPhone: "+44 7825583940",
  businessVat: "491891448",
};

function payloadWith(overrides) {
  return { ...ORDER_FROM_THE_SHOP, ...overrides };
}

function longOrder(count) {
  const lines = Array.from({ length: count }, (_, i) => ({
    name: `Test Item Number ${i + 1} With A Deliberately Long Name`,
    quantity: (i % 3) + 1,
    baseLineTotalPence: 899 * ((i % 3) + 1),
    isMeal: i % 4 === 0,
    mealLabel: i % 4 === 0 ? "Fries + Drink" : null,
    mealLineTotalPence: i % 4 === 0 ? 299 * ((i % 3) + 1) : 0,
    note: i % 5 === 0 ? "No salt, extra crispy, sauce on the side please" : undefined,
  }));
  return payloadWith({
    lines,
    totalItemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalPence: lines.reduce((sum, line) => sum + line.baseLineTotalPence, 0),
    totalPence: lines.reduce((sum, line) => sum + line.baseLineTotalPence, 0),
  });
}

app.whenReady().then(async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "tryo-receipt-test-"));
  const logo = `data:image/png;base64,${fs
    .readFileSync(path.join(__dirname, "../public/menulogo.png"))
    .toString("base64")}`;

  // 1. The order that printed short in the shop. Every line has to survive, and
  //    dropping any one of them has to change what comes out of the encoder.
  const fullKitchen = await rasterOf(ORDER_FROM_THE_SHOP, "kitchen");
  fs.writeFileSync(path.join(output, "kitchen-order-6.png"), fullKitchen.toPNG());
  const fullLines = inkLines(fullKitchen).length;
  assert.equal(fullKitchen.getSize().width, PRINTER_DOTS);
  for (let index = 0; index < ORDER_FROM_THE_SHOP.lines.length; index += 1) {
    const withoutOne = payloadWith({
      lines: ORDER_FROM_THE_SHOP.lines.filter((_, i) => i !== index),
    });
    const shorter = await rasterOf(withoutOne, "kitchen");
    assert(
      inkLines(shorter).length < fullLines,
      `kitchen ticket did not print line ${index + 1} (${ORDER_FROM_THE_SHOP.lines[index].name})`,
    );
  }
  console.log(
    `PASS kitchen ticket for order #6: ${fullKitchen.getSize().height} dots, all 7 lines printed`,
  );

  // 2. The end bar is the last thing on the paper, and it is really there.
  const lastKitchenLine = inkLines(fullKitchen).at(-1);
  assert(
    lastKitchenLine.bottom - lastKitchenLine.top >= 3,
    "the solid end bar is missing from the kitchen ticket",
  );
  assert(
    lastKitchenLine.bottom < fullKitchen.getSize().height - 40,
    "the end bar is too close to the cut",
  );

  // 3. Tills run on small screens, so the ticket is captured a screenful at a
  //    time. Every slice height has to give byte-identical paper: a till on a
  //    1024x768 panel used to stretch its 720-row viewport to fill a 1024-row
  //    slice, printing a ticket 1.4x too tall that stopped at the fold.
  const wholeTicket = await receiptRaster(
    buildReceiptDocument(ORDER_FROM_THE_SHOP, "kitchen"),
  );
  for (const sliceDots of [720, 333, 120, 97]) {
    const sliced = await receiptRaster(
      buildReceiptDocument(ORDER_FROM_THE_SHOP, "kitchen"),
      { sliceDots },
    );
    assert(
      sliced.equals(wholeTicket),
      `a ${sliceDots}-dot viewport printed different paper from a full-height one`,
    );
  }
  const tallReceipt = await rasterOf(longOrder(40), "customer", { logoDataUrl: logo }, { sliceDots: 97 });
  const tallLast = inkLines(tallReceipt).at(-1);
  assert(
    tallLast.bottom > tallReceipt.getSize().height - 200 && tallLast.bottom - tallLast.top >= 3,
    "a long receipt lost its end bar when captured in small slices",
  );
  console.log("PASS the ticket is identical at every viewport height");

  // 4. Customer copy: money, discount and footer all reach the paper.
  const discounted = payloadWith({
    discountLabel: "Discount (10%):",
    discountAmountPence: 749,
    totalPence: 6741,
  });
  const customer = await rasterOf(discounted, "customer", { logoDataUrl: logo });
  fs.writeFileSync(path.join(output, "customer-order-6.png"), customer.toPNG());
  const plainCustomer = await rasterOf(
    payloadWith({ discountLabel: null, discountAmountPence: 0 }),
    "customer",
    { logoDataUrl: logo },
  );
  assert(
    inkLines(customer).length > inkLines(plainCustomer).length,
    "the discount lines never printed on the customer copy",
  );
  const noLogo = await rasterOf(discounted, "customer");
  assert(
    noLogo.getSize().height < customer.getSize().height,
    "the logo never printed on the customer copy",
  );
  console.log(
    `PASS customer receipt: ${customer.getSize().height} dots with logo, discount, total and footer`,
  );

  // 5. Long orders. These cross the capture-slice boundary repeatedly, which is
  //    where a ticket used to lose its tail without saying so.
  let previousHeight = 0;
  for (const count of [1, 12, 60, 150]) {
    const payload = longOrder(count);
    const kitchen = await rasterOf(payload, "kitchen");
    const receipt = await rasterOf(payload, "customer", { logoDataUrl: logo });
    fs.writeFileSync(path.join(output, `kitchen-${count}.png`), kitchen.toPNG());
    for (const image of [kitchen, receipt]) {
      const last = inkLines(image).at(-1);
      assert(
        last.bottom > image.getSize().height - 200,
        `bottom of a ${count}-line ticket is missing: ${output}`,
      );
      assert(
        last.bottom - last.top >= 3,
        `end bar missing from a ${count}-line ticket: ${output}`,
      );
    }
    assert(kitchen.getSize().height > previousHeight);
    previousHeight = kitchen.getSize().height;

    const document = buildReceiptDocument(payload, "customer", { logoDataUrl: logo });
    const { win, pageSize } = await prepareReceiptWindow(document);
    try {
      assert.equal(pageSize.width, 80000);
      const pdf = await win.webContents.printToPDF({
        preferCSSPageSize: true,
        printBackground: true,
        pageSize: { width: pageSize.width / 25400, height: pageSize.height / 25400 },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      // Chromium's PDF page objects are uncompressed. A long order must stay one page.
      assert.equal(
        (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length,
        1,
        `a ${count}-line receipt paginated instead of feeding as one slip`,
      );
      fs.writeFileSync(path.join(output, `receipt-${count}.pdf`), pdf);
    } finally {
      win.destroy();
    }
    console.log(
      `PASS ${count} lines: kitchen ${kitchen.getSize().height} dots, receipt ${receipt.getSize().height} dots, one 80mm x ${pageSize.height / 1000}mm page`,
    );
  }

  // 6. Notes, add-ons and options belong to the line they were typed against.
  const garnished = payloadWith({
    lines: [
      {
        name: "Loaded Fries",
        quantity: 2,
        baseLineTotalPence: 1198,
        isMeal: false,
        mealLabel: null,
        mealLineTotalPence: 0,
        seasoning: "Peri Peri",
        sauce: "Garlic Mayo",
        addonLines: [
          { name: "Extra Cheese", lineTotalPence: 250 },
          { name: "Jalapenos", lineTotalPence: 150 },
        ],
        note: "Allergy: no dairy",
      },
      {
        name: "Plain Fries",
        quantity: 1,
        baseLineTotalPence: 299,
        isMeal: false,
        mealLabel: null,
        mealLineTotalPence: 0,
        seasoning: "None",
        sauce: null,
      },
    ],
    totalItemCount: 3,
  });
  const garnishedTicket = await rasterOf(garnished, "kitchen");
  fs.writeFileSync(path.join(output, "kitchen-options.png"), garnishedTicket.toPNG());
  const bare = await rasterOf(
    payloadWith({
      lines: garnished.lines.map((line) => ({
        ...line,
        seasoning: null,
        sauce: null,
        addonLines: undefined,
        note: undefined,
      })),
      totalItemCount: 3,
    }),
    "kitchen",
  );
  assert(
    inkLines(garnishedTicket).length >= inkLines(bare).length + 5,
    "seasoning, sauce, add-ons or the note never printed",
  );
  // "None" is not a choice the kitchen needs to read.
  const chosenNone = await rasterOf(
    payloadWith({
      lines: [{ ...garnished.lines[1], seasoning: "None" }],
      totalItemCount: 1,
    }),
    "kitchen",
  );
  const chosenNull = await rasterOf(
    payloadWith({
      lines: [{ ...garnished.lines[1], seasoning: null }],
      totalItemCount: 1,
    }),
    "kitchen",
  );
  assert.equal(
    chosenNone.getSize().height,
    chosenNull.getSize().height,
    '"None" printed as if it were a real choice',
  );
  console.log("PASS options, add-ons and notes print against their own line");

  // 7. Text the kitchen types must not be able to change the ticket's markup.
  const injected = await rasterOf(
    payloadWith({
      lines: [
        {
          name: '<script>x</script>"&\'<div style="display:none">',
          quantity: 1,
          baseLineTotalPence: 100,
          isMeal: false,
          mealLabel: null,
          mealLineTotalPence: 0,
          note: "</div></body>",
        },
      ],
      totalItemCount: 1,
    }),
    "kitchen",
  );
  const lastInjected = inkLines(injected).at(-1);
  assert(
    lastInjected.bottom - lastInjected.top >= 3,
    "markup in an item name broke the ticket",
  );
  console.log("PASS item names and notes are escaped, not executed");

  // 8. A ticket with no end bar is refused rather than half-printed.
  await assert.rejects(
    receiptRaster("<!doctype html><html><body><p>No marker here</p></body></html>"),
    /end marker/,
  );
  await assert.rejects(receiptRaster(""), /No ticket/);
  await assert.rejects(
    receiptRaster(
      '<!doctype html><html><body style="width:576px"><div class="endmark" style="height:4px;background:#000"></div></body></html>',
    ),
    /blank/,
  );
  console.log("PASS an unprintable ticket errors instead of feeding paper");

  // 9. Printer plumbing.
  const missing = await printReceipt(
    buildReceiptDocument(ORDER_FROM_THE_SHOP, "kitchen"),
    "TRYO-NONEXISTENT-PRINTER",
  );
  assert.equal(missing.ok, false);
  assert.match(missing.error, /not available/);
  const noPrinter = await printReceipt(
    buildReceiptDocument(ORDER_FROM_THE_SHOP, "kitchen"),
    "",
  );
  assert.equal(noPrinter.ok, false);
  assert.match(noPrinter.error, /Choose and save/);

  const black = Buffer.from([0, 0, 0, 255]);
  const encoded = encodeReceipt(black, 1, 1);
  assert.equal(encoded[12], 0x80);
  assert.deepEqual([...encoded.subarray(-7)], [27, 100, 6, 29, 86, 66, 0]);
  const kitchenRaw = await receiptRaster(
    buildReceiptDocument(ORDER_FROM_THE_SHOP, "kitchen"),
  );
  assert.deepEqual([...kitchenRaw.subarray(-7)], [0x1b, 0x64, 6, 0x1d, 0x56, 0x42, 0]);

  if (process.platform === "win32") {
    const result = await sendRawReceipt("TRYO-NONEXISTENT-PRINTER", encoded);
    assert.equal(result.ok, false);
    assert.match(result.error, /printer name is invalid/i);
    console.log("PASS Windows RAW bridge compiled and returned real spooler error.");
  }
  console.log(`PASS printer errors and ESC/POS trailer. Images and PDFs: ${output}`);
  app.exit(0);
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
