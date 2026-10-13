// ハチのひとこと: ロゴの右の吹き出しに出す言葉。
// いまの状況 (今日のお世話、天気、季節、記録の数 など) から言えることを集めて並べる。
// 先頭は、そのタブでいちばん役に立つ一言 (ホームなら今日のお世話)。吹き出しを押すと、次の言葉に替わる。
// 言葉を足すときは、1 行に 17 文字ほど・2 行までに収まる長さ (34 文字くらいまで) にする
import { addDays, diffDays, monthOf } from './lib/date'
import type { Weather } from './lib/weather'
import type { CareLog, Journal, Plant } from './types'

export type BeeTab = 'home' | 'cal' | 'tl' | 'set'

export interface BeeInput {
  tab: BeeTab
  /** 今日 (YYYY-MM-DD) と、いまの時 (0〜23) */
  today: string
  hour: number
  /** 育てている株と、その株数 (まとめた登録は中身を 1 株ずつ) */
  plants: Plant[]
  heads: number
  /** 今日やる (過ぎているぶんも含む) 株数、そのうち予定を過ぎている株数、明日が予定日の株数 */
  due: number
  over: number
  tomorrow: number
  /** 今日やるお世話に、肥料・活力剤が入っているか / 今日の水やりがすべてちょろ水か */
  dueFeed: boolean
  dueAllLight: boolean
  /** 延期中の株数 */
  snoozed: number
  logs: CareLog[]
  journal: Journal[]
  weather: Weather | null
  /** 最後にバックアップを書き出した日 (無ければ null) */
  lastBackup: string | null
}

/** 同じ日・同じ場面では同じ順になるように、日付から決めた数だけ先頭をずらす (日によって、最初の一言が変わる) */
const rotate = <T>(list: T[], seed: number): T[] => (list.length ? [...list.slice(seed % list.length), ...list.slice(0, seed % list.length)] : list)

/** 長い名前は、吹き出しに収まるように途中まで */
const short = (name: string) => (name.length > 12 ? `${name.slice(0, 11)}…` : name)

/** 育て始めた日: 入手日があればそれ、無ければ登録した日 */
const since = (p: Plant) => p.purchaseDate || p.createdDay

/** 今日のお世話についての一言 (ホームの先頭に出す) */
function careLines(i: BeeInput): string[] {
  if (i.over > 0)
    return [
      `${i.over}株が、お世話を待ってるよ`,
      `予定を過ぎた株が${i.over}株あるよ`,
      `のどが渇いた株がいるみたい。${i.over}株だよ`,
      i.due > i.over ? `今日は${i.due}株。${i.over}株は予定を過ぎてるよ` : `${i.over}株、そろそろ見てあげよう`,
    ]
  if (i.due > 0)
    return [
      i.dueAllLight ? `今日は${i.due}株にちょろ水だよ` : `今日は${i.due}株のお世話だよ`,
      `${i.due}株が待ってるよ。いってらっしゃい`,
      `今日のお世話は${i.due}株。よろしくね`,
      ...(i.dueFeed ? ['今日は肥料や活力剤の日でもあるよ'] : []),
      ...(i.due >= 10 ? [`${i.due}株もあるね。まとめて記録が便利だよ`] : []),
      ...(i.due === 1 ? ['今日は1株だけ。すぐ終わるね'] : []),
    ]
  const today = i.logs.filter((l) => l.date === i.today).length
  if (today > 0)
    return [
      '今日のお世話は完了！おつかれさま',
      'ぜんぶ終わったね。えらい！',
      'みんな、うれしそうだよ',
      `今日は${today}件、記録したね`,
      ...(i.tomorrow > 0 ? [`今日は完了。明日は${i.tomorrow}株だよ`] : []),
    ]
  if (i.tomorrow > 0) return [`今日はおやすみ。明日は${i.tomorrow}株だよ`, `明日は${i.tomorrow}株のお世話だよ`, 'お世話のない日は、葉っぱを眺めよう']
  return ['今日は、お世話のない日だよ', 'のんびりの日。葉っぱを眺めよう', '新しい芽、出てないかな？', '今日は見守るだけで大丈夫']
}

/** 天気についての一言 (天気をオンにしているときだけ) */
function weatherLines(w: Weather | null): string[] {
  if (!w) return []
  const max = Math.round(w.max), min = Math.round(w.min), hum = Math.round(w.humidity)
  const out: string[] = []
  const rain = (w.code >= 51 && w.code <= 67) || (w.code >= 80 && w.code <= 82) || w.code >= 95
  const snow = (w.code >= 71 && w.code <= 77) || w.code === 85 || w.code === 86
  if (w.code >= 95) out.push('雷雨だね。外の鉢は、だいじょうぶ？')
  else if (snow) out.push('雪だ！外の株は、寒くないかな')
  else if (rain) out.push('雨だね。外の株の水やりは、お休みでもいいかも')
  else if (w.code === 0) out.push('いい天気！日なたぼっこ日和だね')
  else if (w.code === 3) out.push('くもりだね。水は乾きにくい日だよ')
  if (max >= 35) out.push(`今日は${max}°。猛暑だね、直射日光に気をつけて`)
  else if (max >= 30) out.push(`${max}°まで上がるよ。水切れに気をつけて`)
  if (min <= 0) out.push(`今夜は${min}°。凍らないように気をつけて`)
  else if (min <= 5) out.push(`今夜は${min}°まで冷えるよ。弱い株は中へ`)
  if (hum <= 35) out.push(`湿度${hum}%。乾いてるね、葉水もいいかも`)
  else if (hum >= 80) out.push(`湿度${hum}%。じめじめ、蒸れに注意だよ`)
  if (w.rain != null && w.rain >= 70 && !rain) out.push(`降水確率${Math.round(w.rain)}%。外の鉢は雨に当たるかも`)
  return out
}

/** 季節についての一言 */
function seasonLines(month: number): string[] {
  if (month >= 3 && month <= 5) return ['植え替えにいい季節だよ', '新芽が動き出すころだね', '春は生長の季節。肥料もそろそろかな', '遅霜には気をつけてね']
  if (month >= 6 && month <= 8) return ['夏は蒸れと水切れに注意だよ', '夕方の水やりは、涼しくていいよ', '強い日ざしは、葉焼けのもとだよ', '風通しのいい場所が、いちばんだね']
  if (month >= 9 && month <= 11) return ['秋もよく育つ季節。よく見てあげて', 'そろそろ冬支度を考えよう', '朝晩が冷えてきたね', '夏のつかれ、出てないかな？']
  return ['冬は、水を控えめにね', '寒い夜は、窓辺から少し離してあげて', '休眠中の株は、そっとしておこう', '暖房の風が、直接当たらないようにね']
}

/** 時間帯のあいさつ */
function hourLines(hour: number): string[] {
  if (hour < 5) return ['こんな時間まで起きてるの？', '夜ふかしだね。植物は、もう寝てるよ']
  if (hour < 10) return ['おはよう！今日もよろしくね', '朝の水やりは、気持ちいいね']
  if (hour < 17) return ['こんにちは。いい光、入ってる？', 'お昼だね。葉っぱ、元気かな']
  if (hour < 22) return ['今日も、おつかれさま', '夜の見まわり、ありがとう']
  return ['そろそろ、おやすみの時間だね', '夜ふかしだね。植物は、もう寝てるよ']
}

/** 育てている株や、これまでの記録についての一言 */
function recordLines(i: BeeInput): string[] {
  const out: string[] = []
  if (i.heads >= 50) out.push(`${i.heads}株…もう植物園だね`)
  else if (i.heads >= 10) out.push(`${i.heads}株も！にぎやかだね`)
  else if (i.heads >= 1) out.push(`いま、${i.heads}株を育ててるよ`)

  // 育てはじめてからの日数と、迎えた記念日
  const first = i.plants.reduce((d, p) => (since(p) < d ? since(p) : d), i.today)
  const days = diffDays(i.today, first) + 1
  if (days >= 2) out.push(days % 100 === 0 ? `今日で${days}日目！おめでとう` : `育てはじめて、${days}日目だよ`)
  for (const p of i.plants) {
    const from = since(p)
    const years = Number(i.today.slice(0, 4)) - Number(from.slice(0, 4))
    if (years >= 1 && from.slice(5) === i.today.slice(5)) out.push(`${short(p.name)}を迎えて${years}年。おめでとう`)
  }
  const newest = [...i.plants].sort((a, b) => since(b).localeCompare(since(a)))[0]
  if (newest && diffDays(i.today, since(newest)) <= 7) out.push(`${short(newest.name)}、新しい場所に慣れたかな？`)

  // お世話の記録
  if (i.logs.length >= 1000) out.push(`お世話は${i.logs.length.toLocaleString('ja-JP')}回。すごいなあ`)
  else if (i.logs.length >= 10) out.push(`これまでのお世話は${i.logs.length}回。えらい！`)
  const week = i.logs.filter((l) => l.date > addDays(i.today, -7) && l.date <= i.today).length
  if (week >= 5) out.push(`この1週間で、${week}回お世話したね`)
  if (i.snoozed > 0) out.push(`${i.snoozed}株は、延期中だよ`)
  if (i.plants.some((p) => p.care.water.light?.includes(monthOf(i.today)))) out.push('今月は、ちょろ水の株があるよ')

  // 生長記録
  const dated = i.journal.filter((j) => j.date).sort((a, b) => b.date.localeCompare(a.date))
  if (!i.journal.length) out.push('生長記録、まだないね。写真を1枚どう？')
  else {
    out.push(`生長記録は${i.journal.length}件。たまってきたね`)
    const gap = dated[0] ? diffDays(i.today, dated[0].date) : 0
    if (gap >= 14) out.push(`最後の写真から${gap}日。変化はあった？`)
  }
  return out
}

/** バックアップについての一言 */
function backupLines(i: BeeInput): string[] {
  if (!i.plants.length) return []
  if (!i.lastBackup) return ['バックアップ、まだ取ってないよ', 'データは、この端末の中だけにあるよ']
  const d = diffDays(i.today, i.lastBackup)
  return d >= 30 ? [`バックアップから${d}日。そろそろ書き出そう`] : d === 0 ? ['今日バックアップしたね。安心だ'] : [`バックアップは${d}日前。ばっちりだね`]
}

/** 育て方のこつや、ひとりごと */
const TIPS = [
  '土が乾いてから水やり、が基本だよ',
  '鉢を回すと、まんべんなく日が当たるよ',
  '葉っぱの裏も、ときどき見てあげてね',
  '風通し、だいじだよ',
  '受け皿の水は、ためっぱなしにしないでね',
  '水やりは、鉢底から流れるくらいたっぷりと',
  '元気がないときは、根を見てみよう',
  '写真を撮っておくと、生長がよくわかるよ',
  '名前を呼んであげると、喜ぶ…かも',
  'ぼくはハチ。鉢を抱えたハチだよ',
  '花が咲いたら、教えてね',
  '押すと、ほかのことも話すよ',
]

/** カレンダー・タイムライン・設定のタブで、先頭に出す一言 */
function tabLines(i: BeeInput): string[] {
  const month = i.today.slice(0, 7)
  if (i.tab === 'cal') {
    const n = i.logs.filter((l) => l.date.startsWith(month)).length
    return [
      n ? `今月の記録は、${n}件だよ` : '今月の記録は、まだないよ',
      '塗りの点が記録、白抜きの点が予定だよ',
      '日付を押すと、その日のお世話が見られるよ',
      '予定は、今の間隔で続けた場合の見込みだよ',
      '過去の日を選んで「記録」で、付け忘れを入れられるよ',
    ]
  }
  if (i.tab === 'tl') {
    const n = i.journal.length
    return [
      n ? `生長記録は、${n}件だよ` : '写真を撮って、生長を残そう',
      '写真は、押すと大きく見られるよ',
      '同じ場所・同じ向きで撮ると、変化がわかるよ',
      '分類や植物で、絞り込めるよ',
      '投稿用の画像も、ここから作れるよ',
    ]
  }
  return [
    'テーマやフォントで、気分を変えてみよう',
    '「季節に合わせる」で、色が自動で変わるよ',
    '困ったら、「使い方」を見てね',
    'ほしい機能は、「リクエストを送る」で教えてね',
    'ぼくのひとことは、「ホームの表示」で消せるよ',
  ]
}

/**
 * いま言えることを、出す順に並べて返す。先頭が、はじめに出る一言。
 * 株が 1 つも無いときは、何も言わない (空の配列)
 */
export function beeLines(i: BeeInput): string[] {
  if (!i.plants.length) return []
  // 日付から決めた数。同じ日は同じ並びにして、開くたびに言葉が変わらないようにする
  const seed = diffDays(i.today, '2026-01-01') + 366 * 100
  const lead = i.tab === 'home' ? careLines(i) : tabLines(i)
  // ホーム以外でも、今日のお世話が残っていれば、2 番目に知らせる
  const care = i.tab !== 'home' && i.due > 0 ? [careLines(i)[0]] : []
  // 設定のタブでは、バックアップの話を早めに出す
  const backup = backupLines(i)
  const rest = rotate([...weatherLines(i.weather), ...hourLines(i.hour), ...seasonLines(monthOf(i.today)), ...recordLines(i), ...(i.tab === 'set' ? [] : backup), ...TIPS], seed)
  const all = [...rotate(lead, seed).slice(0, 1), ...care, ...(i.tab === 'set' ? backup : []), ...rotate(lead, seed).slice(1), ...rest]
  // 同じ言葉が 2 回出ないようにする
  return [...new Set(all)]
}
