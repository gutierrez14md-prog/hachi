import { toKey, today } from './date'

/**
 * 写真の撮影日 (YYYY-MM-DD)。JPEG の EXIF (DateTimeOriginal、無ければ DateTime) を読み、
 * 無ければファイルの更新日。それも今日なら (= 選んだ瞬間の日付で、当てにならない) 空文字を返す
 */
export async function photoDate(file: File): Promise<string> {
  try {
    const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer())
    if (v.getUint16(0) !== 0xffd8) throw new Error('not jpeg')
    for (let o = 2; o + 4 < v.byteLength; ) {
      const marker = v.getUint16(o)
      if ((marker & 0xff00) !== 0xff00) break
      if (marker === 0xffe1 && v.getUint32(o + 4) === 0x45786966 /* "Exif" */) {
        const tiff = o + 10
        const le = v.getUint16(tiff) === 0x4949
        const u16 = (p: number) => v.getUint16(p, le)
        const u32 = (p: number) => v.getUint32(p, le)
        // IFD の中から tag のエントリの位置を探す
        const find = (ifd: number, tag: number) => {
          for (let i = 0, n = u16(ifd); i < n; i++) if (u16(ifd + 2 + i * 12) === tag) return ifd + 2 + i * 12
          return -1
        }
        const ifd0 = tiff + u32(tiff + 4)
        const sub = find(ifd0, 0x8769)
        let entry = sub >= 0 ? find(tiff + u32(sub + 8), 0x9003) : -1
        if (entry < 0) entry = find(ifd0, 0x0132)
        if (entry >= 0) {
          const at = tiff + u32(entry + 8)
          let s = ''
          for (let i = 0; i < 10; i++) s += String.fromCharCode(v.getUint8(at + i))
          const m = /^(\d{4}):(\d{2}):(\d{2})$/.exec(s)
          if (m && m[1] !== '0000') return `${m[1]}-${m[2]}-${m[3]}`
        }
        break
      }
      o += 2 + v.getUint16(o + 2)
    }
  } catch {
    // EXIF なし・JPEG 以外・壊れたデータはファイルの日付で代用する
  }
  const modified = toKey(new Date(file.lastModified))
  return modified < today() ? modified : ''
}
