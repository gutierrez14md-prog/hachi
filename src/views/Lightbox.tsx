import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useApp } from '../ctx'
import { Photo } from '../parts'

const MAX = 5
type View = { s: number; x: number; y: number }
const REST: View = { s: 1, x: 0, y: 0 }

/**
 * 写真を画面いっぱいに出す。指 2 本で拡大、拡大中は 1 本でずらす、ダブルタップで拡大 / 戻す。
 * 複数枚あるときは、等倍のまま横にはらうと前後の写真へ移る。
 * (アプリ全体ではピンチでの拡大を止めているので、ここだけ自前で指の動きを追っている)
 */
export function Lightbox({ ids, index }: { ids: string[]; index: number }) {
  const { close } = useApp()
  const [i, setI] = useState(Math.min(index, ids.length - 1))
  const [view, setView] = useState(REST)
  const [moving, setMoving] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  // 触れている指と、触れはじめたときの状態
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const start = useRef<{ view: View; mid: { x: number; y: number }; dist: number; at: number; moved: boolean } | null>(null)
  const lastTap = useRef(0)

  useEffect(() => setView(REST), [i])
  const go = (d: number) => setI((n) => Math.max(0, Math.min(ids.length - 1, n + d)))

  // 画面の中央を原点にした、指の位置
  const local = (e: PointerEvent) => {
    const r = stage.current!.getBoundingClientRect()
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 }
  }
  const gesture = () => {
    const list = [...pts.current.values()]
    const mid = { x: list.reduce((a, p) => a + p.x, 0) / list.length, y: list.reduce((a, p) => a + p.y, 0) / list.length }
    const dist = list.length > 1 ? Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y) : 0
    return { mid, dist }
  }
  // 写真が画面の外へ行きすぎないように
  const clamp = (v: View): View => {
    const r = stage.current!.getBoundingClientRect()
    const mx = ((v.s - 1) * r.width) / 2, my = ((v.s - 1) * r.height) / 2
    return { s: v.s, x: Math.max(-mx, Math.min(mx, v.x)), y: Math.max(-my, Math.min(my, v.y)) }
  }

  const down = (e: PointerEvent) => {
    stage.current!.setPointerCapture(e.pointerId)
    pts.current.set(e.pointerId, local(e))
    start.current = { view, ...gesture(), at: Date.now(), moved: false }
    setMoving(true)
  }
  const move = (e: PointerEvent) => {
    if (!pts.current.has(e.pointerId) || !start.current) return
    pts.current.set(e.pointerId, local(e))
    const g = gesture(), st = start.current
    if (Math.hypot(g.mid.x - st.mid.x, g.mid.y - st.mid.y) > 8) st.moved = true
    if (pts.current.size > 1 && st.dist > 0) {
      // 2 本: 指の間にあった場所が、指の間に残るように拡大する
      const s = Math.max(1, Math.min(MAX, (st.view.s * g.dist) / st.dist))
      const k = s / st.view.s
      setView(clamp({ s, x: g.mid.x - (st.mid.x - st.view.x) * k, y: g.mid.y - (st.mid.y - st.view.y) * k }))
      st.moved = true
    } else if (st.view.s > 1) {
      setView(clamp({ s: st.view.s, x: st.view.x + g.mid.x - st.mid.x, y: st.view.y + g.mid.y - st.mid.y }))
    } else setView({ s: 1, x: g.mid.x - st.mid.x, y: 0 }) // 等倍: 横にはらう
  }
  const up = (e: PointerEvent) => {
    const at = local(e)
    pts.current.delete(e.pointerId)
    const st = start.current
    if (pts.current.size > 0) {
      // 指が 1 本残った: そこから動かし直す
      start.current = { view, ...gesture(), at: Date.now(), moved: true }
      return
    }
    setMoving(false)
    start.current = null
    if (!st) return
    if (st.view.s === 1 && view.s === 1) {
      // はらった距離が十分なら、前後の写真へ
      if (Math.abs(view.x) > 70) go(view.x < 0 ? 1 : -1)
      setView(REST)
    } else if (view.s < 1.05) setView(REST)
    // ダブルタップ: 等倍なら押したところを中心に拡大、拡大中なら戻す
    if (!st.moved && Date.now() - st.at < 300) {
      if (Date.now() - lastTap.current < 320) {
        setView(view.s > 1 ? REST : clamp({ s: 2.5, x: -at.x * 1.5, y: -at.y * 1.5 }))
        lastTap.current = 0
      } else lastTap.current = Date.now()
    }
  }

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="写真">
      <div
        ref={stage}
        className="lb-stage"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={(e) => setView((v) => clamp({ ...v, s: Math.max(1, Math.min(MAX, v.s * (e.deltaY < 0 ? 1.15 : 0.87))) }))}
      >
        <div className="lb-move" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, transition: moving ? 'none' : 'transform 0.2s ease' }}>
          <Photo key={ids[i]} id={ids[i]} className="lb-img" />
        </div>
      </div>
      <button className="lb-btn lb-x" onClick={() => close()} aria-label="閉じる">
        <X size={20} />
      </button>
      {ids.length > 1 && (
        <>
          <button className="lb-btn lb-prev" disabled={i === 0} onClick={() => go(-1)} aria-label="前の写真">
            <ChevronLeft size={22} />
          </button>
          <button className="lb-btn lb-next" disabled={i === ids.length - 1} onClick={() => go(1)} aria-label="次の写真">
            <ChevronRight size={22} />
          </button>
          <p className="lb-count">
            {i + 1} / {ids.length}
          </p>
        </>
      )}
    </div>
  )
}
