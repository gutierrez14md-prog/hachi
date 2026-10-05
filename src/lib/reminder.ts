import type { CareLog, Plant, Settings } from '../types'
import { SCHED } from '../care'
import { addDays, today } from './date'
import { projected } from './schedule'

const REMINDER = 'hachi-reminder'
const pad = (n: number) => String(n).padStart(2, '0')

type Nav = Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> }

async function show(title: string, body: string) {
  const reg = await navigator.serviceWorker?.getRegistration()
  const opts = { body, icon: 'icon-192.png', tag: 'care-reminder' }
  if (reg) await reg.showNotification(title, opts)
  else new Notification(title, opts)
}

/**
 * 今日ケアが必要な植物があれば 1 日 1 回だけ通知する。
 * 同じ判定が public/sw.js にもある (アプリを閉じている間のバックグラウンド用)。
 */
export async function checkNotify() {
  if (!('caches' in window) || !('Notification' in window) || Notification.permission !== 'granted') return
  const c = await caches.open(REMINDER)
  const res = await c.match('/__reminder')
  if (!res) return
  const data: { enabled: boolean; time: string; days: Record<string, string[]> } = await res.json()
  if (!data.enabled) return
  const now = new Date()
  const key = today()
  if (`${pad(now.getHours())}:${pad(now.getMinutes())}` < data.time) return
  const notified = await c.match('/__notified')
  if (notified && (await notified.text()) === key) return
  const names = [...new Set(Object.keys(data.days).filter((k) => k <= key).flatMap((k) => data.days[k]))]
  if (!names.length) return
  await c.put('/__notified', new Response(key))
  await show(`今日の植物ケア ${names.length}件`, names.slice(0, 5).join('、') + (names.length > 5 ? ' ほか' : ''))
}

/** 向こう 60 日の予定表を service worker から読める場所に書き出し、アイコンのバッジも更新する */
export async function syncReminder(plants: Plant[], logsOf: (id: string) => CareLog[], settings: Settings) {
  const t = today()
  const days: Record<string, string[]> = {}
  for (const p of plants)
    for (const s of SCHED)
      for (const d of projected(p, s, logsOf(p.id), t, addDays(t, 60))) {
        const list = (days[d] ??= [])
        if (!list.includes(p.name)) list.push(p.name)
      }

  const nav = navigator as Nav
  const count = days[t]?.length ?? 0
  if (count) nav.setAppBadge?.(count).catch(() => {})
  else nav.clearAppBadge?.().catch(() => {})

  if (!('caches' in window)) return
  const c = await caches.open(REMINDER)
  await c.put('/__reminder', new Response(JSON.stringify({ enabled: settings.notify, time: settings.remindTime, days })))
  await checkNotify()
}

/** 通知の許可を求め、対応ブラウザではバックグラウンドの定期チェックも登録する */
export async function enableNotifications(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if ((await Notification.requestPermission()) !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker?.ready
    await (reg as unknown as { periodicSync?: { register: (tag: string, o: object) => Promise<void> } }).periodicSync?.register(
      'care-reminder',
      { minInterval: 3 * 60 * 60 * 1000 },
    )
  } catch {
    // Periodic Background Sync 非対応 (iOS / Firefox など)。アプリを開いたときの通知のみになる
  }
  return true
}

export const testNotification = () => show('Hachi', '通知はこのように届きます 🌿')
