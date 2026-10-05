// 依存なしで PWA 用 PNG アイコンを生成する (node scripts/gen-icons.mjs)
import { deflateSync, crc32 } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const BG = [0x2f, 0x5d, 0x46]
const FG = [0xea, 0xf2, 0xe6]

// a-b を両端とするレンズ形 (2 つの円の交差)。public/icon.svg の芽と同じ形
function lens(x, y, ax, ay, bx, by) {
  const mx = (ax + bx) / 2, my = (ay + by) / 2
  const L = Math.hypot(bx - ax, by - ay) / 2
  const nx = -(by - ay) / (2 * L), ny = (bx - ax) / (2 * L)
  const k = L * 0.6, R = Math.hypot(L, k)
  return Math.hypot(x - mx - nx * k, y - my - ny * k) < R && Math.hypot(x - mx + nx * k, y - my + ny * k) < R
}

// 正規化座標 (0..1) での色。鉢 (縁 + 台形の胴) と、そこから出た芽
function sample(x, y) {
  const rim = x > 0.26 && x < 0.74 && y > 0.5 && y < 0.61
  const inset = 0.31 + ((y - 0.61) / 0.23) * 0.05
  const body = y >= 0.61 && y < 0.84 && x > inset && x < 1 - inset
  const stem = Math.abs(x - 0.5) < 0.02 && y > 0.33 && y <= 0.5
  const sprout = lens(x, y, 0.5, 0.4, 0.32, 0.24) || lens(x, y, 0.5, 0.34, 0.66, 0.19)
  return rim || body || stem || sprout ? FG : BG
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size) {
  const SS = 3
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let py = 0; py < size; py++) {
    const row = py * (size * 3 + 1)
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0]
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size)
          acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]
        }
      for (let i = 0; i < 3; i++) raw[row + 1 + px * 3 + i] = Math.round(acc[i] / (SS * SS))
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [180, 192, 512]) {
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), png(size))
  console.log(`icon-${size}.png`)
}
