import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../ctx'
import { CULTIVARS } from '../presets'

/** sci = 選んだときに入る文字。plain は学名ではない候補 (品種名) で、斜体にしない */
export type Hit = { sci: string; ja?: string; rank: string; family?: string; plain?: boolean }
type Result = { hits: Hit[]; source: string }
type Search = (q: string, signal: AbortSignal) => Promise<Result>

// どちらも無料・登録不要で、ブラウザから直接呼べる
// GBIF: 学名のカタログ (Backbone Taxonomy)。学名のつづりに強い
const GBIF = 'https://api.gbif.org/v1/species/suggest?datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c&limit=20&q='
// iNaturalist: 和名を持っている。taxon_id=47126 は植物界。和名が無い種類も多い (多肉・園芸名は特に)
const INAT = 'https://api.inaturalist.org/v1/taxa/autocomplete?locale=ja&taxon_id=47126&per_page=12&q='
const RANKS: Record<string, string> = { genus: '属', species: '種', subspecies: '亜種', variety: '変種', form: '品種', hybrid: '交雑種' }
const MAX = 6

async function gbif(q: string, signal: AbortSignal): Promise<Result> {
  const res = await fetch(GBIF + encodeURIComponent(q), { signal })
  const rows: { kingdom?: string; canonicalName?: string; family?: string; rank?: string }[] = res.ok ? await res.json() : []
  const hits = new Map<string, Hit>()
  for (const r of rows) {
    const rank = RANKS[r.rank?.toLowerCase() ?? '']
    if (r.kingdom !== 'Plantae' || !r.canonicalName || !rank) continue
    if (!hits.has(r.canonicalName)) hits.set(r.canonicalName, { sci: r.canonicalName, rank, family: r.family })
  }
  return { hits: [...hits.values()].slice(0, MAX), source: 'GBIF' }
}

async function inat(q: string, signal: AbortSignal, ranks: string[]): Promise<Result> {
  const res = await fetch(INAT + encodeURIComponent(q), { signal })
  const rows: { name: string; rank: string; preferred_common_name?: string }[] = res.ok ? (await res.json()).results : []
  const hits = rows
    .filter((r) => ranks.includes(r.rank))
    .map((r) => ({ sci: r.name, ja: r.preferred_common_name, rank: RANKS[r.rank] }))
  return { hits: hits.slice(0, MAX), source: 'iNaturalist' }
}

/** 学名の欄: 英字は GBIF、日本語で打ったときは iNaturalist の和名から探す */
export const searchSci: Search = (q, signal) =>
  /[^\x00-\x7f]/.test(q) ? inat(q, signal, Object.keys(RANKS)) : gbif(q, signal)

/** 名前の欄: 和名から探す。「◯◯属」を名前に入れても仕方がないので、種より下だけ */
export const searchName: Search = (q, signal) => inat(q, signal, ['species', 'subspecies', 'variety', 'form', 'hybrid'])

/**
 * 品種名 (白鯨 など) の欄。園芸品種のデータベースは無いので、候補は手元から出す:
 * 同じ学名の株で入力済みのもの → はじめから入っている一覧 (presets.ts) → ほかの株で入力済みのもの
 */
export function CultivarInput({ sci, value, onChange }: { sci: string; value: string; onChange: (v: string) => void }) {
  const { allPlants } = useApp()
  const search = useMemo<Search>(() => {
    const key = sci.trim().toLowerCase()
    const used = allPlants.flatMap((p) => [p, ...(p.members ?? [])]).filter((p) => p.cultivar)
    const same = used.filter((p) => key && p.scientificName.toLowerCase() === key).map((p) => p.cultivar!)
    const builtIn = Object.entries(CULTIVARS).flatMap(([k, list]) => (key.includes(k) ? list : []))
    const pool = [...new Set([...same, ...builtIn, ...used.map((p) => p.cultivar!)])]
    return async (q) => ({
      hits: pool
        .filter((c) => c.toLowerCase().includes(q.toLowerCase()) && c !== q)
        .slice(0, 8)
        .map((c) => ({ sci: c, rank: '', plain: true })),
      source: '',
    })
  }, [allPlants, sci])
  return <SuggestInput eager search={search} value={value} onChange={onChange} onPick={(h) => onChange(h.sci)} placeholder="例: 白鯨" />
}

/**
 * これまでに入力した値から選べる欄 (置き場所、購入場所)。欄に入ると一覧が出て、打てば絞り込める。
 * 一覧に無い値は、そのまま打ち込めば次から候補に出る
 */
export function PickInput({ options, value, onChange, placeholder }: { options: string[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const key = options.join('\n')
  const search = useMemo<Search>(() => {
    const pool = [...new Set(options.map((o) => o.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'))
    return async (q) => ({
      hits: pool
        .filter((o) => o.toLowerCase().includes(q.toLowerCase()) && o !== q)
        .slice(0, 8)
        .map((o) => ({ sci: o, rank: '', plain: true })),
      source: '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options は毎回新しい配列なので、中身 (key) で比べる
  }, [key])
  return <SuggestInput eager search={search} value={value} onChange={onChange} onPick={(h) => onChange(h.sci)} placeholder={placeholder} />
}

/**
 * 候補つきの入力欄。打った文字から候補を出し、選ぶと onPick に渡す。
 * 候補にない名前 (園芸品種・流通名など) もそのまま入力でき、通信できないときは候補が出ないだけ
 */
export function SuggestInput({
  value,
  onChange,
  onPick,
  search,
  placeholder,
  sci,
  eager,
}: {
  value: string
  onChange: (v: string) => void
  onPick: (hit: Hit) => void
  search: Search
  placeholder?: string
  /** 学名の欄 (学名を主に見せ、英字入力向けにする) */
  sci?: boolean
  /** 欄に入った時点で (何も打たなくても) 候補を出す。手元の一覧から選ぶ欄向け */
  eager?: boolean
}) {
  // 自分で打った文字だけを検索する (編集で開いた直後や、候補を選んだ直後には出さない)。null = 検索しない
  const [query, setQuery] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    const q = query?.trim()
    if (q == null || q.length < (eager ? 0 : 2)) {
      setResult(null)
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      search(q, ctrl.signal)
        .then(setResult)
        .catch(() => {})
    }, eager ? 0 : 300)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [query, search, eager])

  const close = () => {
    setQuery(null)
    setResult(null)
  }
  // 欄からフォーカスが外れたら閉じる。候補を押したときも先にフォーカスが外れることがあるので、
  // その押下 (click) が候補に届くまで少し待つ
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(blurTimer.current), [])

  return (
    <span className="suggest">
      <input
        className={sci ? 'sci' : undefined}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setQuery(e.target.value)
        }}
        onFocus={() => {
          clearTimeout(blurTimer.current)
          if (eager) setQuery(value)
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(close, 250)
        }}
        placeholder={placeholder}
        autoCapitalize={sci ? 'off' : undefined}
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
      />
      {result && result.hits.length > 0 && (
        <span className="suggest-list" role="listbox">
          {result.hits.map((h) => (
            <button
              type="button"
              role="option"
              aria-selected={false}
              key={h.sci}
              // 確定は click で行う。押した瞬間 (pointerdown) に一覧を消すと、指を離したときの click が
              // 一覧の下にあった部品 (ハイブリッドのスイッチなど) に届いて、それを押したことになってしまう
              onMouseDown={(e) => e.preventDefault()} // 入力欄のフォーカスは保つ
              onClick={(e) => {
                e.preventDefault()
                clearTimeout(blurTimer.current)
                onPick(h)
                close()
              }}
            >
              {h.plain ? <b>{h.sci}</b> : sci || !h.ja ? <i>{h.sci}</i> : <b>{h.ja}</b>}
              <small>
                {sci || h.plain ? [h.ja, h.rank, h.family].filter(Boolean).join(' ・ ') : h.ja ? <i>{h.sci}</i> : h.rank}
              </small>
            </button>
          ))}
          {result.source && <small className="suggest-src">候補: {result.source}</small>}
        </span>
      )}
    </span>
  )
}
