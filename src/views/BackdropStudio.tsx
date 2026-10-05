import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { db, newId } from '../db'
import { backdropCss, BACKDROPS, compose, cutOut, hasAlpha } from '../lib/cutout'

const SIZE = 1200

/**
 * 写真の植物を切り抜いて、選んだ背景に載せ替える。
 * できあがりを新しい写真として保存して onDone に渡す (元の写真は、使われなくなれば次の起動時に sweepPhotos が消す)
 */
export function BackdropStudio({ photoId, onDone, onClose }: { photoId: string; onDone: (photoId: string) => void; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [cut, setCut] = useState<ImageBitmap | null>(null)
  const [status, setStatus] = useState('写真を読み込み中…')
  const [error, setError] = useState('')
  const [backdrop, setBackdrop] = useState(BACKDROPS[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let dead = false
    ;(async () => {
      const rec = await db.photos.get(photoId)
      if (!rec) throw new Error('写真が見つかりません')
      const source = await createImageBitmap(rec.blob)
      // すでに背景が透明な画像 (iPhone の写真アプリで切り抜いたもの) は、そのまま使う
      if (hasAlpha(source)) return source
      source.close()
      const started = Date.now()
      const blob = await cutOut(rec.blob, (p) => {
        if (dead) return
        if (p.stage === 'download') setStatus(`切り抜き用データをダウンロード中… ${Math.round((p.ratio ?? 0) * 100)}%（初回のみ・44MB）`)
        else if (p.stage === 'prepare') setStatus('切り抜きの準備中…')
        else setStatus('切り抜き中…')
      })
      console.info(`[cutout] ${((Date.now() - started) / 1000).toFixed(1)}s`)
      return createImageBitmap(blob)
    })().then(
      (bitmap) => !dead && setCut(bitmap),
      (e) => !dead && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      dead = true
    }
  }, [photoId])

  useEffect(() => {
    if (cut && canvas.current) compose(canvas.current, cut, backdrop)
  }, [cut, backdrop])

  const save = async () => {
    setSaving(true)
    const blob = await new Promise<Blob | null>((res) => canvas.current!.toBlob(res, 'image/jpeg', 0.88))
    if (!blob) return setError('画像を保存できませんでした')
    const id = newId()
    await db.photos.put({ id, blob })
    onDone(id)
  }

  return (
    <div className="backdrop top" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="背景を変える">
        <button className="sheet-x" onClick={onClose} aria-label="閉じる">
          <X size={16} strokeWidth={2.2} />
        </button>
        <div className="sheet-b">
          <h2 className="sheet-t">背景を変える</h2>
          <div className="studio">
            <canvas ref={canvas} width={SIZE} height={SIZE} />
            {!cut && <p className={error ? 'studio-msg late' : 'studio-msg'}>{error || status}</p>}
          </div>
          <div className="swatches">
            {BACKDROPS.map((b) => (
              <button key={b.id} className={b.id === backdrop.id ? 'on' : ''} onClick={() => setBackdrop(b)} disabled={!cut}>
                <span style={{ background: backdropCss(b) }} />
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <div className="sheet-f">
          <button className="btn primary" disabled={!cut || saving} onClick={save}>
            この背景にする
          </button>
        </div>
      </div>
    </div>
  )
}
