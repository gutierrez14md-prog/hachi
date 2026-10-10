import { useState } from 'react'
import { SCHED } from '../care'
import { useApp } from '../ctx'
import { db } from '../db'
import { addDays, fmtDay, fmtFull, today } from '../lib/date'
import { nextDue } from '../lib/schedule'
import { DateInput, Field, Photo, SciName, Sheet } from '../parts'
import type { ArchiveInfo, ArchiveReason, Plant } from '../types'

export const ARCHIVE_REASONS: [ArchiveReason, string][] = [
  ['dead', '枯れた'],
  ['given', '譲渡'],
  ['sold', '売却'],
  ['other', 'その他'],
]
/** 相手を入れられる理由と、その欄の呼び名 */
const TO_LABEL: Partial<Record<ArchiveReason, string>> = { given: '譲渡先', sold: '売却先' }

/** アーカイブの理由を 1 行で: 「譲渡（田中さん）」。理由を入れていなければ空 */
export function archiveText(a: ArchiveInfo | undefined) {
  const label = ARCHIVE_REASONS.find(([id]) => id === a?.reason)?.[1]
  return label ? label + (a?.to ? `（${a.to}）` : '') : ''
}

/** アーカイブした株の数。ホームと同じく、まとめた登録は中身を 1 株ずつ数える */
export const archivedOf = (all: Plant[]) => all.filter((p) => p.archivedDay)

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
                <SciName plant={p} />
                <small>
                  {fmtFull(p.archivedDay!)}
                  {archiveText(p.archive) ? ` ・ ${archiveText(p.archive)}` : ' にアーカイブ'}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

/**
 * アーカイブの情報: 理由 (枯れた・譲渡・売却・その他)、譲渡先・売却先、アーカイブした日、メモ。
 * 育てている株なら、保存でアーカイブに移す。アーカイブ済みの株なら、情報を直す
 * (譲渡した日があとでわかったときに、日付を直すなど)
 */
export function ArchiveForm({ plantId }: { plantId: string }) {
  const { allPlants, close, toast } = useApp()
  const p = allPlants.find((x) => x.id === plantId)
  const [reason, setReason] = useState(p?.archive?.reason)
  const [to, setTo] = useState(p?.archive?.to ?? '')
  const [note, setNote] = useState(p?.archive?.note ?? '')
  const [day, setDay] = useState(p?.archivedDay ?? today())
  if (!p) return null
  const was = !!p.archivedDay
  const toLabel = reason && TO_LABEL[reason]
  // 相手の候補は、これまでに入れた譲渡先・売却先から
  const known = [...new Set(allPlants.map((x) => x.archive?.to).filter(Boolean))] as string[]

  const save = async () => {
    const before = { archivedDay: p.archivedDay, archive: p.archive }
    const archive: ArchiveInfo = { reason, to: (toLabel && to.trim()) || undefined, note: note.trim() || undefined }
    await db.plants.update(p.id, { archivedDay: day, archive })
    toast(was ? 'アーカイブの情報を保存しました' : `${p.name}をアーカイブに移しました`, () => db.plants.update(p.id, before))
    close(was ? 1 : 2) // 移したときは、下の詳細も閉じる
  }

  return (
    <Sheet
      form
      title={was ? 'アーカイブの情報' : `${p.name}をアーカイブに移す`}
      action={
        <button className="btn primary sm" disabled={!day} onClick={save}>
          {was ? '保存' : 'アーカイブに移す'}
        </button>
      }
    >
      <div className="field">
        <span className="field-l">理由</span>
        <div className="chips">
          {ARCHIVE_REASONS.map(([id, label]) => (
            <button type="button" key={id} className={`chip ${reason === id ? 'on' : ''}`} aria-pressed={reason === id} onClick={() => setReason(reason === id ? undefined : id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {toLabel && (
        <Field label={toLabel}>
          <input value={to} onChange={(e) => setTo(e.target.value)} list="archive-to" placeholder="友人、フリマアプリ など" />
          <datalist id="archive-to">
            {known.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </Field>
      )}
      <Field label="アーカイブした日" required>
        <DateInput max={today()} value={day} onChange={setDay} aria-label="アーカイブした日" />
      </Field>
      <p className="hint">日付がはっきりしないときは、今日のままで保存して、あとから直せます。</p>
      <Field label="メモ">
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="根腐れ、引っ越しで手放した…" />
      </Field>
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
  const [date, setDate] = useState('')
  const p = allPlants.find((x) => x.id === plantId)
  if (!p) return null
  const t = today()
  const due = SCHED.filter((s) => {
    const d = nextDue(p, s, logsOf(p.id))
    return d && d <= t
  })

  // until = その日まで予定に出さない
  const pick = async (until: string, label: string) => {
    const before = p.snooze ?? {}
    const snooze = { ...before }
    for (const s of due) snooze[s] = until
    await db.plants.update(p.id, { snooze })
    toast(`${p.name}のケアを${label}に延期しました`, () => db.plants.update(p.id, { snooze: before }))
    close()
  }

  return (
    <Sheet title={`${p.name}のケアを延期`}>
      <div className="opts">
        {OPTIONS.map(([days, label]) => (
          <button key={days} disabled={!due.length} onClick={() => pick(addDays(t, days), label)}>
            <b>{label}</b>
            <small>{fmtFull(addDays(t, days))}</small>
          </button>
        ))}
      </div>
      {/* 好きな日まで延期する (日付の欄を押すとカレンダーが開く) */}
      <h3 className="sec">日付を選ぶ</h3>
      <div className="row gap">
        <DateInput clearable className="grow" min={addDays(t, 1)} value={date} onChange={setDate} aria-label="延期する日" />
        <button className="btn primary" disabled={!due.length || !date || date <= t} onClick={() => pick(date, fmtDay(date))}>
          この日まで延期
        </button>
      </div>
    </Sheet>
  )
}
