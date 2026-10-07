import { useState } from 'react'
import { ALL_TYPES, CARE, careVar } from '../care'
import { useApp } from '../ctx'
import { today } from '../lib/date'
import { Field, Sheet } from '../parts'
import type { CareType } from '../types'
import { PlantPick } from './PlantPick'

export function LogForm(props: { plantId?: string; type?: CareType; date?: string }) {
  const { plants, record, close } = useApp()
  const [sel, setSel] = useState<string[]>(props.plantId ? [props.plantId] : [])
  // 水やりと液肥のように、同じ日にまとめてやったケアを一度に記録できる
  const [types, setTypes] = useState<CareType[]>([props.type ?? 'water'])
  const [date, setDate] = useState(props.date ?? today())
  const [note, setNote] = useState('')

  const save = async () => {
    await record(sel, types, date, note.trim())
    close()
  }

  return (
    <Sheet
      title="ケアを記録"
      action={
        <button className="btn primary sm" disabled={!sel.length || !types.length || !date} onClick={save}>
          記録
        </button>
      }
    >
      <h3 className="sec">
        ケアの種類 <span className="soft">複数選べます</span>
      </h3>
      <div className="type-grid">
        {ALL_TYPES.map((ty) => {
          const { Icon, label } = CARE[ty]
          return (
            <button key={ty} className={types.includes(ty) ? 'on' : ''}
              aria-pressed={types.includes(ty)}
              style={careVar(ty)}
              onClick={() => setTypes(types.includes(ty) ? types.filter((x) => x !== ty) : ALL_TYPES.filter((x) => x === ty || types.includes(x)))}>
              <span className="care-ic">
                <Icon size={18} />
              </span>
              {label}
            </button>
          )
        })}
      </div>

      <PlantPick multi plants={plants} value={sel} onChange={setSel} />

      <Field label="日付">
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="メモ (任意)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例: 液肥1000倍" />
      </Field>
    </Sheet>
  )
}
