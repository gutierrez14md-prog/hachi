import { ALL_TYPES, CARE } from '../care'
import { db, journalOrigs, journalPhotos } from '../db'
import { heads } from './schedule'

/**
 * 登録してあるデータの内訳 (件数) と、照合コードを作る。
 * バックアップから戻したあとに、元のアプリと見比べて、ちゃんと戻ったかを確かめるためのもの。
 *
 * 照合コード = 植物・記録・生長記録・分類・設定・写真の中身ぜんぶから計算した 8 桁の符号。
 * 1 件でも、1 文字でも違えば別の符号になるので、同じなら中身まで同じとわかる。
 * 写真は、どこかで使われているものだけを数える (使われなくなった写真は、次の起動時に消えるので、数に入れると合わなくなる)
 */
export async function dataSummary(): Promise<{ code: string; lines: string[] }> {
  const [plants, logs, journal, groups, settings, photos] = await Promise.all([
    db.plants.toArray(),
    db.logs.toArray(),
    db.journal.toArray(),
    db.groups.toArray(),
    db.settings.toArray(),
    db.photos.toArray(),
  ])

  // 使われている写真 (植物の写真、生長記録の写真、位置や明るさを調整する前の元の写真)
  const used = new Set<string>()
  for (const p of plants) {
    if (p.photoId) used.add(p.photoId)
    if (p.photoCrop) used.add(p.photoCrop.origId)
  }
  for (const j of journal) for (const id of [...journalPhotos(j), ...journalOrigs(j)]) used.add(id)
  const kept = photos.filter((p) => used.has(p.id))
  const missing = [...used].filter((id) => !photos.some((p) => p.id === id)).length
  const bytes = kept.reduce((n, p) => n + p.blob.size, 0)

  // 照合コード: 並び順や、書き出し・読み込みで変わりうるもの (キーの順、undefined) に左右されない形にしてから計算する
  const canon = (v: unknown): string =>
    JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x))
  const byId = <T extends { id: string }>(list: T[]) => [...list].sort((a, b) => (a.id < b.id ? -1 : 1))
  const text = canon({
    plants: byId(plants),
    logs: byId(logs),
    journal: byId(journal),
    groups: byId(groups),
    settings,
    photos: byId(kept).map((p) => [p.id, p.blob.size]),
  })
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  const hex = [...hash.slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  const code = `${hex.slice(0, 4)}-${hex.slice(4)}`

  const active = plants.filter((p) => !p.archivedDay)
  const archived = plants.filter((p) => p.archivedDay)
  const dates = logs.map((l) => l.date).sort()
  const shots = journal.reduce((n, j) => n + journalPhotos(j).length, 0)
  const mb = (bytes / 1024 / 1024).toFixed(1)
  const lines = [
    `照合コード: ${code}`,
    '',
    `植物: ${plants.length}件`,
    `  育てている: ${active.length}件（${heads(active)}株）`,
    `  アーカイブ: ${archived.length}件`,
    `  写真つき: ${plants.filter((p) => p.photoId).length}件`,
    `分類: ${groups.length}件`,
    '',
    `ケア記録: ${logs.length}件`,
    ...ALL_TYPES.map((ty) => [CARE[ty].label, logs.filter((l) => l.type === ty).length] as const)
      .filter(([, n]) => n > 0)
      .map(([label, n]) => `  ${label}: ${n}件`),
    ...(dates.length ? [`  期間: ${dates[0]} 〜 ${dates[dates.length - 1]}`] : []),
    '',
    `生長記録: ${journal.length}件`,
    `  写真: ${shots}枚`,
    `  過去の写真として追加: ${journal.filter((j) => j.past).length}件`,
    '',
    `写真: ${kept.length}枚（合計 ${mb}MB）`,
    ...(missing ? [`  ※ 見つからない写真: ${missing}枚`] : []),
    '',
    'ケアの設定（育てている株）',
    `  肥料あり: ${active.filter((p) => p.care.fertilizer.enabled).length}件`,
    `  活力剤あり: ${active.filter((p) => p.care.tonic.enabled).length}件`,
    `  月ごとの間隔: ${active.filter((p) => p.care.water.monthly).length}件`,
    `  水やりに合わせる: ${active.filter((p) => p.care.fertilizer.everyWater || p.care.tonic.everyWater).length}件`,
    `  ちょろ水の月あり: ${active.filter((p) => p.care.water.light?.length).length}件`,
  ]
  return { code, lines }
}
