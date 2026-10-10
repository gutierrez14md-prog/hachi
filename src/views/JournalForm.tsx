import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../ctx'
import { db, journalOrigs, journalPhotos, newId } from '../db'
import { today } from '../lib/date'
import { DateInput, Field, PhotosPicker, Sheet } from '../parts'
import type { Journal } from '../types'
import { PlantPick } from './PlantPick'

export function JournalForm(props: { plantId?: string; id?: string }) {
  const { plants: active, allPlants, journal, close, toast } = useApp()
  // アーカイブした株は、その株の記録を開いているときだけ選択肢に出す
  const picked = props.plantId ?? journal.find((j) => j.id === props.id)?.plantId
  const plants = allPlants.filter((p) => !p.archivedDay || p.id === picked)
  const existing = journal.find((j) => j.id === props.id)
  const [f, setF] = useState<Journal>(
    () =>
      existing ?? {
        id: newId(),
        plantId: props.plantId ?? (active.length === 1 ? active[0].id : ''),
        date: today(),
        text: '',
        at: Date.now(),
      },
  )
  const set = (patch: Partial<Journal>) => setF((v) => ({ ...v, ...patch }))
  // 過去の写真は、撮影日がわからなければ空欄のままでよい
  const photos = journalPhotos(f)
  const ok = f.plantId && (f.date || f.past) && (photos.length || f.text.trim())

  const save = async () => {
    // 外した写真の調整は捨てる
    const kept = Object.entries(f.photoCrops ?? {}).filter(([id]) => photos.includes(id))
    await db.journal.put({ ...f, text: f.text.trim(), photoIds: photos, photoId: photos[0], photoCrops: kept.length ? Object.fromEntries(kept) : undefined })
    toast(existing ? '保存しました' : '生長記録を追加しました')
    close()
  }
  const remove = async () => {
    if (!confirm('この生長記録を削除しますか？')) return
    await db.photos.bulkDelete([...photos, ...journalOrigs(f)])
    await db.journal.delete(f.id)
    close()
  }

  return (
    <Sheet
      form
      title={existing ? '生長記録を編集' : '生長記録'}
      action={
        <button className="btn primary sm" disabled={!ok} onClick={save}>
          保存
        </button>
      }
    >
      <PhotosPicker ids={photos} crops={f.photoCrops} onChange={(photoIds, photoCrops) => set({ photoIds, photoId: photoIds[0], photoCrops })} />
      <PlantPick plants={plants} value={f.plantId ? [f.plantId] : []} onChange={([plantId]) => set({ plantId })} />
      <Field label={f.past ? '撮影日' : '日付'}>
        {/* 過去の写真は、撮影日がわからなければ空にできる */}
        <DateInput clearable={!!f.past} value={f.date} max={today()} onChange={(date) => set({ date })} aria-label={f.past ? '撮影日' : '日付'} />
      </Field>
      <label className="line toggle">
        <span className="line-main">
          <span>
            <b>過去の写真</b>
            <small>使い始める前に撮ったもの</small>
          </span>
        </span>
        <input type="checkbox" className="switch" checked={!!f.past} onChange={(e) => set({ past: e.target.checked })} />
      </label>
      <Field label="ひとこと">
        <textarea rows={4} value={f.text} onChange={(e) => set({ text: e.target.value })} placeholder="新芽が出た、花が咲いた…" />
      </Field>
      {existing && (
        <button className="btn danger full" onClick={remove}>
          <Trash2 size={16} /> この記録を削除
        </button>
      )}
    </Sheet>
  )
}
