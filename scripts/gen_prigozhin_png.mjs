import fs from "fs";
import zlib from "zlib";

// Pure Node.js PNG encoder
function createPng(width, height, getPixel) {
  // Each scanline begins with a filter byte (0 = None)
  const lineSize = 1 + width * 4;
  const rawData = Buffer.alloc(lineSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * lineSize;
    rawData[rowOffset] = 0; // Filter: None
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

  // IHDR: width, height, bit depth (8), color type (6 = RGBA), compression (0), filter (0), interlace (0)
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

// Generate Big Zombie Prigožin Clone pixel-art sprite
const W = 160;
const H = 200;

// Pixel drawing buffer
const pixels = Array.from({ length: H }, () => Array.from({ length: W }, () => [0, 0, 0, 0]));

function setPx(x, y, r, g, b, a = 255) {
  if (x >= 0 && x < W && y >= 0 && y < H) {
    pixels[y][x] = [r, g, b, a];
  }
}

function fillRect(x0, y0, w, h, r, g, b, a = 255) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      setPx(x, y, r, g, b, a);
    }
  }
}

function fillCircle(cx, cy, radius, r, g, b, a = 255) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) {
        setPx(x, y, r, g, b, a);
      }
    }
  }
}

// 1. Zombie Greenish Aura Glow
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - 80, y - 95);
    if (d < 82) {
      const alpha = Math.max(0, Math.floor((1 - d / 82) * 55));
      setPx(x, y, 40, 220, 60, alpha);
    }
  }
}

// 2. Huge Sledgehammer on the right/back
// Handle (tilted)
for (let t = 0; t < 120; t++) {
  const hx = Math.round(110 + t * 0.35);
  const hy = Math.round(20 + t * 1.3);
  fillRect(hx - 2, hy, 5, 2, 90, 50, 25);
  fillRect(hx - 3, hy, 1, 2, 30, 15, 8); // shadow
}
// Hammer head
fillRect(100, 14, 42, 32, 70, 75, 82);
fillRect(98, 18, 46, 24, 90, 95, 102);
fillRect(102, 16, 38, 2, 160, 170, 180); // highlight
fillRect(98, 38, 46, 4, 40, 42, 48); // shadow
// Hammer skull emblem
fillCircle(121, 30, 6, 230, 230, 230);
fillRect(118, 33, 6, 4, 230, 230, 230);
setPx(119, 29, 20, 20, 20);
setPx(123, 29, 20, 20, 20);

// 3. Legs & Heavy Combat Boots
// Legs (Camo cargo pants with blood/dirt)
fillRect(50, 140, 24, 38, 65, 75, 52);
fillRect(86, 140, 24, 38, 65, 75, 52);
// Spiked kneepads
fillRect(48, 152, 26, 14, 35, 38, 32);
fillRect(86, 152, 26, 14, 35, 38, 32);
// Metal spike
fillRect(60, 149, 4, 4, 200, 200, 200);
fillRect(98, 149, 4, 4, 200, 200, 200);
// Boots
fillRect(44, 174, 32, 20, 22, 22, 24);
fillRect(40, 184, 38, 10, 15, 15, 16);
fillRect(84, 174, 32, 20, 22, 22, 24);
fillRect(82, 184, 38, 10, 15, 15, 16);

// 4. Massive Muscular Zombie Torso & Tactical Vest
// Tactical Body Armor (Plate Carrier)
fillRect(36, 75, 88, 70, 52, 48, 40);
// Outline
for (let y = 75; y <= 145; y++) {
  setPx(35, y, 15, 15, 12);
  setPx(124, y, 15, 15, 12);
}
// Molle webbing straps
fillRect(42, 88, 76, 4, 32, 28, 22);
fillRect(42, 102, 76, 4, 32, 28, 22);
fillRect(42, 116, 76, 4, 32, 28, 22);
// Ammo Pouches (WHERE IS THE AMMUNITION?!)
fillRect(44, 122, 20, 22, 40, 36, 28);
fillRect(70, 122, 20, 22, 40, 36, 28);
fillRect(96, 122, 20, 22, 40, 36, 28);
// Red tactical lettering: "AMMO?!"
// A
fillRect(48, 92, 4, 8, 255, 40, 40);
fillRect(54, 92, 4, 8, 255, 40, 40);
fillRect(48, 92, 10, 3, 255, 40, 40);
fillRect(48, 96, 10, 2, 255, 40, 40);
// M
fillRect(62, 92, 3, 8, 255, 40, 40);
fillRect(71, 92, 3, 8, 255, 40, 40);
fillRect(65, 94, 3, 4, 255, 40, 40);
fillRect(68, 94, 3, 4, 255, 40, 40);
// M
fillRect(77, 92, 3, 8, 255, 40, 40);
fillRect(86, 92, 3, 8, 255, 40, 40);
fillRect(80, 94, 3, 4, 255, 40, 40);
fillRect(83, 94, 3, 4, 255, 40, 40);
// O
fillRect(92, 92, 9, 8, 255, 40, 40);
fillRect(94, 94, 5, 4, 52, 48, 40);
// !
fillRect(104, 92, 3, 5, 255, 40, 40);
fillRect(104, 98, 3, 2, 255, 40, 40);

// 5. Heavy Muscular Zombie Arms
// Left Arm (bicep, mutated veins)
fillCircle(30, 96, 14, 125, 155, 115);
fillCircle(24, 120, 12, 115, 145, 105);
fillCircle(22, 138, 10, 100, 130, 90);
// Green zombie veins
setPx(28, 92, 40, 240, 60);
setPx(29, 93, 40, 240, 60);
setPx(27, 95, 40, 240, 60);
setPx(25, 116, 40, 240, 60);
setPx(24, 118, 40, 240, 60);

// Right Arm (holding sledgehammer)
fillCircle(130, 96, 14, 125, 155, 115);
fillCircle(136, 118, 12, 115, 145, 105);
fillCircle(138, 136, 10, 100, 130, 90);
// Green zombie veins
setPx(132, 92, 40, 240, 60);
setPx(133, 94, 40, 240, 60);
setPx(135, 115, 40, 240, 60);

// 6. Bull Neck with Stitches & Gold Chain
fillRect(64, 60, 32, 20, 120, 150, 110);
// Zombie Stitches
fillRect(66, 68, 28, 2, 30, 45, 25);
for (let sx = 68; sx <= 92; sx += 6) {
  fillRect(sx, 65, 2, 7, 30, 45, 25);
}
// Broken Gold chain
fillRect(68, 76, 24, 3, 220, 180, 40);

// 7. Iconic Bald Head, Scars, Angry Zombie Face
// Head shape
for (let y = 18; y <= 62; y++) {
  const normY = (y - 40) / 22;
  const radX = Math.round(Math.sqrt(Math.max(0, 1 - normY * normY)) * 26);
  fillRect(80 - radX, y, radX * 2, 1, 135, 165, 122);
}
// Head shading & wrinkles
for (let wx = 65; wx <= 95; wx++) {
  setPx(wx, 26, 95, 120, 85);
  setPx(wx, 30, 95, 120, 85);
}
// Bloody battle scar across forehead
for (let sc = 0; sc < 18; sc++) {
  setPx(68 + sc, 24 + Math.round(sc * 0.5), 180, 25, 25);
  setPx(68 + sc, 25 + Math.round(sc * 0.5), 100, 10, 10);
}

// Heavy furrowed brow
fillRect(62, 36, 16, 4, 45, 60, 38);
fillRect(82, 36, 16, 4, 45, 60, 38);
// Slanted angry eyebrows
for (let b = 0; b < 6; b++) {
  fillRect(64 + b * 2, 36 + b, 3, 3, 30, 40, 25);
  fillRect(94 - b * 2, 36 + b, 3, 3, 30, 40, 25);
}

// Glowing Zombie Eyes (Red/Neon Green)
fillCircle(71, 44, 4, 255, 30, 30);
fillCircle(71, 44, 2, 50, 255, 50);
setPx(71, 44, 255, 255, 255); // glint

fillCircle(89, 44, 4, 255, 30, 30);
fillCircle(89, 44, 2, 50, 255, 50);
setPx(89, 44, 255, 255, 255); // glint

// Broad Pugnacious Nose
fillRect(77, 42, 6, 12, 110, 140, 100);
fillRect(74, 50, 12, 4, 100, 130, 90);
setPx(76, 53, 30, 40, 25);
setPx(84, 53, 30, 40, 25);

// Roaring / Shouting Open Mouth ("GERASIMOV! SHOIGU!")
fillRect(68, 56, 24, 14, 30, 10, 10);
// Sharp Zombie Teeth (top & bottom)
for (let tx = 69; tx < 91; tx += 3) {
  fillRect(tx, 56, 2, 3, 235, 230, 180);
  fillRect(tx, 67, 2, 3, 235, 230, 180);
}
// Tongue
fillRect(76, 64, 8, 4, 160, 50, 50);

// Ears & Radio Earpiece
fillRect(52, 40, 4, 10, 110, 140, 100);
fillRect(104, 40, 4, 10, 110, 140, 100);
fillRect(50, 42, 3, 6, 20, 20, 20); // tactical earpiece

// Generate PNG
const pngBuffer = createPng(W, H, (x, y) => pixels[y][x]);
fs.writeFileSync("public/sprites/prigozhin.png", pngBuffer);
console.log(`Generated public/sprites/prigozhin.png (${pngBuffer.length} bytes)!`);
