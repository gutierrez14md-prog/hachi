import { SCHED } from '../care'
import { useApp } from '../ctx'
import { db } from '../db'
import { addDays, fmtFull, today } from '../lib/date'
import { nextDue } from '../lib/schedule'
import { Photo, Sheet } from '../parts'

/** アーカイブした株の一覧。記録と写真はそのまま見られ、詳細から元に戻せる */
export function Archive() {
  const { allPlants, open } = useApp()
  const list = allPlants
    .filter((p) => p.archivedDay)
    .sort((a, b) => b.archivedDay!.localeCompare(a.archivedDay!))

  return (
    <Sheet title="アーカイブ">
      {!list.length && <p className="none">アーカイブした株はありません</p>}
      <ul className="plants">
        {list.map((p) => (
          <li key={p.id} className="plant">
            <button className="plant-main" onClick={() => open({ k: 'plant', id: p.id })}>
              <Photo id={p.photoId} className="thumb" />
              <span className="plant-text">
                <b>{p.name}</b>
                {p.scientificName && <i>{p.scientificName}</i>}
                <small>{fmtFull(p.archivedDay!)} にアーカイブ</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

const OPTIONS: [number, string][] = [
  [1, '明日'],
  [2, '2日後'],
  [3, '3日後'],
  [7, '1週間後'],
]

/** 今日のケアを先へ送る (雨だった、まだ土が湿っている、など)。記録は付けずに予定だけ動かす */
export function Snooze({ plantId }: { plantId: string }) {
  const { allPlants, logsOf, close, toast } = useApp()
  const p = allPlants.find((x) => x.id === plantId)
  if (!p) return null
  const t = today()
  const due = SCHED.filter((s) => {
    const d = nextDue(p, s, logsOf(p.id))
    return d && d <= t
  })

  const pick = async (days: number, label: string) => {
    const before = p.snooze ?? {}
    const snooze = { ...before }
    for (const s of due) snooze[s] = addDays(t, days)
    await db.plants.update(p.id, { snooze })
    toast(`${p.name}のケアを${label}に延期しました`, () => db.plants.update(p.id, { snooze: before }))
    close()
  }

  return (
    <Sheet title={`${p.name}のケアを延期`}>
      <div className="opts">
        {OPTIONS.map(([days, label]) => (
          <button key={days} disabled={!due.length} onClick={() => pick(days, label)}>
            <b>{label}</b>
            <small>{fmtFull(addDays(t, days))}</small>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
