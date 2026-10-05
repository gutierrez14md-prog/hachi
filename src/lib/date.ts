// 日付はすべてローカル時間の 'YYYY-MM-DD' 文字列 (文字列比較で前後が判定できる) で扱う
const pad = (n: number) => String(n).padStart(2, '0')
const DOW = ['日', '月', '火', '水', '木', '金', '土']

export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = () => toKey(new Date())

export const addDays = (k: string, n: number) => {
  const d = fromKey(k)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

/** a - b の日数 */
export const diffDays = (a: string, b: string) =>
  Math.round((fromKey(a).getTime() - fromKey(b).getTime()) / 86_400_000)

export const monthOf = (k: string) => Number(k.slice(5, 7))

export const fmtDay = (k: string) => {
  const d = fromKey(k)
  return `${d.getMonth() + 1}月${d.getDate()}日(${DOW[d.getDay()]})`
}

/** 年つき。今年以外の日付を出すとき用 */
export const fmtFull = (k: string) => {
  const d = fromKey(k)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/** 今日からの相対表記: 「今日」「あと3日」「2日超過」 */
export const dueLabel = (k: string) => {
  const n = diffDays(k, today())
  if (n < 0) return `${-n}日超過`
  if (n === 0) return '今日'
  if (n === 1) return '明日'
  return `あと${n}日`
}
