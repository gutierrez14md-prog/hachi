import { Archive as ArchiveIcon, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { SCHED } from '../care'
import { useApp } from '../ctx'
import { db, deletePlant, newId } from '../db'
import { today } from '../lib/date'
import { DateInput, Field, PhotoPicker, Sheet } from '../parts'
import { crossText, fromFlat } from '../lib/cross'
import { defaultCare } from '../presets'
import { careIcon, careLabel, METHOD_IDS, METHODS } from '../method'
import type { Member, Method, Plant, SchedType, Cross } from '../types'
import { CareEditor, cleanCare, hasInterval, WaterLabelField } from './CareEditor'
import { CultivarInput, PickInput, searchName, searchSci, SuggestInput } from './SciInput'

const MAX_NAMES = 4
const MAX_MEMBERS = 12
const NEW_MEMBER: Member = { name: '', scientificName: '' }

export function PlantForm({ id }: { id?: string }) {
  const { plants, allPlants, groups, settings, close, replace, toast } = useApp()
  const existing = allPlants.find((p) => p.id === id)
  const [f, setF] = useState<Plant>(
    () =>
      (existing && (existing.scientificNames && !existing.parents ? { ...existing, scientificNames: undefined, parents: fromFlat(existing.scientificNames) } : existing)) ?? {
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
  // 置き場所と購入場所の候補は、これまでに登録した株から集める (アーカイブした株のぶんも含む)
  const locations = allPlants.map((p) => p.location)
  const places = allPlants.map((p) => p.purchasePlace ?? '')
  const givers = allPlants.map((p) => p.giftFrom ?? '')
  const group = groups.find((g) => g.id === f.groupId)

  // 育て方メモを自分で書いていないか: 空か、どれかの分類のひな形そのまま (分類を選び直したら、前の分類のひな形が残らないように)
  const untouched = (profile: string) => !profile.trim() || groups.some((g) => g.profile === profile)
  const applyPreset = (g = group) => {
    if (g)
      setF((v) => ({
        ...v,
        care: structuredClone(g.care),
        dormantMonths: [...g.dormantMonths],
        // 自分で書いたメモは黙って上書きしない。入れ替えたいときは、メモの下の「育て方メモを反映」で
        profile: untouched(v.profile) ? g.profile : v.profile,
        method: g.method ?? v.method,
        waterLabel: g.waterLabel ?? v.waterLabel,
      }))
  }
  // 分類のひな形で、育て方メモを入れ替える (押したときだけ。取り消せる)
  const applyProfile = () => {
    if (!group) return
    const before = f.profile
    set({ profile: group.profile })
    if (before.trim()) toast('育て方メモを入れ替えました', () => set({ profile: before }))
  }
  const pickGroup = (groupId: string) => {
    set({ groupId: groupId || undefined })
    // 新規のときは選んだ分類のプリセットから始める。編集中は、調整済みの設定を黙って上書きしない
    if (!existing) applyPreset(groups.find((g) => g.id === groupId))
  }

  // ハイブリッドは交配親を 2 つ持ち、それぞれ学名を 4 つまで入れられる (親そのものが交配種のこともあるため)。
  // 一覧や検索に使う scientificName は、それを × でつないだもの
  const cross = f.parents
  const hybrid = !!cross
  const names = cross ? [...cross.seed, ...cross.pollen] : [f.scientificName]
  const setSide = (side: 'seed' | 'pollen', list: string[]) => set({ parents: { ...cross!, [side]: list } })
  // 学名の欄を並べる (ふつうの学名にも、交配親にも使う)
  const nameFields = (list: string[], onList: (l: string[]) => void, label: (i: number) => string, placeholder: (i: number) => string) =>
    list.map((name, i) => (
      <Field key={i} label={label(i)}>
        <span className="with-x">
          <SuggestInput
            sci
            search={searchSci}
            value={name}
            onChange={(v) => onList(list.map((n, j) => (j === i ? v : n)))}
            onPick={(h) => onList(list.map((n, j) => (j === i ? h.sci : n)))}
            placeholder={placeholder(i)}
          />
          {list.length > 1 && (
            <button type="button" className="icon-btn muted" onClick={() => onList(list.filter((_, j) => j !== i))} aria-label={`${label(i)}を外す`}>
              <X size={16} />
            </button>
          )}
        </span>
      </Field>
    ))

  // 複数の植物をまとめた登録 (寄せ植え・着生)。中身ごとに名前・学名・品種名を持つ
  const members = f.members
  const setMember = (i: number, patch: Partial<Member>) => set({ members: members!.map((m, j) => (j === i ? { ...m, ...patch } : m)) })

  const save = async () => {
    const clean = (l: string[]) => l.map((n) => n.trim()).filter(Boolean)
    const flat = clean(names)
    let sides: Cross | undefined
    if (f.parents) {
      const a = clean(f.parents.seed), b = clean(f.parents.pollen)
      // 雌雄がわからないときは、親 1 が空なら親 2 を前に詰める
      sides = f.parents.sexed ? { seed: a, pollen: b, sexed: true } : a.length ? { seed: a, pollen: b } : { seed: b, pollen: [] }
    }
    const inside = members
      ?.map((m) => ({ name: m.name.trim(), scientificName: m.scientificName.trim(), cultivar: m.cultivar?.trim() || undefined }))
      .filter((m) => m.name || m.scientificName || m.cultivar)
    const plant: Plant = {
      ...f,
      name: f.name.trim(),
      // まとめた登録では、学名と品種名は中身のほうに持つ
      scientificName: inside ? '' : sides ? crossText(sides) : flat.join(' × '),
      scientificNames: undefined,
      parents: sides && !inside && flat.length ? sides : undefined,
      cultivar: inside ? undefined : f.cultivar?.trim() || undefined,
      members: inside,
      location: f.location.trim(),
      // 譲り受けた株は、購入の情報を持たない (購入に戻したときは、譲ってくれた人を持たない)
      purchasePlace: f.gift ? undefined : f.purchasePlace?.trim(),
      purchasePrice: f.gift ? null : f.purchasePrice,
      gift: f.gift || undefined,
      giftFrom: (f.gift && f.giftFrom?.trim()) || undefined,
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

  // 枯れた・手放した株を、記録と写真を残したまま一覧と予定から外す。理由と日付を入れる画面に替える
  const archive = () => replace({ k: 'archiveInfo', plantId: f.id })

  const remove = async () => {
    if (!confirm(`「${f.name}」と、そのケア記録・生長記録をすべて削除します。よろしいですか？`)) return
    await deletePlant(f.id)
    close(2) // 編集画面と詳細画面を閉じる
  }

  return (
    <Sheet
      form
      title={existing ? '植物を編集' : '植物を追加'}
      action={
        <button className="btn primary sm" disabled={!f.name.trim() || !hasInterval(f.care.water)} onClick={save}>
          保存
        </button>
      }
    >
      <PhotoPicker id={f.photoId} crop={f.photoCrop} onChange={(photoId, photoCrop) => set({ photoId, photoCrop })} />

      <Field label="名前" required>
        <SuggestInput
          search={searchName}
          value={f.name}
          onChange={(name) => set({ name })}
          // 和名を入れ、学名がまだ空ならそれも入れる (入力済みの学名は上書きしない)
          onPick={(h) => {
            set({ name: h.ja ?? h.sci })
            if (!members && !names[0]?.trim()) cross ? setSide('seed', [h.sci, ...cross.seed.slice(1)]) : set({ scientificName: h.sci })
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
      {!hybrid &&
        nameFields(
          [f.scientificName],
          ([v]) => set({ scientificName: v ?? '' }),
          () => '学名',
          () => '例: Monstera deliciosa',
        )}
      <label className="line toggle">
        <span className="line-main">
          <b>ハイブリッド（交配種）</b>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={hybrid}
          // オンにしたら入れてあった学名を親 1 に移す。オフにしたら 1 つ目の学名だけ残す
          onChange={(e) =>
            set(e.target.checked ? { parents: { seed: [f.scientificName], pollen: [''] } } : { parents: undefined, scientificName: names.find((n) => n.trim()) ?? '' })
          }
        />
      </label>
      {cross && (
        <>
          {(
            [
              ['seed', cross.sexed ? '♀ 雌親' : '親 1', 'f'],
              ['pollen', cross.sexed ? '♂ 雄親' : '親 2', 'm'],
            ] as const
          ).map(([side, title, cls]) => (
            <div key={side} className={`cross-box ${cross.sexed ? cls : ''}`}>
              {nameFields(
                cross[side].length ? cross[side] : [''],
                (l) => setSide(side, l),
                (i) => (cross[side].length > 1 ? `${title} の学名 ${i + 1}` : `${title} の学名`),
                () => '交配親の学名',
              )}
              {cross[side].length < MAX_NAMES && (
                <button type="button" className="btn ghost sm" onClick={() => setSide(side, [...(cross[side].length ? cross[side] : ['']), ''])}>
                  <Plus size={15} /> {title} が交配種のとき、学名を追加
                </button>
              )}
            </div>
          ))}
          {/* 雌雄はわからないことも多いので、任意 (わかるときだけ、親 1 を雌親、親 2 を雄親として扱う) */}
          <label className="line toggle cross-sex">
            <span className="line-main">
              <b>親の雌雄がわかる</b>
              <small>親 1 を雌親（♀）、親 2 を雄親（♂）にする</small>
            </span>
            <input type="checkbox" className="switch" checked={!!cross.sexed} onChange={(e) => set({ parents: { ...cross, sexed: e.target.checked || undefined } })} />
          </label>
        </>
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
        <PickInput options={locations} value={f.location} onChange={(location) => set({ location })} placeholder="例: リビング、ベランダ" />
      </Field>
      <Field label="プロフィール・育て方メモ">
        <textarea
          rows={4}
          value={f.profile}
          onChange={(e) => set({ profile: e.target.value })}
          placeholder="日当たり、用土、気をつけることなど"
        />
      </Field>
      {group?.profile && group.profile !== f.profile && (
        <button className="btn ghost sm preset" onClick={applyProfile}>
          「{group.name}」の育て方メモを反映
        </button>
      )}

      <h3 className="sec">入手</h3>
      {/* 買った株か、人から譲り受けた株か。譲り受けた株では、金額と購入場所のかわりに、譲ってくれた人を入れる */}
      <div className="seg how" role="group" aria-label="入手の方法">
        <button type="button" className={f.gift ? '' : 'on'} aria-pressed={!f.gift} onClick={() => set({ gift: undefined })}>
          購入
        </button>
        <button type="button" className={f.gift ? 'on' : ''} aria-pressed={!!f.gift} onClick={() => set({ gift: true })}>
          譲り受けた
        </button>
      </div>
      <Field label="入手日">
        <DateInput clearable max={today()} value={f.purchaseDate ?? ''} onChange={(purchaseDate) => set({ purchaseDate })} aria-label="入手日" />
      </Field>
      {f.gift ? (
        <Field label="譲ってくれた人">
          <PickInput options={givers} value={f.giftFrom ?? ''} onChange={(giftFrom) => set({ giftFrom })} placeholder="例: 友人、家族、園芸仲間" />
        </Field>
      ) : (
        <>
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
            <PickInput
              options={places}
              value={f.purchasePlace ?? ''}
              onChange={(purchasePlace) => set({ purchasePlace })}
              placeholder="例: 園芸店、イベント、通販"
            />
          </Field>
        </>
      )}

      <h3 className="sec">ケアの設定</h3>
      <CareEditor
        care={f.care}
        dormantMonths={f.dormantMonths}
        onChange={set}
        required={['water']}
        labels={{ water: careLabel('water', f) }}
        icons={{ water: careIcon('water', f) }}
        stagger={f.stagger}
        onStagger={(on) => set({ stagger: on || undefined })}
        extra={(s) => (
          <>
            {/* いつから始めるか。空欄なら登録した日から。記録を付けたあとも「この日より前には出さない」として効く */}
            <label className="inline">
              開始日
              <DateInput
                clearable
                value={f.care[s].start ?? ''}
                onChange={(start) => set({ care: { ...f.care, [s]: { ...f.care[s], start: start || undefined } } })}
                aria-label="開始日"
              />
              {!f.care[s].start && <span className="soft">登録した日から</span>}
            </label>
            {!existing && (
              <label className="inline">
                最後に実施した日
                <DateInput clearable max={today()} value={last[s]} onChange={(v) => setLast({ ...last, [s]: v })} aria-label="最後に実施した日" />
              </label>
            )}
          </>
        )}
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
