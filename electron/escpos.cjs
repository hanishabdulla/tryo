// BGRA pixels from Electron nativeImage -> ESC/POS raster bands (GS v 0).
function encodeReceipt(bitmap, width, height) {
  if (!Number.isInteger(width) || width < 1 || width > 576 ||
      !Number.isInteger(height) || height < 1 || bitmap.length !== width * height * 4) {
    throw new Error('Invalid receipt bitmap');
  }
  const stride = Math.ceil(width / 8);
  const chunks = [Buffer.from([0x1b, 0x40, 0x1b, 0x32])]; // initialize, default line spacing
  for (let top = 0; top < height; top += 128) {
    const rows = Math.min(128, height - top);
    const pixels = Buffer.alloc(stride * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < width; x++) {
        const offset = ((top + y) * width + x) * 4;
        const alpha = bitmap[offset + 3] / 255;
        const grey = (bitmap[offset] + bitmap[offset + 1] + bitmap[offset + 2]) / 3;
        if (grey * alpha + 255 * (1 - alpha) < 160) {
          pixels[y * stride + (x >> 3)] |= 0x80 >> (x % 8);
        }
      }
    }
    chunks.push(Buffer.from([0x1d, 0x76, 0x30, 0, stride & 255, stride >> 8, rows, 0]), pixels);
  }
  // Feed the last lines past the print head and tear bar, then partial cut.
  // Printers without a cutter ignore GS V.
  chunks.push(Buffer.from([0x1b, 0x64, 6, 0x1d, 0x56, 0x42, 0]));
  return Buffer.concat(chunks);
}
module.exports = { encodeReceipt };
