import { Copy, Download, Move, Share2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useApp } from '../ctx'
import { db, journalPhotos } from '../db'
import { diffDays, fromKey, today } from '../lib/date'
import { CARD_H, CARD_W, clampFocus, drawCard, NO_FOCUS, TONES, type Brand, type Design, type Focus, type Slot, type ToneId } from '../lib/sharecard'
import { Photo, Sheet } from '../parts'

type FieldId = 'name' | 'sci' | 'cultivar' | 'group' | 'date' | 'days'
const FIELDS: [FieldId, string][] = [
  ['name', '名前'],
  ['sci', '学名'],
  ['cultivar', '品種名'],
  ['group', '分類'],
  ['date', '日付'],
  ['days', '育てた日数'],
]
const DESIGNS: [Design, string][] = [
  ['label', 'ラベル'],
  ['specimen', '標本カード'],
  ['compare', 'ビフォーアフター'],
]
// 標本カードで、値の左に出す項目名
const META_LABELS = { group: '分類', date: '日付', days: '栽培' } as const
const BRANDS: [Brand, string][] = [
  ['word', 'Hachi'],
  ['mark', '鉢マーク'],
  ['kanji', '鉢'],
  ['none', 'なし'],
]

// 前回の選び方を覚えておく (端末ごと)
type Prefs = { fields: FieldId[]; brand: Brand; tone: ToneId; design: Design }
const loadPrefs = (): Prefs => {
  try {
    const p = JSON.parse(localStorage.getItem('shareCard') ?? 'null')
    if (p && Array.isArray(p.fields) && BRANDS.some(([b]) => b === p.brand))
      return { ...p, tone: TONES.some((t) => t.id === p.tone) ? p.tone : 'green', design: DESIGNS.some(([d]) => d === p.design) ? p.design : 'label' }
  } catch {
    // 壊れていたら初期値
  }
  return { fields: ['name', 'sci', 'cultivar', 'date'], brand: 'word', tone: 'green', design: 'label' }
}

const dots = (key: string) => {
  const d = fromKey(key)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

type Shot = { id: string; date?: string }

/** 写真を選ぶ一覧。どれがいつの写真かわかるように、下に日付を重ねる */
function ShotStrip({ shots, value, onPick }: { shots: Shot[]; value?: string; onPick: (id: string) => void }) {
  return (
    <div className="share-shots">
      {shots.map((s) => (
        <button key={s.id} className={s.id === value ? 'on' : ''} onClick={() => onPick(s.id)} aria-label={s.date ? `${dots(s.date)} の写真` : '日付のない写真'}>
          <Photo id={s.id} />
          <span>{s.date ? dots(s.date).slice(2) : '日付なし'}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * SNS に投稿する用の画像を作る。載せる情報とアプリの刻印を選び、端末の共有シート (Instagram など) に渡す。
 * 購入金額・購入場所のような情報は、選択肢にも出さない
 */
export function ShareCard({ plantId, photoId }: { plantId: string; photoId?: string }) {
  const { allPlants, groups, journal, toast } = useApp()
  const p = allPlants.find((x) => x.id === plantId)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [prefs, setPrefs] = useState(loadPrefs)
  const [file, setFile] = useState<File | null>(null)

  // 使える写真: 植物の写真と、その株の生長記録の写真 (新しい順)。記録の写真は、その記録の日付を持つ
  const shots = useMemo(() => {
    const list: Shot[] = []
    if (p?.photoId) list.push({ id: p.photoId })
    const entries = journal.filter((j) => j.plantId === plantId).sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at)
    for (const j of entries)
      for (const id of journalPhotos(j)) {
        const known = list.find((s) => s.id === id)
        // 植物の写真が生長記録の写真と同じものなら、その記録の日付を使う
        if (known) known.date ??= j.date || undefined
        else list.push({ id, date: j.date || undefined })
      }
    return list
  }, [p?.photoId, journal, plantId])
  const [shotId, setShotId] = useState(photoId ?? shots[0]?.id)
  const shot = shots.find((s) => s.id === shotId)
  // ビフォーアフターの「前」の写真。初めは、いちばん古い写真 (一覧の末尾)
  const [beforeId, setBeforeId] = useState<string>()
  const before = shots.find((s) => s.id === beforeId && s.id !== shotId) ?? [...shots].reverse().find((s) => s.id !== shotId)
  // 写真が 1 枚しか無い株では、ビフォーアフターは作れない
  const design: Design = prefs.design === 'compare' && !before ? 'label' : prefs.design
  const two = design === 'compare'
  const afterDate = shot?.date ?? today()
  // カードに入る写真。ビフォーアフターは [前, 後] の順
  const used = two ? [before?.id, shotId] : [shotId]
  const usedKey = used.join('|')

  const group = groups.find((g) => g.id === p?.groupId)?.name
  const values: Record<FieldId, string | undefined> = {
    name: p?.name,
    sci: p?.scientificName || undefined,
    cultivar: p?.cultivar,
    group,
    date: dots(afterDate),
    days: p ? `${diffDays(today(), p.purchaseDate || p.createdDay) + 1}日目` : undefined,
  }
  const on = (id: FieldId) => prefs.fields.includes(id) && !!values[id]

  const update = (next: Prefs) => {
    setPrefs(next)
    localStorage.setItem('shareCard', JSON.stringify(next))
  }

  // 写真の位置と大きさの調整 (写真ごと)。adjusting の間だけ、プレビューを指で動かせる
  const [focus, setFocus] = useState<Record<string, Focus>>({})
  const [adjusting, setAdjusting] = useState(false)
  const [active, setActive] = useState(0) // 拡大のスライダーが効く写真 (最後に触ったほう)
  const slots = useRef<(Slot | null)[]>([])
  const drag = useRef<{ i: number; x: number; y: number; from: Focus } | null>(null)

  // 写真を読み込む (選び直したときだけ。位置を動かすたびには読み直さない)。
  // どの組み合わせの写真かを一緒に持ち、描く側は「いま選んでいる組み合わせ」のものだけを使う。
  // 古い写真は、新しい写真に入れ替えたあとで破棄する (描いている途中の写真を破棄しないため)
  const [loaded, setLoaded] = useState<{ key: string; list: (ImageBitmap | null)[] } | null>(null)
  const loadedRef = useRef(loaded)
  loadedRef.current = loaded
  useEffect(() => {
    let dead = false
    Promise.all(
      usedKey.split('|').map(async (id) => {
        const rec = id ? await db.photos.get(id) : undefined
        return rec ? createImageBitmap(rec.blob) : null
      }),
    ).then((list) => {
      if (dead) return list.forEach((b) => b?.close())
      const old = loadedRef.current
      setLoaded({ key: usedKey, list })
      setTimeout(() => old?.list.forEach((b) => b?.close()), 1000)
    })
    return () => {
      dead = true
    }
  }, [usedKey])
  useEffect(() => () => loadedRef.current?.list.forEach((b) => b?.close()), [])
  const bitmaps = loaded?.key === usedKey ? loaded.list : null

  // 選び方や位置が変わるたびに描き直す。共有用のファイルは、動かし終わってから作る
  // (共有シートは、ボタンを押したその場で呼ばないと開かないので、押してから作るのでは遅い)
  const key = JSON.stringify([usedKey, design, prefs, values, used.map((id) => (id ? focus[id] : null))])
  useEffect(() => {
    if (!bitmaps || !canvas.current) return
    let dead = false
    setFile(null)
    let timer: ReturnType<typeof setTimeout>
    drawCard(
      canvas.current,
      bitmaps,
      {
        design,
        name: on('name') ? values.name : undefined,
        sci: on('sci') ? values.sci : undefined,
        cultivar: on('cultivar') ? values.cultivar : undefined,
        // ビフォーアフターでは、日付は左右の写真の下に出すので、ここには入れない
        meta: (['group', 'date', 'days'] as const)
          .filter((id) => on(id) && !(two && id === 'date'))
          .map((id) => ({ label: META_LABELS[id], value: values[id]! })),
        brand: prefs.brand,
        tone: prefs.tone,
        dates: two && on('date') ? [before?.date && dots(before.date), dots(afterDate)] : undefined,
        elapsed: two && on('date') && before?.date ? `${diffDays(afterDate, before.date)}日` : undefined,
      },
      used.map((id) => (id ? focus[id] : undefined)),
    ).then(
      (s) => {
        if (dead) return
        slots.current = s
        timer = setTimeout(
          () => canvas.current?.toBlob((blob) => !dead && blob && setFile(new File([blob], `hachi-${today()}.jpg`, { type: 'image/jpeg' })), 'image/jpeg', 0.9),
          200,
        )
      },
      // 写真を選び直した直後は、前の写真がもう破棄されていて描けないことがある。すぐ次の描画が来るので、何もしない
      (e) => console.warn('[share card]', e),
    )
    return () => {
      dead = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key と bitmaps が、描く内容のすべて
  }, [key, bitmaps])

  if (!p) return null

  // プレビュー上の指の位置を、カードの座標にする
  const toCard = (e: PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * CARD_W, y: ((e.clientY - r.top) / r.height) * CARD_H }
  }
  const setFocusOf = (i: number, f: Focus) => {
    const id = used[i], slot = slots.current[i]
    if (id && slot) setFocus((cur) => ({ ...cur, [id]: clampFocus(f, slot) }))
  }
  const down = (e: PointerEvent) => {
    if (!adjusting) return
    const at = toCard(e)
    // 触ったところにある写真を動かす (ビフォーアフターは左右どちらか)
    const i = Math.max(0, slots.current.findIndex((s) => s && at.x >= s.x && at.x <= s.x + s.w && at.y >= s.y && at.y <= s.y + s.h))
    canvas.current!.setPointerCapture(e.pointerId)
    drag.current = { i, ...at, from: focus[used[i] ?? ''] ?? NO_FOCUS }
    setActive(i)
  }
  const move = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const at = toCard(e)
    setFocusOf(d.i, { ...d.from, dx: d.from.dx + at.x - d.x, dy: d.from.dy + at.y - d.y })
  }
  const activeIndex = Math.min(active, used.length - 1)
  const activeFocus = focus[used[activeIndex] ?? ''] ?? NO_FOCUS

  const caption = [p.name, [p.scientificName, p.cultivar && `'${p.cultivar}'`].filter(Boolean).join(' '), '', [group, p.scientificName.split(' ')[0]].filter(Boolean).map((t) => `#${t}`).join(' ')]
    .join('\n')
    .trim()

  const canShare = !!file && !!navigator.canShare?.({ files: [file] })
  const share = () => {
    if (!file) return
    navigator.share({ files: [file] }).catch(() => {}) // 共有シートを閉じただけのときも、ここに来る
  }
  const save = () => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const copy = () =>
    navigator.clipboard.writeText(caption).then(
      () => toast('キャプションをコピーしました'),
      () => toast('コピーできませんでした'),
    )

  return (
    <Sheet
      title="投稿用の画像"
      action={
        <>
          <button className="btn ghost" onClick={copy}>
            <Copy size={16} /> 文をコピー
          </button>
          {canShare ? (
            <button className="btn primary" onClick={share}>
              <Share2 size={16} /> 共有
            </button>
          ) : (
            <button className="btn primary" disabled={!file} onClick={save}>
              <Download size={16} /> 保存
            </button>
          )}
        </>
      }
    >
      <div className="seg share-design">
        {DESIGNS.map(([id, label]) => (
          <button key={id} className={design === id ? 'on' : ''} disabled={id === 'compare' && shots.length < 2} onClick={() => update({ ...prefs, design: id })}>
            {label}
          </button>
        ))}
      </div>
      <canvas
        ref={canvas}
        width={CARD_W}
        height={CARD_H}
        className={`share-canvas ${adjusting ? 'adjusting' : ''}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      />

      {/* 写真の位置: ふだんはプレビューの上でもスクロールできるように、押したときだけ動かせる状態にする */}
      {shots.length > 0 && (
        <div className="share-adjust">
          <button className={`btn sm ${adjusting ? 'primary' : 'ghost'}`} onClick={() => setAdjusting((a) => !a)}>
            <Move size={15} /> {adjusting ? '位置の調整を終える' : '写真の位置を調整'}
          </button>
          {adjusting && (
            <>
              <label>
                拡大{two && (activeIndex === 0 ? '（前）' : '（後）')}
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={activeFocus.z}
                  onChange={(e) => setFocusOf(activeIndex, { ...activeFocus, z: Number(e.target.value) })}
                />
              </label>
              <button
                className="btn ghost sm"
                onClick={() =>
                  setFocus((cur) => {
                    const next = { ...cur }
                    for (const id of used) if (id) delete next[id]
                    return next
                  })
                }
              >
                戻す
              </button>
            </>
          )}
        </div>
      )}

      {/* 写真えらび。ビフォーアフターは、前 → 後の順 */}
      {two && (
        <>
          <p className="share-cap">前（左）の写真</p>
          <ShotStrip shots={shots.filter((s) => s.id !== shotId)} value={before?.id} onPick={setBeforeId} />
          <p className="share-cap">後（右）の写真</p>
        </>
      )}
      {shots.length > 1 && <ShotStrip shots={shots} value={shotId} onPick={setShotId} />}

      <h3 className="sec">載せる情報</h3>
      <div className="chips">
        {FIELDS.filter(([id]) => values[id]).map(([id, label]) => (
          <button
            key={id}
            className={`chip ${on(id) ? 'on' : ''}`}
            aria-pressed={on(id)}
            onClick={() => update({ ...prefs, fields: on(id) ? prefs.fields.filter((x) => x !== id) : [...prefs.fields, id] })}
          >
            {label}
          </button>
        ))}
      </div>

      <h3 className="sec">カードの色</h3>
      <div className="swatches">
        {TONES.map((t) => (
          <button key={t.id} className={prefs.tone === t.id ? 'on' : ''} onClick={() => update({ ...prefs, tone: t.id })}>
            <span style={{ background: t.band }} />
            {t.label}
          </button>
        ))}
      </div>

      <h3 className="sec">アプリの刻印</h3>
      <div className="seg">
        {BRANDS.map(([id, label]) => (
          <button key={id} className={prefs.brand === id ? 'on' : ''} onClick={() => update({ ...prefs, brand: id })}>
            {label}
          </button>
        ))}
      </div>
      {canShare && (
        <button className="btn ghost sm share-save" onClick={save}>
          <Download size={15} /> 画像を保存
        </button>
      )}
    </Sheet>
  )
}
