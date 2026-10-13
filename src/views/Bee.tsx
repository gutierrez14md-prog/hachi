import { useEffect, useMemo, useState } from 'react'
import { SCHED } from '../care'
import { beeLines, type BeeTab } from '../bee'
import { useApp } from '../ctx'
import { lastBackup } from '../lib/backup'
import { addDays, today } from '../lib/date'
import { heads, isSnoozed, lightWater, nextDue } from '../lib/schedule'
import { useWeather } from '../lib/weather'

/**
 * ハチのひとこと: ロゴの右の吹き出し。いまの状況に合った一言を出し、押すと次の言葉に替わる。
 * 言葉そのものは src/bee.ts。設定の「ホームの表示」で消せる
 */
export function BeeSays({ tab }: { tab: BeeTab }) {
  const { plants, logs, journal, logsOf } = useApp()
  const t = today()
  const weather = useWeather(t)
  // 何番目の言葉を出しているか (押すたびに進む)
  const [n, setN] = useState(0)

  const lines = useMemo(() => {
    const tomorrow = addDays(t, 1)
    let over = 0, snoozed = 0, feed = false, water = 0, light = 0
    const due: typeof plants = [], next: typeof plants = []
    for (const p of plants) {
      const dates = SCHED.map((s) => [s, nextDue(p, s, logsOf(p.id))] as const)
      const now = dates.filter(([, d]) => d && d <= t)
      if (now.length) due.push(p)
      if (now.some(([, d]) => d! < t)) over += p.members?.length || 1
      if (now.some(([s]) => s !== 'water')) feed = true
      if (now.some(([s]) => s === 'water')) {
        water++
        if (lightWater(p, t)) light++
      }
      if (dates.some(([, d]) => d === tomorrow)) next.push(p)
      if (dates.some(([s, d]) => isSnoozed(p, s, d))) snoozed += p.members?.length || 1
    }
    return beeLines({
      tab,
      today: t,
      hour: new Date().getHours(),
      plants,
      heads: heads(plants),
      due: heads(due),
      over,
      tomorrow: heads(next),
      dueFeed: feed,
      dueAllLight: water > 0 && water === light && !feed,
      snoozed,
      logs,
      journal,
      weather,
      lastBackup: lastBackup(),
    })
  }, [tab, t, plants, logs, journal, logsOf, weather])

  // タブを替えたとき、先頭の一言が変わったとき (お世話を記録した、など) は、先頭に戻す
  const lead = lines[0]
  useEffect(() => setN(0), [tab, lead])

  if (!lines.length) return null
  return (
    <button className="bubble" onClick={() => setN((v) => v + 1)} aria-label={`ハチのひとこと: ${lines[n % lines.length]}。押すと、次のひとこと`}>
      <span aria-live="polite">{lines[n % lines.length]}</span>
    </button>
  )
}
