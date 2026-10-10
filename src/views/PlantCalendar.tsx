import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ALL_TYPES, careVar, SCHED } from '../care'
import { useApp } from '../ctx'
import { db } from '../db'
import { addDays, fmtDay, today } from '../lib/date'
import { projected } from '../lib/schedule'
import { careIcon, careLabel } from '../method'
import type { CareLog, Plant, SchedType } from '../types'
import { MonthCal, monthRange, thisMonth } from './MonthCal'

/**
 * 植物 1 株のケアカレンダー: これまでの記録 (塗りの点) と、今の間隔どおりに続けた場合の予定 (輪の点)。
 * 日付を選ぶと、その日のケアが下に出る。アーカイブした株は、記録だけ出す
 */
export function PlantCalendar({ plant: p, logs }: { plant: Plant; logs: CareLog[] }) {
  const { open } = useApp()
  const t = today()
  const [ym, setYm] = useState(thisMonth)
  const [sel, setSel] = useState(t)
  const { first, last } = monthRange(ym)
  const archived = !!p.archivedDay

  const { done, plan } = useMemo(() => {
    const done = new Map<string, CareLog[]>()
    const plan = new Map<string, { type: SchedType }[]>()
    for (const l of logs) {
      if (l.date < first || l.date > last) continue
      done.set(l.date, [...(done.get(l.date) ?? []), l])
    }
    if (!archived)
      for (const type of SCHED) for (const d of projected(p, type, logs, first, last)) plan.set(d, [...(plan.get(d) ?? []), { type }])
    return { done, plan }
  }, [p, logs, archived, first, last])

  // 凡例に出すのは、この株で予定を立てているケアと、記録のあるケアだけ
  const used = ALL_TYPES.filter((ty) => (!archived && SCHED.includes(ty as SchedType) && p.care[ty as SchedType].enabled) || logs.some((l) => l.type === ty))
  const selDone = done.get(sel) ?? []
  const selPlan = plan.get(sel) ?? []
  const heading = sel === t ? '今日' : sel === addDays(t, 1) ? '明日' : fmtDay(sel)

  return (
    <>
      <h3 className="sec">ケアカレンダー</h3>
      <MonthCal sub ym={ym} setYm={setYm} sel={sel} setSel={setSel} done={(d) => done.get(d)} plan={(d) => plan.get(d)} />
      <div className="legend sub">
        <span>
          <i className="dot" /> 記録済み
        </span>
        {!archived && (
          <span>
            <i className="dot plan" /> 予定
          </span>
        )}
        {used.map((ty) => (
          <span key={ty}>
            <i className="dot" style={careVar(ty)} /> {careLabel(ty, p)}
          </span>
        ))}
      </div>

      <section className="card">
        <div className="cal-sel">
          <h3 className="card-t">{heading}</h3>
          {sel <= t && !archived && (
            <button className="btn ghost sm" onClick={() => open({ k: 'log', plantId: p.id, date: sel })}>
              <Plus size={15} /> 記録
            </button>
          )}
        </div>
        {selPlan.map(({ type }) => {
          const Icon = careIcon(type, p)
          return (
            <div className="line" key={`p${type}`}>
              <span className="care-ic" style={careVar(type)}>
                <Icon size={16} />
              </span>
              <span className="line-main">
                <b>{careLabel(type, p)}</b>
              </span>
              <span className="soft">{sel === t ? 'ケアが必要' : '予定'}</span>
            </div>
          )
        })}
        {selDone.map((l) => {
          const Icon = careIcon(l.type, p)
          return (
            <div className="line" key={l.id}>
              <span className="care-ic" style={careVar(l.type)}>
                <Icon size={16} />
              </span>
              <span className="line-main">
                <span>
                  <b>{careLabel(l.type, p)}</b>
                  <small>記録済み{l.note && ` ・ ${l.note}`}</small>
                </span>
              </span>
              <button className="icon-btn muted" onClick={() => db.logs.delete(l.id)} aria-label="記録を削除">
                <Trash2 size={16} />
              </button>
            </div>
          )
        })}
        {!selPlan.length && !selDone.length && <p className="none">{sel > t ? 'ケアの予定はありません' : '記録はありません'}</p>}
      </section>
    </>
  )
}
