const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256;
const CX = SIZE / 2, CY = SIZE / 2;
const RADIUS = 90;

function crc32(buf) {
  let crc = 0xffffffff;
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeB, data]);
  const crcV = Buffer.alloc(4);
  crcV.writeUInt32BE(crc32(crcData));
  return Buffer.concat([len, typeB, data, crcV]);
}

const pixels = Buffer.alloc(SIZE * SIZE * 4);

function setPixel(x, y, r, g, b, a) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  pixels[i] = r;
  pixels[i + 1] = g;
  pixels[i + 2] = b;
  pixels[i + 3] = a;
}

function fillCircle(cx, cy, radius, r, g, b, a) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= radius * radius) {
        setPixel(x, y, r, g, b, a);
      }
    }
  }
}

function fillRect(x1, y1, x2, y2, r, g, b, a) {
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++)
      setPixel(x, y, r, g, b, a);
}

// Antialias helper — blend a pixel with the background
function setPixelAA(x, y, r, g, b, a, bgR, bgG, bgB) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  const alpha = a / 255;
  pixels[i] = Math.round(r * alpha + bgR * (1 - alpha));
  pixels[i + 1] = Math.round(g * alpha + bgG * (1 - alpha));
  pixels[i + 2] = Math.round(b * alpha + bgB * (1 - alpha));
  pixels[i + 3] = 255;
}

function fillCircleAA(cx, cy, radius, r, g, b, a) {
  const minX = Math.max(0, Math.floor(cx - radius - 1));
  const maxX = Math.min(SIZE - 1, Math.ceil(cx + radius + 1));
  const minY = Math.max(0, Math.floor(cy - radius - 1));
  const maxY = Math.min(SIZE - 1, Math.ceil(cy + radius + 1));
  const r2 = radius * radius;
  const bgR = 0x0a, bgG = 0x0a, bgB = 0x0b;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx, dy = y - cy;
      const dist2 = dx * dx + dy * dy;
      if (dist2 <= r2) {
        setPixel(x, y, r, g, b, 255);
      } else if (dist2 <= (radius + 1) * (radius + 1)) {
        const dist = Math.sqrt(dist2);
        const alpha = Math.round(Math.max(0, Math.min(255, (radius + 1 - dist) * 255)));
        setPixelAA(x, y, r, g, b, alpha, bgR, bgG, bgB);
      }
    }
  }
}

// Fill background
for (let i = 0; i < pixels.length; i += 4) {
  pixels[i] = 0x0a;
  pixels[i + 1] = 0x0a;
  pixels[i + 2] = 0x0b;
  pixels[i + 3] = 255;
}

// Draw accent circle
fillCircleAA(CX, CY, RADIUS, 0x63, 0x66, 0xf1, 255);

// Draw a stylized terminal prompt ">_"
const fgR = 0xff, fgG = 0xff, fgB = 0xff;
const s = 2; // stroke width

// ">" — diagonal lines made from small rects
fillRect(CX - 32, CY - 28, CX + 32, CY - 28 + s - 1, fgR, fgG, fgB, 255);
fillRect(CX - 32, CY + 28 - s + 1, CX + 32, CY + 28, fgR, fgG, fgB, 255);
fillRect(CX + 28 - s + 1, CY - 28, CX + 28, CY + 28, fgR, fgG, fgB, 255);

// "_" — horizontal line
fillRect(CX - 20, CY + 30, CX + 36, CY + 30 + s - 1, fgR, fgG, fgB, 255);

// Build raw scanlines (each row: filter byte 0x00 + RGBA pixels)
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y++) {
  raw[y * (1 + SIZE * 4)] = 0; // None filter
  pixels.copy(raw, y * (1 + SIZE * 4) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const compressed = zlib.deflateSync(raw);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // color type RGBA
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const png = Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);

const outPath = path.join(__dirname, '..', 'assets', 'icon.png');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, png);
console.log('✓ Generated icon at', outPath, '(' + png.length + ' bytes)');
