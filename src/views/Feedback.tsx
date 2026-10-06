import { useState } from 'react'
import { useApp } from '../ctx'
import { Field, Sheet } from '../parts'

const KINDS = [
  ['request', '機能リクエスト'],
  ['bug', '不具合'],
  ['other', 'その他'],
] as const

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
        body: JSON.stringify({ kind, name, message, agent: navigator.userAgent }),
      })
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
        <button className="btn primary sm" disabled={!message.trim() || busy} onClick={send}>
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
        <Field label="名前（任意）">
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="だれからか、わかるように" />
        </Field>
      </div>
      {error && <p className="hint late">{error}</p>}
    </Sheet>
  )
}
