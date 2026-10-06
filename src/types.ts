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
  /**
   * 月ごとの間隔 (1 月〜12 月の 12 個、0 = お休み)。入っていれば上の生長期 / 休眠期より優先する。
   * 「9 月は 7 日、10 月は 10 日、11 月は 14 日…」のように少しずつ変えるためのもの
   */
  monthly?: number[] | null
}

export type CareSettings = Record<SchedType, Schedule>

/** 栽培方法: 土植え / 着生 / 腰水 / 水耕栽培 */
export type Method = 'soil' | 'mount' | 'bottom' | 'hydro'

export interface Member {
  name: string
  scientificName: string
  cultivar?: string
}

export interface Plant {
  id: string
  name: string
  /** 表示・検索・並び替えに使う学名。ハイブリッドは交配親を「 × 」でつないだもの */
  scientificName: string
  /** ハイブリッド (交配種) のときだけ: 交配親の学名 (4 つまで) */
  scientificNames?: string[]
  /** 園芸品種名・流通名 (白鯨 など)。学名のあとに ' ' で囲んで出す */
  cultivar?: string
  /**
   * 1 つの鉢や着生木に複数の植物をまとめているとき (寄せ植え、流木につけたチランジアなど) の中身。
   * 入っていれば、この登録の学名・品種名は使わず、ケアはまとめて 1 つとして扱う
   */
  members?: Member[]
  location: string
  profile: string
  photoId?: string
  /** 分類 (Group.id) */
  groupId?: string
  method?: Method
  /** 休眠期の月 (1-12) */
  dormantMonths: number[]
  care: CareSettings
  /** 登録日 YYYY-MM-DD */
  createdDay: string
  purchasePlace?: string
  /** 円 */
  purchasePrice?: number | null
  /** 入手日 YYYY-MM-DD */
  purchaseDate?: string
  /** アーカイブした日。入っている株は一覧・予定・通知から外す (記録と写真は残る) */
  archivedDay?: string
  /** 延期: この日までは予定に出さない。次にケアを記録すれば、予定がこの日を越えるので自然に無効になる */
  snooze?: Partial<Record<SchedType, string>>
}

/** 分類 (アガベ、サボテン…) と、そのケア設定のプリセット */
export interface Group {
  id: string
  name: string
  /** この分類でふつうの栽培方法 (チランジアなら着生)。植物を追加するときの初期値になる */
  method?: Method
  dormantMonths: number[]
  care: CareSettings
  /** 育て方メモのひな形 */
  profile: string
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
  /** YYYY-MM-DD。past の記録は日付不明 ('') もある */
  date: string
  text: string
  photoId?: string
  /** このアプリを使い始める前の写真 (ほかのアプリからの移行など) */
  past?: boolean
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
