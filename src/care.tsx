import { Bug, Droplet, DropletOff, Ellipsis, Hand, Scissors, Shovel, Sparkles, SprayCan, Sprout, type LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { CareType, SchedType } from './types'

export const CARE: Record<CareType, { label: string; color: string; Icon: LucideIcon }> = {
  water: { label: '水やり', color: '#3F8FBF', Icon: Droplet },
  fertilizer: { label: '肥料', color: '#C9902E', Icon: Sprout },
  tonic: { label: '活力剤', color: '#8E6BBF', Icon: Sparkles },
  mist: { label: '葉水', color: '#3FA9A0', Icon: SprayCan },
  repot: { label: '植え替え', color: '#9A6B4B', Icon: Shovel },
  prune: { label: '剪定', color: '#5E9B57', Icon: Scissors },
  pesticide: { label: '薬剤', color: '#C6584F', Icon: Bug },
  other: { label: 'その他', color: '#8A8F8C', Icon: Ellipsis },
  check: { label: '確認', color: '#6F8796', Icon: Hand },
}

export const SCHED: SchedType[] = ['water', 'fertilizer', 'tonic']
/** 記録に残る種類ぜんぶ (件数の内訳、カレンダーの凡例など) */
export const LOG_TYPES = Object.keys(CARE) as CareType[]
/** 自分で選んで記録する種類。確認は延期から付くものなので、選ぶ欄には出さない */
export const ALL_TYPES = LOG_TYPES.filter((ty) => ty !== 'check')

/** ケア種別の色を CSS 変数 --c として渡す */
export const careVar = (type: CareType) => ({ '--c': CARE[type].color }) as CSSProperties

/** 断水 (ケアの種類ではなく、株の状態)。乾いた土の色 */
export const DRY = { label: '断水', color: '#A0835F', Icon: DropletOff }
export const dryVar = { '--c': DRY.color } as CSSProperties
