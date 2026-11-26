import { useState } from 'react'
import { useApp } from '../ctx'
import { db, newId } from '../db'
import { addDays, diffDays, fmtDay, fmtFull, today } from '../lib/date'
import { DateInput, Field, Sheet } from '../parts'
import type { CareLog, Plant } from '../types'

/** ケア履歴に残すメモ (種類は「その他」)。来年の断水の時期の参考にする */
export const DRY_START = '断水開始'
const DRY_END = '断水終了'

/** 断水中の様子を 1 行で: 「11/20から断水中（7日目）」 */
export const dryText = (p: Plant, t = today()) => (p.dry ? `${fmtDay(p.dry.from)}から断水中（${diffDays(t, p.dry.from) + 1}日目）` : '')

/**
 * 断水 (落葉しきった株などの水を、春まで切る)。株ごとに、始める / 再開の目安を直す / 終える。
 * 選んだ株に断水していない株があれば、その株の断水を始める。すべて断水中なら、目安を直すか、断水を終える
 */
export function DrySheet({ plantIds, onDone }: { plantIds: string[]; onDone?: () => void }) {
  const { allPlants, close, toast } = useApp()
  const t = today()
  const list = plantIds.map((id) => allPlants.find((x) => x.id === id)).filter((p): p is Plant => !!p)
  const starts = list.filter((p) => !p.dry)
  const drying = list.filter((p) => p.dry)
  const one = list.length === 1 ? list[0] : undefined
  const who = one ? one.name : `${(starts.length ? starts : drying).length}株`

  const [from, setFrom] = useState(t)
  // 再開の目安。断水中の株を直すときは、いまの目安 (株ごとに違えば空) から
  const [initial] = useState(() => {
    const all = [...new Set(drying.map((p) => p.dry!.until ?? ''))]
    return all.length === 1 && !starts.length ? all[0] : ''
  })
  const [until, setUntil] = useState(initial)

  // 取り消し用に、変える前の断水の状態と、足した記録を覚えておく
  const done = (msg: string, before: Pick<Plant, 'id' | 'dry' | 'dryEnded'>[], logs: CareLog[]) => {
    toast(msg, () =>
      db.transaction('rw', db.plants, db.logs, async () => {
        await Promise.all(before.map((b) => db.plants.update(b.id, { dry: b.dry, dryEnded: b.dryEnded })))
        await db.logs.bulkDelete(logs.map((l) => l.id))
      }),
    )
    close()
    onDone?.()
  }
  const snapshot = (ps: Plant[]) => ps.map(({ id, dry, dryEnded }) => ({ id, dry, dryEnded }))
  const log = (p: Plant, date: string, note: string): CareLog => ({ id: newId(), plantId: p.id, type: 'other', date, note, at: Date.now() })

  const start = async () => {
    const dry = { from, ...(until ? { until } : {}) }
    const logs = starts.map((p) => log(p, from, DRY_START))
    await db.transaction('rw', db.plants, db.logs, async () => {
      await Promise.all(starts.map((p) => db.plants.update(p.id, { dry })))
      await db.logs.bulkAdd(logs)
    })
    done(`${who}の断水を始めました`, snapshot(starts), logs)
  }

  const saveUntil = async () => {
    await db.transaction('rw', db.plants, () =>
      Promise.all(drying.map((p) => db.plants.update(p.id, { dry: { from: p.dry!.from, ...(until ? { until } : {}) } }))),
    )
    done(until ? `${who}の再開の目安を${fmtDay(until)}にしました` : `${who}の再開の目安を消しました`, snapshot(drying), [])
  }

  const end = async () => {
    const logs = drying.map((p) => log(p, t, `${DRY_END}（${diffDays(t, p.dry!.from) + 1}日間）`))
    await db.transaction('rw', db.plants, db.logs, async () => {
      await Promise.all(drying.map((p) => db.plants.update(p.id, { dry: undefined, dryEnded: t })))
      await db.logs.bulkAdd(logs)
    })
    done(`${who}の断水を終えました`, snapshot(drying), logs)
  }

  // 断水を始める
  if (starts.length)
    return (
      <Sheet
        title={`${who}の断水を始める`}
        action={
          <button className="btn primary grow" disabled={!from || (!!until && until <= from)} onClick={start}>
            断水を始める
          </button>
        }
      >
        <p className="hint lead">
          水やり・肥料・活力剤の予定を、断水を終えるまで出しません。再開の目安を入れておくと、その日に「今日のケア」でお知らせします（自動では再開しません）。
          {drying.length > 0 && `（選んだ${list.length}株のうち、すでに断水中の${drying.length}株はそのままです）`}
        </p>
        <Field label="断水を始めた日" required>
          <DateInput max={t} value={from} onChange={(v) => v && v <= t && setFrom(v)} aria-label="断水を始めた日" />
        </Field>
        <Field label="再開の目安">
          <DateInput clearable min={addDays(from, 1)} value={until} onChange={setUntil} aria-label="再開の目安" />
        </Field>
      </Sheet>
    )

  // 断水中の株: 目安を直すか、終える
  const changed = until !== initial
  return (
    <Sheet
      title={`${who}の断水`}
      action={
        <button className="btn primary grow" disabled={!drying.length} onClick={end}>
          断水を終える
        </button>
      }
    >
      <p className="hint lead">
        {one ? `${fmtFull(one.dry!.from)}から断水中です（${diffDays(t, one.dry!.from) + 1}日目）。` : `${drying.length}株とも断水中です。`}
        断水を終えると、今日から水やりの予定が戻ります。
      </p>
      <h3 className="sec">再開の目安</h3>
      <div className="row gap">
        <DateInput clearable className="grow" min={addDays(t, 1)} value={until} onChange={setUntil} aria-label="再開の目安" />
        <button className="btn ghost" disabled={!changed || (!!until && until <= t)} onClick={saveUntil}>
          {until ? '保存' : '目安を消す'}
        </button>
      </div>
    </Sheet>
  )
}
