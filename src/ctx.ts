import { createContext, useContext } from 'react'
import type { CareLog, CareType, Group, Journal, Plant, Settings } from './types'

/** タブの上に重ねて開く画面 */
export type Overlay =
  | { k: 'menu' }
  | { k: 'plantForm'; id?: string }
  | { k: 'plant'; id: string }
  | { k: 'log'; plantId?: string; type?: CareType; date?: string }
  | { k: 'journal'; plantId?: string; id?: string }
  | { k: 'past'; plantId?: string }
  | { k: 'group'; id?: string }
  | { k: 'snooze'; plantId: string }
  | { k: 'archive' }
  | { k: 'feedback' }
  | { k: 'share'; plantId: string; photoId?: string }

export interface AppCtx {
  /** 育てている株 (アーカイブを除く) */
  plants: Plant[]
  /** アーカイブも含む全部。記録から株を引くときなどに使う */
  allPlants: Plant[]
  groups: Group[]
  logs: CareLog[]
  journal: Journal[]
  settings: Settings
  logsOf: (plantId: string) => CareLog[]
  open: (o: Overlay) => void
  /** いちばん上の画面を別の画面に差し替える */
  replace: (o: Overlay) => void
  /** 上から n 枚閉じる */
  close: (n?: number) => void
  /** ケアを記録する (取り消し付きのトーストを出す)。種類は複数まとめて渡せる */
  record: (plantIds: string[], type: CareType | CareType[], date?: string, note?: string) => Promise<void>
  toast: (msg: string, undo?: () => void) => void
}

export const Ctx = createContext<AppCtx>(null!)
export const useApp = () => useContext(Ctx)
