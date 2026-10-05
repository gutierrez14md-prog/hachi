/** 間隔を決めて予定を立てるケア */
export type SchedType = 'water' | 'fertilizer' | 'tonic'
export type CareType = SchedType | 'mist' | 'repot' | 'prune' | 'pesticide' | 'other'

export interface Schedule {
  enabled: boolean
  /** 生長期の間隔 (日) */
  days: number
  /** 休眠期の扱い: 生長期と同じ / 別の間隔 / 休止 */
  offMode: 'same' | 'custom' | 'pause'
  offDays: number
}

export interface Plant {
  id: string
  name: string
  scientificName: string
  location: string
  profile: string
  photoId?: string
  /** 休眠期の月 (1-12) */
  dormantMonths: number[]
  care: Record<SchedType, Schedule>
  /** 登録日 YYYY-MM-DD */
  createdDay: string
}

export interface CareLog {
  id: string
  plantId: string
  type: CareType
  /** YYYY-MM-DD */
  date: string
  note: string
  at: number
}

export interface Journal {
  id: string
  plantId: string
  /** YYYY-MM-DD */
  date: string
  text: string
  photoId?: string
  at: number
}

export interface PhotoRec {
  id: string
  blob: Blob
}

export interface Settings {
  key: 'app'
  notify: boolean
  /** HH:MM */
  remindTime: string
  /** 新しい植物の休眠期の初期値 */
  dormantMonths: number[]
}
