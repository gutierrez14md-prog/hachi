import { Archive, CalendarClock, Check, Droplets, MapPin, Search, ThermometerSnowflake, ThermometerSun, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { careVar, SCHED } from '../care'
import { useApp } from '../ctx'
import { diffDays, dueLabel, fmtDay, fmtFull, fromKey, today } from '../lib/date'
import { careIcon, careLabel, METHOD_IDS, METHODS } from '../method'
import { nextDue } from '../lib/schedule'
import { describe, useWeather } from '../lib/weather'
import { Photo, PotIcon, SciName } from '../parts'
import type { Plant, SchedType } from '../types'

type Sort = 'water' | 'name' | 'sci' | 'new' | 'days-desc' | 'days-asc' | 'price-desc' | 'price-asc'
const SORTS: [Sort, string][] = [
  ['water', '水やりが近い順'],
  ['name', '名前順'],
  ['sci', '学名順'],
  ['days-desc', '育てている日数が長い順'],
  ['days-asc', '育てている日数が短い順'],
  ['price-desc', '金額が高い順'],
  ['price-asc', '金額が安い順'],
  ['new', '追加が新しい順'],
]

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** 育て始めた日: 入手日があればそれ、無ければ登録した日 */
const since = (p: Plant) => p.purchaseDate || p.createdDay

export function Home() {
  const { plants, allPlants, groups, logsOf, open, record } = useApp()
  const [q, setQ] = useState('')
  const [loc, setLoc] = useState('')
  const [grp, setGrp] = useState('')
  const [method, setMethod] = useState('')
  const [sort, setSort] = useState<Sort>(() => (localStorage.getItem('sort') as Sort) || 'water')
  const t = today()
  const weather = useWeather(t)
  const sky = weather && describe(weather.code)

  const rows = useMemo(
    () =>
      plants.map((p, i) => {
        const due = {} as Record<SchedType, string | null>
        for (const s of SCHED) due[s] = nextDue(p, s, logsOf(p.id))
        return { p, due, i }
      }),
    [plants, logsOf],
  )

  const dueNow = rows
    .map((r) => ({ ...r, types: SCHED.filter((s) => r.due[s] && r.due[s]! <= t) }))
    .filter((r) => r.types.length)
  const waterDue = dueNow.filter((r) => r.types.includes('water')).map((r) => r.p.id)
  // 上のカードの株数は、まとめた登録 (寄せ植え・着生) の中身も 1 株ずつ数える
  const heads = (list: Plant[]) => list.reduce((n, p) => n + (p.members?.length || 1), 0)

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
      return (a.due.water ?? '9999').localeCompare(b.due.water ?? '9999') || a.p.name.localeCompare(b.p.name, 'ja')
    })

  // 日数・金額・追加日で並べているときは、その値を行に出す (ふだんは出していない項目なので)
  const sortKey: ((p: Plant) => string) | null = sort.startsWith('days')
    ? (p) => `${diffDays(t, since(p)).toLocaleString('ja-JP')}日`
    : sort.startsWith('price')
      ? (p) => (p.purchasePrice == null ? '金額なし' : `¥${p.purchasePrice.toLocaleString('ja-JP')}`)
      : sort === 'new'
        ? (p) => `${fmtFull(p.createdDay)} 追加`
        : null

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
        // 天気を出すとき: 4 列 × 2 段。左に日付と株数、右に天気 (今の気温・湿度 / 最高・最低) をそろえて並べる
        <section className="hero-card grid">
          <div className="span2">
            <p className="eyebrow">{WEEKDAYS[fromKey(t).getDay()]}曜日</p>
            <p className="hero-n">
              {fromKey(t).getMonth() + 1}/{fromKey(t).getDate()}
            </p>
          </div>
          <div aria-label={`${sky.label} 気温${Math.round(weather.temp)}度`}>
            <p className="hero-ic">
              <sky.Icon size={17} />
            </p>
            <p className="hero-n">{Math.round(weather.temp)}°</p>
          </div>
          <div aria-label={`湿度${Math.round(weather.humidity)}%`}>
            <p className="hero-ic">
              <Droplets size={17} />
            </p>
            <p className="hero-n">
              {Math.round(weather.humidity)}
              <small>%</small>
            </p>
          </div>
          {stats}
          <div aria-label={`最高気温${Math.round(weather.max)}度`}>
            <p className="hero-ic">
              <ThermometerSun size={17} />
            </p>
            <p className="hero-n">{Math.round(weather.max)}°</p>
          </div>
          <div aria-label={`最低気温${Math.round(weather.min)}度`}>
            <p className="hero-ic">
              <ThermometerSnowflake size={17} />
            </p>
            <p className="hero-n">{Math.round(weather.min)}°</p>
          </div>
        </section>
      ) : (
        <section className="hero-card">
          <div className="hero-stats">{stats}</div>
          <p className="eyebrow">{fmtDay(t)}</p>
        </section>
      )}

      {dueNow.length > 0 && (
        <section className="card due">
          {dueNow.map(({ p, types, due }) => (
            <div className="due-row" key={p.id}>
              <button className="due-plant" onClick={() => open({ k: 'plant', id: p.id })}>
                <Photo id={p.photoId} className="thumb sm" />
                <span>
                  <b>{p.name}</b>
                  <small>{types.map((s) => dueLabel(due[s]!)).find((l) => l !== '今日') ?? '今日'}</small>
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
          {waterDue.length > 1 && (
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
        <select
          value={sort}
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
      </div>

      {locations.length > 0 && (
        <div className="chips scroll">
          <button className={`chip ${!loc ? 'on' : ''}`} onClick={() => setLoc('')}>
            すべて
          </button>
          {locations.map((l) => (
            <button key={l} className={`chip ${loc === l ? 'on' : ''}`} onClick={() => setLoc(loc === l ? '' : l)}>
              {l}
            </button>
          ))}
        </div>
      )}

      {usedGroups.length > 0 && (
        <div className="chips scroll">
          <button className={`chip ${!grp ? 'on' : ''}`} onClick={() => setGrp('')}>
            全分類
          </button>
          {usedGroups.map((g) => (
            <button key={g.id} className={`chip ${grp === g.id ? 'on' : ''}`} onClick={() => setGrp(grp === g.id ? '' : g.id)}>
              {g.name}
            </button>
          ))}
        </div>
      )}

      {usedMethods.length > 1 && (
        <div className="chips scroll">
          <button className={`chip ${!method ? 'on' : ''}`} onClick={() => setMethod('')}>
            全方法
          </button>
          {usedMethods.map((m) => (
            <button key={m} className={`chip ${method === m ? 'on' : ''}`} onClick={() => setMethod(method === m ? '' : m)}>
              {METHODS[m].label}
            </button>
          ))}
        </div>
      )}

      <ul className="plants">
        {list.map(({ p, due }) => {
          const w = due.water
          const late = !!w && w <= t
          const WaterIcon = careIcon('water', p)
          return (
            <li key={p.id} className="plant">
              <button className="plant-main" onClick={() => open({ k: 'plant', id: p.id })}>
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
                    <span className={late ? 'late' : ''}>{w ? `${careLabel('water', p)} ${dueLabel(w)}` : `${careLabel('water', p)}の予定なし`}</span>
                  </small>
                </span>
              </button>
              <button
                className={`drop ${late ? 'on' : ''}`}
                style={careVar('water')}
                onClick={() => record([p.id], 'water')}
                aria-label={`${p.name}に${careLabel('water', p)}を記録`}
              >
                <WaterIcon size={20} />
              </button>
            </li>
          )
        })}
        {!list.length && <li className="none">該当する植物がありません</li>}
      </ul>
      {archiveLink}
    </>
  )
}
