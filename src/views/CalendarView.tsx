import { Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CARE, careVar, SCHED } from '../care'
import { useApp } from '../ctx'
import { db } from '../db'
import { addDays, fmtDay, today } from '../lib/date'
import { heads, projected } from '../lib/schedule'
import { logIcon, logLabel } from '../method'
import { CarePills, Photo } from '../parts'
import type { CareLog, Plant, SchedType } from '../types'
import { MonthCal, monthRange, thisMonth } from './MonthCal'

export function CalendarView() {
  const { plants, allPlants, logs, logsOf, open, toast } = useApp()
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

  // 記録済みも、株ごとに 1 行にまとめる
  const selDone: { p: Plant; logs: CareLog[] }[] = []
  for (const l of done.get(sel) ?? []) {
    const row = selDone.find((r) => r.p.id === l.plantId)
    if (row) row.logs.push(l)
    else selDone.push({ p: plantOf.get(l.plantId)!, logs: [l] })
  }
  // その日の予定は、株ごとに 1 行にまとめる (水やりと肥料が重なる株を、2 行に分けない)
  const selPlan: { p: Plant; types: SchedType[] }[] = []
  for (const { p, type } of plan.get(sel) ?? []) {
    const row = selPlan.find((r) => r.p.id === p.id)
    if (row) row.types.push(type)
    else selPlan.push({ p, types: [type] })
  }
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
          {/* 数は株数 (ホームと同じ数え方。まとめた登録は中身を 1 株ずつ) */}
          <h3 className="card-t">
            {sel === t ? 'ケアが必要' : '予定'} {heads(selPlan.map((r) => r.p))}株
          </h3>
          {selPlan.map(({ p, types }) => (
            <div className="line" key={p.id}>
              <button className="line-main" onClick={() => open({ k: 'plant', id: p.id })}>
                <Photo id={p.photoId} className="thumb sm" />
                <b className="pn">{p.name}</b>
              </button>
              <div className="due-acts">
                <CarePills p={p} types={types} day={sel} record={sel === t} />
              </div>
            </div>
          ))}
        </section>
      )}

      {selDone.length > 0 && (
        <section className="card">
          <h3 className="card-t">記録済み {heads(selDone.map((r) => r.p))}株</h3>
          {selDone.map(({ p, logs }) => {
            // メモは名前の下に並べる (ちょろ水の印として入れたメモは、札の名前でわかるので出さない)
            const notes = logs.filter((l) => l.note && logLabel(l, p) !== l.note)
            return (
              <div className="line" key={p.id}>
                <button className="line-main" onClick={() => open({ k: 'plant', id: p.id })}>
                  <Photo id={p.photoId} className="thumb sm" />
                  <span>
                    <b className="pn">{p.name}</b>
                    {notes.map((l) => (
                      <small key={l.id}>
                        {logLabel(l, p)}：{l.note}
                      </small>
                    ))}
                  </span>
                </button>
                {/* 記録の札。押すと、その 1 件を消す (取り消せる) */}
                <div className="due-acts">
                  {logs.map((l) => {
                    const Icon = logIcon(l, p)
                    const label = logLabel(l, p)
                    return (
                      <button
                        key={l.id}
                        className="tag del"
                        style={careVar(l.type)}
                        aria-label={`${p.name}の${label}の記録を消す`}
                        onClick={async () => {
                          await db.logs.delete(l.id)
                          toast(`${label}の記録を消しました`, () => db.logs.put(l))
                        }}
                      >
                        <Icon size={14} />
                        {label}
                        <X size={12} />
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {!selPlan.length && !selDone.length && <p className="none">{sel > t ? 'ケアの予定はありません' : '記録はありません'}</p>}
    </>
  )
}
