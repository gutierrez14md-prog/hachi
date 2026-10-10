import { Camera, Move, RotateCw, Wand2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useApp } from './ctx'
import { db } from './db'
import { isGrouped } from './lib/cross'
import { dueLabel, urgency } from './lib/date'
import { rotatePhoto, savePhoto } from './lib/photo'
import type { PhotoCrop, Plant } from './types'
import { BackdropStudio } from './views/BackdropStudio'
import { PhotoAdjust } from './views/PhotoAdjust'

/** アプリのシンボル (鉢植え)。lucide のアイコンと同じ線の太さ・使い方に合わせている */
export function PotIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12V7" />
      <path d="M12 9c-2.8 0-4.5-1.7-4.5-4.5C10.300 4.500 12 6.200 12 9Z" />
      <path d="M12 7c0-2.300 1.500-4 4.200-4C16.200 5.500 14.500 7 12 7Z" />
      <path d="M5 12h14v3H5z" />
      <path d="m6.500 15 1.200 6h8.600l1.200-6" />
    </svg>
  )
}

/** IndexedDB に保存した写真を表示する。写真がなければ鉢植えのプレースホルダー。onClick は写真があるときだけ効く (拡大表示用) */
export function Photo({ id, className = '', onClick }: { id?: string; className?: string; onClick?: () => void }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    setUrl(undefined)
    if (!id) return
    let dead = false
    let made: string | undefined
    db.photos.get(id).then((rec) => {
      if (!rec || dead) return
      made = URL.createObjectURL(rec.blob)
      setUrl(made)
    })
    return () => {
      dead = true
      if (made) URL.revokeObjectURL(made)
    }
  }, [id])
  if (url) return <img className={className} src={url} alt="" onClick={onClick} draggable={false} />
  return (
    <div className={`${className} ph`}>
      <PotIcon />
    </div>
  )
}

/**
 * 学名そのもの (斜体)。親が交配種のハイブリッドは、親ごとに 1 つのかたまりにして出す
 * (どこまでが片方の親の交配かが見てわかるように)。雌雄がわかっていれば、♀ ♂ の印を付ける
 */
export function SciText({ plant: p, empty = '' }: { plant: Pick<Plant, 'scientificName' | 'parents'>; empty?: string }) {
  const c = p.parents
  if (!c || !isGrouped(c)) return <i>{p.scientificName || empty}</i>
  const side = (list: string[], mark: string, cls: string, label: string) =>
    list.length > 0 && (
      <span className="cross-side">
        {c.sexed && (
          <b className={`sex ${cls}`} aria-label={label}>
            {mark}
          </b>
        )}
        <i>{list.join(' × ')}</i>
      </span>
    )
  return (
    <span className="cross">
      {side(c.seed, '♀', 'f', '雌親')}
      {c.seed.length > 0 && c.pollen.length > 0 && <span className="cross-x"> × </span>}
      {side(c.pollen, '♂', 'm', '雄親')}
    </span>
  )
}

/**
 * 名前の下に出す 1 行: 学名 (斜体) と品種名 (' ' で囲む。斜体にしない)。
 * 複数の植物をまとめた登録は、中身の名前を並べる
 */
export function SciName({ plant: p }: { plant: Pick<Plant, 'scientificName' | 'cultivar' | 'members' | 'parents'> }) {
  if (p.members?.length)
    return <span className="sci-line">{p.members.map((m) => m.name || m.scientificName).filter(Boolean).join('、')}</span>
  if (!p.scientificName && !p.cultivar) return null
  return (
    <span className="sci-line">
      <SciText plant={p} />
      {p.cultivar && ` '${p.cultivar}'`}
    </span>
  )
}

/**
 * 植物の写真を選ぶ欄。選んだあとに、位置と大きさの調整・回転・背景の差し替えができる。
 * crop = 位置と大きさを調整済みのときの、元の写真とその調整 (調整し直すときは、元の写真からやり直す)。
 * 写真を選び直す・回す・背景を変えると、写真そのものが変わるので crop は無くなる
 */
export function PhotoPicker({ id, crop, onChange }: { id?: string; crop?: PhotoCrop; onChange: (id: string, crop?: PhotoCrop) => void }) {
  const [studio, setStudio] = useState(false)
  const [adjust, setAdjust] = useState(false)
  return (
    <>
      <label className="picker">
        <Photo id={id} className="picker-img" />
        <span className="picker-badge">
          <Camera size={16} />
          {id ? '写真を変更' : '写真を追加'}
        </span>
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) onChange(await savePhoto(file))
          }}
        />
      </label>
      {id && (
        <div className="picker-acts">
          <button type="button" className="btn ghost sm" onClick={() => setAdjust(true)}>
            <Move size={15} /> 位置と大きさ
          </button>
          <button type="button" className="btn ghost sm" onClick={async () => onChange(await rotatePhoto(id))}>
            <RotateCw size={15} /> 回転
          </button>
          <button type="button" className="btn ghost sm" onClick={() => setStudio(true)}>
            <Wand2 size={15} /> 背景を変える
          </button>
        </div>
      )}
      {studio && id && (
        <BackdropStudio
          photoId={id}
          onClose={() => setStudio(false)}
          onDone={(next) => {
            onChange(next)
            setStudio(false)
          }}
        />
      )}
      {adjust && id && (
        <PhotoAdjust
          photoId={crop?.origId ?? id}
          start={crop}
          onClose={() => setAdjust(false)}
          onDone={(next, c) => {
            onChange(next, { origId: crop?.origId ?? id, ...c })
            setAdjust(false)
          }}
        />
      )}
    </>
  )
}

const MAX_SHOTS = 10

/**
 * 写真を複数枚選ぶ欄 (生長記録用)。1 枚ずつ外したり、位置と大きさを調整したり、回したり、背景を変えたりできる。
 * crops = 位置と大きさを調整した写真の、元の写真とその調整 (キーは調整後の写真の id)
 */
export function PhotosPicker({
  ids,
  crops = {},
  onChange,
}: {
  ids: string[]
  crops?: Record<string, PhotoCrop>
  onChange: (ids: string[], crops: Record<string, PhotoCrop>) => void
}) {
  const [studio, setStudio] = useState<string | null>(null)
  const [adjust, setAdjust] = useState<string | null>(null)
  // 写真 from を to に差し替える。crop を渡さなければ、その写真の調整は無くなる (回転や背景の差し替えで、写真そのものが変わったとき)
  const swap = (from: string, to: string, crop?: PhotoCrop) => {
    const rest = Object.fromEntries(Object.entries(crops).filter(([id]) => id !== from))
    onChange(
      ids.map((x) => (x === from ? to : x)),
      crop ? { ...rest, [to]: crop } : rest,
    )
  }
  const [busy, setBusy] = useState(false)

  const add = async (files: File[]) => {
    setBusy(true)
    const added: string[] = []
    for (const file of files.slice(0, MAX_SHOTS - ids.length)) added.push(await savePhoto(file))
    onChange([...ids, ...added], crops)
    setBusy(false)
  }

  return (
    <>
      <div className="shots">
        {ids.map((id) => (
          <div className="shot" key={id}>
            <Photo id={id} className="shot-img" />
            <button type="button" className="shot-btn x" onClick={() => onChange(ids.filter((x) => x !== id), crops)} aria-label="この写真を外す">
              <X size={14} />
            </button>
            <button type="button" className="shot-btn wand" onClick={() => setStudio(id)} aria-label="背景を変える">
              <Wand2 size={14} />
            </button>
            <button
              type="button"
              className="shot-btn turn"
              aria-label="右に回転"
              onClick={async () => swap(id, await rotatePhoto(id))}
            >
              <RotateCw size={14} />
            </button>
            <button type="button" className="shot-btn move" onClick={() => setAdjust(id)} aria-label="位置と大きさを調整">
              <Move size={14} />
            </button>
          </div>
        ))}
        {ids.length < MAX_SHOTS && (
          <label className="shot add">
            <Camera size={20} />
            {busy ? '読み込み中…' : ids.length ? '追加' : '写真を追加'}
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={busy}
              onChange={(e) => {
                add([...(e.target.files ?? [])])
                e.target.value = ''
              }}
            />
          </label>
        )}
      </div>
      {studio && (
        <BackdropStudio
          photoId={studio}
          onClose={() => setStudio(null)}
          onDone={(next) => {
            swap(studio, next)
            setStudio(null)
          }}
        />
      )}
      {adjust && (
        <PhotoAdjust
          own
          photoId={crops[adjust]?.origId ?? adjust}
          start={crops[adjust]}
          onClose={() => setAdjust(null)}
          onDone={(next, c) => {
            swap(adjust, next, { origId: crops[adjust]?.origId ?? adjust, ...c })
            setAdjust(null)
          }}
        />
      )}
    </>
  )
}

/**
 * 重ねて開く画面の枠。画面の端から少し離した角丸のカードで、action (保存など) は
 * スクロールせず常に下に見える。背景のタップと × で閉じる。
 * form = 入力する画面。うっかり外側に触れて入力が消えないよう、背景のタップでは閉じない (× か保存で閉じる)
 */
export function Sheet({ title, action, form, children }: { title: string; action?: ReactNode; form?: boolean; children: ReactNode }) {
  const { close } = useApp()
  return (
    <div className="backdrop" onClick={(e) => !form && e.target === e.currentTarget && close()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title || undefined}>
        <button className="sheet-x" onClick={() => close()} aria-label="閉じる">
          <X size={16} strokeWidth={2.2} />
        </button>
        <div className="sheet-b">
          {title && <h2 className="sheet-t">{title}</h2>}
          {children}
        </div>
        {action && <div className="sheet-f">{action}</div>}
      </div>
    </div>
  )
}

/**
 * 日付・時刻の欄。iPhone のカレンダーにある「リセット」は、押しても React の onChange が呼ばれないことがあり、
 * 画面では消えたのに中身は前の日付のまま、というずれが起きる。それを防ぐために:
 *   ・ブラウザの change / input / blur を直接聞いて、欄の中身と違っていたら必ず伝える
 *   ・親が受け取らなかった値 (空にできない欄を空にした、など) は、欄の表示を元に戻す
 *   ・clearable なら、端末に頼らずに消せる × を付ける
 */
export function DateInput({
  value,
  onChange,
  type = 'date',
  clearable,
  className = '',
  ...rest
}: {
  value: string
  onChange: (v: string) => void
  type?: 'date' | 'time'
  /** 空にしてよい欄。値が入っているとき、消すための × を出す */
  clearable?: boolean
  className?: string
  min?: string
  max?: string
  'aria-label'?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const latest = useRef({ value, onChange })
  latest.current = { value, onChange }
  useEffect(() => {
    const el = ref.current!
    const sync = () => {
      if (el.value !== latest.current.value) latest.current.onChange(el.value)
      // 少し待っても親の値と違うままなら、親が受け取らなかったということなので、表示を親の値に戻す
      setTimeout(() => {
        if (el.isConnected && el.value !== latest.current.value) el.value = latest.current.value
      }, 80)
    }
    const events = ['change', 'input', 'blur']
    events.forEach((ev) => el.addEventListener(ev, sync))
    return () => events.forEach((ev) => el.removeEventListener(ev, sync))
  }, [])
  const input = <input ref={ref} type={type} className={clearable ? undefined : className} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
  if (!clearable) return input
  return (
    <span className={`date-wrap ${className}`}>
      {input}
      {value && (
        <button
          type="button"
          className="icon-btn muted"
          onClick={(e) => {
            e.preventDefault() // 欄を囲む label が押されたことにならないように
            onChange('')
          }}
          aria-label={`${rest['aria-label'] ?? '日付'}を消す`}
        >
          <X size={16} />
        </button>
      )}
    </span>
  )
}

/**
 * 予定日までの残り (「今日」「2日超過」「あと3日」)。今日と超過は、名前の太字に埋もれないように色つきのバッジにする。
 * 超過 = 赤の塗り、今日 = 薄いオレンジ地。色だけに頼らないよう、塗り方も変えている
 */
export function DueTag({ due }: { due: string }) {
  const lv = urgency(due)
  return lv ? <span className={`urg ${lv}`}>{dueLabel(due)}</span> : <>{dueLabel(due)}</>
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-l">
        {label}
        {required && <span className="req">必須</span>}
      </span>
      {children}
    </label>
  )
}
