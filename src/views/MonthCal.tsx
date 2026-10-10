import { ChevronLeft, ChevronRight } from 'lucide-react'
import { careVar } from '../care'
import { addDays, toKey, today } from '../lib/date'
import type { CareType } from '../types'

const DOW = ['日', '月', '火', '水', '木', '金', '土']

export type YearMonth = { y: number; m: number }
export const thisMonth = (): YearMonth => ({ y: new Date().getFullYear(), m: new Date().getMonth() })
/** その月の最初の日と最後の日 */
export const monthRange = ({ y, m }: YearMonth) => ({ first: toKey(new Date(y, m, 1)), last: toKey(new Date(y, m + 1, 0)) })

/**
 * 月のカレンダー: 見出し (前後の月へ) と日付のます。ますには、その日のケアを種類ごとの点で出す
 * (done = 記録済みは塗り、plan = 予定は輪)。sub = ほかの画面の中に置くとき (見出しを小さくする)
 */
export function MonthCal({
  ym,
  setYm,
  sel,
  setSel,
  done,
  plan,
  sub,
}: {
  ym: YearMonth
  setYm: (ym: YearMonth) => void
  sel: string
  setSel: (day: string) => void
  done: (day: string) => { type: CareType }[] | undefined
  plan: (day: string) => { type: CareType }[] | undefined
  sub?: boolean
}) {
  const t = today()
  const { first, last } = monthRange(ym)
  const lead = new Date(ym.y, ym.m, 1).getDay()
  const days = Array.from({ length: Number(last.slice(8)) }, (_, i) => addDays(first, i))
  const move = (n: number) => {
    const d = new Date(ym.y, ym.m + n, 1)
    setYm({ y: d.getFullYear(), m: d.getMonth() })
  }
  const types = (list: { type: CareType }[] | undefined) => [...new Set(list?.map((x) => x.type))].slice(0, 4)
  const title = `${ym.y}年${ym.m + 1}月`

  return (
    <>
      <header className={`cal-head ${sub ? 'sub' : ''}`}>
        <button className="sq" onClick={() => move(-1)} aria-label="前の月">
          <ChevronLeft size={20} />
        </button>
        <div className="row">
          {sub ? <h4>{title}</h4> : <h1>{title}</h1>}
          {!t.startsWith(first.slice(0, 7)) && (
            <button
              className="chip"
              onClick={() => {
                setYm(thisMonth())
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
          <button key={d} className={`cal-day ${d === sel ? 'sel' : ''} ${d === t ? 'today' : ''}`} onClick={() => setSel(d)}>
            <span className="cal-num">{Number(d.slice(8))}</span>
            <span className="dots">
              {types(done(d)).map((ty) => (
                <i key={ty} className="dot" style={careVar(ty)} />
              ))}
              {types(plan(d)).map((ty) => (
                <i key={`p${ty}`} className="dot plan" style={careVar(ty)} />
              ))}
            </span>
          </button>
        ))}
      </section>
    </>
  )
}
