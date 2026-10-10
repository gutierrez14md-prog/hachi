import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { CARE, careVar, SCHED } from '../care'
import { useApp } from '../ctx'
import { today } from '../lib/date'
import { intervalOn, MAX_EVERY } from '../lib/schedule'
import { careLabel, WATER_LABELS } from '../method'
import { Field } from '../parts'
import type { CareSettings, Method, SchedType, Schedule } from '../types'

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

/** 水やりの呼び名 (ソーキング など)。空欄なら栽培方法に合わせた呼び名になり、それを薄く見せておく */
export function WaterLabelField({ value, onChange }: { value: { method?: Method; waterLabel?: string }; onChange: (v: string) => void }) {
  return (
    <Field label="水やりの呼び名">
      <input
        value={value.waterLabel ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={careLabel('water', { method: value.method })}
        list="water-labels"
      />
      <datalist id="water-labels">
        {WATER_LABELS.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
    </Field>
  )
}

/** 間隔が入っているか (生長期の日数、または月ごとのどこか 1 か月) */
export const hasInterval = (c: Schedule) => (c.monthly ? c.monthly.some((v) => v > 0) : c.days > 0)

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
      everyWater: s !== 'water' && c.everyWater ? Math.min(MAX_EVERY, Math.max(1, c.everyWater)) : undefined,
    }
  }
  return out
}

const EVERY = Array.from({ length: MAX_EVERY }, (_, i) => i + 1)
const everyLabel = (n: number) => (n === 1 ? '毎回' : `${n}回に1回`)

/**
 * 「水やり何回に 1 回」の図: しずくを並べ、一緒にあげる回にそのケアの印を付ける。
 * 数字を読まなくても、どの水やりであげるのかが見てわかるように
 */
function EveryFig({ n, WaterIcon, Icon }: { n: number; WaterIcon: LucideIcon; Icon: LucideIcon }) {
  return (
    <div className="every-fig" aria-hidden="true">
      {Array.from({ length: Math.max(6, n * 2) }, (_, i) => {
        const on = (i + 1) % n === 0
        return (
          <span key={i} className={on ? 'on' : ''}>
            <WaterIcon size={15} />
            {on && <Icon size={13} strokeWidth={2.4} />}
          </span>
        )
      })}
    </div>
  )
}

/** 水やり・肥料・活力剤の間隔と、休眠期の月の入力。植物と分類 (プリセット) の両方で使う */
export function CareEditor({
  care,
  dormantMonths,
  onChange,
  extra,
  stagger,
  onStagger,
  required,
  labels,
  icons,
}: {
  /** ケアのアイコンの差し替え (呼び名と揃える) */
  icons?: Partial<Record<SchedType, LucideIcon>>
  /** ケアの呼び名の差し替え (栽培方法によって「水やり」を「水替え」と呼ぶ、など) */
  labels?: Partial<Record<SchedType, string>>
  /** オン / オフを選ばせず、必ず設定させるケア */
  required?: SchedType[]
  care: CareSettings
  dormantMonths: number[]
  onChange: (patch: { care?: CareSettings; dormantMonths?: number[] }) => void
  /** ケアごとに末尾へ足す入力 (新規登録時の「最後に実施した日」) */
  extra?: (type: SchedType) => ReactNode
  /** 肥料と活力剤が同じ回に重なったら交互にずらすか。onStagger を渡したとき (植物の編集) だけ、スイッチを出す */
  stagger?: boolean
  onStagger?: (on: boolean) => void
}) {
  const { settings } = useApp()
  // 今の水やりの間隔 (日)。「だいたい◯日ごと」の目安と、日数から回数への置き換えに使う
  const waterDays = intervalOn({ dormantMonths }, care.water, today())
  /** 日数で決めていた間隔を、いちばん近い「水やり何回に 1 回」に置き換える */
  const toEvery = (c: Schedule) => Math.min(MAX_EVERY, Math.max(1, Math.round(c.days / (waterDays || 7))))
  const setCare = (type: SchedType, patch: Partial<Schedule>) =>
    onChange({ care: { ...care, [type]: { ...care[type], ...patch } } })
  const usesSeason = SCHED.some((s) => (care[s].enabled || required?.includes(s)) && !care[s].monthly)

  return (
    <>
      {SCHED.map((s) => {
        const c = care[s]
        const Icon = icons?.[s] ?? CARE[s].Icon
        const label = labels?.[s] ?? CARE[s].label
        const must = required?.includes(s)
        // 水やりに合わせられるケア (肥料・活力剤)。設定をオフにしたあとも、合わせてある株では選び直せるようにする
        const mixable = s !== 'water' && !!settings.careWithWater
        const every = s !== 'water' ? c.everyWater : undefined
        return (
          <section key={s} className="card care" style={careVar(s)}>
            <label className="care-h">
              <span className="care-ic">
                <Icon size={18} />
              </span>
              <b>{label}</b>
              {must ? (
                <span className="req">必須</span>
              ) : (
                <input
                  type="checkbox"
                  className="switch"
                  checked={c.enabled}
                  // 水に混ぜてあげる設定なら、はじめから「水やりに合わせる」にしておく
                  onChange={(e) =>
                    setCare(s, e.target.checked && mixable && !c.everyWater ? { enabled: true, everyWater: toEvery(c), monthly: null } : { enabled: e.target.checked })
                  }
                />
              )}
            </label>
            {(c.enabled || must) && (
              <div className="care-b">
                {(mixable || every) && (
                  <div className="seg">
                    <button type="button" className={every ? 'on' : ''} onClick={() => every || setCare(s, { everyWater: toEvery(c), monthly: null })}>
                      水やりに合わせる
                    </button>
                    <button type="button" className={every ? '' : 'on'} onClick={() => setCare(s, { everyWater: undefined })}>
                      日数で決める
                    </button>
                  </div>
                )}
                {every ? (
                  <>
                    <div className="every-chips" role="group" aria-label={`${labels?.water ?? CARE.water.label}何回に 1 回か`}>
                      {EVERY.map((n) => (
                        <button type="button" key={n} className={`chip ${every === n ? 'on' : ''}`} aria-pressed={every === n} onClick={() => setCare(s, { everyWater: n })}>
                          {everyLabel(n)}
                        </button>
                      ))}
                    </div>
                    <EveryFig n={every} WaterIcon={icons?.water ?? CARE.water.Icon} Icon={Icon} />
                    <p className="hint">
                      {every === 1 ? `${labels?.water ?? CARE.water.label}のたびに` : `${labels?.water ?? CARE.water.label}${every}回ごとに`}、{label}も一緒にあげます。
                      {waterDays > 0 && `今の間隔なら、だいたい${waterDays * every}日ごとです。`}
                    </p>
                    <label className="inline">
                      休眠期
                      <select value={c.offMode === 'pause' ? 'pause' : 'same'} onChange={(e) => setCare(s, { offMode: e.target.value as Schedule['offMode'] })}>
                        <option value="same">生長期と同じ</option>
                        <option value="pause">お休み</option>
                      </select>
                    </label>
                  </>
                ) : (
                  <>
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
                  </>
                )}
                {extra?.(s)}
              </div>
            )}
          </section>
        )
      })}

      {/* 水やりに合わせる肥料と活力剤が、同じ回に重なることがあるとき */}
      {onStagger && care.fertilizer.enabled && care.tonic.enabled && care.fertilizer.everyWater && care.tonic.everyWater && (
        <section className="card">
          <label className="line">
            <span className="line-main">
              <span>
                <b>肥料と活力剤を同じ日にあげない</b>
                <small>同じ回に重なったら、交互にずらします</small>
              </span>
            </span>
            <input type="checkbox" className="switch" checked={!!stagger} onChange={(e) => onStagger(e.target.checked)} />
          </label>
        </section>
      )}

      {usesSeason && (
        <>
          <h3 className="sec">休眠期の月</h3>
          <MonthChips value={dormantMonths} onChange={(v) => onChange({ dormantMonths: v })} />
        </>
      )}
    </>
  )
}
