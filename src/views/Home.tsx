import { Check, MapPin, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CARE, careVar, SCHED } from '../care'
import { useApp } from '../ctx'
import { dueLabel, fmtDay, today } from '../lib/date'
import { nextDue } from '../lib/schedule'
import { Photo, PotIcon } from '../parts'
import type { SchedType } from '../types'

type Sort = 'water' | 'name' | 'sci' | 'new'
const SORTS: [Sort, string][] = [
  ['water', '水やりが近い順'],
  ['name', '名前順'],
  ['sci', '学名順'],
  ['new', '追加が新しい順'],
]

export function Home() {
  const { plants, logsOf, open, record } = useApp()
  const [q, setQ] = useState('')
  const [loc, setLoc] = useState('')
  const [sort, setSort] = useState<Sort>(() => (localStorage.getItem('sort') as Sort) || 'water')
  const t = today()

  const rows = useMemo(
    () =>
      plants.map((p, i) => {
        const due = {} as Record<SchedType, string | null>
        for (const s of SCHED) due[s] = nextDue(p, s, logsOf(p.id))
        return { p, due, i }
      }),
    [plants, logsOf],
  )

  const dueNow = rows
    .map((r) => ({ ...r, types: SCHED.filter((s) => r.due[s] && r.due[s]! <= t) }))
    .filter((r) => r.types.length)
  const waterDue = dueNow.filter((r) => r.types.includes('water')).map((r) => r.p.id)

  const locations = [...new Set(plants.map((p) => p.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'))
  const needle = q.trim().toLowerCase()
  const list = rows
    .filter((r) => !loc || r.p.location === loc)
    .filter(
      (r) => !needle || [r.p.name, r.p.scientificName, r.p.location].some((v) => v.toLowerCase().includes(needle)),
    )
    .sort((a, b) => {
      if (sort === 'name') return a.p.name.localeCompare(b.p.name, 'ja')
      if (sort === 'sci') return (a.p.scientificName || '￿').localeCompare(b.p.scientificName || '￿')
      if (sort === 'new') return b.p.createdDay.localeCompare(a.p.createdDay) || b.i - a.i
      return (a.due.water ?? '9999').localeCompare(b.due.water ?? '9999') || a.p.name.localeCompare(b.p.name, 'ja')
    })

  if (!plants.length)
    return (
      <div className="empty">
        <div className="empty-icon">
          <PotIcon size={36} />
        </div>
        <h1>Hachi</h1>
        <p>育てている植物を登録して、水やりや生長を記録しましょう。</p>
        <button className="btn primary" onClick={() => open({ k: 'plantForm' })}>
          最初の植物を追加
        </button>
      </div>
    )

  return (
    <>
      <header className="top">
        <p className="eyebrow">{fmtDay(t)}</p>
        <h1>{dueNow.length ? `今日のケア ${dueNow.length}株` : '今日のケアは完了'}</h1>
      </header>

      {dueNow.length > 0 && (
        <section className="card due">
          {dueNow.map(({ p, types, due }) => (
            <div className="due-row" key={p.id}>
              <button className="due-plant" onClick={() => open({ k: 'plant', id: p.id })}>
                <Photo id={p.photoId} className="thumb sm" />
                <span>
                  <b>{p.name}</b>
                  <small>{types.map((s) => dueLabel(due[s]!)).find((l) => l !== '今日') ?? '今日'}</small>
                </span>
              </button>
              <div className="due-acts">
                {types.map((s) => {
                  const { Icon, label } = CARE[s]
                  return (
                    <button key={s} className="pill" style={careVar(s)} onClick={() => record([p.id], s)}>
                      <Icon size={15} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {waterDue.length > 1 && (
            <button className="btn ghost full" onClick={() => record(waterDue, 'water')}>
              <Check size={16} /> {waterDue.length}株まとめて水やり済みにする
            </button>
          )}
        </section>
      )}

      <div className="search">
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="名前・学名で検索" />
        {q && (
          <button onClick={() => setQ('')} aria-label="クリア">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="list-head">
        <h2>
          植物 <span>{list.length}</span>
        </h2>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as Sort)
            localStorage.setItem('sort', e.target.value)
          }}
        >
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {locations.length > 0 && (
        <div className="chips scroll">
          <button className={`chip ${!loc ? 'on' : ''}`} onClick={() => setLoc('')}>
            すべて
          </button>
          {locations.map((l) => (
            <button key={l} className={`chip ${loc === l ? 'on' : ''}`} onClick={() => setLoc(loc === l ? '' : l)}>
              {l}
            </button>
          ))}
        </div>
      )}

      <ul className="plants">
        {list.map(({ p, due }) => {
          const w = due.water
          const late = !!w && w <= t
          return (
            <li key={p.id} className="plant">
              <button className="plant-main" onClick={() => open({ k: 'plant', id: p.id })}>
                <Photo id={p.photoId} className="thumb" />
                <span className="plant-text">
                  <b>{p.name}</b>
                  {p.scientificName && <i>{p.scientificName}</i>}
                  <small>
                    {p.location && (
                      <>
                        <MapPin size={11} /> {p.location}
                        {' ・ '}
                      </>
                    )}
                    <span className={late ? 'late' : ''}>{w ? `水やり ${dueLabel(w)}` : '水やり予定なし'}</span>
                  </small>
                </span>
              </button>
              <button
                className={`drop ${late ? 'on' : ''}`}
                style={careVar('water')}
                onClick={() => record([p.id], 'water')}
                aria-label={`${p.name}に水やりを記録`}
              >
                <CARE.water.Icon size={20} />
              </button>
            </li>
          )
        })}
        {!list.length && <li className="none">該当する植物がありません</li>}
      </ul>
    </>
  )
}
