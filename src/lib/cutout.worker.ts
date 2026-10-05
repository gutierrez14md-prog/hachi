// 写真から主役 (植物と鉢) を切り抜く。重い処理なので、画面を止めないようワーカーの中で動かす。
// モデルは RMBG-1.4 (BRIA AI。非商用ライセンス) の量子化版 44MB。端末の中だけで推論し、写真は外に送らない
import * as ort from 'onnxruntime-web/wasm'

const MODEL = 'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model_quantized.onnx'
const SIZE = 1024 // モデルの入力は 1024x1024 固定

export type Progress = { type: 'progress'; stage: 'download' | 'prepare' | 'cut'; ratio?: number }
export type Done = { type: 'done'; blob: Blob }
export type Failed = { type: 'error'; message: string }

const post = (msg: Progress | Done | Failed) => (self as unknown as Worker).postMessage(msg)

/** モデルを取ってくる。2 回目からは端末に保存したものを使う (通信しない) */
async function fetchModel(): Promise<ArrayBuffer> {
  const cache = await caches.open('hachi-models')
  const hit = await cache.match(MODEL)
  if (hit) return hit.arrayBuffer()

  const res = await fetch(MODEL)
  if (!res.ok || !res.body) throw new Error(`切り抜き用データを取得できませんでした (${res.status})`)
  const total = Number(res.headers.get('content-length')) || 44_400_000
  const chunks: Uint8Array[] = []
  let got = 0
  for (const reader = res.body.getReader(); ; ) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    got += value.length
    post({ type: 'progress', stage: 'download', ratio: Math.min(1, got / total) })
  }
  const buf = new Uint8Array(got)
  let at = 0
  for (const c of chunks) {
    buf.set(c, at)
    at += c.length
  }
  await cache.put(MODEL, new Response(buf, { headers: { 'content-type': 'application/octet-stream' } }))
  return buf.buffer
}

let session: Promise<ort.InferenceSession> | null = null
const getSession = () =>
  (session ??= (async () => {
    const model = await fetchModel()
    post({ type: 'progress', stage: 'prepare' })
    return ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
  })().catch((e) => {
    session = null // 次に押したときにやり直せるように
    throw e
  }))

async function cut(bitmap: ImageBitmap): Promise<Blob> {
  const s = await getSession()
  post({ type: 'progress', stage: 'cut' })

  // 前処理: 1024x1024 に伸縮して、RGB を (値 / 255 - 0.5) の並びにする
  const small = new OffscreenCanvas(SIZE, SIZE)
  const sctx = small.getContext('2d', { willReadFrequently: true })!
  sctx.drawImage(bitmap, 0, 0, SIZE, SIZE)
  const px = sctx.getImageData(0, 0, SIZE, SIZE).data
  const n = SIZE * SIZE
  const input = new Float32Array(3 * n)
  for (let i = 0; i < n; i++) {
    input[i] = px[i * 4] / 255 - 0.5
    input[n + i] = px[i * 4 + 1] / 255 - 0.5
    input[2 * n + i] = px[i * 4 + 2] / 255 - 0.5
  }

  const out = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) })
  const mask = out[s.outputNames[0]].data as Float32Array
  let min = Infinity
  let max = -Infinity
  for (const v of mask) {
    if (v < min) min = v
    if (v > max) max = v
  }

  // マスク (主役らしさ 0..1) を不透明度にして、元の大きさの写真に掛ける
  const alpha = sctx.createImageData(SIZE, SIZE)
  for (let i = 0; i < n; i++) alpha.data[i * 4 + 3] = ((mask[i] - min) / (max - min || 1)) * 255
  sctx.putImageData(alpha, 0, 0)

  const full = new OffscreenCanvas(bitmap.width, bitmap.height)
  const fctx = full.getContext('2d')!
  fctx.drawImage(bitmap, 0, 0)
  fctx.globalCompositeOperation = 'destination-in'
  fctx.drawImage(small, 0, 0, bitmap.width, bitmap.height)
  bitmap.close()
  return full.convertToBlob({ type: 'image/png' })
}

self.onmessage = async (e: MessageEvent<ImageBitmap>) => {
  try {
    post({ type: 'done', blob: await cut(e.data) })
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
