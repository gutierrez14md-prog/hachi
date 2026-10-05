import { Camera, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useApp } from './ctx'
import { db } from './db'
import { savePhoto } from './lib/photo'
import type { Plant } from './types'

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

/** IndexedDB に保存した写真を表示する。写真がなければ鉢植えのプレースホルダー */
export function Photo({ id, className = '' }: { id?: string; className?: string }) {
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
  if (url) return <img className={className} src={url} alt="" />
  return (
    <div className={`${className} ph`}>
      <PotIcon />
    </div>
  )
}

/**
 * 名前の下に出す 1 行: 学名 (斜体) と品種名 (' ' で囲む。斜体にしない)。
 * 複数の植物をまとめた登録は、中身の名前を並べる
 */
export function SciName({ plant: p }: { plant: Pick<Plant, 'scientificName' | 'cultivar' | 'members'> }) {
  if (p.members?.length)
    return <span className="sci-line">{p.members.map((m) => m.name || m.scientificName).filter(Boolean).join('、')}</span>
  if (!p.scientificName && !p.cultivar) return null
  return (
    <span className="sci-line">
      <i>{p.scientificName}</i>
      {p.cultivar && ` '${p.cultivar}'`}
    </span>
  )
}

export function PhotoPicker({ id, onChange }: { id?: string; onChange: (id: string) => void }) {
  return (
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
  )
}

/**
 * 重ねて開く画面の枠。画面の端から少し離した角丸のカードで、action (保存など) は
 * スクロールせず常に下に見える。背景のタップと × で閉じる。
 */
export function Sheet({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const { close } = useApp()
  return (
    <div className="backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
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
