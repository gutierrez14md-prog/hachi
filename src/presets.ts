import type { CareSettings, Group, Schedule } from './types'

const sched = (enabled: boolean, days: number, offMode: Schedule['offMode'], offDays: number): Schedule => ({
  enabled,
  days,
  offMode,
  offDays,
  monthly: null,
})

/** 分類を選ばないときの初期値 */
export const defaultCare = (): CareSettings => ({
  water: sched(true, 7, 'custom', 14),
  fertilizer: sched(false, 30, 'pause', 60),
  tonic: sched(false, 14, 'pause', 30),
})

/**
 * 品種名の候補のうち、はじめから入れておくもの。キーは学名 (小文字) の一部。
 * 園芸品種を網羅したデータベースは無いので、ここに無い名前は、一度入力すれば次から候補に出る
 */
export const CULTIVARS: Record<string, string[]> = {
  'agave titanota': [
    '白鯨', 'シーザー', 'ハデス', 'レッドキャットウィーズル', 'スナグルトゥース', 'ブラックアンドブルー',
    '姫厳竜', '厳竜', '南アフリカダイヤモンド', '農大No.1', 'FO-076', '恐竜牙歯', '狼人', '海王', '金剛',
  ],
}

/** 水やりを月ごとの間隔 (1〜12 月、0 = お休み) で持つプリセット */
const group = (id: string, name: string, dormantMonths: number[], water: number[], profile: string): Group => ({
  id,
  name,
  dormantMonths,
  care: { ...defaultCare(), water: { ...sched(true, 7, 'custom', 14), monthly: water } },
  profile,
})

/**
 * はじめから入っている分類。関東以西の平地・室内外を想定した、ごく大まかな出発点。
 * 設定の「分類」からいつでも直せる (直したものはここの値では上書きしない)
 */
export const defaultGroups = (): Group[] => [
  group('g-agave', 'アガベ', [12, 1, 2], [30, 30, 14, 10, 7, 7, 7, 7, 7, 10, 14, 30], '日当たりと風通しのよい場所。冬は水を控えめに。'),
  group('g-euphorbia', 'ユーフォルビア', [12, 1, 2], [30, 30, 21, 10, 7, 7, 7, 7, 7, 10, 14, 30], '寒さに弱い種類が多い。冬は室内でほぼ断水。'),
  group('g-cactus', 'サボテン', [12, 1, 2], [30, 30, 14, 10, 7, 7, 10, 10, 7, 10, 14, 30], '真夏は蒸れに注意。冬は月 1 回ほど。'),
  group('g-caudex', '塊根植物', [11, 12, 1, 2, 3], [0, 0, 0, 14, 7, 7, 7, 7, 7, 10, 21, 0], '葉が落ちたら断水。芽が動いたら少しずつ再開。'),
  group('g-tillandsia', 'チランジア', [12, 1, 2], [5, 5, 3, 3, 3, 2, 2, 2, 3, 3, 5, 5], '水やり = ミスティング。風通しよく、濡れたままにしない。'),
  group('g-fern', 'シダ', [12, 1, 2], [5, 5, 4, 3, 3, 2, 2, 2, 3, 3, 4, 5], '乾燥に弱い。明るい日陰で、土を乾かしきらない。'),
  group('g-foliage', '観葉植物', [12, 1, 2], [14, 14, 10, 7, 7, 5, 5, 5, 7, 7, 10, 14], '土の表面が乾いたらたっぷり。冬は乾かし気味に。'),
]
