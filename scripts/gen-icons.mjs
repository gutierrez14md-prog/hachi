// 依存なしでアプリのアイコン (PNG 3 サイズ + SVG) を生成する (node scripts/gen-icons.mjs)
import { deflateSync, crc32 } from 'node:zlib'
import { writeFileSync } from 'node:fs'

// モノトーン: アプリのインク色の地に、明るいアガベのシルエット
const BG = [0x17, 0x24, 0x1d]
const FG = [0xec, 0xf0, 0xed]
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')

// アガベ: 株元 BASE から扇形に広がる葉。[真上からの角度 (度), 長さ]。座標は 0..1
const BASE = [0.5, 0.76]
const LEAVES = [
  [0, 0.48], [21, 0.47], [-21, 0.47], [42, 0.44], [-42, 0.44],
  [63, 0.4], [-63, 0.4], [84, 0.34], [-84, 0.34], [104, 0.24], [-104, 0.24],
]
const HALF_WIDTH = 0.05
// 葉の幅の変わり方 (u = 株元 0 → 先端 1): 株元は細く、中ほどでふくらみ、先端は鋭くとがる
const profile = (u) => (u < 0.38 ? 0.4 + 0.6 * Math.sin((u / 0.38) * (Math.PI / 2)) : ((1 - u) / 0.62) ** 0.85)

function inLeaf(x, y, [deg, len]) {
  const a = (deg * Math.PI) / 180
  const ax = Math.sin(a), ay = -Math.cos(a)
  const dx = x - BASE[0], dy = y - BASE[1]
  const u = (dx * ax + dy * ay) / len
  return u >= 0 && u <= 1 && Math.abs(dx * ay - dy * ax) < HALF_WIDTH * profile(u)
}

const sample = (x, y) => (LEAVES.some((leaf) => inLeaf(x, y, leaf)) ? FG : BG)

// 同じ形を SVG (ブラウザのタブ用) にも書き出す
function svg() {
  const paths = LEAVES.map(([deg, len]) => {
    const a = (deg * Math.PI) / 180
    const ax = Math.sin(a), ay = -Math.cos(a)
    const side = (sign) =>
      Array.from({ length: 21 }, (_, i) => {
        const u = i / 20
        const w = HALF_WIDTH * profile(u) * sign
        return [(BASE[0] + ax * len * u + ay * w) * 100, (BASE[1] + ay * len * u - ax * w) * 100]
      })
    const pts = [...side(1), ...side(-1).reverse()].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    return `    <polygon points="${pts.join(' ')}"/>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${hex(BG)}"/>
  <g fill="${hex(FG)}">
${paths.join('\n')}
  </g>
</svg>
`
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
writeFileSync(new URL('../public/icon.svg', import.meta.url), svg())
console.log('icon.svg')
