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
