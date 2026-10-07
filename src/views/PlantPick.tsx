import { Check, Search, X } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../ctx'
import { Photo, SciName } from '../parts'
import type { Plant } from '../types'

const NO_GROUP = '-'

/**
 * 植物を選ぶ欄。株が増えても探せるように、分類・置き場所での絞り込みと、名前・学名での検索を付けている。
 * multi なら複数選べる (ケアの記録用)。1 つだけ選ぶ欄は、選んだあと 1 行にたたむ
 */
export function PlantPick({
  plants,
  value,
  onChange,
  multi,
}: {
  plants: Plant[]
  value: string[]
  onChange: (ids: string[]) => void
  multi?: boolean
}) {
  const { groups } = useApp()
  const [q, setQ] = useState('')
  const [grp, setGrp] = useState('')
  const [loc, setLoc] = useState('')
  const [open, setOpen] = useState(multi || !value.length)

  // 絞り込みに出すのは、実際に株がある分類・置き場所だけ
  const usedGroups = groups.filter((g) => plants.some((p) => p.groupId === g.id))
  const hasUngrouped = usedGroups.length > 0 && plants.some((p) => !usedGroups.some((g) => g.id === p.groupId))
  const locations = [...new Set(plants.map((p) => p.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'))

  const needle = q.trim().toLowerCase()
  const shown = plants
    .filter((p) => !grp || (grp === NO_GROUP ? !usedGroups.some((g) => g.id === p.groupId) : p.groupId === grp))
    .filter((p) => !loc || p.location === loc)
    .filter(
      (p) =>
        !needle ||
        [p.name, p.scientificName, p.cultivar, ...(p.members ?? []).flatMap((m) => [m.name, m.scientificName, m.cultivar])].some((v) =>
          v?.toLowerCase().includes(needle),
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))

  const pick = (id: string) => {
    if (!multi) {
      onChange([id])
      return setOpen(false)
    }
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  }
  const shownIds = shown.map((p) => p.id)
  const allShown = shownIds.length > 0 && shownIds.every((id) => value.includes(id))
  const toggleShown = () => onChange(allShown ? value.filter((id) => !shownIds.includes(id)) : [...new Set([...value, ...shownIds])])

  const row = (p: Plant, on: boolean, onClick: () => void, trailing?: React.ReactNode) => (
    <button type="button" key={p.id} className={`pick-row ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>
      <Photo id={p.photoId} className="thumb sm" />
      <span className="pick-text">
        <b className="pn">{p.name}</b>
        <SciName plant={p} />
      </span>
      {trailing ?? (on && <Check size={18} />)}
    </button>
  )

  const selected = !multi && plants.find((p) => p.id === value[0])
  if (selected && !open)
    return (
      <div className="field">
        <span className="field-l">植物</span>
        <div className="pick-list">{row(selected, false, () => setOpen(true), <span className="pick-change">変更</span>)}</div>
      </div>
    )

  return (
    <div className="field">
      <span className="field-l">
        植物
        {multi && <span className="pick-count">{value.length}株を選択中</span>}
      </span>
      {!plants.length && <p className="none">先に植物を追加してください</p>}
      {plants.length > 5 && (
        <div className="search compact">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="名前・学名で絞り込む" aria-label="植物を絞り込む" />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="クリア">
              <X size={15} />
            </button>
          )}
        </div>
      )}
      {usedGroups.length > 0 && (
        <div className="chips scroll">
          <button type="button" className={`chip ${!grp ? 'on' : ''}`} onClick={() => setGrp('')}>
            全分類
          </button>
          {usedGroups.map((g) => (
            <button type="button" key={g.id} className={`chip ${grp === g.id ? 'on' : ''}`} onClick={() => setGrp(grp === g.id ? '' : g.id)}>
              {g.name}
            </button>
          ))}
          {hasUngrouped && (
            <button type="button" className={`chip ${grp === NO_GROUP ? 'on' : ''}`} onClick={() => setGrp(grp === NO_GROUP ? '' : NO_GROUP)}>
              分類なし
            </button>
          )}
        </div>
      )}
      {locations.length > 1 && (
        <div className="chips scroll">
          <button type="button" className={`chip ${!loc ? 'on' : ''}`} onClick={() => setLoc('')}>
            全場所
          </button>
          {locations.map((l) => (
            <button type="button" key={l} className={`chip ${loc === l ? 'on' : ''}`} onClick={() => setLoc(loc === l ? '' : l)}>
              {l}
            </button>
          ))}
        </div>
      )}
      {multi && shown.length > 1 && (
        <button type="button" className="btn ghost sm pick-all" onClick={toggleShown}>
          {allShown ? `表示中の ${shown.length} 株を外す` : `表示中の ${shown.length} 株をすべて選ぶ`}
        </button>
      )}
      {plants.length > 0 && (
        <div className="pick-list">
          {shown.map((p) => row(p, value.includes(p.id), () => pick(p.id)))}
          {!shown.length && <p className="none">該当する植物がありません</p>}
        </div>
      )}
    </div>
  )
}
