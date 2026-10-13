import { db, newId } from '../db'
import type { PhotoTone } from '../types'
import { hasAlpha } from './cutout'

const MAX_EDGE = 1280

/** 長辺を edge 以内に縮め、右へ 90° × turns だけ回して描いたキャンバスを返す */
async function draw(src: Blob, edge: number, turns: number): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(src)
  const scale = Math.min(1, edge / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const side = ((turns % 4) + 4) % 4
  const canvas = document.createElement('canvas')
  canvas.width = side % 2 ? h : w
  canvas.height = side % 2 ? w : h
  const g = canvas.getContext('2d')!
  g.translate(canvas.width / 2, canvas.height / 2)
  g.rotate((side * Math.PI) / 2)
  g.drawImage(bmp, -w / 2, -h / 2, w, h)
  bmp.close()
  return canvas
}

// 背景が透明な画像 (切り抜き済みのもの) は、JPEG にすると透明部分が黒くなるので PNG のまま持つ
const encode = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((res) => (hasAlpha(canvas) ? canvas.toBlob(res, 'image/png') : canvas.toBlob(res, 'image/jpeg', quality)))

/**
 * 保存済みの写真を右へ 90° 回す。回した写真は新しい id で保存して返す
 * (元の写真は、どこからも使われなくなれば起動時の掃除で消える。「やめる」で閉じたときに元へ戻れるように残す)
 */
export async function rotatePhoto(id: string): Promise<string> {
  const rec = await db.photos.get(id)
  if (!rec) return id
  const out = await encode(await draw(rec.blob, Infinity, 1), 0.92)
  if (!out) return id
  const next = newId()
  await db.photos.put({ id: next, blob: out })
  return next
}

export const NO_TONE: PhotoTone = { b: 0, c: 0, s: 0 }
export const hasTone = (t?: PhotoTone) => !!t && (t.b !== 0 || t.c !== 0 || t.s !== 0)

// スライダーの値 (-100〜100) を、掛ける倍率にする。明るさとコントラストは 0.5〜1.5 倍、彩度は 0〜2 倍
const factors = (t: PhotoTone) => ({ kb: 1 + t.b / 200, kc: 1 + t.c / 200, ks: 1 + t.s / 100 })

/** 調整の見本を画面に出すときの CSS (filter)。保存するときの applyTone と同じ計算になる */
export function toneCss(t: PhotoTone): string {
  const { kb, kc, ks } = factors(t)
  return `brightness(${kb}) contrast(${kc}) saturate(${ks})`
}

/**
 * キャンバスの絵に、明るさ・コントラスト・彩度の調整をかける。
 * iPhone のブラウザには、キャンバスに filter をかける機能が無い版があるので、1 画素ずつ計算する。
 * 式は CSS の brightness → contrast → saturate と同じ (見本と保存した写真が同じ色になるように)
 */
function applyTone(canvas: HTMLCanvasElement, t: PhotoTone) {
  const g = canvas.getContext('2d')!
  const img = g.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  const { kb, kc, ks } = factors(t)
  const lim = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)
  for (let i = 0; i < d.length; i += 4) {
    const r = lim((lim(d[i] * kb) - 127.5) * kc + 127.5)
    const gr = lim((lim(d[i + 1] * kb) - 127.5) * kc + 127.5)
    const b = lim((lim(d[i + 2] * kb) - 127.5) * kc + 127.5)
    d[i] = (0.213 + 0.787 * ks) * r + (0.715 - 0.715 * ks) * gr + (0.072 - 0.072 * ks) * b
    d[i + 1] = (0.213 - 0.213 * ks) * r + (0.715 + 0.285 * ks) * gr + (0.072 - 0.072 * ks) * b
    d[i + 2] = (0.213 - 0.213 * ks) * r + (0.715 - 0.715 * ks) * gr + (0.072 + 0.928 * ks) * b
  }
  g.putImageData(img, 0, 0)
}

/** 植物の写真を切り出すときの縦横比 (詳細のいちばん上の写真と同じ 4:3) */
export const CROP_ASPECT = 4 / 3

/**
 * 写真の一部を切り出して、新しい写真として保存する (位置と大きさの調整)。
 * x, y = 切り出す範囲の中心 (0〜1)、zoom = 拡大率 (1 で、写真が枠をちょうど覆う)、aspect = 枠の縦横比、
 * tone = 明るさ・コントラスト・彩度の調整
 */
export async function cropPhoto(id: string, c: { x: number; y: number; zoom: number }, aspect = CROP_ASPECT, tone?: PhotoTone): Promise<string> {
  const rec = await db.photos.get(id)
  if (!rec) throw new Error('no photo')
  const bmp = await createImageBitmap(rec.blob)
  // 切り出す範囲 (写真の px)
  const wide = bmp.width / bmp.height > aspect
  const sh = wide ? bmp.height / c.zoom : bmp.width / c.zoom / aspect
  const sw = sh * aspect
  const sx = Math.min(bmp.width - sw, Math.max(0, c.x * bmp.width - sw / 2))
  const sy = Math.min(bmp.height - sh, Math.max(0, c.y * bmp.height - sh / 2))
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh))
  canvas.width = Math.round(sw * scale)
  canvas.height = Math.round(sh * scale)
  canvas.getContext('2d')!.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  bmp.close()
  if (tone && hasTone(tone)) applyTone(canvas, tone)
  const out = await encode(canvas, 0.9)
  if (!out) throw new Error('encode failed')
  const next = newId()
  await db.photos.put({ id: next, blob: out })
  return next
}

/** 写真を長辺 1280px の JPEG に縮小して保存し、photoId を返す。turns は右へ 90° 回す回数 */
export async function savePhoto(file: File, turns = 0): Promise<string> {
  let blob: Blob = file
  try {
    const out = await encode(await draw(file, MAX_EDGE, turns), 0.82)
    if (out) blob = out
  } catch {
    // デコードできない形式は元ファイルのまま保存する
  }
  const id = newId()
  await db.photos.put({ id, blob })
  return id
}
