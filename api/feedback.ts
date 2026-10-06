// 設定の「リクエストを送る」から届いた内容を、開発者あてにメールで送る (Vercel の関数)。
// 送信は Gmail の SMTP。必要な環境変数 (Vercel の Settings → Environment Variables):
//   GMAIL_USER          送信に使う Gmail アドレス
//   GMAIL_APP_PASSWORD  その Gmail のアプリパスワード (16 文字。ふだんのパスワードではない)
//   FEEDBACK_TO         届け先 (任意。無ければ GMAIL_USER あて)
import nodemailer from 'nodemailer'

const KINDS: Record<string, string> = { request: '機能リクエスト', bug: '不具合', other: 'その他' }
const MAX_MESSAGE = 2000
const MAX_NAME = 40

const json = (status: number, body: object) => Response.json(body, { status })

export async function POST(request: Request): Promise<Response> {
  // ほかのサイトに置いたフォームからの送信は受けない
  const origin = request.headers.get('origin')
  if (origin && new URL(origin).host !== request.headers.get('host')) return json(403, { error: 'forbidden' })

  let body: { kind?: unknown; message?: unknown; name?: unknown; website?: unknown; agent?: unknown }
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'invalid' })
  }
  // website は画面に出していない欄。埋まっていたら自動投稿とみなして、送らずに成功を返す
  if (body.website) return json(200, { ok: true })

  const kind = typeof body.kind === 'string' && body.kind in KINDS ? body.kind : 'other'
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_NAME) : ''
  const agent = typeof body.agent === 'string' ? body.agent.slice(0, 300) : ''
  if (!message || message.length > MAX_MESSAGE) return json(400, { error: 'invalid' })

  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) {
    console.error('feedback: GMAIL_USER / GMAIL_APP_PASSWORD が設定されていません')
    return json(500, { error: 'not-configured' })
  }

  try {
    await nodemailer.createTransport({ service: 'gmail', auth: { user, pass } }).sendMail({
      from: `Hachi <${user}>`,
      to: process.env.FEEDBACK_TO || user,
      subject: `[Hachi] ${KINDS[kind]}${name ? ` (${name})` : ''}: ${message.replace(/\s+/g, ' ').slice(0, 40)}`,
      text: [`種類: ${KINDS[kind]}`, `送信者: ${name || '(名前なし)'}`, '', message, '', '--', `端末: ${agent || '(不明)'}`].join('\n'),
    })
    return json(200, { ok: true })
  } catch (e) {
    console.error('feedback: 送信に失敗', e)
    return json(502, { error: 'send-failed' })
  }
}
