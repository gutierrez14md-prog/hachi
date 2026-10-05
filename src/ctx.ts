import { createContext, useContext } from 'react'
import type { CareLog, CareType, Journal, Plant, Settings } from './types'

/** タブの上に重ねて開く画面 */
export type Overlay =
  | { k: 'menu' }
  | { k: 'plantForm'; id?: string }
  | { k: 'plant'; id: string }
  | { k: 'log'; plantId?: string; type?: CareType; date?: string }
  | { k: 'journal'; plantId?: string; id?: string }

export interface AppCtx {
  plants: Plant[]
  logs: CareLog[]
  journal: Journal[]
  settings: Settings
  logsOf: (plantId: string) => CareLog[]
  open: (o: Overlay) => void
  /** いちばん上の画面を別の画面に差し替える */
  replace: (o: Overlay) => void
  /** 上から n 枚閉じる */
  close: (n?: number) => void
  /** ケアを記録する (取り消し付きのトーストを出す) */
  record: (plantIds: string[], type: CareType, date?: string, note?: string) => Promise<void>
  toast: (msg: string, undo?: () => void) => void
}

export const Ctx = createContext<AppCtx>(null!)
export const useApp = () => useContext(Ctx)
