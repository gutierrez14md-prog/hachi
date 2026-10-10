import { db, newId } from '../db'
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

/** 植物の写真を切り出すときの縦横比 (詳細のいちばん上の写真と同じ 4:3) */
export const CROP_ASPECT = 4 / 3

/**
 * 写真の一部を切り出して、新しい写真として保存する (位置と大きさの調整)。
 * x, y = 切り出す範囲の中心 (0〜1)、zoom = 拡大率 (1 で、写真が枠をちょうど覆う)、aspect = 枠の縦横比
 */
export async function cropPhoto(id: string, c: { x: number; y: number; zoom: number }, aspect = CROP_ASPECT): Promise<string> {
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
