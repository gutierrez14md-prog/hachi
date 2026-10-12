import { GlassWater, Pipette, RefreshCw, SprayCan, Waves, type LucideIcon } from 'lucide-react'
import { CARE } from './care'
import { LIGHT, lightWater } from './lib/schedule'
import type { CareLog, CareType, Method, Plant } from './types'

/**
 * 栽培方法。water は、その方法での「水やり」にあたる作業の呼び名
 * (予定の仕組みは同じで、画面に出す言葉だけ変える)
 */
export const METHODS: Record<Method, { label: string; water: string }> = {
  soil: { label: '土植え', water: '水やり' },
  moss: { label: '水苔', water: '水やり' },
  mount: { label: '着生', water: '水やり' },
  bottom: { label: '腰水', water: '水足し' },
  hydro: { label: '水耕栽培', water: '水替え' },
}

export const METHOD_IDS = Object.keys(METHODS) as Method[]

/** 水やりのアイコン。呼び名ごとに変える (色はどれも水やりの水色)。ここに無い呼び名は、しずく */
const WATER_ICONS: Record<string, LucideIcon> = {
  ソーキング: Waves,
  ミスティング: SprayCan,
  水足し: GlassWater,
  水替え: RefreshCw,
}

/** ケアのアイコン。水やりだけ、呼び名に合わせて変える */
export const careIcon = (type: CareType, of?: { method?: Method; waterLabel?: string }): LucideIcon =>
  (type === 'water' && WATER_ICONS[careLabel(type, of)]) || CARE[type].Icon

/** ちょろ水のアイコン。ふつうの水やり (しずく) と見分けられるよう、ほんの少しの水 = スポイトにする (色は水やりと同じ) */
export const LIGHT_ICON: LucideIcon = Pipette

/** その日にやるケアのアイコン。ちょろ水の月の水やりは、ちょろ水のアイコン */
export const planIcon = (type: CareType, p: Pick<Plant, 'care' | 'method' | 'waterLabel'>, day: string): LucideIcon =>
  type === 'water' && lightWater(p, day) ? LIGHT_ICON : careIcon(type, p)

/** 記録のアイコン。ちょろ水として残した水やり (メモが「ちょろ水」) は、ちょろ水のアイコン */
export const logIcon = (l: Pick<CareLog, 'type' | 'note'>, p?: { method?: Method; waterLabel?: string }): LucideIcon =>
  l.type === 'water' && l.note === LIGHT ? LIGHT_ICON : careIcon(l.type, p)

/** 「水やりの呼び名」の欄に出す候補 */
export const WATER_LABELS = ['水やり', 'ソーキング', 'ミスティング', '水足し', '水替え']

/**
 * ケアの呼び名。水やりだけ言い換える: 自分で決めた呼び名 (ソーキング など) があればそれ、
 * 無ければ栽培方法に合わせたもの
 */
export const careLabel = (type: CareType, of?: { method?: Method; waterLabel?: string }) =>
  type !== 'water' ? CARE[type].label : of?.waterLabel || (of?.method ? METHODS[of.method].water : CARE.water.label)
