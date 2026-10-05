import { Archive as ArchiveIcon, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { SCHED } from '../care'
import { useApp } from '../ctx'
import { db, deletePlant, newId } from '../db'
import { today } from '../lib/date'
import { Field, PhotoPicker, Sheet } from '../parts'
import { defaultCare } from '../presets'
import type { Plant, SchedType } from '../types'
import { CareEditor, cleanCare, hasInterval } from './CareEditor'

export function PlantForm({ id }: { id?: string }) {
  const { plants, allPlants, groups, settings, close, toast } = useApp()
  const existing = allPlants.find((p) => p.id === id)
  const [f, setF] = useState<Plant>(
    () =>
      existing ?? {
        id: newId(),
        name: '',
        scientificName: '',
        location: '',
        profile: '',
        dormantMonths: settings.dormantMonths,
        care: defaultCare(),
        createdDay: today(),
      },
  )
  // 新規登録時のみ: 最後にケアした日 (入力すると次回予定の起点になる)
  const [last, setLast] = useState<Record<SchedType, string>>({ water: '', fertilizer: '', tonic: '' })

  const set = (patch: Partial<Plant>) => setF((v) => ({ ...v, ...patch }))
  const locations = [...new Set(plants.map((p) => p.location).filter(Boolean))]
  const group = groups.find((g) => g.id === f.groupId)

  const applyPreset = (g = group) => {
    if (g) setF((v) => ({ ...v, care: structuredClone(g.care), dormantMonths: [...g.dormantMonths], profile: v.profile || g.profile }))
  }
  const pickGroup = (groupId: string) => {
    set({ groupId: groupId || undefined })
    // 新規のときは選んだ分類のプリセットから始める。編集中は、調整済みの設定を黙って上書きしない
    if (!existing) applyPreset(groups.find((g) => g.id === groupId))
  }

  const save = async () => {
    const plant: Plant = {
      ...f,
      name: f.name.trim(),
      scientificName: f.scientificName.trim(),
      location: f.location.trim(),
      purchasePlace: f.purchasePlace?.trim(),
      // 水やりは必須 (オフにはできない)
      care: cleanCare({ ...f.care, water: { ...f.care.water, enabled: true } }),
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

  // 枯れた・手放した株を、記録と写真を残したまま一覧と予定から外す
  const archive = async () => {
    await db.plants.update(f.id, { archivedDay: today() })
    toast(`${f.name}をアーカイブに移しました`, () => db.plants.update(f.id, { archivedDay: undefined }))
    close(2)
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
        <button className="btn primary sm" disabled={!f.name.trim() || !hasInterval(f.care.water)} onClick={save}>
          保存
        </button>
      }
    >
      <PhotoPicker id={f.photoId} onChange={(photoId) => set({ photoId })} />

      <Field label="名前" required>
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
      <Field label="分類">
        <select value={f.groupId ?? ''} onChange={(e) => pickGroup(e.target.value)}>
          <option value="">なし</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </Field>
      {existing && group && (
        <button className="btn ghost sm preset" onClick={() => applyPreset()}>
          「{group.name}」のケア設定を反映
        </button>
      )}
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
          placeholder="日当たり、用土、気をつけることなど"
        />
      </Field>

      <h3 className="sec">入手</h3>
      <Field label="入手日">
        <input type="date" max={today()} value={f.purchaseDate ?? ''} onChange={(e) => set({ purchaseDate: e.target.value })} />
      </Field>
      <Field label="購入金額 (円)">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={f.purchasePrice ?? ''}
          onChange={(e) => set({ purchasePrice: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0) })}
        />
      </Field>
      <Field label="購入場所">
        <input value={f.purchasePlace ?? ''} onChange={(e) => set({ purchasePlace: e.target.value })} placeholder="例: 園芸店、イベント、通販" />
      </Field>

      <h3 className="sec">ケアの設定</h3>
      <CareEditor
        care={f.care}
        dormantMonths={f.dormantMonths}
        onChange={set}
        required={['water']}
        extra={
          existing
            ? undefined
            : (s) => (
                <label className="inline">
                  最後に実施した日
                  <input type="date" max={today()} value={last[s]} onChange={(e) => setLast({ ...last, [s]: e.target.value })} />
                </label>
              )
        }
      />

      {existing && !existing.archivedDay && (
        <button className="btn ghost full preset" onClick={archive}>
          <ArchiveIcon size={16} /> アーカイブに移す
        </button>
      )}
      {existing && (
        <button className="btn danger full" onClick={remove}>
          <Trash2 size={16} /> この植物を削除
        </button>
      )}
    </Sheet>
  )
}
