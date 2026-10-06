import { CARE } from './care'
import type { CareType, Method } from './types'

/**
 * 栽培方法。water は、その方法での「水やり」にあたる作業の呼び名
 * (予定の仕組みは同じで、画面に出す言葉だけ変える)
 */
export const METHODS: Record<Method, { label: string; water: string }> = {
  soil: { label: '土植え', water: '水やり' },
  mount: { label: '着生', water: '水やり' },
  bottom: { label: '腰水', water: '水足し' },
  hydro: { label: '水耕栽培', water: '水替え' },
}

export const METHOD_IDS = Object.keys(METHODS) as Method[]

/** 「水やりの呼び名」の欄に出す候補 */
export const WATER_LABELS = ['水やり', 'ソーキング', 'ミスティング', '水足し', '水替え']

/**
 * ケアの呼び名。水やりだけ言い換える: 自分で決めた呼び名 (ソーキング など) があればそれ、
 * 無ければ栽培方法に合わせたもの
 */
export const careLabel = (type: CareType, of?: { method?: Method; waterLabel?: string }) =>
  type !== 'water' ? CARE[type].label : of?.waterLabel || (of?.method ? METHODS[of.method].water : CARE.water.label)
