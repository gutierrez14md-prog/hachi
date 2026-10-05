// 依存なしでアプリのアイコン (PNG 3 サイズ + SVG) を生成する (node scripts/gen-icons.mjs)
import { deflateSync, crc32 } from 'node:zlib'
import { writeFileSync } from 'node:fs'

// アプリを開いたときの鉢のマーク (src/parts.tsx の PotIcon) と同じ絵: 白地にインク色の線
const BG = [0xff, 0xff, 0xff]
const FG = [0x17, 0x24, 0x1d]
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')

// 3 次ベジェを折れ線にする
const cubic = (p0, p1, p2, p3) =>
  Array.from({ length: 17 }, (_, i) => {
    const t = i / 16, u = 1 - t
    return [0, 1].map((k) => u ** 3 * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t ** 3 * p3[k])
  })

// PotIcon の線。24x24 の座標のまま (形を変えるときは PotIcon の path も合わせる)
const LINES = [
  [[12, 12], [12, 7]], // 茎
  [...cubic([12, 9], [9.2, 9], [7.5, 7.3], [7.5, 4.5]), ...cubic([7.5, 4.5], [10.3, 4.5], [12, 6.2], [12, 9])], // 左の葉
  [...cubic([12, 7], [12, 4.7], [13.5, 3], [16.2, 3]), ...cubic([16.2, 3], [16.2, 5.5], [14.5, 7], [12, 7])], // 右の葉
  [[5, 12], [19, 12], [19, 15], [5, 15], [5, 12]], // 鉢の縁
  [[6.5, 15], [7.7, 21], [16.3, 21], [17.5, 15]], // 鉢の胴
]
const STROKE = 2
// 24x24 の絵を、アイコンの中央に SCALE 倍 (アイコンの幅 = 1) で置く
const SCALE = 0.58 / 24
const place = ([x, y]) => [0.5 + (x - 12) * SCALE, 0.5 + (y - 12) * SCALE]
const SEGMENTS = LINES.flatMap((line) => line.slice(1).map((p, i) => [place(line[i]), place(p)]))

function distToSegment(x, y, [[ax, ay], [bx, by]]) {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(x - ax - dx * t, y - ay - dy * t)
}

// 線からの距離が太さの半分以内なら線の色 (端と角は自然に丸くなる)
const sample = (x, y) => (SEGMENTS.some((s) => distToSegment(x, y, s) < (STROKE * SCALE) / 2) ? FG : BG)

// 同じ絵を SVG (ブラウザのタブ用) にも書き出す
function svg() {
  const lines = LINES.map((line) => {
    const pts = line.map((p) => place(p).map((v) => (v * 100).toFixed(2)).join(','))
    return `    <polyline points="${pts.join(' ')}"/>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${hex(BG)}"/>
  <g fill="none" stroke="${hex(FG)}" stroke-width="${(STROKE * SCALE * 100).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">
${lines.join('\n')}
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
