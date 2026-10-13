// ハチのひとことの、追加ぶん: 植物の種類ごとの豆知識、新しい株をお迎えしたくなる言葉、登録した株のことを話す言葉。
// 集めて順番を決めるのは src/bee.ts。ここは「いま言えること」を出すだけ。
// 豆知識は、広く知られた確かなことだけを書く (育て方の細かい数字のように、条件で変わることは書かない)。
// どの言葉も、吹き出しの 2 行に収まる長さにする (全角 22 文字くらいまで。長すぎるものは bee.ts が外す)
import { diffDays, monthOf } from './lib/date'
import type { BeeInput } from './bee'
import type { Plant } from './types'

/** 吹き出しに収まるように、名前や場所を途中までにする */
export const short = (text: string, max = 9) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

/** 育て始めた日: 入手日があればそれ、無ければ登録した日 */
export const since = (p: Plant) => p.purchaseDate || p.createdDay

/** 種から決めた、いつも同じ並びの乱数 (0〜1)。同じ日は同じ言葉・同じ順にするため */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function shuffle<T>(list: T[], random: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ---------------------------------------------------------------------------
// 豆知識。keys のどれかが、株の学名・名前・分類の名前に入っていれば、その lines を話す
// ---------------------------------------------------------------------------
const TRIVIA: { keys: string[]; lines: string[] }[] = [
  { keys: ['agave', 'アガベ'], lines: ['テキーラの原料は、アガベなんだよ', 'アガベは、一生に一度だけ花を咲かせるよ', 'アガベの花茎は、数メートルにもなるよ', 'アガベのトゲ、うっかり刺さらないようにね'] },
  { keys: ['pachypodium', 'パキポ'], lines: ['パキポディウムは「太い足」という意味だよ', 'パキポの故郷は、マダガスカルやアフリカだよ', 'パキポは、葉が落ちたら水を控えてね'] },
  { keys: ['platycerium', 'ビカク', 'コウモリラン'], lines: ['ビカクシダは、漢字で「麋角羊歯」だよ', 'ビカクシダには、2種類の葉があるよ', '貯水葉は、茶色くなっても取らないでね', 'ビカクシダの名前は、鹿の角が由来だよ'] },
  { keys: ['tillandsia', 'チランジア', 'ティランジア', 'エアプランツ'], lines: ['チランジアは、葉から水を吸うんだよ', 'チランジアは、パイナップルの仲間だよ', 'ソーキングのあとは、しっかり乾かしてね', 'チランジアの白い粉は、水を集める毛だよ'] },
  { keys: ['monstera', 'モンステラ'], lines: ['モンステラの名前は「怪物」が由来だよ', 'モンステラの葉の穴は、育つと増えるよ', 'モンステラの気根は、切らなくていいよ'] },
  { keys: ['haworthia', 'ハオルチア', 'ハオルシア'], lines: ['ハオルチアの「窓」は、光を取りこむ窓だよ', 'ハオルチアは、強い日ざしが苦手だよ'] },
  { keys: ['echeveria', 'エケベリア'], lines: ['エケベリアは、画家の名前が由来だよ', 'エケベリアは、秋に紅葉する種類が多いよ', 'エケベリアは、日が足りないと間のびするよ'] },
  { keys: ['sansevieria', 'サンスベリア', 'サンセベリア'], lines: ['サンスベリアは、今はドラセナの仲間だよ', 'サンスベリアは、寒い時期は水を控えてね'] },
  { keys: ['euphorbia', 'ユーフォルビア'], lines: ['ユーフォルビアの白い汁は、かぶれるよ', 'サボテン似でも、ユーフォルビアは別の仲間', 'ポインセチアも、ユーフォルビアの仲間だよ'] },
  {
    keys: ['サボテン', 'cactus', 'gymnocalycium', 'mammillaria', 'echinopsis', 'ferocactus', 'echinocactus', 'ギムノ', 'マミラリア'],
    lines: ['サボテンのトゲは、葉が変化したものだよ', 'サボテンは、夜に気孔を開くんだよ', 'サボテンの花は短い命。見逃さないでね', 'トゲの根もとの綿毛が、サボテンの目印だよ'],
  },
  { keys: ['astrophytum', 'アストロフィツム', '兜', '鸞鳳玉'], lines: ['アストロフィツムは「星の植物」だよ'] },
  { keys: ['opuntia', 'ウチワサボテン'], lines: ['ウチワサボテンの実は、食べられるよ'] },
  { keys: ['rhipsalis', 'リプサリス'], lines: ['リプサリスは、森で育つサボテンだよ', 'リプサリスは、直射日光が苦手だよ'] },
  { keys: ['lithops', 'リトープス'], lines: ['リトープスは、脱皮して大きくなるよ', 'リトープスは「石に似た」という意味だよ'] },
  { keys: ['nepenthes', 'ウツボカズラ', 'ネペンテス'], lines: ['ウツボカズラの袋は、葉が変化したものだよ', 'ウツボカズラの袋には、消化液が入ってるよ'] },
  { keys: ['dionaea', 'ハエトリ'], lines: ['ハエトリソウは、2回さわると閉じるよ', 'ハエトリソウで遊びすぎると、弱っちゃうよ'] },
  { keys: ['sarracenia', 'サラセニア'], lines: ['サラセニアは、筒の中に虫を落とすよ', 'サラセニアの故郷は、北アメリカだよ'] },
  { keys: ['drosera', 'モウセンゴケ', 'ドロセラ'], lines: ['モウセンゴケは、ねばねばで虫を捕まえるよ'] },
  { keys: ['食虫'], lines: ['食虫植物は、やせた土地で生きる工夫だよ', '食虫植物も、光合成で育つんだよ'] },
  { keys: ['ficus', 'フィカス', 'ゴムの木', 'ガジュマル', 'ウンベラータ'], lines: ['フィカスは、イチジクの仲間だよ', 'ゴムの木の白い汁は、昔ゴムの原料だったよ'] },
  { keys: ['hoya', 'ホヤ'], lines: ['ホヤは、咲いたあとの花茎を切らないでね', 'ホヤの花は、ろう細工みたいだよ'] },
  { keys: ['aloe', 'アロエ'], lines: ['アロエは、冬に花が咲く種類が多いよ'] },
  { keys: ['adenium', 'アデニウム'], lines: ['アデニウムは「砂漠のバラ」と呼ばれるよ'] },
  { keys: ['philodendron', 'フィロデンドロン'], lines: ['フィロデンドロンは「木を愛する」だよ'] },
  { keys: ['epipremnum', 'ポトス'], lines: ['ポトスは、大きく育つと葉が割れるよ', 'ポトスは、水にさすだけで根が出るよ'] },
  { keys: ['calathea', 'カラテア', 'maranta', 'マランタ'], lines: ['カラテアは、夜になると葉を立てるよ'] },
  { keys: ['aeschynanthus', 'エスキナンサス'], lines: ['エスキナンサスは、口紅みたいな花が咲くよ'] },
  { keys: ['anthurium', 'アンスリウム'], lines: ['アンスリウムの赤い部分は、花じゃないよ'] },
  { keys: ['alocasia', 'アロカシア', 'クワズイモ'], lines: ['アロカシアは、葉先から水を出すことがあるよ'] },
  { keys: ['phalaenopsis', 'dendrobium', '胡蝶蘭', 'コチョウラン', 'デンドロビウム'], lines: ['ランの根は、空気が好きなんだよ'] },
  { keys: ['olea', 'オリーブ'], lines: ['オリーブは、2品種あると実がつきやすいよ'] },
  { keys: ['塊根', 'コーデックス', 'caudex'], lines: ['塊根は、水をためるタンクだよ', '葉が落ちたら、塊根植物はお休みの合図'] },
  { keys: ['シダ', 'fern', 'adiantum', 'アジアンタム', 'nephrolepis'], lines: ['シダは、種じゃなくて胞子でふえるよ', 'シダは、花を咲かせない植物だよ', 'シダは、恐竜より昔からいるんだよ'] },
  { keys: ['多肉'], lines: ['多肉植物は、葉に水をためているよ', '多肉は、夜に気孔を開く種類が多いよ', '多肉は、葉1枚からふやせる種類もあるよ'] },
  { keys: ['観葉'], lines: ['葉のほこりを拭くと、光をよく浴びられるよ', 'エアコンの風は、観葉植物の大敵だよ'] },
]

/** 育てている株の種類に合った豆知識 */
export function triviaLines(i: BeeInput): string[] {
  const groupName = new Map(i.groups.map((g) => [g.id, g.name]))
  const texts = i.plants.map((p) =>
    [p.scientificName, p.name, groupName.get(p.groupId ?? ''), ...(p.members ?? []).flatMap((m) => [m.name, m.scientificName])].filter(Boolean).join(' ').toLowerCase(),
  )
  return TRIVIA.filter((t) => t.keys.some((k) => texts.some((x) => x.includes(k)))).flatMap((t) => t.lines)
}

// ---------------------------------------------------------------------------
// お迎えをそそのかす言葉
// ---------------------------------------------------------------------------
export function wantLines(i: BeeInput): string[] {
  const out = [
    'そろそろ、新しい株をお迎えしない？',
    '園芸店、のぞいてみない？',
    '気になってる株、あるんじゃない？',
    '見るだけ…って言って、連れて帰るよね',
    '棚、まだ空いてるよね？',
    'ほしい株リスト、長くなってない？',
    '1株増えても、お世話は変わらない…たぶん',
    '植物は、いくつあってもいいよね',
    '新入りが来ると、みんな喜ぶよ…きっと',
    'ネットで株を見てるだけ。見てるだけだよ',
    '運命の1株、まだ出会ってないかも',
    'ぼくにも、新しい鉢を持たせてよ',
  ]
  if (i.weekday === 0 || i.weekday === 6) out.push('週末だね。園芸店日和だよ', 'イベントや即売会、やってないかな')
  if (i.weekday === 5) out.push('明日は週末。園芸店に行く？')

  const month = monthOf(i.today)
  if (month >= 3 && month <= 5) out.push('春は、新しい株が並ぶ季節だよ', '春は、お迎えにいちばんいい季節だよ')
  else if (month >= 9 && month <= 11) out.push('秋も、お迎えにいい季節だよ', '秋の園芸店、いい株が並んでるかも')
  else if (month >= 6 && month <= 8) out.push('夏型の株は、今がいちばん元気だよ')
  else out.push('冬のお迎えは、寒さに気をつけてあげてね')

  // 最後にお迎えしてからの日数と、きりのいい株数まであと少しのとき
  const last = i.plants.reduce((d, p) => (since(p) > d ? since(p) : d), '')
  const gap = last ? diffDays(i.today, last) : 0
  if (gap >= 30) out.push(`最後のお迎えから${gap}日。そろそろ…？`)
  const round = Math.ceil((i.heads + 1) / 10) * 10
  if (round - i.heads <= 3) out.push(`あと${round - i.heads}株で、${round}株だよ`)

  // 分類ごと: 1 株だけの分類、まだ育てていない分類
  const counts = new Map<string, number>()
  for (const p of i.plants) if (p.groupId) counts.set(p.groupId, (counts.get(p.groupId) ?? 0) + (p.members?.length || 1))
  for (const g of i.groups) {
    const n = counts.get(g.id) ?? 0
    if (n === 1) out.push(`${short(g.name, 7)}は1株だけ。仲間を増やす？`)
    if (n === 0) out.push(`${short(g.name, 7)}は、まだ育ててないね。どう？`)
  }
  return out
}

// ---------------------------------------------------------------------------
// 登録した株のことを話す言葉
// ---------------------------------------------------------------------------
/** ある 1 株について言えること */
function aboutPlant(p: Plant, i: BeeInput): string[] {
  const n = short(p.name)
  const out = [`${n}、元気にしてる？`, `${n}の葉っぱ、つやつやかな`, `${n}に、声をかけてあげて`]
  const days = diffDays(i.today, since(p)) + 1
  if (days >= 2) out.push(`${n}は、育てて${days}日目だよ`)
  if (days >= 365) out.push(`${n}とは、もう${Math.floor(days / 365)}年のつきあいだね`)

  const water = i.nextWater[p.id]
  if (water) {
    const k = diffDays(water, i.today)
    if (k === 1) out.push(`${n}の水やりは、明日だよ`)
    else if (k > 1) out.push(`${n}の水やりは、あと${k}日だよ`)
    else if (k < 0) out.push(`${n}が、${-k}日待ってるよ`)
  }
  if (p.location) out.push(`${n}は、${short(p.location, 7)}にいるね`)
  if (!p.photoId) out.push(`${n}の写真、まだないね`)
  if (p.dormantMonths.includes(monthOf(i.today))) out.push(`${n}は、いま休眠期だね`)
  if (p.parents) out.push(`${n}は、交配種なんだね`)
  if (p.cultivar) out.push(`${n}の品種は「${short(p.cultivar, 7)}」だね`)
  if (p.gift) out.push(p.giftFrom ? `${n}は、${short(p.giftFrom, 6)}からの株だね` : `${n}は、譲り受けた株だね`)
  else if (p.purchasePlace) out.push(`${n}は、${short(p.purchasePlace, 6)}で出会ったね`)
  if (p.members?.length) out.push(`${n}には、${p.members.length}株が一緒だね`)

  const logs = i.logs.filter((l) => l.plantId === p.id)
  const waters = logs.filter((l) => l.type === 'water').length
  if (waters >= 5) out.push(`${n}に、${waters}回お水をあげたね`)
  const repot = logs.filter((l) => l.type === 'repot').reduce((d, l) => (l.date > d ? l.date : d), '')
  if (repot && diffDays(i.today, repot) >= 365) out.push(`${n}、植え替えから1年以上だね`)
  else if (!repot && days >= 365) out.push(`${n}、植え替えはした？`)

  const shots = i.journal.filter((j) => j.plantId === p.id)
  const lastShot = shots.reduce((d, j) => (j.date > d ? j.date : d), '')
  if (!shots.length) out.push(`${n}の生長記録、つけてみない？`)
  else if (lastShot && diffDays(i.today, lastShot) >= 30) out.push(`${n}、前の写真から変わったかな`)
  else out.push(`${n}の記録は、${shots.length}件あるよ`)
  return out
}

/** 株ぜんたいを見わたして言えること (いちばんの古株、いちばん多い分類 など) */
function aboutAll(i: BeeInput): string[] {
  const out: string[] = []
  if (i.plants.length >= 2) {
    const oldest = i.plants.reduce((a, b) => (since(b) < since(a) ? b : a))
    out.push(`いちばんの古株は、${short(oldest.name)}だね`)
    const newest = i.plants.reduce((a, b) => (since(b) > since(a) ? b : a))
    out.push(`いちばんの新入りは、${short(newest.name)}だね`)

    // 水やりの回数と、写真の数がいちばん多い株
    const count = (ids: string[]) => {
      const m = new Map<string, number>()
      for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1)
      return [...m.entries()].sort((a, b) => b[1] - a[1])[0]
    }
    const byName = new Map(i.plants.map((p) => [p.id, p.name]))
    const top = count(i.logs.filter((l) => l.type === 'water' && byName.has(l.plantId)).map((l) => l.plantId))
    if (top && top[1] >= 5) out.push(`水やりの回数1位は、${short(byName.get(top[0])!)}`)
    const shot = count(i.journal.filter((j) => byName.has(j.plantId)).map((j) => j.plantId))
    if (shot && shot[1] >= 3) out.push(`写真がいちばん多いのは、${short(byName.get(shot[0])!)}`)
  }

  // 分類と置き場所
  const tally = (key: (p: Plant) => string | undefined) => {
    const m = new Map<string, number>()
    for (const p of i.plants) {
      const k = key(p)
      if (k) m.set(k, (m.get(k) ?? 0) + (p.members?.length || 1))
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const groupName = new Map(i.groups.map((g) => [g.id, g.name]))
  const groups = tally((p) => groupName.get(p.groupId ?? ''))
  if (groups.length >= 2) out.push(`いちばん多いのは${short(groups[0][0], 7)}。${groups[0][1]}株だよ`, `${groups.length}種類の分類を育ててるね`)
  else if (groups.length === 1 && groups[0][1] >= 3) out.push(`${short(groups[0][0], 7)}ひとすじだね。${groups[0][1]}株`)
  const places = tally((p) => p.location)
  for (const [place, n] of places.slice(0, 2)) out.push(`${short(place, 7)}には、${n}株いるよ`)
  if (places.length >= 3) out.push(`${places.length}か所に、株を置いてるんだね`)

  if (i.archived > 0) out.push(`アーカイブには${i.archived}株。思い出だね`)
  if (i.plants.some((p) => p.members?.length)) out.push('寄せ植えも育ててるんだね')
  if (i.plants.some((p) => p.method === 'hydro')) out.push('水耕栽培の株は、水の汚れに気をつけてね')
  if (i.plants.some((p) => p.method === 'mount')) out.push('着生の株は、乾きやすいから気をつけてね')
  if (i.plants.some((p) => p.method === 'bottom')) out.push('腰水の株は、水を切らさないでね')
  const noPhoto = i.plants.filter((p) => !p.photoId).length
  if (noPhoto > 0 && noPhoto < i.plants.length) out.push(`写真のない株が、${noPhoto}件あるよ`)
  const resting = i.plants.filter((p) => p.dormantMonths.includes(monthOf(i.today))).length
  if (resting > 0) out.push(`いま休眠期の株は、${resting}件だよ`)
  return out
}

/** 登録した株のこと。株が多いときは、日替わりで選んだ何株かのことを話す */
export function plantLines(i: BeeInput, random: () => number): string[] {
  const picked = shuffle(i.plants, random).slice(0, 6)
  return [...aboutAll(i), ...picked.flatMap((p) => shuffle(aboutPlant(p, i), random).slice(0, 4))]
}
