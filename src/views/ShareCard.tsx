import { Copy, Download, Share2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../ctx'
import { db, journalPhotos } from '../db'
import { diffDays, fromKey, today } from '../lib/date'
import { CARD_H, CARD_W, drawCard, TONES, type Brand, type Design, type ToneId } from '../lib/sharecard'
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

/**
 * SNS に投稿する用の画像を作る。載せる情報とアプリの印を選び、端末の共有シート (Instagram など) に渡す。
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
    const list: { id: string; date?: string }[] = []
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
  const before = shots.find((s) => s.id === beforeId) ?? [...shots].reverse().find((s) => s.id !== shotId)
  // 写真が 1 枚しか無い株では、ビフォーアフターは作れない
  const design: Design = prefs.design === 'compare' && !before ? 'label' : prefs.design
  const afterDate = shot?.date ?? today()

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

  // 選び方が変わるたびに描き直し、共有用のファイルも作っておく
  // (共有シートは、ボタンを押したその場で呼ばないと開かないので、押してから作るのでは遅い)
  const key = JSON.stringify([shotId, before?.id, design, prefs, values])
  useEffect(() => {
    let dead = false
    setFile(null)
    ;(async () => {
      const load = async (id?: string) => {
        const rec = id ? await db.photos.get(id) : undefined
        return rec ? createImageBitmap(rec.blob) : null
      }
      const two = design === 'compare'
      // ビフォーアフターは [前, 後] の順
      const bitmaps = two ? [await load(before?.id), await load(shotId)] : [await load(shotId)]
      if (dead || !canvas.current) return
      await drawCard(canvas.current, bitmaps, {
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
      })
      bitmaps.forEach((b) => b?.close())
      canvas.current.toBlob((blob) => !dead && blob && setFile(new File([blob], `hachi-${today()}.jpg`, { type: 'image/jpeg' })), 'image/jpeg', 0.9)
    })()
    return () => {
      dead = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key が、描く内容のすべて
  }, [key])

  if (!p) return null

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
      <canvas ref={canvas} width={CARD_W} height={CARD_H} className="share-canvas" />

      {shots.length > 1 && (
        <>
          {design === 'compare' && <p className="share-cap">後（右）の写真</p>}
          <div className="share-shots">
            {shots.map((s) => (
              <button key={s.id} className={s.id === shotId ? 'on' : ''} onClick={() => setShotId(s.id)} aria-label="この写真を使う">
                <Photo id={s.id} />
              </button>
            ))}
          </div>
        </>
      )}
      {design === 'compare' && (
        <>
          <p className="share-cap">前（左）の写真</p>
          <div className="share-shots">
            {shots
              .filter((s) => s.id !== shotId)
              .map((s) => (
                <button key={s.id} className={s.id === before?.id ? 'on' : ''} onClick={() => setBeforeId(s.id)} aria-label="前の写真に使う">
                  <Photo id={s.id} />
                </button>
              ))}
          </div>
        </>
      )}

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
