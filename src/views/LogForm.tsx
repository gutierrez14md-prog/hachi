import { useState } from 'react'
import { ALL_TYPES, CARE, careVar } from '../care'
import { useApp } from '../ctx'
import { today } from '../lib/date'
import { Field, Sheet } from '../parts'
import type { CareType } from '../types'

export function LogForm(props: { plantId?: string; type?: CareType; date?: string }) {
  const { plants, record, close } = useApp()
  const [sel, setSel] = useState<string[]>(props.plantId ? [props.plantId] : [])
  const [type, setType] = useState<CareType>(props.type ?? 'water')
  const [date, setDate] = useState(props.date ?? today())
  const [note, setNote] = useState('')

  const toggle = (ids: string[]) =>
    setSel((cur) => (ids.every((i) => cur.includes(i)) ? cur.filter((i) => !ids.includes(i)) : [...new Set([...cur, ...ids])]))
  const locations = [...new Set(plants.map((p) => p.location).filter(Boolean))]
  const sorted = [...plants].sort((a, b) => a.name.localeCompare(b.name, 'ja'))

  const save = async () => {
    await record(sel, type, date, note.trim())
    close()
  }

  return (
    <Sheet
      title="ケアを記録"
      action={
        <button className="btn primary sm" disabled={!sel.length || !date} onClick={save}>
          記録
        </button>
      }
    >
      <h3 className="sec">ケアの種類</h3>
      <div className="type-grid">
        {ALL_TYPES.map((ty) => {
          const { Icon, label } = CARE[ty]
          return (
            <button key={ty} className={type === ty ? 'on' : ''} style={careVar(ty)} onClick={() => setType(ty)}>
              <span className="care-ic">
                <Icon size={18} />
              </span>
              {label}
            </button>
          )
        })}
      </div>

      <h3 className="sec">
        植物 <span className="soft">{sel.length}株</span>
      </h3>
      {!plants.length && <p className="none">先に植物を追加してください</p>}
      {plants.length > 1 && (
        <div className="chips">
          <button className="chip outline" onClick={() => toggle(plants.map((p) => p.id))}>
            すべて
          </button>
          {locations.map((l) => (
            <button key={l} className="chip outline" onClick={() => toggle(plants.filter((p) => p.location === l).map((p) => p.id))}>
              {l}
            </button>
          ))}
        </div>
      )}
      <div className="chips">
        {sorted.map((p) => (
          <button key={p.id} className={`chip ${sel.includes(p.id) ? 'on' : ''}`} onClick={() => toggle([p.id])}>
            {p.name}
          </button>
        ))}
      </div>

      <Field label="日付">
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="メモ (任意)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例: 液肥1000倍" />
      </Field>
    </Sheet>
  )
}
