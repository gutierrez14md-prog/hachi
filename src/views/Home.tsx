import { AlignJustify, Archive, BookOpen, CalendarClock, Check, ChevronDown, ChevronUp, Droplets, Grid2x2, Grid3x3, LayoutList, ListChecks, MapPin, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ALL_TYPES, CARE, careVar, SCHED } from '../care'
import { useApp } from '../ctx'
import { addDays, diffDays, fmtDay, fmtFull, fromKey, today, urgency, type Urgency } from '../lib/date'
import { careIcon, careLabel, METHOD_IDS, METHODS } from '../method'
import { heads, nextDue } from '../lib/schedule'
import { describe, useWeather } from '../lib/weather'
import { DueTag, Photo, PotIcon, SciName, SciText } from '../parts'
import type { CareType, Plant, SchedType } from '../types'

type Sort = 'water' | 'care' | 'name' | 'sci' | 'new' | 'days-desc' | 'days-asc' | 'price-desc' | 'price-asc'
const SORTS: [Sort, string][] = [
  ['water', '水やりが近い順'],
  ['care', 'ケアが近い順'],
  ['name', '名前順'],
  ['sci', '学名順'],
  ['days-desc', '育てている日数が長い順'],
  ['days-asc', '育てている日数が短い順'],
  ['price-desc', '金額が高い順'],
  ['price-asc', '金額が安い順'],
  ['new', '追加が新しい順'],
]

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

type View = 'list' | 'tile' | 'mini' | 'compact' | 'book'
const VIEWS: [View, string, typeof LayoutList][] = [
  ['list', 'リスト', LayoutList],
  ['tile', 'タイル（3 列）', Grid2x2],
  ['mini', 'ミニ（5 列）', Grid3x3],
  ['compact', 'コンパクト', AlignJustify],
  ['book', '図鑑', BookOpen],
]

// 一覧を見出しで区切るか
type GroupBy = 'none' | 'group' | 'location'
const GROUP_BYS: [GroupBy, string][] = [
  ['none', 'まとめない'],
  ['group', '分類ごと'],
  ['location', '置き場所ごと'],
]

/**
 * まとめてケア: ケアの種類を選ぶ (types) → 一覧で株を選ぶ (plants) → 決定で、選んだ株にまとめて記録する。
 * 株を選んでいる間は、一覧の株を押すと詳細が開くかわりに、選択が入る
 */
type Bulk = { step: 'types' | 'plants'; types: CareType[]; sel: string[] }

type Due = Record<SchedType, string | null>

/** 予定がいちばん近いケア (水やり・肥料・活力剤のうち)。予定が 1 つも無ければ null */
const nearest = (due: Due): SchedType | null =>
  SCHED.reduce<SchedType | null>((best, s) => (due[s] && (!best || due[s]! < due[best]!) ? s : best), null)

/**
 * 今日やる (または過ぎている) ケアを、種類ごとの小さな丸いアイコンで並べる。
 * 文字を増やさずに「何が必要か」を見せるためのもの。過ぎているケアは赤い縁で囲む
 */
function DueIcons({ p, due, t, size = 11, className = '' }: { p: Plant; due: Due; t: string; size?: number; className?: string }) {
  const types = SCHED.filter((s) => due[s] && due[s]! <= t)
  if (!types.length) return null
  return (
    <span className={`due-ics ${className}`} role="img" aria-label={types.map((s) => careLabel(s, p)).join('・')}>
      {types.map((s) => {
        const Icon = careIcon(s, p)
        return (
          <span key={s} className={`due-ic ${urgency(due[s], t)}`} style={careVar(s)}>
            <Icon size={size} strokeWidth={2.5} />
          </span>
        )
      })}
    </span>
  )
}

/** 育て始めた日: 入手日があればそれ、無ければ登録した日 */
const since = (p: Plant) => p.purchaseDate || p.createdDay

export function Home() {
  const { plants, allPlants, groups, logsOf, open, record } = useApp()
  const [q, setQ] = useState('')
  const [loc, setLoc] = useState('')
  const [grp, setGrp] = useState('')
  const [method, setMethod] = useState('')
  const [sort, setSort] = useState<Sort>(() => (localStorage.getItem('sort') as Sort) || 'water')
  const [view, setView] = useState<View>(() => {
    const saved = localStorage.getItem('homeView')
    return VIEWS.some(([id]) => id === saved) ? (saved as View) : 'list'
  })
  const [groupBy, setGroupBy] = useState<GroupBy>(() => {
    const saved = localStorage.getItem('homeGroupBy')
    return GROUP_BYS.some(([id]) => id === saved) ? (saved as GroupBy) : 'none'
  })
  const [bulk, setBulk] = useState<Bulk | null>(null)
  // 今日のケアの一覧を開いておくか (畳むと見出しの 1 行だけになる)
  const [dueOpen, setDueOpen] = useState(() => localStorage.getItem('homeDue') !== '0')
  const picking = bulk?.step === 'plants'
  const t = today()
  const weather = useWeather(t)
  const sky = weather && describe(weather.code)

  const rows = useMemo(
    () =>
      plants.map((p, i) => {
        const due = {} as Due
        for (const s of SCHED) due[s] = nextDue(p, s, logsOf(p.id))
        return { p, due, i }
      }),
    [plants, logsOf],
  )

  const dueNow = rows
    .map((r) => ({ ...r, types: SCHED.filter((s) => r.due[s] && r.due[s]! <= t) }))
    .filter((r) => r.types.length)
  // 明日が予定日の株 (天気を出しているとき、植物のカードに添える)
  const tomorrow = addDays(t, 1)
  const dueTomorrow = rows.filter((r) => SCHED.some((s) => r.due[s] === tomorrow)).map((r) => r.p)
  const waterDue = dueNow.filter((r) => r.types.includes('water')).map((r) => r.p.id)

  const locations = [...new Set(plants.map((p) => p.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'))
  // 絞り込みに出すのは、実際に株がある分類だけ
  const groupName = new Map(groups.map((g) => [g.id, g.name]))
  const usedGroups = groups.filter((g) => plants.some((p) => p.groupId === g.id))
  // 栽培方法の絞り込みは、2 種類以上を使い分けているときだけ出す
  const usedMethods = METHOD_IDS.filter((m) => plants.some((p) => p.method === m))
  const needle = q.trim().toLowerCase()
  const byName = (a: { p: Plant }, b: { p: Plant }) => a.p.name.localeCompare(b.p.name, 'ja')
  const list = rows
    .filter((r) => !loc || r.p.location === loc)
    .filter((r) => !grp || r.p.groupId === grp)
    .filter((r) => !method || r.p.method === method)
    .filter(
      (r) =>
        !needle ||
        [
          r.p.name,
          r.p.scientificName,
          r.p.cultivar,
          r.p.location,
          groupName.get(r.p.groupId ?? ''),
          r.p.method && METHODS[r.p.method].label,
          ...(r.p.members ?? []).flatMap((m) => [m.name, m.scientificName, m.cultivar]),
        ].some((v) => v?.toLowerCase().includes(needle)),
    )
    .sort((a, b) => {
      if (sort === 'name') return a.p.name.localeCompare(b.p.name, 'ja')
      if (sort === 'sci') return (a.p.scientificName || '￿').localeCompare(b.p.scientificName || '￿')
      if (sort === 'new') return b.p.createdDay.localeCompare(a.p.createdDay) || b.i - a.i
      if (sort === 'days-desc') return since(a.p).localeCompare(since(b.p)) || byName(a, b)
      if (sort === 'days-asc') return since(b.p).localeCompare(since(a.p)) || byName(a, b)
      if (sort === 'price-desc' || sort === 'price-asc') {
        // 金額を入れていない株は、どちらの向きでも最後
        const x = a.p.purchasePrice, y = b.p.purchasePrice
        if (x == null || y == null) return (x == null ? 1 : 0) - (y == null ? 1 : 0) || byName(a, b)
        return (sort === 'price-desc' ? y - x : x - y) || byName(a, b)
      }
      // ケアが近い順: 水やり・肥料・活力剤のうち、いちばん近い予定で比べる (水やりを済ませても、肥料が残っていれば上に残る)
      const key = (due: Due) => (sort === 'care' ? due[nearest(due) ?? 'water'] : due.water) ?? '9999'
      return key(a.due).localeCompare(key(b.due)) || byName(a, b)
    })

  // 行に出す予定: 今日やるものがあればそのうちいちばん古いもの。無ければ、ケアが近い順ではいちばん近いケア、ほかでは水やり
  const lead = (due: Due): SchedType | null => {
    const s = nearest(due)
    return s && (due[s]! <= t || sort === 'care') ? s : due.water ? 'water' : null
  }

  // 日数・金額・追加日で並べているときは、その値を行に出す (ふだんは出していない項目なので)
  const sortKey: ((p: Plant) => string) | null = sort.startsWith('days')
    ? (p) => `${diffDays(t, since(p)).toLocaleString('ja-JP')}日`
    : sort.startsWith('price')
      ? (p) => (p.purchasePrice == null ? '金額なし' : `¥${p.purchasePrice.toLocaleString('ja-JP')}`)
      : sort === 'new'
        ? (p) => `${fmtFull(p.createdDay)} 追加`
        : null

  // その株でいちばん急ぎのケア (水やり・肥料・活力剤のどれか)。タイルとミニの読み上げに使う
  const worst = (due: Due): Urgency => {
    const all = SCHED.map((s) => urgency(due[s], t))
    return all.includes('over') ? 'over' : all.includes('today') ? 'today' : ''
  }

  // 見出しで区切る。分類や置き場所が入っていない株は、最後にまとめる
  type Row = (typeof list)[number]
  const sections: { key: string; title: string; items: Row[] }[] =
    groupBy === 'group'
      ? [
          ...usedGroups.map((g) => ({ key: g.id, title: g.name, items: list.filter((r) => r.p.groupId === g.id) })),
          { key: '-', title: '分類なし', items: list.filter((r) => !usedGroups.some((g) => g.id === r.p.groupId)) },
        ].filter((s) => s.items.length)
      : groupBy === 'location'
        ? [
            ...locations.map((l) => ({ key: l, title: l, items: list.filter((r) => r.p.location === l) })),
            { key: '-', title: '置き場所なし', items: list.filter((r) => !r.p.location) },
          ].filter((s) => s.items.length)
        : [{ key: 'all', title: '', items: list }]

  // 株を押したとき: ふだんは詳細を開く。まとめてケアで株を選んでいる間は、選択を切り替える
  const isOn = (p: Plant) => !!bulk?.sel.includes(p.id)
  const tap = (p: Plant) => {
    if (!picking) return open({ k: 'plant', id: p.id })
    setBulk((b) => b && { ...b, sel: b.sel.includes(p.id) ? b.sel.filter((id) => id !== p.id) : [...b.sel, p.id] })
  }
  // 選択の印 (選んでいる間だけ出す)
  const mark = (p: Plant) =>
    picking && (
      <span className={`pickmark ${isOn(p) ? 'on' : ''}`} aria-hidden="true">
        {isOn(p) && <Check size={14} strokeWidth={3} />}
      </span>
    )
  const pressed = (p: Plant) => (picking ? { 'aria-pressed': isOn(p) } : {})

  const renderItems = (items: Row[]) => {
    // リスト: 写真・名前・学名・置き場所・水やり。右のボタンですぐ記録できる
    if (view === 'list')
      return (
        <ul className="plants">
          {items.map(({ p, due }) => {
            const w = due.water
            const s = lead(due)
            const late = !!w && w <= t
            const WaterIcon = careIcon('water', p)
            return (
              <li key={p.id} className={`plant ${isOn(p) ? 'picked' : ''}`}>
                <button className="plant-main" onClick={() => tap(p)} {...pressed(p)}>
                  <Photo id={p.photoId} className="thumb" />
                  <span className="plant-text">
                    <b>{p.name}</b>
                    <SciName plant={p} />
                    <small>
                      {sortKey && `${sortKey(p)} ・ `}
                      {p.location && (
                        <>
                          <MapPin size={11} /> {p.location}
                          {' ・ '}
                        </>
                      )}
                      {!s ? (
                        `${careLabel('water', p)}の予定なし`
                      ) : due[s]! <= t ? (
                        <>
                          <DueIcons p={p} due={due} t={t} /> <DueTag due={due[s]!} />
                        </>
                      ) : (
                        <>
                          {careLabel(s, p)} <DueTag due={due[s]!} />
                        </>
                      )}
                    </small>
                  </span>
                  {mark(p)}
                </button>
                {!picking && (
                  <button
                    className={`drop ${late ? 'on' : ''}`}
                    style={careVar('water')}
                    onClick={() => record([p.id], 'water')}
                    aria-label={`${p.name}に${careLabel('water', p)}を記録`}
                  >
                    <WaterIcon size={20} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )
    // タイル (3 列) とミニ (5 列): 写真を並べて、名前を下に重ねる。今日ケアが必要な株には、右上にそのケアのアイコン
    if (view === 'tile' || view === 'mini')
      return (
        <ul className={`tiles ${view}`}>
          {items.map(({ p, due }) => {
            const s = lead(due)
            const lv = worst(due)
            const what = SCHED.filter((x) => due[x] && due[x]! <= t).map((x) => careLabel(x, p)).join('・')
            return (
              <li key={p.id} className={isOn(p) ? 'picked' : ''}>
                <button onClick={() => tap(p)} aria-label={`${p.name}${lv === 'over' ? `（${what}の予定を過ぎています）` : lv ? `（今日${what}が必要）` : ''}`} {...pressed(p)}>
                  <Photo id={p.photoId} className="tile-img" />
                  <span className="tile-text">
                    <b>{p.name}</b>
                    {view === 'tile' && <small>{sortKey ? sortKey(p) : s ? <DueTag due={due[s]!} /> : ''}</small>}
                  </span>
                  <DueIcons p={p} due={due} t={t} size={view === 'mini' ? 9 : 11} className="on-tile" />
                  {mark(p)}
                </button>
              </li>
            )
          })}
        </ul>
      )
    // 図鑑: 学名を主役に、通し番号・品種名・名前・育て始めた日を添える
    if (view === 'book')
      return (
        <ul className="books">
          {items.map(({ p, i }) => (
            <li key={p.id} className={isOn(p) ? 'picked' : ''}>
              <button onClick={() => tap(p)} {...pressed(p)}>
                <Photo id={p.photoId} className="book-img" />
                <span className="book-text">
                  <small className="book-no">
                    No.{String(i + 1).padStart(3, '0')}
                    {groupName.get(p.groupId ?? '') && ` ・ ${groupName.get(p.groupId ?? '')}`}
                  </small>
                  {p.members?.length ? (
                    <span className="book-sci plain">{p.members.map((m) => m.scientificName || m.name).filter(Boolean).join(' / ')}</span>
                  ) : (
                    <span className="book-sci">
                      <SciText plant={p} empty="学名未登録" />
                      {p.cultivar && ` '${p.cultivar}'`}
                    </span>
                  )}
                  <b>{p.name}</b>
                  <small>
                    {fmtFull(since(p))}
                    {p.purchaseDate ? ' 入手' : ' 登録'} ・ {(diffDays(t, since(p)) + 1).toLocaleString('ja-JP')}日目
                  </small>
                </span>
                {mark(p)}
              </button>
            </li>
          ))}
        </ul>
      )
    // コンパクト: 写真なしの 1 行。株が多いときに、たくさん見渡せる
    return (
      <ul className="rows">
        {items.map(({ p, due }) => {
          const s = lead(due)
          return (
            <li key={p.id} className={isOn(p) ? 'picked' : ''}>
              <button onClick={() => tap(p)} {...pressed(p)}>
                {mark(p)}
                <b>{p.name}</b>
                <span>
                  <DueIcons p={p} due={due} t={t} />
                  {sortKey ? sortKey(p) : s ? <DueTag due={due[s]!} /> : '—'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  const archivedCount = allPlants.length - plants.length
  const archiveLink = archivedCount > 0 && (
    <button className="btn ghost full archive-link" onClick={() => open({ k: 'archive' })}>
      <Archive size={16} /> アーカイブ {archivedCount}株
    </button>
  )

  if (!plants.length)
    return (
      <div className="empty">
        <div className="empty-icon">
          <PotIcon size={36} />
        </div>
        <h1>Hachi</h1>
        <p>育てている植物を登録して、水やりや生長を記録しましょう。</p>
        <button className="btn primary" onClick={() => open({ k: 'plantForm' })}>
          最初の植物を追加
        </button>
        {archiveLink}
      </div>
    )

  // 上のカードの株数 (天気を出すときも出さないときも同じもの)
  const stats = (
    <>
      <div>
        <p className="eyebrow">今日のケア</p>
        <p className="hero-n">
          {heads(dueNow.map((r) => r.p))}
          <small>株</small>
        </p>
      </div>
      <div>
        <p className="eyebrow">育てている株</p>
        <p className="hero-n">
          {heads(plants)}
          <small>株</small>
        </p>
      </div>
    </>
  )

  return (
    <>
      {weather && sky ? (
        // 天気を出すとき: 植物のカード (濃い色) と天気のカード (白) を横に並べる。話が別なので枠を分ける。
        // どちらも主役の数字は 1 つだけ (今日のケア、今の気温) にして、ほかは小さく添える
        <div className="hero-pair">
          <section className="hero-card">
            {/* 今日のケアを左端、育てている株を右端に。カードの右側を空けない */}
            <div className="hero-two">
              <p className="eyebrow">今日のケア</p>
              <p className="eyebrow">育てている株</p>
              <p className="hero-n">
                {heads(dueNow.map((r) => r.p))}
                <small>株</small>
              </p>
              <p className="hero-n">
                {heads(plants)}
                <small>株</small>
              </p>
            </div>
            <p className="hero-sub">
              明日のケア <b>{heads(dueTomorrow)}株</b>
            </p>
          </section>
          <section className="wx-card" aria-label="今日の天気">
            {/* 見出しと数字をひとまとめにする (植物のカードと同じ組み方にして、数字の高さをそろえる) */}
            <div>
              <p className="eyebrow">
                {fromKey(t).getMonth() + 1}/{fromKey(t).getDate()} {WEEKDAYS[fromKey(t).getDay()]}
              </p>
              <p className="hero-n wx-now" aria-label={`${sky.label} ${Math.round(weather.temp)}度`}>
                <sky.Icon size={22} />
                {Math.round(weather.temp)}°
              </p>
            </div>
            <p className="hero-sub wx-sub">
              <b aria-label={`最高${Math.round(weather.max)}度 最低${Math.round(weather.min)}度`}>
                {Math.round(weather.max)}° / {Math.round(weather.min)}°
              </b>
              <span aria-label={`湿度${Math.round(weather.humidity)}%`}>
                <Droplets size={12} />
                <b>{Math.round(weather.humidity)}%</b>
              </span>
            </p>
          </section>
        </div>
      ) : (
        <section className="hero-card">
          <div className="hero-stats">{stats}</div>
          <p className="eyebrow">{fmtDay(t)}</p>
        </section>
      )}

      {dueNow.length > 0 && !picking && (
        <section className={`card due ${dueOpen ? '' : 'folded'}`}>
          <button
            className="due-head"
            aria-expanded={dueOpen}
            onClick={() => {
              localStorage.setItem('homeDue', dueOpen ? '0' : '1')
              setDueOpen(!dueOpen)
            }}
          >
            <b>今日のケア</b>
            <span>{dueNow.length}件</span>
            {dueOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {dueOpen && dueNow.map(({ p, types, due }) => (
            <div className="due-row" key={p.id}>
              <button className="due-plant" onClick={() => open({ k: 'plant', id: p.id })}>
                <Photo id={p.photoId} className="thumb sm" />
                <span>
                  <b>{p.name}</b>
                  <small>
                    <DueTag due={types.map((s) => due[s]!).sort()[0]} />
                  </small>
                </span>
              </button>
              <div className="due-acts">
                {types.map((s) => {
                  const Icon = careIcon(s, p)
                  const label = careLabel(s, p)
                  return (
                    <button key={s} className="pill" style={careVar(s)} onClick={() => record([p.id], s)}>
                      <Icon size={15} />
                      {label}
                    </button>
                  )
                })}
                <button className="icon-btn muted" onClick={() => open({ k: 'snooze', plantId: p.id })} aria-label={`${p.name}のケアを延期`}>
                  <CalendarClock size={18} />
                </button>
              </div>
            </div>
          ))}
          {dueOpen && waterDue.length > 1 && (
            <button className="btn ghost full" onClick={() => record(waterDue, 'water')}>
              <Check size={16} /> {waterDue.length}株まとめて水やり済みにする
            </button>
          )}
        </section>
      )}

      <div className="search">
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="名前・学名・分類などで検索" />
        {q && (
          <button onClick={() => setQ('')} aria-label="クリア">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="list-head">
        <h2>
          植物 <span>{list.length}</span>
        </h2>
        {/* 一覧の見せ方 */}
        <div className="view-seg" role="group" aria-label="一覧の見せ方">
          {VIEWS.map(([id, label, Icon]) => (
            <button
              key={id}
              className={view === id ? 'on' : ''}
              aria-label={label}
              aria-pressed={view === id}
              onClick={() => {
                setView(id)
                localStorage.setItem('homeView', id)
              }}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>
      </div>
      <div className="list-tools">
        <select
          value={sort}
          aria-label="並べ替え"
          onChange={(e) => {
            setSort(e.target.value as Sort)
            localStorage.setItem('sort', e.target.value)
          }}
        >
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={groupBy}
          aria-label="見出しでの区切り方"
          onChange={(e) => {
            setGroupBy(e.target.value as GroupBy)
            localStorage.setItem('homeGroupBy', e.target.value)
          }}
        >
          {GROUP_BYS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      {!picking && (
        <button className="btn ghost full bulk-start" onClick={() => setBulk({ step: 'types', types: ['water'], sel: [] })}>
          <ListChecks size={16} /> まとめてケアを記録
        </button>
      )}

      {/* 絞り込み: 場所・分類・栽培方法を 1 行に並べ、押すと候補が出る。絞り込んでいる欄は色が変わる */}
      {(locations.length > 0 || usedGroups.length > 0 || usedMethods.length > 1) && (
        <div className="filters">
          {locations.length > 0 && (
            <select className={loc ? 'on' : ''} value={loc} onChange={(e) => setLoc(e.target.value)} aria-label="場所で絞り込む">
              <option value="">場所</option>
              {locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}
          {usedGroups.length > 0 && (
            <select className={grp ? 'on' : ''} value={grp} onChange={(e) => setGrp(e.target.value)} aria-label="分類で絞り込む">
              <option value="">分類</option>
              {usedGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
          {usedMethods.length > 1 && (
            <select className={method ? 'on' : ''} value={method} onChange={(e) => setMethod(e.target.value)} aria-label="栽培方法で絞り込む">
              <option value="">栽培方法</option>
              {usedMethods.map((m) => (
                <option key={m} value={m}>
                  {METHODS[m].label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {!list.length && <p className="none">該当する植物がありません</p>}
      {sections.map((sec) => (
        <section key={sec.key} className="plant-sec">
          {sec.title && (
            <h3 className="sec-head">
              {sec.title} <span>{sec.items.length}</span>
            </h3>
          )}
          {renderItems(sec.items)}
        </section>
      ))}
      {!picking && archiveLink}

      {/* まとめてケア 1: ケアの種類を選ぶ (複数可) */}
      {bulk?.step === 'types' && (
        <div className="backdrop" onClick={(e) => e.target === e.currentTarget && setBulk(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="まとめてケアを記録">
            <button className="sheet-x" onClick={() => setBulk(null)} aria-label="閉じる">
              <X size={16} strokeWidth={2.2} />
            </button>
            <div className="sheet-b">
              <h2 className="sheet-t">まとめてケアを記録</h2>
              <h3 className="sec first">
                ケアの種類 <span className="soft">複数選べます</span>
              </h3>
              <div className="type-grid">
                {ALL_TYPES.map((ty) => {
                  const { Icon, label } = CARE[ty]
                  const on = bulk.types.includes(ty)
                  return (
                    <button
                      key={ty}
                      className={on ? 'on' : ''}
                      aria-pressed={on}
                      style={careVar(ty)}
                      onClick={() => setBulk({ ...bulk, types: on ? bulk.types.filter((x) => x !== ty) : ALL_TYPES.filter((x) => x === ty || bulk.types.includes(x)) })}
                    >
                      <span className="care-ic">
                        <Icon size={18} />
                      </span>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="sheet-f">
              <button className="btn primary" disabled={!bulk.types.length} onClick={() => setBulk({ ...bulk, step: 'plants' })}>
                植物を選ぶ
              </button>
            </div>
          </div>
        </div>
      )}
      {/* まとめてケア 2: 一覧で株を選んで、決定 (下のバーは、選んでいる間だけ下部ナビの上に出る) */}
      {bulk && picking && (
        <>
          <div className="bulk-space" />
          <div className="bulk-bar">
            <div className="bulk-in">
              <div className="row">
                <span className="bulk-what">
                  <b>{bulk.types.map((ty) => CARE[ty].label).join('・')}</b>
                  <small>{bulk.sel.length}株を選択中</small>
                </span>
                <button
                  className="btn ghost sm"
                  onClick={() => {
                    const shown = list.map((r) => r.p.id)
                    const all = shown.length > 0 && shown.every((id) => bulk.sel.includes(id))
                    setBulk({ ...bulk, sel: all ? bulk.sel.filter((id) => !shown.includes(id)) : [...new Set([...bulk.sel, ...shown])] })
                  }}
                >
                  {list.length > 0 && list.every((r) => bulk.sel.includes(r.p.id)) ? '表示中をすべて外す' : '表示中をすべて選ぶ'}
                </button>
              </div>
              <div className="row gap">
                <button className="btn ghost" onClick={() => setBulk(null)}>
                  やめる
                </button>
                <button
                  className="btn primary grow"
                  disabled={!bulk.sel.length}
                  onClick={async () => {
                    await record(bulk.sel, bulk.types)
                    setBulk(null)
                  }}
                >
                  {bulk.sel.length ? `${bulk.sel.length}株に記録` : '株を選んでください'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
