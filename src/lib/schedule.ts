import type { CareLog, Plant, SchedType, Schedule } from '../types'
import { addDays, fromKey, monthOf, toKey, today } from './date'

const isDormant = (p: Plant, key: string) => p.dormantMonths.includes(monthOf(key))

/** 休眠期は休止の設定なら、次に生長期へ入る月の 1 日まで送る */
function skipPause(p: Plant, s: Schedule, key: string): string | null {
  if (s.offMode !== 'pause') return key
  let d = key
  for (let i = 0; i < 13; i++) {
    if (!isDormant(p, d)) return d
    const dt = fromKey(d)
    d = toKey(new Date(dt.getFullYear(), dt.getMonth() + 1, 1))
  }
  return null // 12 か月すべて休眠 = 予定なし
}

/** last に実施したとして、その次の予定日 */
function nextAfter(p: Plant, s: Schedule, last: string): string | null {
  const dormant = isDormant(p, last)
  if (dormant && s.offMode === 'pause') return skipPause(p, s, last)
  const days = Math.max(1, dormant && s.offMode === 'custom' ? s.offDays : s.days)
  return skipPause(p, s, addDays(last, days))
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
  return last ? nextAfter(p, s, last) : skipPause(p, s, p.createdDay)
}

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
