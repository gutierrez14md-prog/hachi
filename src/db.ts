import Dexie, { type Table } from 'dexie'
import { defaultGroups } from './presets'
import type { CareLog, Group, Journal, PhotoRec, Plant, Settings } from './types'

class HachiDB extends Dexie {
  plants!: Table<Plant, string>
  logs!: Table<CareLog, string>
  journal!: Table<Journal, string>
  photos!: Table<PhotoRec, string>
  settings!: Table<Settings, string>
  groups!: Table<Group, string>

  constructor() {
    super('hachi')
    this.version(1).stores({
      plants: 'id',
      logs: 'id, plantId, date',
      journal: 'id, plantId, date',
      photos: 'id',
      settings: 'key',
    })
    // v2: 分類 (ケア設定のプリセット)。すでに使っている端末にも初期の分類を入れる
    this.version(2)
      .stores({ groups: 'id' })
      .upgrade((tx) => tx.table('groups').bulkAdd(defaultGroups()))
    // v3: 分類に栽培方法を持たせた。はじめから入っている分類のうち、まだ決めていないものに初期値を入れる
    this.version(3).upgrade((tx) => {
      const methods = new Map(defaultGroups().map((g) => [g.id, g.method]))
      return tx
        .table('groups')
        .toCollection()
        .modify((g: Group) => {
          if (!g.method && methods.has(g.id)) g.method = methods.get(g.id)
        })
    })
    // v4: 水やりの呼び名。チランジアの分類と、その分類の株を「ソーキング」にする (自分で決めた呼び名は変えない)
    this.version(4).upgrade(async (tx) => {
      const set = (row: Group | Plant) => {
        if (!row.waterLabel) row.waterLabel = 'ソーキング'
      }
      // 分類の間隔とメモは、以前の初期値 (ミスティング向け) のままなら、ソーキング向けの新しい初期値に替える
      const fresh = defaultGroups().find((g) => g.id === 'g-tillandsia')!
      await tx
        .table('groups')
        .where('id')
        .equals('g-tillandsia')
        .modify((g: Group) => {
          set(g)
          if (String(g.care.water.monthly) === '5,5,3,3,3,2,2,2,3,3,5,5') g.care.water.monthly = fresh.care.water.monthly
          if (g.profile === '水やり = ミスティング。風通しよく、濡れたままにしない。') g.profile = fresh.profile
        })
      await tx
        .table('plants')
        .filter((p: Plant) => p.groupId === 'g-tillandsia')
        .modify(set)
    })
    // v5: はじめから入っている分類に「多肉植物」を足した。すでに使っている端末にも入れる (同じ名前の分類を自分で作っていれば足さない)
    this.version(5).upgrade(async (tx) => {
      const fresh = defaultGroups().find((g) => g.id === 'g-succulent')!
      const groups = (await tx.table('groups').toArray()) as Group[]
      if (!groups.some((g) => g.id === fresh.id || g.name === fresh.name)) await tx.table('groups').add(fresh)
    })
    this.on('populate', (tx) => tx.table('groups').bulkAdd(defaultGroups()))
  }
}

export const db = new HachiDB()

export const DEFAULT_SETTINGS: Settings = {
  key: 'app',
  notify: false,
  remindTime: '08:00',
  dormantMonths: [11, 12, 1, 2, 3],
}

export const newId = () => crypto.randomUUID()

/** 生長記録の写真ぜんぶ (1 枚だけ持っていた古い記録も同じ形で返す) */
export const journalPhotos = (j: Journal): string[] => j.photoIds ?? (j.photoId ? [j.photoId] : [])

/** 生長記録の写真のうち、位置と大きさを調整したものの元の写真 (いま使っている写真のぶんだけ) */
export const journalOrigs = (j: Journal): string[] => {
  const now = journalPhotos(j)
  return Object.entries(j.photoCrops ?? {})
    .filter(([id]) => now.includes(id))
    .map(([, c]) => c.origId)
}

/**
 * どの植物・生長記録からも使われていない写真を消す (写真の差し替えや、背景を変える前の元写真、
 * 保存せずに閉じたフォームで選んだ写真)。開いているフォームの写真を消さないよう、起動時にだけ呼ぶ
 */
export async function sweepPhotos() {
  await db.transaction('rw', db.plants, db.journal, db.photos, async () => {
    const used = new Set<string>()
    await db.plants.each((p) => {
      if (p.photoId) used.add(p.photoId)
      // 位置を調整した写真は、調整し直せるように元の写真も残す
      if (p.photoCrop) used.add(p.photoCrop.origId)
    })
    await db.journal.each((j) => [...journalPhotos(j), ...journalOrigs(j)].forEach((id) => used.add(id)))
    const unused = (await db.photos.toCollection().primaryKeys()).filter((id) => !used.has(id))
    await db.photos.bulkDelete(unused)
  })
}

/** 植物と、それに紐づく記録・写真をまとめて削除する */
export async function deletePlant(id: string) {
  await db.transaction('rw', db.plants, db.logs, db.journal, db.photos, async () => {
    const plant = await db.plants.get(id)
    const entries = await db.journal.where('plantId').equals(id).toArray()
    const photoIds = [plant?.photoId, plant?.photoCrop?.origId, ...entries.flatMap(journalPhotos), ...entries.flatMap(journalOrigs)].filter((p): p is string => !!p)
    await db.photos.bulkDelete(photoIds)
    await db.logs.where('plantId').equals(id).delete()
    await db.journal.where('plantId').equals(id).delete()
    await db.plants.delete(id)
  })
}
