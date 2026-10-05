import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { CARE, careVar, SCHED } from '../care'
import { useApp } from '../ctx'
import { db, deletePlant, newId } from '../db'
import { today } from '../lib/date'
import { Field, PhotoPicker, Sheet } from '../parts'
import type { Plant, SchedType, Schedule } from '../types'

const DEFAULT_CARE: Record<SchedType, Schedule> = {
  water: { enabled: true, days: 7, offMode: 'custom', offDays: 14 },
  fertilizer: { enabled: false, days: 30, offMode: 'pause', offDays: 60 },
  tonic: { enabled: false, days: 14, offMode: 'pause', offDays: 30 },
}

const num = (v: string) => Math.max(0, parseInt(v) || 0)

export function MonthChips({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="months">
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
        <button
          type="button"
          key={m}
          className={`chip ${value.includes(m) ? 'on' : ''}`}
          onClick={() => onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m])}
        >
          {m}月
        </button>
      ))}
    </div>
  )
}

export function PlantForm({ id }: { id?: string }) {
  const { plants, settings, close, toast } = useApp()
  const existing = plants.find((p) => p.id === id)
  const [f, setF] = useState<Plant>(
    () =>
      existing ?? {
        id: newId(),
        name: '',
        scientificName: '',
        location: '',
        profile: '',
        dormantMonths: settings.dormantMonths,
        care: DEFAULT_CARE,
        createdDay: today(),
      },
  )
  // 新規登録時のみ: 最後にケアした日 (入力すると次回予定の起点になる)
  const [last, setLast] = useState<Record<SchedType, string>>({ water: '', fertilizer: '', tonic: '' })

  const set = (patch: Partial<Plant>) => setF((v) => ({ ...v, ...patch }))
  const setCare = (type: SchedType, patch: Partial<Schedule>) =>
    setF((v) => ({ ...v, care: { ...v.care, [type]: { ...v.care[type], ...patch } } }))
  const locations = [...new Set(plants.map((p) => p.location).filter(Boolean))]

  const save = async () => {
    const plant: Plant = { ...f, name: f.name.trim(), scientificName: f.scientificName.trim(), location: f.location.trim(), care: { ...f.care } }
    for (const s of SCHED) {
      plant.care[s] = { ...plant.care[s], days: Math.max(1, plant.care[s].days), offDays: Math.max(1, plant.care[s].offDays) }
    }
    await db.plants.put(plant)
    if (!existing) {
      const rows = SCHED.filter((s) => plant.care[s].enabled && last[s]).map((s) => ({
        id: newId(),
        plantId: plant.id,
        type: s,
        date: last[s],
        note: '',
        at: Date.now(),
      }))
      await db.logs.bulkAdd(rows)
    }
    toast(existing ? '保存しました' : `${plant.name}を追加しました`)
    close()
  }

  const remove = async () => {
    if (!confirm(`「${f.name}」と、そのケア記録・生長記録をすべて削除します。よろしいですか？`)) return
    await deletePlant(f.id)
    close(2) // 編集画面と詳細画面を閉じる
  }

  return (
    <Sheet
      title={existing ? '植物を編集' : '植物を追加'}
      action={
        <button className="btn primary sm" disabled={!f.name.trim()} onClick={save}>
          保存
        </button>
      }
    >
      <PhotoPicker id={f.photoId} onChange={(photoId) => set({ photoId })} />

      <Field label="名前">
        <input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="例: モンステラ" />
      </Field>
      <Field label="学名">
        <input
          className="sci"
          value={f.scientificName}
          onChange={(e) => set({ scientificName: e.target.value })}
          placeholder="例: Monstera deliciosa"
          autoCapitalize="off"
          spellCheck={false}
        />
      </Field>
      <Field label="置き場所">
        <input
          value={f.location}
          onChange={(e) => set({ location: e.target.value })}
          placeholder="例: リビング、ベランダ"
          list="locations"
        />
        <datalist id="locations">
          {locations.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </Field>
      <Field label="プロフィール・育て方メモ">
        <textarea
          rows={4}
          value={f.profile}
          onChange={(e) => set({ profile: e.target.value })}
          placeholder="日当たり、用土、購入日、気をつけることなど"
        />
      </Field>

      <h3 className="sec">ケアの設定</h3>
      {SCHED.map((s) => {
        const c = f.care[s]
        const { Icon, label } = CARE[s]
        return (
          <section key={s} className="card care" style={careVar(s)}>
            <label className="care-h">
              <span className="care-ic">
                <Icon size={18} />
              </span>
              <b>{label}</b>
              <input type="checkbox" className="switch" checked={c.enabled} onChange={(e) => setCare(s, { enabled: e.target.checked })} />
            </label>
            {c.enabled && (
              <div className="care-b">
                <label className="inline">
                  生長期
                  <input type="number" inputMode="numeric" min={1} value={c.days || ''} onChange={(e) => setCare(s, { days: num(e.target.value) })} />
                  日ごと
                </label>
                <label className="inline">
                  休眠期
                  <select value={c.offMode} onChange={(e) => setCare(s, { offMode: e.target.value as Schedule['offMode'] })}>
                    <option value="same">生長期と同じ</option>
                    <option value="custom">間隔を変える</option>
                    <option value="pause">お休み</option>
                  </select>
                  {c.offMode === 'custom' && (
                    <>
                      <input type="number" inputMode="numeric" min={1} value={c.offDays || ''} onChange={(e) => setCare(s, { offDays: num(e.target.value) })} />
                      日ごと
                    </>
                  )}
                </label>
                {!existing && (
                  <label className="inline">
                    最後に実施した日
                    <input type="date" max={today()} value={last[s]} onChange={(e) => setLast({ ...last, [s]: e.target.value })} />
                  </label>
                )}
              </div>
            )}
          </section>
        )
      })}

      <h3 className="sec">休眠期の月</h3>
      <p className="hint">選んだ月は「休眠期」の間隔で予定を立てます。夏に休む種類は夏の月を選んでください。</p>
      <MonthChips value={f.dormantMonths} onChange={(dormantMonths) => set({ dormantMonths })} />

      {existing && (
        <button className="btn danger full" onClick={remove}>
          <Trash2 size={16} /> この植物を削除
        </button>
      )}
    </Sheet>
  )
}
