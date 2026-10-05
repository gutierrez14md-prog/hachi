import { Images, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../ctx'
import { fmtDay } from '../lib/date'
import { Photo } from '../parts'
import type { Journal } from '../types'

export const sortJournal = (list: Journal[]) =>
  [...list].sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at)

export function JournalCard({ entry, plantName }: { entry: Journal; plantName?: string }) {
  const { open } = useApp()
  return (
    <article className="entry">
      <header>
        <span>
          <time>{fmtDay(entry.date)}</time>
          {plantName && (
            <button className="entry-plant" onClick={() => open({ k: 'plant', id: entry.plantId })}>
              {plantName}
            </button>
          )}
        </span>
        <button className="icon-btn muted" onClick={() => open({ k: 'journal', id: entry.id })} aria-label="編集">
          <Pencil size={15} />
        </button>
      </header>
      {entry.photoId && <Photo id={entry.photoId} className="entry-img" />}
      {entry.text && <p>{entry.text}</p>}
    </article>
  )
}

export function Timeline() {
  const { plants, journal, open } = useApp()
  const [plantId, setPlantId] = useState('')
  const names = new Map(plants.map((p) => [p.id, p.name]))
  const entries = sortJournal(journal).filter((j) => names.has(j.plantId) && (!plantId || j.plantId === plantId))

  let month = ''
  return (
    <>
      <header className="top row">
        <h1>タイムライン</h1>
        {plants.length > 0 && (
          <select value={plantId} onChange={(e) => setPlantId(e.target.value)}>
            <option value="">すべての植物</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </header>

      {!entries.length && (
        <div className="empty small">
          <div className="empty-icon">
            <Images size={30} />
          </div>
          <p>写真と一言で、生長の記録を残せます。</p>
          {plants.length > 0 && (
            <button className="btn primary" onClick={() => open({ k: 'journal', plantId: plantId || undefined })}>
              生長記録を書く
            </button>
          )}
        </div>
      )}

      <div className="tl">
        {entries.map((j) => {
          const m = `${Number(j.date.slice(0, 4))}年${Number(j.date.slice(5, 7))}月`
          const head = m !== month
          month = m
          return (
            <div key={j.id}>
              {head && <h2 className="tl-month">{m}</h2>}
              <JournalCard entry={j} plantName={names.get(j.plantId)} />
            </div>
          )
        })}
      </div>
    </>
  )
}
