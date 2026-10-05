import { useEffect, useState } from 'react'

export type Hit = { sci: string; ja?: string; rank: string; family?: string }
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
}: {
  value: string
  onChange: (v: string) => void
  onPick: (hit: Hit) => void
  search: Search
  placeholder?: string
  /** 学名の欄 (学名を主に見せ、英字入力向けにする) */
  sci?: boolean
}) {
  // 自分で打った文字だけを検索する (編集で開いた直後や、候補を選んだ直後には出さない)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResult(null)
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      search(q, ctrl.signal)
        .then(setResult)
        .catch(() => {})
    }, 300)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [query, search])

  const close = () => {
    setQuery('')
    setResult(null)
  }

  return (
    <span className="suggest">
      <input
        className={sci ? 'sci' : undefined}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setQuery(e.target.value)
        }}
        onBlur={close}
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
              // 入力欄のフォーカスが外れて一覧が消える前に選べるよう、押した時点で確定する
              onPointerDown={(e) => {
                e.preventDefault()
                onPick(h)
                close()
              }}
            >
              {sci || !h.ja ? <i>{h.sci}</i> : <b>{h.ja}</b>}
              <small>
                {sci ? [h.ja, h.rank, h.family].filter(Boolean).join(' ・ ') : h.ja ? <i>{h.sci}</i> : h.rank}
              </small>
            </button>
          ))}
          <small className="suggest-src">候補: {result.source}</small>
        </span>
      )}
    </span>
  )
}
