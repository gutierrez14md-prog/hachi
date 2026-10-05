import { Archive as ArchiveIcon, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { SCHED } from '../care'
import { useApp } from '../ctx'
import { db, deletePlant, newId } from '../db'
import { today } from '../lib/date'
import { Field, PhotoPicker, Sheet } from '../parts'
import { defaultCare } from '../presets'
import type { Plant, SchedType } from '../types'
import { CareEditor, cleanCare, hasInterval } from './CareEditor'
import { searchName, searchSci, SuggestInput } from './SciInput'

const MAX_NAMES = 4

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

  // ハイブリッドは交配親の学名を 4 つまで持つ。一覧や検索に使う scientificName は、それを × でつないだもの
  const hybrid = !!f.scientificNames
  const names = f.scientificNames ?? [f.scientificName]
  const setNames = (list: string[]) => set(hybrid ? { scientificNames: list } : { scientificName: list[0] ?? '' })

  const save = async () => {
    const parents = names.map((n) => n.trim()).filter(Boolean)
    const plant: Plant = {
      ...f,
      name: f.name.trim(),
      scientificName: parents.join(' × '),
      scientificNames: hybrid ? parents : undefined,
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
        <SuggestInput
          search={searchName}
          value={f.name}
          onChange={(name) => set({ name })}
          // 和名を入れ、学名がまだ空ならそれも入れる (入力済みの学名は上書きしない)
          onPick={(h) => {
            set({ name: h.ja ?? h.sci })
            if (!names[0].trim()) setNames([h.sci, ...names.slice(1)])
          }}
          placeholder="例: モンステラ"
        />
      </Field>
      {names.map((name, i) => (
        <Field key={i} label={hybrid ? `学名 ${i + 1}` : '学名'}>
          <span className="with-x">
            <SuggestInput
              sci
              search={searchSci}
              value={name}
              onChange={(v) => setNames(names.map((n, j) => (j === i ? v : n)))}
              onPick={(h) => setNames(names.map((n, j) => (j === i ? h.sci : n)))}
              placeholder={i === 0 ? '例: Monstera deliciosa' : '交配親の学名'}
            />
            {names.length > 1 && (
              <button type="button" className="icon-btn muted" onClick={() => setNames(names.filter((_, j) => j !== i))} aria-label={`学名 ${i + 1} を外す`}>
                <X size={16} />
              </button>
            )}
          </span>
        </Field>
      ))}
      <label className="line toggle">
        <span className="line-main">
          <b>ハイブリッド（交配種）</b>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={hybrid}
          // オフにしたら 1 つ目の学名だけ残す
          onChange={(e) => set({ scientificNames: e.target.checked ? [f.scientificName, ''] : undefined, scientificName: names[0] })}
        />
      </label>
      {hybrid && names.length < MAX_NAMES && (
        <button type="button" className="btn ghost sm preset" onClick={() => setNames([...names, ''])}>
          <Plus size={15} /> 学名を追加
        </button>
      )}
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
