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
