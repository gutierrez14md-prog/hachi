// SNS に投稿する用の画像 (縦 4:5 = Instagram のフィードの大きさ) を描く。
// デザイン「ラベル」: 上に写真、下にインク色の帯。帯に植物の情報と、アプリの印を置く
export type Brand = 'none' | 'word' | 'mark' | 'kanji'

export type CardInfo = {
  name?: string
  sci?: string
  cultivar?: string
  /** 小さく並べる項目 (分類、日付、育てた日数など) */
  meta: string[]
  brand: Brand
}

export const CARD_W = 1080
export const CARD_H = 1350
const PAD = 56
const INK = '#17241d'
const PAPER = '#ecf0ed'

/** アプリで今使っている書体 (設定のフォント・植物名のフォントに合わせる) */
function fonts() {
  const css = getComputedStyle(document.documentElement)
  const get = (name: string) => css.getPropertyValue(name).trim()
  const body = get('--font-body') || 'sans-serif'
  const display = get('--font-display') || body
  return {
    name: (size: number) => `${get('--name-weight') || 700} ${size}px ${get('--font-name') || body}, ${body}, serif`,
    sci: (size: number, italic: boolean) => `${italic ? 'italic ' : ''}400 ${size}px ${get('--font-sci') || body}, ${body}, sans-serif`,
    display: (size: number, weight = 600) => `${weight} ${size}px ${display}, ${body}, sans-serif`,
  }
}

// 鉢のマーク (src/parts.tsx の PotIcon と同じ線。24x24)
const POT = ['M12 12V7', 'M12 9c-2.8 0-4.5-1.7-4.5-4.5C10.3 4.5 12 6.2 12 9Z', 'M12 7c0-2.3 1.5-4 4.2-4C16.2 5.5 14.5 7 12 7Z', 'M5 12h14v3H5z', 'm6.5 15 1.2 6h8.6l1.2-6']

type Run = { text: string; font: (size: number) => string }

/** 幅に収まるまで字を小さくし、それでも入らなければ末尾を … にして描く。複数の書体をつなげて 1 行にできる */
function fitLine(ctx: CanvasRenderingContext2D, runs: Run[], x: number, baseline: number, maxW: number, size: number, min: number) {
  const width = (s: number, list = runs) =>
    list.reduce((w, r) => {
      ctx.font = r.font(s)
      return w + ctx.measureText(r.text).width
    }, 0)
  while (size > min && width(size) > maxW) size -= 2
  let list = runs
  if (width(size) > maxW) {
    // 最後の run から 1 文字ずつ削る
    list = runs.map((r) => ({ ...r }))
    while (list.length && width(size, list) > maxW) {
      const last = list[list.length - 1]
      last.text = last.text.replace(/….?$|.$/u, '').trimEnd() + '…'
      if (last.text === '…') list.pop()
    }
  }
  for (const r of list) {
    ctx.font = r.font(size)
    ctx.fillText(r.text, x, baseline)
    x += ctx.measureText(r.text).width
  }
}

export async function drawCard(canvas: HTMLCanvasElement, photo: ImageBitmap | null, info: CardInfo) {
  const f = fonts()
  const sciRuns: Run[] = [
    ...(info.sci ? [{ text: info.sci, font: (s: number) => f.sci(s, true) }] : []),
    ...(info.cultivar ? [{ text: `${info.sci ? ' ' : ''}'${info.cultivar}'`, font: (s: number) => f.sci(s, false) }] : []),
  ]
  const meta = info.meta.join('  ・  ')
  const brandText = info.brand === 'word' ? 'Hachi' : info.brand === 'kanji' ? '鉢' : ''

  // Web フォントは、使う文字ぶんを読み込んでから描く (読み込み前に描くと、別の書体で焼き付いてしまう)
  await Promise.all(
    [
      info.name && document.fonts.load(f.name(64), info.name),
      sciRuns.length && document.fonts.load(f.sci(34, true), info.sci ?? ''),
      info.cultivar && document.fonts.load(f.sci(34, false), info.cultivar),
      meta && document.fonts.load(f.display(28), meta),
      brandText && document.fonts.load(f.display(48, 800), brandText),
    ].filter(Boolean),
  ).catch(() => {})

  const ctx = canvas.getContext('2d')!
  const rows = [info.name ? 82 : 0, sciRuns.length ? 52 : 0, meta ? 48 : 0]
  const textH = rows[0] + rows[1] + rows[2]
  const bandH = textH || info.brand !== 'none' ? Math.max(textH + 84, 150) : 0
  const photoH = CARD_H - bandH

  // 写真: 帯の上の領域いっぱいに、切り取って収める
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  if (photo) {
    const scale = Math.max(CARD_W / photo.width, photoH / photo.height)
    const w = photo.width * scale, h = photo.height * scale
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, CARD_W, photoH)
    ctx.clip()
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(photo, (CARD_W - w) / 2, (photoH - h) / 2, w, h)
    ctx.restore()
  }
  if (!bandH) return

  ctx.fillStyle = INK
  ctx.fillRect(0, photoH, CARD_W, bandH)
  ctx.fillStyle = PAPER
  ctx.strokeStyle = PAPER
  ctx.textBaseline = 'alphabetic'

  // アプリの印: 帯の右端、上下中央
  let brandW = 0
  const midY = photoH + bandH / 2
  if (info.brand === 'mark') {
    const size = 76
    brandW = size * (14 / 24) + 8
    ctx.save()
    ctx.translate(CARD_W - PAD - size * (19 / 24), midY - size / 2)
    ctx.scale(size / 24, size / 24)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const d of POT) ctx.stroke(new Path2D(d))
    ctx.restore()
  } else if (brandText) {
    const size = info.brand === 'kanji' ? 60 : 46
    ctx.font = f.display(size, 800)
    brandW = ctx.measureText(brandText).width
    ctx.textAlign = 'right'
    ctx.fillText(brandText, CARD_W - PAD, midY + size * 0.36)
    ctx.textAlign = 'left'
  }

  // 情報: 左寄せで上から。印のぶんは幅を空ける
  const maxW = CARD_W - PAD * 2 - (brandW ? brandW + 40 : 0)
  let y = photoH + (bandH - textH) / 2
  if (info.name) {
    fitLine(ctx, [{ text: info.name, font: f.name }], PAD, y + 62, maxW, 64, 40)
    y += rows[0]
  }
  if (sciRuns.length) {
    ctx.globalAlpha = 0.78
    fitLine(ctx, sciRuns, PAD, y + 38, maxW, 34, 24)
    ctx.globalAlpha = 1
    y += rows[1]
  }
  if (meta) {
    ctx.globalAlpha = 0.78
    fitLine(ctx, [{ text: meta, font: (s) => f.display(s) }], PAD, y + 36, maxW, 26, 20)
    ctx.globalAlpha = 1
  }
}
