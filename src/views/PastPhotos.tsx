import { ImagePlus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../ctx'
import { db, newId } from '../db'
import { today } from '../lib/date'
import { photoDate } from '../lib/exif'
import { savePhoto } from '../lib/photo'
import { DateInput, Sheet } from '../parts'
import { PlantPick } from './PlantPick'

type Item = { key: string; file: File; url: string; date: string }

/** このアプリを使い始める前の写真を、まとめて生長記録に入れる (ほかのアプリからの移行用) */
export function PastPhotos(props: { plantId?: string }) {
  const { allPlants, close, toast } = useApp()
  const plants = allPlants.filter((p) => !p.archivedDay || p.id === props.plantId)
  const [plantId, setPlantId] = useState(props.plantId ?? (plants.length === 1 ? plants[0].id : ''))
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)

  // 閉じるときにプレビュー用の URL を解放する
  const live = useRef<Item[]>([])
  live.current = items
  useEffect(() => () => live.current.forEach((i) => URL.revokeObjectURL(i.url)), [])

  const add = async (files: File[]) => {
    const added = await Promise.all(
      files.map(async (file) => ({ key: newId(), file, url: URL.createObjectURL(file), date: await photoDate(file) })),
    )
    setItems((cur) => [...cur, ...added].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')))
  }
  const drop = (item: Item) => {
    URL.revokeObjectURL(item.url)
    setItems((cur) => cur.filter((i) => i !== item))
  }

  const save = async () => {
    setBusy(true)
    for (const item of items) {
      const photoId = await savePhoto(item.file)
      await db.journal.put({ id: newId(), plantId, date: item.date, text: '', photoId, past: true, at: Date.now() })
    }
    toast(`過去の写真を ${items.length} 枚追加しました`)
    close()
  }

  return (
    <Sheet
      title="過去の写真を追加"
      action={
        <button className="btn primary sm" disabled={!plantId || !items.length || busy} onClick={save}>
          {busy ? '保存中…' : items.length ? `${items.length} 枚を追加` : '追加'}
        </button>
      }
    >
      <PlantPick plants={plants} value={plantId ? [plantId] : []} onChange={([id]) => setPlantId(id)} />

      <label className="btn ghost full">
        <ImagePlus size={16} /> 写真を選ぶ (複数可)
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            add([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
      </label>

      {items.length > 0 && <p className="hint">撮影日（わからなければ空欄のまま）</p>}
      <div className="past-list">
        {items.map((item) => (
          <div className="past-item" key={item.key}>
            <img src={item.url} alt="" />
            {/* 消す × は付けない (隣に「写真を外す」の × があって紛らわしいため)。空にするのは、カレンダーのリセットで */}
            <DateInput max={today()} value={item.date} aria-label="撮影日" onChange={(date) => setItems((cur) => cur.map((i) => (i.key === item.key ? { ...i, date } : i)))} />
            <button className="icon-btn muted" onClick={() => drop(item)} aria-label="この写真を外す">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
