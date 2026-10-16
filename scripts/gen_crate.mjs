import fs from "fs";
import zlib from "zlib";

function createPng(width, height, getPixel) {
  const lineSize = 1 + width * 4;
  const rawData = Buffer.alloc(lineSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * lineSize;
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const toCrc = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(toCrc), 0);
    return Buffer.concat([len, toCrc, crcBuf]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    sig,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

// Draw Ammo Crate
const W = 40;
const H = 34;
const pixels = Array.from({ length: H }, () => Array.from({ length: W }, () => [0, 0, 0, 0]));

for (let y = 2; y < H - 2; y++) {
  for (let x = 2; x < W - 2; x++) {
    // Military olive green crate with wood grain & stenciled text
    pixels[y][x] = [75, 88, 54, 255];
  }
}
// Dark border & metal corner brackets
for (let y = 2; y < H - 2; y++) {
  pixels[y][2] = [20, 25, 15, 255];
  pixels[y][W - 3] = [20, 25, 15, 255];
}
for (let x = 2; x < W - 2; x++) {
  pixels[2][x] = [20, 25, 15, 255];
  pixels[H - 3][x] = [20, 25, 15, 255];
  pixels[Math.floor(H / 2)][x] = [35, 42, 25, 255];
}
// Metal brackets in corners
const corners = [[2, 2], [W - 8, 2], [2, H - 8], [W - 8, H - 8]];
for (const [cx, cy] of corners) {
  for (let dy = 0; dy < 6; dy++) {
    for (let dx = 0; dx < 6; dx++) {
      pixels[cy + dy][cx + dx] = [45, 48, 50, 255];
    }
  }
}
// Yellow hazard / explosive skull symbol
for (let y = 10; y < 22; y++) {
  for (let x = 14; x < 26; x++) {
    if (Math.hypot(x - 20, y - 15) < 5) {
      pixels[y][x] = [240, 200, 30, 255];
    }
  }
}

const png = createPng(W, H, (x, y) => pixels[y][x]);
fs.writeFileSync("public/sprites/ammocrate.png", png);
console.log("Generated public/sprites/ammocrate.png");
