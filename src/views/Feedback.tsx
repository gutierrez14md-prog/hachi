import { ImagePlus, X } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../ctx'
import { Field, Sheet } from '../parts'

const KINDS = [
  ['request', '機能リクエスト'],
  ['bug', '不具合'],
  ['other', 'その他'],
] as const

const MAX_IMAGES = 3

/** 添付する画像を、送れる大きさの JPEG に縮める (スクリーンショットの字が読める程度は残す)。返すのは data URL */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  let url = ''
  // 1MB ほどに収まらなければ、もう一段小さくする
  for (const [edge, q] of [[1600, 0.8], [1100, 0.7], [800, 0.6]]) {
    const scale = Math.min(1, edge / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    const g = canvas.getContext('2d')!
    g.fillStyle = '#fff' // 透明な部分は白にする
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    url = canvas.toDataURL('image/jpeg', q)
    if (url.length < 1_300_000) break
  }
  bmp.close()
  return url
}

const ERRORS: Record<string, string> = {
  'not-configured': '送信の設定がまだ済んでいません。開発者に直接伝えてください。',
  'send-failed': '送信できませんでした。少し待ってから、もう一度試してください。',
  invalid: '内容を確かめて、もう一度送ってください。',
}

/** 開発者へのリクエスト・不具合の報告。api/feedback.ts がメールで届ける */
export function Feedback() {
  const { close, toast } = useApp()
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>('request')
  const [name, setName] = useState(() => localStorage.getItem('feedbackName') ?? '')
  const [message, setMessage] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const addImages = async (files: File[]) => {
    setLoading(true)
    setError('')
    const added: string[] = []
    for (const file of files.slice(0, MAX_IMAGES - images.length)) {
      try {
        added.push(await shrink(file))
      } catch {
        setError('読み込めない画像がありました。')
      }
    }
    setImages((cur) => [...cur, ...added].slice(0, MAX_IMAGES))
    setLoading(false)
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    setBusy(true)
    setError('')
    localStorage.setItem('feedbackName', name.trim())
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // agent: 不具合を調べるときに、機種とブラウザがわかるように
        body: JSON.stringify({ kind, name, message, agent: navigator.userAgent, images: images.map((u) => u.slice(u.indexOf(',') + 1)) }),
      })
      if (res.status === 413) throw new Error('画像が大きすぎて送れませんでした。枚数を減らして、もう一度試してください。')
      if (!res.ok) {
        const code = (await res.json().catch(() => null))?.error
        throw new Error(ERRORS[code] ?? ERRORS['send-failed'])
      }
      toast('送信しました。ありがとうございます')
      close()
    } catch (e) {
      // 通信そのものの失敗 (圏外など) は TypeError で来る
      setError(e instanceof TypeError ? '通信できませんでした。電波のよい場所で、もう一度試してください。' : (e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Sheet
      title="リクエストを送る"
      action={
        <button className="btn primary sm" disabled={!message.trim() || busy || loading} onClick={send}>
          {busy ? '送信中…' : '送信'}
        </button>
      }
    >
      <div className="seg">
        {KINDS.map(([id, label]) => (
          <button key={id} type="button" className={kind === id ? 'on' : ''} onClick={() => setKind(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="gap-top">
        <Field label="内容" required>
          <textarea
            rows={7}
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={kind === 'bug' ? 'どの画面で、何をしたら、どうなったか' : 'こうなったらうれしい、ここが使いにくい、など'}
          />
        </Field>
        {/* スクリーンショットなど。送るのはここで選んだ画像だけ */}
        <div className="field">
          <span className="field-l">画像（任意・{MAX_IMAGES} 枚まで）</span>
          <div className="shots">
            {images.map((url, i) => (
              <div className="shot" key={i}>
                <img className="shot-img" src={url} alt="" />
                <button type="button" className="shot-btn x" onClick={() => setImages(images.filter((_, j) => j !== i))} aria-label="この画像を外す">
                  <X size={14} />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <label className="shot add">
                <ImagePlus size={20} />
                {loading ? '読み込み中…' : '画像を追加'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  disabled={loading}
                  onChange={(e) => {
                    addImages([...(e.target.files ?? [])])
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>
        </div>
        <Field label="名前（任意）">
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="だれからか、わかるように" />
        </Field>
      </div>
      {error && <p className="hint late">{error}</p>}
    </Sheet>
  )
}
