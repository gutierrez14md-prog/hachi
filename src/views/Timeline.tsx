import { Images, Pencil, Share2 } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../ctx'
import { journalPhotos, journalPlants } from '../db'
import { fmtDay, fmtFull, today } from '../lib/date'
import { Photo } from '../parts'
import type { Journal } from '../types'

/** 新しい順。日付不明 (過去の写真) はいちばん最後 */
export const sortJournal = (list: Journal[]) =>
  [...list].sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at)

const entryDate = (date: string) => (!date ? '日付不明' : date.slice(0, 4) === today().slice(0, 4) ? fmtDay(date) : fmtFull(date))

/** 紐づけた植物の名前は、これより多ければ「ほか N 株」にまとめる */
const SHOW_PLANTS = 3

/**
 * here = 植物の詳細から見ているときの、その植物。名前の一覧からは外し、投稿用の画像もその植物で作る。
 * タイムラインでは、紐づけた植物の名前を出す
 */
export function JournalCard({ entry, here }: { entry: Journal; here?: string }) {
  const { allPlants, open } = useApp()
  const photos = journalPhotos(entry)
  const linked = journalPlants(entry).flatMap((id) => allPlants.find((p) => p.id === id) ?? [])
  const others = linked.filter((p) => p.id !== here)
  const shareFor = here ?? linked[0]?.id
  return (
    <article className={`entry ${entry.past ? 'past' : ''}`}>
      <header>
        <span className="entry-meta">
          <time>{entryDate(entry.date)}</time>
          {entry.past && <span className="past-tag">過去の写真</span>}
          {/* 植物の詳細では、ほかにも紐づけた植物があるときだけ「ほかに〜」として出す */}
          {here && others.length > 0 && <span className="entry-with">ほかに</span>}
          {others.slice(0, SHOW_PLANTS).map((p) => (
            <button key={p.id} className="entry-plant" onClick={() => open({ k: 'plant', id: p.id })}>
              {p.name}
            </button>
          ))}
          {others.length > SHOW_PLANTS && <span className="entry-with">ほか{others.length - SHOW_PLANTS}株</span>}
        </span>
        <span className="entry-acts">
          {photos.length > 0 && shareFor && (
            <button className="icon-btn muted" onClick={() => open({ k: 'share', plantId: shareFor, photoId: photos[0] })} aria-label="投稿用の画像を作る">
              <Share2 size={15} />
            </button>
          )}
          <button className="icon-btn muted" onClick={() => open({ k: 'journal', id: entry.id })} aria-label="編集">
            <Pencil size={15} />
          </button>
        </span>
      </header>
      {photos.length === 1 && <Photo id={photos[0]} className="entry-img" onClick={() => open({ k: 'photo', ids: photos, index: 0 })} />}
      {/* 複数枚: 横に並べてスワイプで送る。次の写真が少しのぞくので、続きがあるとわかる */}
      {photos.length > 1 && (
        <div className="entry-strip">
          {photos.map((id, i) => (
            <Photo key={id} id={id} className="entry-img" onClick={() => open({ k: 'photo', ids: photos, index: i })} />
          ))}
        </div>
      )}
      {entry.text && <p>{entry.text}</p>}
    </article>
  )
}

export function Timeline() {
  const { plants, allPlants, groups, journal, open } = useApp()
  const [plantId, setPlantId] = useState('')
  // 株が多いと 1 つの一覧から選びにくいので、先に分類で絞れるようにする
  const [grp, setGrp] = useState('')
  const usedGroups = groups.filter((g) => plants.some((p) => p.groupId === g.id))
  const inGroup = new Set(allPlants.filter((p) => !grp || p.groupId === grp).map((p) => p.id))
  // アーカイブした株の記録もタイムラインには残す。複数の植物に紐づけた日記は、どれか 1 つが当てはまれば出す
  const known = new Set(allPlants.map((p) => p.id))
  const entries = sortJournal(journal).filter((j) => journalPlants(j).some((id) => known.has(id) && inGroup.has(id) && (!plantId || id === plantId)))

  let month = ''
  return (
    <>
      <header className="top row">
        <h1>タイムライン</h1>
      </header>
      {plants.length > 0 && (
        <div className="filters">
          {usedGroups.length > 0 && (
            <select
              value={grp}
              aria-label="分類で絞り込む"
              onChange={(e) => {
                setGrp(e.target.value)
                setPlantId('')
              }}
            >
              <option value="">すべての分類</option>
              {usedGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
          <select value={plantId} aria-label="植物で絞り込む" onChange={(e) => setPlantId(e.target.value)}>
            <option value="">すべての植物</option>
            {[...plants]
              .filter((p) => inGroup.has(p.id))
              .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      )}

      {!entries.length && (
        <div className="empty small">
          <div className="empty-icon">
            <Images size={30} />
          </div>
          <p>写真とひとことで、生長の様子や作業のことを残せます。</p>
          {plants.length > 0 && (
            <>
              <button className="btn primary" onClick={() => open({ k: 'journal', plantId: plantId || undefined })}>
                日記を書く
              </button>
              <button className="btn ghost" onClick={() => open({ k: 'past', plantId: plantId || undefined })}>
                過去の写真をまとめて追加
              </button>
            </>
          )}
        </div>
      )}

      <div className="tl">
        {entries.map((j) => {
          const m = j.date ? `${Number(j.date.slice(0, 4))}年${Number(j.date.slice(5, 7))}月` : '日付不明'
          const head = m !== month
          month = m
          return (
            <div key={j.id}>
              {head && <h2 className="tl-month">{m}</h2>}
              <JournalCard entry={j} />
            </div>
          )
        })}
      </div>
    </>
  )
}
