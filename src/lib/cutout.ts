import type { Done, Failed, Progress } from './cutout.worker'

let worker: Worker | null = null

/** 写真から主役を切り抜いた、背景が透明な PNG を返す。途中経過は onProgress に流す */
export function cutOut(image: Blob, onProgress: (p: Progress) => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // ワーカー (と 44MB のモデル) は、はじめて使うときに用意して、以後は使い回す
    worker ??= new Worker(new URL('./cutout.worker.ts', import.meta.url), { type: 'module' })
    const w = worker
    const fail = (message: string) => {
      // 落ちたワーカーは捨てて、次に押したときに作り直す
      w.terminate()
      if (worker === w) worker = null
      reject(new Error(message))
    }
    w.onmessage = (e: MessageEvent<Progress | Done | Failed>) => {
      if (e.data.type === 'progress') onProgress(e.data)
      else if (e.data.type === 'done') resolve(e.data.blob)
      else fail(e.data.message)
    }
    w.onerror = (e) => fail(e.message || '切り抜きに失敗しました')
    createImageBitmap(image).then((bitmap) => w.postMessage(bitmap, [bitmap]), reject)
  })
}

/** 透明な部分があるか (iPhone の写真アプリで被写体を切り抜いた画像など) */
export function hasAlpha(image: CanvasImageSource): boolean {
  const c = document.createElement('canvas')
  c.width = c.height = 48
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0, 48, 48)
  const d = ctx.getImageData(0, 0, 48, 48).data
  let clear = 0
  for (let i = 3; i < d.length; i += 4) if (d[i] < 128) clear++
  return clear > 48 * 48 * 0.02
}

export type Backdrop = { id: string; label: string; colors: [string, string?]; kind?: 'radial' | 'linear'; shadow?: boolean }

/** 背景のパターン。colors が 2 色ならグラデーション (radial = 中央が明るいスタジオ風、linear = 上から下) */
export const BACKDROPS: Backdrop[] = [
  { id: 'studio', label: 'スタジオ', colors: ['#f6f6f4', '#c3c7c4'], kind: 'radial', shadow: true },
  { id: 'white', label: '白', colors: ['#ffffff'], shadow: true },
  { id: 'paper', label: '生成り', colors: ['#ece5d8'], shadow: true },
  { id: 'gray', label: 'グレー', colors: ['#d3d6d4'], shadow: true },
  { id: 'sage', label: 'セージ', colors: ['#cdd8cd'], shadow: true },
  { id: 'dusk', label: 'グラデ', colors: ['#ebe5d9', '#b7c1b3'], kind: 'linear', shadow: true },
  { id: 'terracotta', label: 'テラコッタ', colors: ['#c9997a'], shadow: true },
  { id: 'ink', label: '墨', colors: ['#17241d'] },
]

export const backdropCss = (b: Backdrop) =>
  !b.colors[1]
    ? b.colors[0]
    : b.kind === 'radial'
      ? `radial-gradient(circle at 50% 45%, ${b.colors[0]}, ${b.colors[1]})`
      : `linear-gradient(${b.colors[0]}, ${b.colors[1]})`

/** 切り抜いた画像の、中身がある範囲 */
function bounds(cut: ImageBitmap) {
  const N = 160
  const c = document.createElement('canvas')
  c.width = c.height = N
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(cut, 0, 0, N, N)
  const d = ctx.getImageData(0, 0, N, N).data
  let x0 = N, y0 = N, x1 = -1, y1 = -1
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      if (d[(y * N + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 < 0) return { x: 0, y: 0, w: cut.width, h: cut.height } // 何も残らなかったら全体
  const sx = cut.width / N, sy = cut.height / N
  return { x: x0 * sx, y: y0 * sy, w: (x1 - x0 + 1) * sx, h: (y1 - y0 + 1) * sy }
}

/**
 * 背景を敷き、切り抜いた主役を中央・やや下寄りに置く。
 * 元の写真での位置や大きさに関係なく、どの写真も同じ構図に揃える
 */
export function compose(canvas: HTMLCanvasElement, cut: ImageBitmap, b: Backdrop) {
  const S = canvas.width
  const ctx = canvas.getContext('2d')!
  if (!b.colors[1]) ctx.fillStyle = b.colors[0]
  else {
    const g = b.kind === 'radial' ? ctx.createRadialGradient(S / 2, S * 0.45, 0, S / 2, S * 0.45, S * 0.75) : ctx.createLinearGradient(0, 0, 0, S)
    g.addColorStop(0, b.colors[0])
    g.addColorStop(1, b.colors[1])
    ctx.fillStyle = g
  }
  ctx.fillRect(0, 0, S, S)

  const box = bounds(cut)
  const scale = Math.min((S * 0.8) / box.w, (S * 0.8) / box.h)
  const w = box.w * scale, h = box.h * scale
  const x = (S - w) / 2
  const y = Math.min(S * 0.92 - h, (S - h) / 2 + S * 0.03)

  if (b.shadow) {
    // 足元の影: 横長につぶした、中心から薄くなる円
    ctx.save()
    ctx.translate(S / 2, y + h - h * 0.015)
    ctx.scale(1, 0.13)
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.5)
    g.addColorStop(0, 'rgba(0,0,0,0.3)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, w * 0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(cut, box.x, box.y, box.w, box.h, x, y, w, h)
}
