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

/**
 * どの植物・生長記録からも使われていない写真を消す (写真の差し替えや、背景を変える前の元写真、
 * 保存せずに閉じたフォームで選んだ写真)。開いているフォームの写真を消さないよう、起動時にだけ呼ぶ
 */
export async function sweepPhotos() {
  await db.transaction('rw', db.plants, db.journal, db.photos, async () => {
    const used = new Set<string>()
    await db.plants.each((p) => p.photoId && used.add(p.photoId))
    await db.journal.each((j) => j.photoId && used.add(j.photoId))
    const unused = (await db.photos.toCollection().primaryKeys()).filter((id) => !used.has(id))
    await db.photos.bulkDelete(unused)
  })
}

/** 植物と、それに紐づく記録・写真をまとめて削除する */
export async function deletePlant(id: string) {
  await db.transaction('rw', db.plants, db.logs, db.journal, db.photos, async () => {
    const plant = await db.plants.get(id)
    const entries = await db.journal.where('plantId').equals(id).toArray()
    const photoIds = [plant?.photoId, ...entries.map((j) => j.photoId)].filter((p): p is string => !!p)
    await db.photos.bulkDelete(photoIds)
    await db.logs.where('plantId').equals(id).delete()
    await db.journal.where('plantId').equals(id).delete()
    await db.plants.delete(id)
  })
}
