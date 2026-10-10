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

/** 水やりの回数で数えるケアか (水に混ぜてあげる肥料・活力剤) */
export const byWater = (p: Pick<Plant, 'care'>, type: SchedType) => type !== 'water' && p.care[type].enabled && !!p.care[type].everyWater

/** 水やり何回に 1 回か、の上限 */
export const MAX_EVERY = 6
const COUNTED: SchedType[] = ['fertilizer', 'tonic']
/** まだ一度もあげていないケアの「前回からの水やりの回数」。次の水やりですぐあげる */
const NEVER = 999

/**
 * これからの水やりを順にたどり、その回に一緒にあげるケア (水やりの回数で数えるもの) を visit に渡す。
 * visit が false を返したら止める。clamp = 過ぎている水やりを今日やるものとして数える (カレンダーの見込み用)
 *   ・前回あげてからの水やりの回数が「何回に 1 回」に届いた回であげる
 *   ・休眠期お休みの月、開始日の前、延期中の回は飛ばし、そのあと最初の水やりであげる
 *   ・stagger の株で 2 つが重なったら、あいだの空いているほうだけあげる (もう片方は次の水やりへ)
 */
function waterings(p: Plant, logs: CareLog[], visit: (date: string, given: SchedType[]) => boolean, clamp = false) {
  const types = COUNTED.filter((s) => byWater(p, s))
  const first = types.length ? nextDue(p, 'water', logs) : null
  if (!first) return
  const since = {} as Record<SchedType, number>
  for (const s of types) {
    const last = lastDone(logs, s)
    since[s] = last ? new Set(logs.filter((l) => l.type === 'water' && l.date > last).map((l) => l.date)).size : NEVER
  }
  const open = (s: SchedType, d: string) => {
    const c = p.care[s]
    if ((c.start && d < c.start) || (p.snooze?.[s] && d < p.snooze[s]!)) return false
    return !(c.offMode === 'pause' && p.dormantMonths.includes(monthOf(d)))
  }
  const t = today()
  let d: string | null = first < t ? t : first
  for (let i = 0; d && i < 120; i++) {
    let given = types.filter((s) => since[s] + 1 >= p.care[s].everyWater! && open(s, d!))
    if (p.stagger && given.length > 1) given = [given.reduce((a, b) => (since[b] > since[a] ? b : a))]
    for (const s of types) since[s] = given.includes(s) ? 0 : since[s] + 1
    if (!visit(i === 0 && !clamp ? first : d, given)) return
    d = nextAfter(p, p.care.water, d)
  }
}

/** 次の予定日。過去日なら期限超過。予定なしなら null */
export function nextDue(p: Plant, type: SchedType, logs: CareLog[]): string | null {
  const s = p.care[type]
  if (!s.enabled) return null
  if (byWater(p, type)) {
    let found: string | null = null
    waterings(p, logs, (d, given) => !given.includes(type) || ((found = d), false))
    return found
  }
  const last = lastDone(logs, type)
  let due = last ? nextAfter(p, s, last) : skipPause(p, s, s.start || p.createdDay)
  // 開始日より前には出さない (開始日を決める前に付けた記録が残っていても)
  if (due && last && s.start && s.start > due) due = skipPause(p, s, s.start)
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
  if (byWater(p, type)) {
    waterings(p, logs, (d, given) => (given.includes(type) && d >= from && d <= to && out.push(d), d <= to), true)
    return out
  }
  const t = today()
  let d = nextDue(p, type, logs)
  if (d && d < t) d = t
  for (let i = 0; d && d <= to && i < 400; i++) {
    if (d >= from) out.push(d)
    d = nextAfter(p, p.care[type], d)
  }
  return out
}
