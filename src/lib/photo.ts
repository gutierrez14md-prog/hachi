import { db, newId } from '../db'

const MAX_EDGE = 1280

/** 写真を長辺 1280px の JPEG に縮小して保存し、photoId を返す */
export async function savePhoto(file: File): Promise<string> {
  let blob: Blob = file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82))
    if (out) blob = out
  } catch {
    // デコードできない形式は元ファイルのまま保存する
  }
  const id = newId()
  await db.photos.put({ id, blob })
  return id
}
