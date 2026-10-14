import { db } from '../db'
import { today } from './date'

const toDataUrl = (blob: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })

/** ひと息つく。写真をたくさん処理する合間に入れて、使い終わったメモリを片づける間と、画面が固まらない間を作る */
const pause = () => new Promise<void>((res) => setTimeout(res))

const LAST = 'lastBackup'
/** 最後にバックアップを書き出した日 (YYYY-MM-DD)。この端末で書き出したことが無ければ null */
export const lastBackup = (): string | null => localStorage.getItem(LAST)

/** 写真を一度に何枚ずつ処理するか (読み込みで、ぜんぶを一度に画像へ戻すと、メモリが足りなくなる) */
const BATCH = 20

// 書き出している途中にもう一度押されても、二重に走らせない (写真が多いと、2 つぶんのメモリで落ちる)
let exporting: Promise<void> | null = null

/**
 * 全データ (写真込み) を 1 つの JSON ファイルとしてダウンロードする。
 *
 * 写真が何百枚もあると、ぜんぶを一度に文字にして 1 本の文字列にまとめる作りでは、iPhone でメモリが足りずに
 * ページごと落ちる (「問題が繰り返し起きました」)。そこで、写真は 1 枚ずつ文字にして、そのつど Blob にしまい、
 * 最後に Blob をつなげてファイルにする。大きな文字列を手元にためない
 */
export function exportBackup(): Promise<void> {
  exporting ??= write().finally(() => (exporting = null))
  return exporting
}

async function write() {
  const parts: Blob[] = []
  const put = (text: string) => parts.push(new Blob([text]))
  const [plants, logs, journal, settings, groups] = await Promise.all([db.plants.toArray(), db.logs.toArray(), db.journal.toArray(), db.settings.toArray(), db.groups.toArray()])
  put(`{"app":"hachi","version":1,"plants":${JSON.stringify(plants)},"logs":${JSON.stringify(logs)},"journal":${JSON.stringify(journal)}`)
  put(`,"settings":${JSON.stringify(settings)},"groups":${JSON.stringify(groups)},"photos":[`)
  let count = 0
  for (const id of await db.photos.toCollection().primaryKeys()) {
    const rec = await db.photos.get(id)
    if (!rec) continue
    put(`${count ? ',' : ''}${JSON.stringify({ id: rec.id, data: await toDataUrl(rec.blob) })}`)
    if (++count % BATCH === 0) await pause()
  }
  put(']}')
  const url = URL.createObjectURL(new Blob(parts, { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `hachi-backup-${today()}.json`
  a.click()
  localStorage.setItem(LAST, today())
  // 保存の画面を出している間にファイルが消えないよう、少し長めに残す
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** 読み込むとき、ファイルを一度にどれだけ読むか (バイト) */
const CHUNK = 4 << 20
/** ファイルの中で、写真の並びが始まる目印。文章の中の " は \" と書かれるので、メモなどの中身とは重ならない */
const MARK = ',"photos":['

type Shot = { id: string; data: string }
type Records = { app?: string; plants?: unknown; logs?: unknown[]; journal?: unknown[]; settings?: unknown[]; groups?: unknown[]; photos?: Shot[] }

const check = (data: Records) => {
  if (data.app !== 'hachi' || !Array.isArray(data.plants)) throw new Error('Hachi のバックアップファイルではありません')
  return data
}

/** 写真を画像に戻して保存する (文字のほうは、済んだら手放す) */
async function savePhotos(shots: Shot[]) {
  await db.photos.bulkPut(await Promise.all(shots.map(async (p) => ({ id: p.id, blob: await (await fetch(p.data)).blob() }))))
  for (const p of shots) p.data = ''
  await pause()
}

/**
 * バックアップを読み込む。同じ ID のデータは上書き、それ以外は残す。
 * ただし、まだ何も登録していないアプリ (入れ直したばかりのアプリ) に読み込むときは、はじめから入っている分類を
 * いったん消して、バックアップの分類だけにする。元のアプリで消した分類が残ると、元と同じ状態に戻らないため。
 *
 * 写真が何百枚もあるとファイルは 100MB を超える。ぜんぶを一度に文字として読むと、iPhone ではメモリが足りずに落ちる。
 * そこで、ファイルを少しずつ読み、写真の並び (ファイルの最後にある) は 1 枚ずつ取り出して、少しずつ保存する。
 * 写真を先に入れ、植物や記録はそのあとにまとめて入れる。途中で止まっても、記録だけあって写真が無い、という
 * 半端な状態にならない (入れかけの写真は、どこからも使われていないので、次の起動時に消える。もう一度読み込めばよい)
 */
export async function importBackup(file: File) {
  const data = (await readStreaming(file)) ?? (await readWhole(file))
  await db.transaction('rw', [db.plants, db.logs, db.journal, db.settings, db.groups], async () => {
    const fresh = (await db.plants.count()) === 0 && (await db.logs.count()) === 0 && (await db.journal.count()) === 0
    if (fresh && Array.isArray(data.groups)) await db.groups.clear()
    await db.groups.bulkPut((data.groups ?? []) as never[])
    await db.plants.bulkPut(data.plants as never[])
    await db.logs.bulkPut((data.logs ?? []) as never[])
    await db.journal.bulkPut((data.journal ?? []) as never[])
    await db.settings.bulkPut((data.settings ?? []) as never[])
  })
  return (data.plants as unknown[]).length
}

/**
 * ファイルを少しずつ読む。写真より前の部分 (植物や記録) を返し、写真はその場で保存する。
 * 思っている形のファイルでなければ (写真の並びが最後に無い、など)、null を返す
 */
async function readStreaming(file: File): Promise<Records | null> {
  const decoder = new TextDecoder()
  let head = ''
  let buf = ''
  let data: Records | null = null
  let queue: Shot[] = []
  for (let at = 0; at < file.size; at += CHUNK) {
    buf += decoder.decode(await file.slice(at, at + CHUNK).arrayBuffer(), { stream: true })
    if (!data) {
      // まだ写真の並びに着いていない: 目印を探す (チャンクの境目にまたがっても見つかるよう、末尾を少し残す)
      const mark = buf.indexOf(MARK)
      if (mark < 0) {
        head += buf.slice(0, -MARK.length)
        buf = buf.slice(-MARK.length)
        continue
      }
      try {
        data = check(JSON.parse(head + buf.slice(0, mark) + '}'))
      } catch (e) {
        if (e instanceof SyntaxError) return null
        throw e
      }
      head = ''
      buf = buf.slice(mark + MARK.length)
    }
    // 読めたぶんの写真を取り出す。写真は {"id":"…","data":"…"} で、中身 (base64) に " は出てこない
    let pos = 0
    for (;;) {
      const start = buf.indexOf('{"id":"', pos)
      const end = start < 0 ? -1 : buf.indexOf('"}', start)
      if (end < 0) break
      queue.push(JSON.parse(buf.slice(start, end + 2)))
      pos = end + 2
      if (queue.length >= BATCH) {
        await savePhotos(queue)
        queue = []
      }
    }
    buf = buf.slice(pos)
  }
  // 写真の並びのあとにほかの項目が続いているなど、思っている形のファイルでなければ、ぜんぶを一度に読む方法に任せる
  // (ここまでに保存した写真は、同じ写真を入れ直すだけなので害は無い)
  if (!data || buf.trim() !== ']}') return null
  await savePhotos(queue)
  return data
}

/** ファイルぜんぶを一度に読む (古い読み方。写真が少ないファイルや、形の違うファイル用) */
async function readWhole(file: File): Promise<Records> {
  const data = check(JSON.parse(await file.text()))
  const photos = data.photos ?? []
  for (let i = 0; i < photos.length; i += BATCH) await savePhotos(photos.slice(i, i + BATCH))
  return data
}
