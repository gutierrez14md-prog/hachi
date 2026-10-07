// SNS に投稿する用の画像 (縦 4:5 = Instagram のフィードの大きさ) を描く。デザインは 3 つ:
//   label    … 上に写真、下に色の帯。帯に植物の情報と、アプリの刻印
//   specimen … 標本カード。台紙に写真を枠で置き、下に標本ラベルのように項目を並べる
//   compare  … ビフォーアフター。写真を左右に 2 枚並べ、帯にそれぞれの日付と、その間の日数
export type Design = 'label' | 'specimen' | 'compare'
export type Brand = 'none' | 'word' | 'mark' | 'kanji'
export type Meta = { label: string; value: string }

export type CardInfo = {
  design: Design
  name?: string
  sci?: string
  cultivar?: string
  /** 小さく並べる項目 (分類、日付、育てた日数など) */
  meta: Meta[]
  brand: Brand
  tone: ToneId
  /** compare のとき: 左右の写真の日付 (わからなければ空) と、その間の日数 */
  dates?: [string | undefined, string | undefined]
  elapsed?: string
}

/** 色の組み合わせ (band = 帯や台紙の地、ink = 文字と刻印) */
export const TONES = [
  { id: 'green', label: 'グリーン', band: '#17241d', ink: '#ecf0ed' },
  { id: 'light', label: 'ライト', band: '#ffffff', ink: '#17241d' },
  { id: 'dark', label: 'ダーク', band: '#121212', ink: '#ececec' },
  { id: 'paper', label: '生成り', band: '#ece5d8', ink: '#2b2620' },
] as const
export type ToneId = (typeof TONES)[number]['id']

export const CARD_W = 1080
export const CARD_H = 1350
const PAD = 56
const PAPER = '#ecf0ed' // 写真が読み込めないとき・透明な写真のうしろ
const SOFT = 0.78 // 脇役の文字の濃さ

/** アプリで今使っている書体 (設定のフォント・植物名のフォントに合わせる) */
function fonts() {
  const css = getComputedStyle(document.documentElement)
  const get = (name: string) => css.getPropertyValue(name).trim()
  const body = get('--font-body') || 'sans-serif'
  const display = get('--font-display') || body
  return {
    name: (size: number) => `${get('--name-weight') || 700} ${size}px ${get('--font-name') || body}, ${body}, serif`,
    sci: (size: number, italic: boolean) => `${italic ? 'italic ' : ''}400 ${size}px ${get('--font-sci') || body}, ${body}, sans-serif`,
    body: (size: number) => `500 ${size}px ${body}, sans-serif`,
    display: (size: number, weight = 600) => `${weight} ${size}px ${display}, ${body}, sans-serif`,
  }
}
type Fonts = ReturnType<typeof fonts>

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

/** 写真を、枠いっぱいに切り取って収める。写真が無ければ薄い地だけ */
function cover(ctx: CanvasRenderingContext2D, photo: ImageBitmap | null, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = PAPER
  ctx.fillRect(x, y, w, h)
  if (!photo) return
  const scale = Math.max(w / photo.width, h / photo.height)
  const pw = photo.width * scale, ph = photo.height * scale
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(photo, x + (w - pw) / 2, y + (h - ph) / 2, pw, ph)
  ctx.restore()
}

const brandText = (b: Brand) => (b === 'word' ? 'Hachi' : b === 'kanji' ? '鉢' : '')

/** アプリの刻印を、右下の角 (right, bottom) に合わせて小さく描く。描いた幅を返す */
function stamp(ctx: CanvasRenderingContext2D, f: Fonts, brand: Brand, right: number, bottom: number): number {
  let w = 0
  ctx.save()
  ctx.globalAlpha = 0.85
  if (brand === 'mark') {
    const size = 50
    w = size * (14 / 24)
    // マークの絵は 24x24 のうち x 5〜19、y 3〜21 にある。その右下の角を合わせる
    ctx.translate(right - size * (19 / 24), bottom - size * (21 / 24))
    ctx.scale(size / 24, size / 24)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const d of POT) ctx.stroke(new Path2D(d))
  } else if (brand !== 'none') {
    // 「鉢」の字は、植物の名前と同じ書体で出す
    ctx.font = brand === 'kanji' ? f.name(40) : f.display(32, 800)
    w = ctx.measureText(brandText(brand)).width
    ctx.textAlign = 'right'
    ctx.fillText(brandText(brand), right, bottom)
  }
  ctx.restore()
  return w
}

const sciRuns = (info: CardInfo, f: Fonts): Run[] => [
  ...(info.sci ? [{ text: info.sci, font: (s: number) => f.sci(s, true) }] : []),
  ...(info.cultivar ? [{ text: `${info.sci ? ' ' : ''}'${info.cultivar}'`, font: (s: number) => f.sci(s, false) }] : []),
]

/** label と compare: 写真の下の帯。compare は、帯のいちばん上に左右の日付の行が入る */
function drawBand(ctx: CanvasRenderingContext2D, f: Fonts, photos: (ImageBitmap | null)[], info: CardInfo) {
  const tone = TONES.find((t) => t.id === info.tone) ?? TONES[0]
  const sci = sciRuns(info, f)
  const meta = info.meta.map((m) => m.value).join('  ・  ')
  const two = info.design === 'compare'
  const dates = two && (info.dates?.some(Boolean) || info.elapsed) ? info.dates ?? [undefined, undefined] : null

  const rows = [dates ? 58 : 0, info.name ? 82 : 0, sci.length ? 52 : 0, meta ? 48 : 0]
  const textH = rows.reduce((a, b) => a + b, 0)
  const bandH = textH || info.brand !== 'none' ? Math.max(textH + 84, 150) : 0
  const photoH = CARD_H - bandH

  if (two) {
    // 左右に 2 枚。間は帯と同じ色の細いすき間
    const gap = 6, w = (CARD_W - gap) / 2
    ctx.fillStyle = tone.band
    ctx.fillRect(0, 0, CARD_W, photoH)
    cover(ctx, photos[0], 0, 0, w, photoH)
    cover(ctx, photos[1], w + gap, 0, w, photoH)
  } else cover(ctx, photos[0], 0, 0, CARD_W, photoH)
  if (!bandH) return

  ctx.fillStyle = tone.band
  ctx.fillRect(0, photoH, CARD_W, bandH)
  ctx.fillStyle = tone.ink
  ctx.strokeStyle = tone.ink
  ctx.textBaseline = 'alphabetic'

  // 刻印: 帯の右下に、小さくさりげなく。情報のいちばん下の行と、下端をそろえる
  let y = photoH + (bandH - textH) / 2
  const brandW = stamp(ctx, f, info.brand, CARD_W - PAD, textH ? y + textH - 12 : photoH + bandH / 2 + 18)

  // 情報: 左寄せで上から。刻印と同じ高さになる最後の行だけ、刻印のぶん幅を空ける
  const fullW = CARD_W - PAD * 2
  const lastRow = rows.reduce((last, h, i) => (h ? i : last), 0)
  const widthOf = (row: number) => (row === lastRow && brandW ? fullW - brandW - 36 : fullW)

  if (dates) {
    // それぞれの写真の真下に日付、右端にその間の日数
    ctx.font = f.display(26)
    ctx.globalAlpha = SOFT
    if (dates[0]) ctx.fillText(dates[0], PAD, y + 34)
    if (dates[1]) ctx.fillText(dates[1], CARD_W / 2 + 3 + PAD / 2, y + 34)
    ctx.globalAlpha = 1
    if (info.elapsed) {
      ctx.font = f.display(30, 800)
      ctx.textAlign = 'right'
      ctx.fillText(info.elapsed, CARD_W - PAD, y + 35)
      ctx.textAlign = 'left'
    }
    y += rows[0]
  }
  if (info.name) {
    fitLine(ctx, [{ text: info.name, font: f.name }], PAD, y + 62, widthOf(1), 64, 40)
    y += rows[1]
  }
  if (sci.length) {
    ctx.globalAlpha = SOFT
    fitLine(ctx, sci, PAD, y + 38, widthOf(2), 34, 24)
    ctx.globalAlpha = 1
    y += rows[2]
  }
  if (meta) {
    ctx.globalAlpha = SOFT
    fitLine(ctx, [{ text: meta, font: (s) => f.display(s) }], PAD, y + 36, widthOf(3), 26, 20)
    ctx.globalAlpha = 1
  }
}

/** specimen: 台紙の上に写真を枠で置き、その下に標本ラベルのように「項目名  値」を罫線つきで並べる */
function drawSpecimen(ctx: CanvasRenderingContext2D, f: Fonts, photo: ImageBitmap | null, info: CardInfo) {
  const tone = TONES.find((t) => t.id === info.tone) ?? TONES[0]
  const sci = sciRuns(info, f)
  const M = 64
  const ROW = 50
  const titleH = (info.name ? 80 : 0) + (sci.length ? 50 : 0)
  const tableH = info.meta.length ? info.meta.length * ROW + (titleH ? 18 : 0) : 0
  const hasText = titleH + tableH > 0
  // 文字が無く刻印だけのときは、刻印 1 行ぶんだけ下を空ける
  const labelH = hasText ? titleH + tableH + 36 : info.brand !== 'none' ? 70 : 0
  const frameH = CARD_H - M * 2 - labelH

  ctx.fillStyle = tone.band
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  cover(ctx, photo, M, M, CARD_W - M * 2, frameH)
  ctx.strokeStyle = tone.ink
  ctx.globalAlpha = 0.22
  ctx.lineWidth = 2
  ctx.strokeRect(M, M, CARD_W - M * 2, frameH)
  ctx.globalAlpha = 1

  ctx.fillStyle = tone.ink
  ctx.textBaseline = 'alphabetic'
  const fullW = CARD_W - M * 2
  let y = M + frameH + 36
  if (info.name) {
    fitLine(ctx, [{ text: info.name, font: f.name }], M, y + 56, fullW, 58, 38)
    y += 80
  }
  if (sci.length) {
    ctx.globalAlpha = SOFT
    fitLine(ctx, sci, M, y + 34, fullW, 32, 24)
    ctx.globalAlpha = 1
    y += 50
  }
  if (info.meta.length) {
    if (titleH) y += 18
    // 刻印が右下に入るので、表は刻印にかからない幅まで
    const tableW = info.brand === 'none' ? fullW : fullW - 190
    for (const m of info.meta) {
      ctx.globalAlpha = 0.22
      ctx.fillRect(M, y, tableW, 2)
      ctx.globalAlpha = 0.6
      ctx.font = f.body(22)
      ctx.fillText(m.label, M, y + 34)
      ctx.globalAlpha = 1
      fitLine(ctx, [{ text: m.value, font: (s) => f.display(s) }], M + 190, y + 35, tableW - 190, 25, 18)
      y += ROW
    }
  }
  stamp(ctx, f, info.brand, CARD_W - M, CARD_H - M - 4)
}

export async function drawCard(canvas: HTMLCanvasElement, photos: (ImageBitmap | null)[], info: CardInfo) {
  const f = fonts()
  const metaText = info.meta.map((m) => m.label + m.value).join('') + (info.dates?.join('') ?? '') + (info.elapsed ?? '')
  // Web フォントは、使う文字ぶんを読み込んでから描く (読み込み前に描くと、別の書体で焼き付いてしまう)
  await Promise.all(
    [
      info.name && document.fonts.load(f.name(64), info.name),
      info.sci && document.fonts.load(f.sci(34, true), info.sci),
      info.cultivar && document.fonts.load(f.sci(34, false), info.cultivar),
      metaText && document.fonts.load(f.display(28), metaText),
      metaText && document.fonts.load(f.display(30, 800), metaText),
      metaText && document.fonts.load(f.body(22), metaText),
      info.brand === 'word' && document.fonts.load(f.display(32, 800), 'Hachi'),
      info.brand === 'kanji' && document.fonts.load(f.name(40), '鉢'),
    ].filter(Boolean),
  ).catch(() => {})

  const ctx = canvas.getContext('2d')!
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'
  if (info.design === 'specimen') drawSpecimen(ctx, f, photos[0], info)
  else drawBand(ctx, f, photos, info)
}
