import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CARE, careVar, SCHED } from '../care'
import { useApp } from '../ctx'
import { db } from '../db'
import { addDays, fmtDay, toKey, today } from '../lib/date'
import { projected } from '../lib/schedule'
import { Photo } from '../parts'
import type { CareLog, CareType, Plant, SchedType } from '../types'

const DOW = ['日', '月', '火', '水', '木', '金', '土']

export function CalendarView() {
  const { plants, logs, logsOf, open, record } = useApp()
  const t = today()
  const [ym, setYm] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }))
  const [sel, setSel] = useState(t)

  const first = toKey(new Date(ym.y, ym.m, 1))
  const last = toKey(new Date(ym.y, ym.m + 1, 0))
  const lead = new Date(ym.y, ym.m, 1).getDay()
  const days = Array.from({ length: Number(last.slice(8)) }, (_, i) => addDays(first, i))
  const plantOf = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants])

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

  const move = (n: number) => {
    const d = new Date(ym.y, ym.m + n, 1)
    setYm({ y: d.getFullYear(), m: d.getMonth() })
  }
  const types = (list: { type: CareType }[] | undefined) => [...new Set(list?.map((x) => x.type))].slice(0, 4)

  const selDone = done.get(sel) ?? []
  const selPlan = plan.get(sel) ?? []
  const heading = sel === t ? '今日' : sel === addDays(t, 1) ? '明日' : fmtDay(sel)

  return (
    <>
      <header className="cal-head">
        <button className="sq" onClick={() => move(-1)} aria-label="前の月">
          <ChevronLeft size={20} />
        </button>
        <div className="row">
          <h1>
            {ym.y}年{ym.m + 1}月
          </h1>
          {!t.startsWith(first.slice(0, 7)) && (
            <button
              className="chip"
              onClick={() => {
                setYm({ y: new Date().getFullYear(), m: new Date().getMonth() })
                setSel(t)
              }}
            >
              今日
            </button>
          )}
        </div>
        <button className="sq" onClick={() => move(1)} aria-label="次の月">
          <ChevronRight size={20} />
        </button>
      </header>

      <section className="card cal">
        {DOW.map((d) => (
          <div key={d} className="cal-dow">
            {d}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`b${i}`} />
        ))}
        {days.map((d) => (
          <button
            key={d}
            className={`cal-day ${d === sel ? 'sel' : ''} ${d === t ? 'today' : ''}`}
            onClick={() => setSel(d)}
          >
            <span className="cal-num">{Number(d.slice(8))}</span>
            <span className="dots">
              {types(done.get(d)).map((ty) => (
                <i key={ty} className="dot" style={careVar(ty)} />
              ))}
              {types(plan.get(d)).map((ty) => (
                <i key={`p${ty}`} className="dot plan" style={careVar(ty)} />
              ))}
            </span>
          </button>
        ))}
      </section>

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
            const { Icon, label } = CARE[type]
            return (
              <div className="line" key={p.id + type}>
                <button className="line-main" onClick={() => open({ k: 'plant', id: p.id })}>
                  <Photo id={p.photoId} className="thumb sm" />
                  <b>{p.name}</b>
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
            const { Icon, label } = CARE[l.type]
            const p = plantOf.get(l.plantId)!
            return (
              <div className="line" key={l.id}>
                <button className="line-main" onClick={() => open({ k: 'plant', id: p.id })}>
                  <Photo id={p.photoId} className="thumb sm" />
                  <span>
                    <b>{p.name}</b>
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
