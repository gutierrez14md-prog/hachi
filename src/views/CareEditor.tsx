import type { ReactNode } from 'react'
import { CARE, careVar, SCHED } from '../care'
import { intervalOn } from '../lib/schedule'
import type { CareSettings, SchedType, Schedule } from '../types'

const num = (v: string) => Math.max(0, parseInt(v) || 0)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

export function MonthChips({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="months">
      {MONTHS.map((m) => (
        <button
          type="button"
          key={m}
          className={`chip ${value.includes(m) ? 'on' : ''}`}
          onClick={() => onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m])}
        >
          {m}月
        </button>
      ))}
    </div>
  )
}

/** 保存前に、空欄や 0 の間隔を使える値に直す */
export function cleanCare(care: CareSettings): CareSettings {
  const out = { ...care }
  for (const s of SCHED) {
    const c = care[s]
    out[s] = {
      ...c,
      days: Math.max(1, c.days),
      offDays: Math.max(1, c.offDays),
      monthly: c.monthly ? MONTHS.map((m) => Math.max(0, c.monthly![m - 1] || 0)) : null,
    }
  }
  return out
}

/** 水やり・肥料・活力剤の間隔と、休眠期の月の入力。植物と分類 (プリセット) の両方で使う */
export function CareEditor({
  care,
  dormantMonths,
  onChange,
  extra,
}: {
  care: CareSettings
  dormantMonths: number[]
  onChange: (patch: { care?: CareSettings; dormantMonths?: number[] }) => void
  /** ケアごとに末尾へ足す入力 (新規登録時の「最後に実施した日」) */
  extra?: (type: SchedType) => ReactNode
}) {
  const setCare = (type: SchedType, patch: Partial<Schedule>) =>
    onChange({ care: { ...care, [type]: { ...care[type], ...patch } } })
  const usesSeason = SCHED.some((s) => care[s].enabled && !care[s].monthly)

  return (
    <>
      {SCHED.map((s) => {
        const c = care[s]
        const { Icon, label } = CARE[s]
        return (
          <section key={s} className="card care" style={careVar(s)}>
            <label className="care-h">
              <span className="care-ic">
                <Icon size={18} />
              </span>
              <b>{label}</b>
              <input type="checkbox" className="switch" checked={c.enabled} onChange={(e) => setCare(s, { enabled: e.target.checked })} />
            </label>
            {c.enabled && (
              <div className="care-b">
                <div className="seg">
                  <button type="button" className={c.monthly ? '' : 'on'} onClick={() => setCare(s, { monthly: null })}>
                    生長期・休眠期
                  </button>
                  <button
                    type="button"
                    className={c.monthly ? 'on' : ''}
                    // 今の設定を 12 か月に展開したところから始める
                    onClick={() =>
                      c.monthly || setCare(s, { monthly: MONTHS.map((m) => intervalOn({ dormantMonths }, c, `2000-${String(m).padStart(2, '0')}-01`)) })
                    }
                  >
                    月ごと
                  </button>
                </div>
                {c.monthly ? (
                  <>
                    <div className="month-grid" aria-label="月ごとの間隔 (日)。空欄はお休み">
                      {MONTHS.map((m) => (
                        <label key={m}>
                          <span>{m}月</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            placeholder="休"
                            value={c.monthly![m - 1] || ''}
                            onChange={(e) => setCare(s, { monthly: c.monthly!.map((v, i) => (i === m - 1 ? num(e.target.value) : v)) })}
                          />
                        </label>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <label className="inline">
                      生長期
                      <input type="number" inputMode="numeric" min={1} value={c.days || ''} onChange={(e) => setCare(s, { days: num(e.target.value) })} />
                      日ごと
                    </label>
                    <label className="inline">
                      休眠期
                      <select value={c.offMode} onChange={(e) => setCare(s, { offMode: e.target.value as Schedule['offMode'] })}>
                        <option value="same">生長期と同じ</option>
                        <option value="custom">間隔を変える</option>
                        <option value="pause">お休み</option>
                      </select>
                      {c.offMode === 'custom' && (
                        <>
                          <input type="number" inputMode="numeric" min={1} value={c.offDays || ''} onChange={(e) => setCare(s, { offDays: num(e.target.value) })} />
                          日ごと
                        </>
                      )}
                    </label>
                  </>
                )}
                {extra?.(s)}
              </div>
            )}
          </section>
        )
      })}

      {usesSeason && (
        <>
          <h3 className="sec">休眠期の月</h3>
          <MonthChips value={dormantMonths} onChange={(v) => onChange({ dormantMonths: v })} />
        </>
      )}
    </>
  )
}
