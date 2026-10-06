import { Archive as ArchiveIcon, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { SCHED } from '../care'
import { useApp } from '../ctx'
import { db, deletePlant, newId } from '../db'
import { today } from '../lib/date'
import { Field, PhotoPicker, Sheet } from '../parts'
import { defaultCare } from '../presets'
import { careIcon, careLabel, METHOD_IDS, METHODS } from '../method'
import type { Member, Method, Plant, SchedType } from '../types'
import { CareEditor, cleanCare, hasInterval, WaterLabelField } from './CareEditor'
import { CultivarInput, searchName, searchSci, SuggestInput } from './SciInput'

const MAX_NAMES = 4
const MAX_MEMBERS = 12
const NEW_MEMBER: Member = { name: '', scientificName: '' }

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
    if (g)
      setF((v) => ({
        ...v,
        care: structuredClone(g.care),
        dormantMonths: [...g.dormantMonths],
        profile: v.profile || g.profile,
        method: g.method ?? v.method,
        waterLabel: g.waterLabel ?? v.waterLabel,
      }))
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

  // 複数の植物をまとめた登録 (寄せ植え・着生)。中身ごとに名前・学名・品種名を持つ
  const members = f.members
  const setMember = (i: number, patch: Partial<Member>) => set({ members: members!.map((m, j) => (j === i ? { ...m, ...patch } : m)) })

  const save = async () => {
    const parents = names.map((n) => n.trim()).filter(Boolean)
    const inside = members
      ?.map((m) => ({ name: m.name.trim(), scientificName: m.scientificName.trim(), cultivar: m.cultivar?.trim() || undefined }))
      .filter((m) => m.name || m.scientificName || m.cultivar)
    const plant: Plant = {
      ...f,
      name: f.name.trim(),
      // まとめた登録では、学名と品種名は中身のほうに持つ
      scientificName: inside ? '' : parents.join(' × '),
      scientificNames: hybrid && !inside ? parents : undefined,
      cultivar: inside ? undefined : f.cultivar?.trim() || undefined,
      members: inside,
      location: f.location.trim(),
      purchasePlace: f.purchasePlace?.trim(),
      waterLabel: f.waterLabel?.trim() || undefined,
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
            if (!members && !names[0].trim()) setNames([h.sci, ...names.slice(1)])
          }}
          placeholder={members ? '例: 流木のチランジア' : '例: モンステラ'}
        />
      </Field>

      <label className="line toggle">
        <span className="line-main">
          <span>
            <b>複数の植物をまとめる</b>
            <small>寄せ植え、1 本の木につけた着生植物など</small>
          </span>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={!!members}
          // オンにするときは、入力済みの学名・品種名を 1 つ目として引き継ぐ
          onChange={(e) =>
            set({ members: e.target.checked ? [{ name: '', scientificName: names[0], cultivar: f.cultivar }, { ...NEW_MEMBER }] : undefined })
          }
        />
      </label>

      {members?.map((m, i) => (
        <section className="card member" key={i}>
          <header>
            <h3 className="card-t">植物 {i + 1}</h3>
            {members.length > 1 && (
              <button type="button" className="icon-btn muted" onClick={() => set({ members: members.filter((_, j) => j !== i) })} aria-label={`植物 ${i + 1} を外す`}>
                <X size={16} />
              </button>
            )}
          </header>
          <Field label="名前">
            <SuggestInput
              search={searchName}
              value={m.name}
              onChange={(name) => setMember(i, { name })}
              onPick={(h) => setMember(i, { name: h.ja ?? h.sci, scientificName: m.scientificName.trim() ? m.scientificName : h.sci })}
              placeholder="例: イオナンタ"
            />
          </Field>
          <Field label="学名">
            <SuggestInput
              sci
              search={searchSci}
              value={m.scientificName}
              onChange={(scientificName) => setMember(i, { scientificName })}
              onPick={(h) => setMember(i, { scientificName: h.sci })}
              placeholder="例: Tillandsia ionantha"
            />
          </Field>
          <Field label="品種名">
            <CultivarInput sci={m.scientificName} value={m.cultivar ?? ''} onChange={(cultivar) => setMember(i, { cultivar })} />
          </Field>
        </section>
      ))}
      {members && members.length < MAX_MEMBERS && (
        <button type="button" className="btn ghost sm preset" onClick={() => set({ members: [...members, { ...NEW_MEMBER }] })}>
          <Plus size={15} /> 植物を追加
        </button>
      )}

      {!members && (
        <>
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
      <Field label="品種名">
        <CultivarInput sci={names[0]} value={f.cultivar ?? ''} onChange={(cultivar) => set({ cultivar })} />
      </Field>
        </>
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
      <Field label="栽培方法">
        <select value={f.method ?? ''} onChange={(e) => set({ method: (e.target.value || undefined) as Method | undefined })}>
          <option value="">未設定</option>
          {METHOD_IDS.map((m) => (
            <option key={m} value={m}>
              {METHODS[m].label}
            </option>
          ))}
        </select>
      </Field>
      <WaterLabelField value={f} onChange={(waterLabel) => set({ waterLabel })} />
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
        labels={{ water: careLabel('water', f) }}
        icons={{ water: careIcon('water', f) }}
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
