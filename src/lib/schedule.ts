import type { CareLog, Plant, SchedType, Schedule } from '../types'
import { addDays, fromKey, monthOf, toKey, today } from './date'

type Season = Pick<Plant, 'dormantMonths'>

/** 株数。複数の植物をまとめた登録 (寄せ植え・着生) は、中身を 1 株ずつ数える */
export const heads = (list: Pick<Plant, 'members'>[]) => list.reduce((n, p) => n + (p.members?.length || 1), 0)

/** その日の時点での間隔 (日)。0 = その月はお休み */
export function intervalOn(p: Season, s: Schedule, key: string): number {
  const m = monthOf(key)
  if (s.monthly) return Math.max(0, s.monthly[m - 1] || 0)
  if (!p.dormantMonths.includes(m)) return Math.max(1, s.days)
  if (s.offMode === 'pause') return 0
  return Math.max(1, s.offMode === 'custom' ? s.offDays : s.days)
}

/** お休みの月なら、次に再開する月の 1 日まで送る */
function skipPause(p: Season, s: Schedule, key: string): string | null {
  let d = key
  for (let i = 0; i < 13; i++) {
    if (intervalOn(p, s, d) > 0) return d
    const dt = fromKey(d)
    d = toKey(new Date(dt.getFullYear(), dt.getMonth() + 1, 1))
  }
  return null // 12 か月すべてお休み = 予定なし
}

/** last に実施したとして、その次の予定日。間隔は「実施した月」のものを使う */
function nextAfter(p: Season, s: Schedule, last: string): string | null {
  const days = intervalOn(p, s, last)
  return skipPause(p, s, days ? addDays(last, days) : last)
}

export function lastDone(logs: CareLog[], type: string): string | null {
  let last: string | null = null
  for (const l of logs) if (l.type === type && (!last || l.date > last)) last = l.date
  return last
}

/** 次の予定日。過去日なら期限超過。予定なしなら null */
export function nextDue(p: Plant, type: SchedType, logs: CareLog[]): string | null {
  const s = p.care[type]
  if (!s.enabled) return null
  const last = lastDone(logs, type)
  const due = last ? nextAfter(p, s, last) : skipPause(p, s, p.createdDay)
  const until = p.snooze?.[type]
  return due && until && until > due ? until : due
}

/** 次の予定が「延期」で後ろへ送られているか */
export const isSnoozed = (p: Plant, type: SchedType, due: string | null) => !!due && p.snooze?.[type] === due

/**
 * 「今の予定どおりにケアし続けたら」の見込み日を from..to の範囲で返す。
 * 期限超過ぶんは今日やるものとして数える。
 */
export function projected(p: Plant, type: SchedType, logs: CareLog[], from: string, to: string): string[] {
  const out: string[] = []
  const t = today()
  let d = nextDue(p, type, logs)
  if (d && d < t) d = t
  for (let i = 0; d && d <= to && i < 400; i++) {
    if (d >= from) out.push(d)
    d = nextAfter(p, p.care[type], d)
  }
  return out
}
