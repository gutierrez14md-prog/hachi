import type { Cross } from '../types'

/**
 * 交配親を 1 行の文字にする (検索・並べ替え・投稿用の画像に使う)。
 * 交配種どうしの交配は、どこまでが片方の親かわかるように括弧でくくる: (A × B × C) × (D × E)
 */
export function crossText(c: Cross): string {
  const sides = [c.seed, c.pollen].filter((l) => l.length)
  return sides.map((l) => (l.length > 1 && sides.length > 1 ? `(${l.join(' × ')})` : l.join(' × '))).join(' × ')
}

/** 親ごとのかたまりに分けて見せる必要があるか (雌雄がわかっている、または、どちらかの親が交配種) */
export const isGrouped = (c: Cross) => !!c.sexed || (c.seed.length > 0 && c.pollen.length > 0 && c.seed.length + c.pollen.length > 2)

/** 以前の形式 (1 列に並べた交配親) を、親 1・親 2 に移す。2 つならそのまま 1 つずつ。3 つ以上は区切りがわからないので、親 1 にまとめておく */
export const fromFlat = (names: string[]): Cross =>
  names.length === 2 ? { seed: [names[0]], pollen: [names[1]] } : { seed: names.length ? names : [''], pollen: [''] }
