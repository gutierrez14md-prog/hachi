import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../ctx'
import { db, newId } from '../db'
import { Field, Sheet } from '../parts'
import { defaultCare } from '../presets'
import { careLabel, METHOD_IDS, METHODS } from '../method'
import type { Group, Method } from '../types'
import { CareEditor, cleanCare, WaterLabelField } from './CareEditor'

/** 分類と、そのケア設定のプリセットの編集 */
export function GroupForm({ id }: { id?: string }) {
  const { groups, plants, settings, close, toast } = useApp()
  const existing = groups.find((g) => g.id === id)
  const [f, setF] = useState<Group>(
    () => existing ?? { id: newId(), name: '', dormantMonths: settings.dormantMonths, care: defaultCare(), profile: '' },
  )
  const set = (patch: Partial<Group>) => setF((v) => ({ ...v, ...patch }))
  const members = plants.filter((p) => p.groupId === f.id)

  const put = () => {
    const group = { ...f, name: f.name.trim(), waterLabel: f.waterLabel?.trim() || undefined, care: cleanCare(f.care) }
    return db.groups.put(group).then(() => group)
  }
  const save = async () => {
    await put()
    toast('保存しました')
    close()
  }
  const applyToMembers = async () => {
    if (!confirm(`「${f.name}」の ${members.length} 株のケア設定を、この内容で上書きします。よろしいですか？`)) return
    const group = await put()
    await db.plants.bulkPut(
      members.map((p) => ({ ...p, care: structuredClone(group.care), dormantMonths: [...group.dormantMonths], method: group.method ?? p.method, waterLabel: group.waterLabel ?? p.waterLabel })),
    )
    toast(`${members.length}株に反映しました`)
    close()
  }
  const remove = async () => {
    if (!confirm(`分類「${f.name}」を削除しますか？ 植物そのものと、そのケア設定は残ります。`)) return
    await db.groups.delete(f.id)
    close()
  }

  return (
    <Sheet
      title={existing ? '分類を編集' : '分類を追加'}
      action={
        <button className="btn primary sm" disabled={!f.name.trim()} onClick={save}>
          保存
        </button>
      }
    >
      <Field label="分類名">
        <input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="例: アガベ、サボテン" />
      </Field>
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
      <Field label="育て方メモのひな形">
        <textarea rows={3} value={f.profile} onChange={(e) => set({ profile: e.target.value })} />
      </Field>

      <h3 className="sec">ケアの設定</h3>
      <CareEditor care={f.care} dormantMonths={f.dormantMonths} onChange={set} labels={{ water: careLabel('water', f) }} />

      {members.length > 0 && (
        <button className="btn ghost full preset" disabled={!f.name.trim()} onClick={applyToMembers}>
          この分類の {members.length} 株に反映
        </button>
      )}
      {existing && (
        <button className="btn danger full" onClick={remove}>
          <Trash2 size={16} /> この分類を削除
        </button>
      )}
    </Sheet>
  )
}
