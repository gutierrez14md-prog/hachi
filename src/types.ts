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
  /**
   * このケアを始める日 (YYYY-MM-DD)。入っていれば、この日より前には予定を出さない
   * (肥料は春から、植え替えた直後の水やりは 1 週間後から、など)。空なら登録した日から
   */
  start?: string
  /**
   * 水やり何回に 1 回か (1〜6)。水に混ぜてあげる肥料・活力剤のためのもの。
   * 入っていれば日数は使わず、水やりの回数で数える (予定日は必ず水やりの日に重なる)。水やり自身には使わない
   */
  everyWater?: number
}

export type CareSettings = Record<SchedType, Schedule>

/** 栽培方法: 土植え / 水苔 / 着生 / 腰水 / 水耕栽培 */
export type Method = 'soil' | 'moss' | 'mount' | 'bottom' | 'hydro'

export interface Member {
  name: string
  scientificName: string
  cultivar?: string
}

/**
 * 交配親。親は 2 つで、それぞれが交配種のこともあるので、学名を 4 つまで持つ
 * (親 1 が A × B × C、親 2 が D × E、など)。片方だけでもよい。
 * sexed = 雌雄がわかっている。そのときは seed が雌親 (♀・種子親)、pollen が雄親 (♂・花粉親)。
 * わからないときは、seed が親 1、pollen が親 2 というだけで、雌雄の意味は無い
 */
export interface Cross {
  seed: string[]
  pollen: string[]
  sexed?: boolean
}

/** 写真の切り出し方。x, y = 枠の中心に来る写真上の位置 (0〜1)、zoom = 拡大率 (1 で写真が枠をちょうど覆う) */
export interface PhotoCrop {
  /** 調整前の写真 */
  origId: string
  x: number
  y: number
  zoom: number
}

/** アーカイブした理由: 枯れた / 譲渡 / 売却 / その他 */
export type ArchiveReason = 'dead' | 'given' | 'sold' | 'other'

export interface ArchiveInfo {
  reason?: ArchiveReason
  /** 譲渡先・売却先 (理由が譲渡か売却のとき) */
  to?: string
  note?: string
}

export interface Plant {
  id: string
  name: string
  /** 表示・検索・並び替えに使う学名。ハイブリッドは交配親を「 × 」でつないだもの */
  scientificName: string
  /** 以前の形式のハイブリッド (交配親を 1 列に並べたもの)。編集して保存すると parents に移る */
  scientificNames?: string[]
  /** ハイブリッド (交配種) の交配親 */
  parents?: Cross
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
  /** 写真の位置と大きさを調整したとき: 調整前の写真と、その調整。調整し直すときに使う (photoId は切り出したあとの写真) */
  photoCrop?: PhotoCrop
  /** 分類 (Group.id) */
  groupId?: string
  method?: Method
  /** 水やりの呼び名を自分で決めたとき (ソーキング など)。空なら栽培方法に合わせる */
  waterLabel?: string
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
  /** アーカイブした理由など。あとから入れたり直したりできる (日付は archivedDay) */
  archive?: ArchiveInfo
  /** 延期: この日までは予定に出さない。次にケアを記録すれば、予定がこの日を越えるので自然に無効になる */
  snooze?: Partial<Record<SchedType, string>>
  /** 水やりに合わせる肥料と活力剤が同じ回に重なったら、同じ日にあげず、交互にずらす */
  stagger?: boolean
}

/** 分類 (アガベ、サボテン…) と、そのケア設定のプリセット */
export interface Group {
  id: string
  name: string
  /** この分類でふつうの栽培方法 (チランジアなら着生)。植物を追加するときの初期値になる */
  method?: Method
  /** この分類での水やりの呼び名 (チランジアならソーキング)。空なら栽培方法に合わせる */
  waterLabel?: string
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
  /** 1 枚目の写真 (写真が 1 枚だけだったころの持ち方。一覧などはこれを見る) */
  photoId?: string
  /** 写真ぜんぶ (複数枚のとき)。無ければ photoId の 1 枚だけ。読むときは db.ts の journalPhotos を使う */
  photoIds?: string[]
  /** 位置と大きさを調整した写真の、調整前の写真とその調整 (キーは調整後の写真の id)。調整し直すときに使う */
  photoCrops?: Record<string, PhotoCrop>
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
  /** 設定の下に、購入金額の合計を出すか (入っていなければ出す) */
  showSpent?: boolean
  /** ホームのカードに、アーカイブした株数を出すか (入っていなければ出す) */
  showArchived?: boolean
  /** 肥料・活力剤を水に混ぜてあげる (水やりを兼ねる)。ケアの設定で、間隔を「水やり何回に 1 回」で選べるようになる */
  careWithWater?: boolean
}
