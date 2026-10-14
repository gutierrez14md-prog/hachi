import { db } from '../db'
import { today } from './date'

const toDataUrl = (blob: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })

const LAST = 'lastBackup'
/** 最後にバックアップを書き出した日 (YYYY-MM-DD)。この端末で書き出したことが無ければ null */
export const lastBackup = (): string | null => localStorage.getItem(LAST)

/** 全データ (写真込み) を 1 つの JSON ファイルとしてダウンロードする */
export async function exportBackup() {
  const photos = await db.photos.toArray()
  const data = {
    app: 'hachi',
    version: 1,
    plants: await db.plants.toArray(),
    logs: await db.logs.toArray(),
    journal: await db.journal.toArray(),
    settings: await db.settings.toArray(),
    groups: await db.groups.toArray(),
    photos: await Promise.all(photos.map(async (p) => ({ id: p.id, data: await toDataUrl(p.blob) }))),
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `hachi-backup-${today()}.json`
  a.click()
  localStorage.setItem(LAST, today())
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * バックアップを読み込む。同じ ID のデータは上書き、それ以外は残す。
 * ただし、まだ何も登録していないアプリ (入れ直したばかりのアプリ) に読み込むときは、はじめから入っている分類を
 * いったん消して、バックアップの分類だけにする。元のアプリで消した分類が残ると、元と同じ状態に戻らないため
 */
export async function importBackup(file: File) {
  const data = JSON.parse(await file.text())
  if (data.app !== 'hachi' || !Array.isArray(data.plants)) throw new Error('Hachi のバックアップファイルではありません')
  const photos = await Promise.all(
    (data.photos ?? []).map(async (p: { id: string; data: string }) => ({
      id: p.id,
      blob: await (await fetch(p.data)).blob(),
    })),
  )
  await db.transaction('rw', [db.plants, db.logs, db.journal, db.photos, db.settings, db.groups], async () => {
    const fresh = (await db.plants.count()) === 0 && (await db.logs.count()) === 0 && (await db.journal.count()) === 0
    if (fresh && Array.isArray(data.groups)) await db.groups.clear()
    await db.groups.bulkPut(data.groups ?? [])
    await db.plants.bulkPut(data.plants)
    await db.logs.bulkPut(data.logs ?? [])
    await db.journal.bulkPut(data.journal ?? [])
    await db.settings.bulkPut(data.settings ?? [])
    await db.photos.bulkPut(photos)
  })
  return data.plants.length as number
}
