import { X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { db } from '../db'
import { CROP_ASPECT, cropPhoto } from '../lib/photo'
import type { PhotoCrop } from '../types'

const MAX_ZOOM = 4

/**
 * 写真の位置と大きさの調整。枠の中で写真を指で動かし、2 本指かスライダーで拡大する。
 * 決定すると、枠の範囲を切り出した新しい写真を保存して onDone に渡す。
 * 元の写真 (photoId) は残すので、あとから調整し直せる (start = 前回の調整)。
 * own = 枠を 4:3 にせず、写真そのものの形にする (生長記録用。写真の形は変えずに、寄せたり拡大したりする)
 */
export function PhotoAdjust({
  photoId,
  start,
  own,
  onDone,
  onClose,
}: {
  photoId: string
  own?: boolean
  start?: Pick<PhotoCrop, 'x' | 'y' | 'zoom'>
  onDone: (photoId: string, crop: Pick<PhotoCrop, 'x' | 'y' | 'zoom'>) => void
  onClose: () => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string>()
  // 写真の元の大きさ (px)
  const [size, setSize] = useState<{ w: number; h: number }>()
  // 枠の横幅 (px)。表示の計算に使う
  const [width, setWidth] = useState(0)
  // x, y = 枠の中心に来る写真上の位置 (0〜1)。zoom = 1 で、写真が枠をちょうど覆う大きさ
  const [v, setV] = useState({ x: start?.x ?? 0.5, y: start?.y ?? 0.5, zoom: start?.zoom ?? 1 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let made: string | undefined
    let dead = false
    db.photos.get(photoId).then((rec) => {
      if (!rec || dead) return
      made = URL.createObjectURL(rec.blob)
      setUrl(made)
    })
    return () => {
      dead = true
      if (made) URL.revokeObjectURL(made)
    }
  }, [photoId])

  useEffect(() => {
    const el = frame.current!
    const measure = () => setWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 枠の縦横比。写真そのものの形にするときも、極端に細長い写真は枠が画面に収まる範囲にとどめる
  const aspect = own && size ? Math.min(1.8, Math.max(0.7, size.w / size.h)) : CROP_ASPECT
  // 枠の形が決まったら (写真を読み込んで縦横比がわかったとき)、すぐに横幅を測り直す
  useLayoutEffect(() => setWidth(frame.current!.clientWidth), [aspect])
  // 表示上の写真の大きさ (px)
  const height = width / aspect
  const base = size ? Math.max(width / size.w, height / size.h) : 0
  const dw = size ? size.w * base * v.zoom : 0
  const dh = size ? size.h * base * v.zoom : 0

  // 写真が枠からはみ出して余白が出ないように、位置を収める
  const clamp = (n: { x: number; y: number; zoom: number }) => {
    if (!size || !width) return n
    const zoom = Math.min(MAX_ZOOM, Math.max(1, n.zoom))
    const hx = width / (2 * size.w * base * zoom)
    const hy = height / (2 * size.h * base * zoom)
    return { zoom, x: Math.min(1 - hx, Math.max(hx, n.x)), y: Math.min(1 - hy, Math.max(hy, n.y)) }
  }

  // 指 1 本で動かす、2 本で拡大する
  const points = useRef(new Map<number, { x: number; y: number }>())
  const down = (e: React.PointerEvent) => {
    // 指が枠の外へ出ても追い続ける (取れない環境では、枠の中だけで動かせる)
    try {
      frame.current!.setPointerCapture(e.pointerId)
    } catch {}
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }
  const move = (e: React.PointerEvent) => {
    const prev = points.current.get(e.pointerId)
    if (!prev || !dw) return
    const now = { x: e.clientX, y: e.clientY }
    const others = [...points.current.entries()].filter(([id]) => id !== e.pointerId)
    points.current.set(e.pointerId, now)
    if (!others.length) return setV((c) => clamp({ ...c, x: c.x - (now.x - prev.x) / dw, y: c.y - (now.y - prev.y) / dh }))
    const o = others[0][1]
    const before = Math.hypot(prev.x - o.x, prev.y - o.y)
    const after = Math.hypot(now.x - o.x, now.y - o.y)
    if (before > 0) setV((c) => clamp({ ...c, zoom: c.zoom * (after / before) }))
  }
  const up = (e: React.PointerEvent) => points.current.delete(e.pointerId)

  const save = async () => {
    setSaving(true)
    try {
      const crop = clamp(v)
      onDone(await cropPhoto(photoId, crop, aspect), crop)
    } catch {
      setError('画像を保存できませんでした')
      setSaving(false)
    }
  }

  const shown = clamp(v)
  return (
    <div className="backdrop top">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="写真の位置と大きさ">
        <button className="sheet-x" onClick={onClose} aria-label="閉じる">
          <X size={16} strokeWidth={2.2} />
        </button>
        <div className="sheet-b">
          <h2 className="sheet-t">写真の位置と大きさ</h2>
          <div className="adjust-frame" style={{ aspectRatio: aspect, '--ar': aspect } as React.CSSProperties} ref={frame} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            {url && (
              <img
                src={url}
                alt=""
                draggable={false}
                onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                style={size && width ? { width: dw, height: dh, left: width / 2 - shown.x * dw, top: height / 2 - shown.y * dh } : { opacity: 0 }}
              />
            )}
            {/* 一覧のタイルは正方形に切り取られるので、その範囲の目安 (植物の写真だけ) */}
            {!own && <i className="adjust-guide" />}
          </div>
          <div className="share-adjust">
            <label>
              拡大
              <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={shown.zoom} onChange={(e) => setV((c) => clamp({ ...c, zoom: Number(e.target.value) }))} />
            </label>
            <button className="btn ghost sm" onClick={() => setV({ x: 0.5, y: 0.5, zoom: 1 })}>
              元に戻す
            </button>
          </div>
          {error && <p className="hint late">{error}</p>}
        </div>
        <div className="sheet-f">
          <button className="btn primary" disabled={!size || saving} onClick={save}>
            この位置にする
          </button>
        </div>
      </div>
    </div>
  )
}
