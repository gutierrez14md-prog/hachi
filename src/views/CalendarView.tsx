import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CARE, careVar, SCHED } from '../care'
import { useApp } from '../ctx'
import { db } from '../db'
import { addDays, fmtDay, today } from '../lib/date'
import { projected } from '../lib/schedule'
import { careIcon, careLabel } from '../method'
import { Photo } from '../parts'
import type { CareLog, Plant, SchedType } from '../types'
import { MonthCal, monthRange, thisMonth } from './MonthCal'

export function CalendarView() {
  const { plants, allPlants, logs, logsOf, open, record } = useApp()
  const t = today()
  const [ym, setYm] = useState(thisMonth)
  const [sel, setSel] = useState(t)
  const { first, last } = monthRange(ym)
  // 記録済みはアーカイブした株のぶんも出す (予定は育てている株だけ)
  const plantOf = useMemo(() => new Map(allPlants.map((p) => [p.id, p])), [allPlants])

  // 記録済み (過去〜今日) と、今の間隔どおりに続けた場合の予定 (今日〜未来)
  const { done, plan } = useMemo(() => {
    const done = new Map<string, CareLog[]>()
    const plan = new Map<string, { p: Plant; type: SchedType }[]>()
    for (const l of logs) {
      if (l.date < first || l.date > last || !plantOf.has(l.plantId)) continue
      done.set(l.date, [...(done.get(l.date) ?? []), l])
    }
    for (const p of plants)
      for (const type of SCHED)
        for (const d of projected(p, type, logsOf(p.id), first, last)) plan.set(d, [...(plan.get(d) ?? []), { p, type }])
    return { done, plan }
  }, [plants, logs, logsOf, plantOf, first, last])

  const selDone = done.get(sel) ?? []
  const selPlan = plan.get(sel) ?? []
  const heading = sel === t ? '今日' : sel === addDays(t, 1) ? '明日' : fmtDay(sel)

  return (
    <>
      <MonthCal ym={ym} setYm={setYm} sel={sel} setSel={setSel} done={(d) => done.get(d)} plan={(d) => plan.get(d)} />

      <div className="legend">
        <span>
          <i className="dot" /> 記録済み
        </span>
        <span>
          <i className="dot plan" /> 予定
        </span>
        {SCHED.map((s) => (
          <span key={s}>
            <i className="dot" style={careVar(s)} /> {CARE[s].label}
          </span>
        ))}
      </div>

      <div className="list-head">
        <h2>{heading}</h2>
        {sel <= t && (
          <button className="btn ghost sm" onClick={() => open({ k: 'log', date: sel })}>
            <Plus size={15} /> 記録
          </button>
        )}
      </div>

      {selPlan.length > 0 && (
        <section className="card">
          <h3 className="card-t">{sel === t ? 'ケアが必要' : `予定 ${selPlan.length}件`}</h3>
          {selPlan.map(({ p, type }) => {
            const Icon = careIcon(type, p)
            const label = careLabel(type, p)
            return (
              <div className="line" key={p.id + type}>
                <button className="line-main" onClick={() => open({ k: 'plant', id: p.id })}>
                  <Photo id={p.photoId} className="thumb sm" />
                  <b className="pn">{p.name}</b>
                </button>
                {sel === t ? (
                  <button className="pill" style={careVar(type)} onClick={() => record([p.id], type)}>
                    <Icon size={15} />
                    {label}
                  </button>
                ) : (
                  <span className="tag" style={careVar(type)}>
                    <Icon size={14} />
                    {label}
                  </span>
                )}
              </div>
            )
          })}
        </section>
      )}

      {selDone.length > 0 && (
        <section className="card">
          <h3 className="card-t">記録済み {selDone.length}件</h3>
          {selDone.map((l) => {
            const p = plantOf.get(l.plantId)!
            const Icon = careIcon(l.type, p)
            const label = careLabel(l.type, p)
            return (
              <div className="line" key={l.id}>
                <button className="line-main" onClick={() => open({ k: 'plant', id: p.id })}>
                  <Photo id={p.photoId} className="thumb sm" />
                  <span>
                    <b className="pn">{p.name}</b>
                    {l.note && <small>{l.note}</small>}
                  </span>
                </button>
                <span className="tag" style={careVar(l.type)}>
                  <Icon size={14} />
                  {label}
                </span>
                <button className="icon-btn muted" onClick={() => db.logs.delete(l.id)} aria-label="記録を削除">
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })}
        </section>
      )}

      {!selPlan.length && !selDone.length && <p className="none">{sel > t ? 'ケアの予定はありません' : '記録はありません'}</p>}
    </>
  )
}
