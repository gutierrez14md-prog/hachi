import { Camera, MapPin, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ALL_TYPES, CARE, careVar, SCHED } from '../care'
import { useApp } from '../ctx'
import { db } from '../db'
import { dueLabel, fmtDay, today } from '../lib/date'
import { lastDone, nextDue } from '../lib/schedule'
import { Photo, Sheet } from '../parts'
import { JournalCard, sortJournal } from './Timeline'

export function PlantDetail({ id }: { id: string }) {
  const { plants, journal, logsOf, open, record } = useApp()
  const [showAll, setShowAll] = useState(false)
  const p = plants.find((x) => x.id === id)
  if (!p) return null

  const t = today()
  const logs = [...logsOf(id)].sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at)
  const entries = sortJournal(journal.filter((j) => j.plantId === id))
  const sched = SCHED.filter((s) => p.care[s].enabled)

  return (
    <Sheet
      title=""
      action={
        <button className="btn ghost" onClick={() => open({ k: 'plantForm', id })}>
          <Pencil size={16} /> 編集
        </button>
      }
    >
      <Photo id={p.photoId} className="hero" />
      <div className="detail-h">
        <h1>{p.name}</h1>
        {p.scientificName && <i>{p.scientificName}</i>}
        {p.location && (
          <small>
            <MapPin size={12} /> {p.location}
          </small>
        )}
      </div>
      {p.profile && <p className="profile">{p.profile}</p>}

      {sched.length > 0 && (
        <section className="card">
          <h3 className="card-t">次のケア</h3>
          {sched.map((s) => {
            const { Icon, label } = CARE[s]
            const due = nextDue(p, s, logs)
            const last = lastDone(logs, s)
            return (
              <div className="line" key={s}>
                <span className="care-ic" style={careVar(s)}>
                  <Icon size={18} />
                </span>
                <span className="line-main">
                  <span>
                    <b>
                      {label} <span className={due && due <= t ? 'late' : 'soft'}>{due ? dueLabel(due) : '予定なし'}</span>
                    </b>
                    <small>
                      {p.care[s].days}日ごと ・ {last ? `前回 ${fmtDay(last)}` : '記録なし'}
                    </small>
                  </span>
                </span>
                <button className="pill" style={careVar(s)} onClick={() => record([id], s)}>
                  記録
                </button>
              </div>
            )
          })}
        </section>
      )}

      <h3 className="sec">ケアを記録</h3>
      <div className="type-grid">
        {ALL_TYPES.map((ty) => {
          const { Icon, label } = CARE[ty]
          return (
            <button key={ty} style={careVar(ty)} onClick={() => open({ k: 'log', plantId: id, type: ty })}>
              <span className="care-ic">
                <Icon size={18} />
              </span>
              {label}
            </button>
          )
        })}
      </div>

      <div className="list-head">
        <h3 className="sec">生長記録</h3>
        <button className="btn ghost sm" onClick={() => open({ k: 'journal', plantId: id })}>
          <Camera size={15} /> 追加
        </button>
      </div>
      {entries.length ? (
        <div className="tl">
          {entries.map((j) => (
            <JournalCard key={j.id} entry={j} />
          ))}
        </div>
      ) : (
        <p className="none">まだ記録がありません</p>
      )}

      <h3 className="sec">ケア履歴</h3>
      {logs.length ? (
        <section className="card">
          {(showAll ? logs : logs.slice(0, 10)).map((l) => {
            const { Icon, label } = CARE[l.type]
            return (
              <div className="line" key={l.id}>
                <span className="care-ic" style={careVar(l.type)}>
                  <Icon size={16} />
                </span>
                <span className="line-main">
                  <span>
                    <b>{label}</b>
                    <small>
                      {fmtDay(l.date)}
                      {l.note && ` ・ ${l.note}`}
                    </small>
                  </span>
                </span>
                <button className="icon-btn muted" onClick={() => db.logs.delete(l.id)} aria-label="記録を削除">
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })}
          {!showAll && logs.length > 10 && (
            <button className="btn ghost full" onClick={() => setShowAll(true)}>
              すべて表示 ({logs.length}件)
            </button>
          )}
        </section>
      ) : (
        <p className="none">まだ記録がありません</p>
      )}
    </Sheet>
  )
}
