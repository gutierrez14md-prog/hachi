// テーマとフォント。描画前に決まっていてほしいので IndexedDB ではなく localStorage に持つ
// (テーマは index.html のインラインスクリプトが先に <html data-theme> へ反映する)
/**
 * テーマ。Light / Dark のほかに、緑 (リーフ)、季節 (春夏秋冬)、行事 (ハロウィン・クリスマス) の色がある。色そのものは styles.css の :root[data-theme]。
 * bg は地の色 (ブラウザの上のバーの色と、設定の見本に使う)、hero は上のカードの色 (見本に使う)
 */
export const THEMES = [
  { id: 'light', label: 'Light', bg: '#ecf0ed', hero: '#17241d' },
  { id: 'dark', label: 'Dark', bg: '#121212', hero: '#333333' },
  { id: 'leaf', label: 'Leaf', bg: '#d3ead0', hero: '#2a7a47' },
  { id: 'spring', label: 'Spring', bg: '#f7d6df', hero: '#b93a65' },
  { id: 'summer', label: 'Summer', bg: '#cbe7f4', hero: '#0a759a' },
  { id: 'autumn', label: 'Autumn', bg: '#f3d9b8', hero: '#ad4318' },
  { id: 'winter', label: 'Winter', bg: '#d5dfef', hero: '#23406e' },
  { id: 'halloween', label: 'Halloween', bg: '#f8d09a', hero: '#4a1f66' },
  { id: 'christmas', label: 'Christmas', bg: '#d0e4ce', hero: '#ad1f2c' },
] as const

export type Theme = (typeof THEMES)[number]['id']
/** 選べるもの: テーマのどれか、または auto = 今の季節に合わせる */
export type ThemeChoice = Theme | 'auto'

/**
 * 今日の季節のテーマ: 10/25〜10/31 はハロウィン、12/15〜12/25 はクリスマス、
 * ほかは 3〜5 月が春、6〜8 月が夏、9〜11 月が秋、12〜2 月が冬。
 * 描画前に反映するために、同じ決まりが index.html のインラインスクリプトにもある
 */
export function seasonTheme(now = new Date()): Theme {
  const m = now.getMonth() + 1, d = now.getDate()
  if (m === 10 && d >= 25) return 'halloween'
  if (m === 12 && d >= 15 && d <= 25) return 'christmas'
  return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter'
}

/** フォントの候補。q は Google Fonts の css2 に渡す family 指定。CSS 側の対応は styles.css の :root[data-font] */
export const FONTS = [
  {
    id: 'stories',
    label: 'Stories',
    desc: 'Unbounded + Zen Kaku Gothic New',
    q: 'family=Unbounded:wght@400;600;800&family=Zen+Kaku+Gothic+New:wght@400;500;700',
  },
  {
    id: 'neutral',
    label: 'Neutral',
    desc: 'Inter + Noto Sans JP',
    q: 'family=Inter:ital,wght@0,400;0,600;0,800;1,400&family=Noto+Sans+JP:wght@400;500;700',
  },
  {
    id: 'classic',
    label: 'Classic',
    desc: 'Cormorant Garamond + しっぽり明朝',
    q: 'family=Cormorant+Garamond:ital,wght@0,600;0,700;1,500&family=Shippori+Mincho+B1:wght@600;800&family=Zen+Kaku+Gothic+New:wght@400;500;700',
  },
  {
    id: 'plex',
    label: 'Plex',
    desc: 'IBM Plex Mono + IBM Plex Sans JP',
    q: 'family=IBM+Plex+Mono:ital,wght@0,500;0,600;1,400&family=IBM+Plex+Sans+JP:wght@400;500;700',
  },
] as const

export type FontId = (typeof FONTS)[number]['id']

/** 植物の名前だけに使う書体。family が空なら本文と同じ。weight はその書体で使う太さ */
export const NAME_FONTS = [
  { id: 'shippori', label: 'しっぽり明朝', desc: '端正な明朝', family: 'Shippori Mincho B1', weight: 700, q: 'family=Shippori+Mincho+B1:wght@700' },
  { id: 'antique', label: 'Zen Antique', desc: '古風で力のある明朝', family: 'Zen Antique', weight: 400, q: 'family=Zen+Antique' },
  { id: 'kaisei', label: 'Kaisei Decol', desc: '装飾のあるレトロな明朝', family: 'Kaisei Decol', weight: 700, q: 'family=Kaisei+Decol:wght@700' },
  { id: 'yuji', label: '佑字 肅', desc: '筆文字', family: 'Yuji Syuku', weight: 400, q: 'family=Yuji+Syuku' },
  { id: 'dela', label: 'Dela Gothic', desc: '極太のゴシック', family: 'Dela Gothic One', weight: 400, q: 'family=Dela+Gothic+One' },
  { id: 'body', label: '標準', desc: '本文と同じ', family: '', weight: 700, q: '' },
] as const

export type NameFontId = (typeof NAME_FONTS)[number]['id']

const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}

export const getTheme = (): ThemeChoice => {
  const saved = read('theme')
  return saved === 'auto' ? 'auto' : (THEMES.find((t) => t.id === saved)?.id ?? 'light')
}

export function applyTheme(choice: ThemeChoice) {
  const theme = THEMES.find((t) => t.id === (choice === 'auto' ? seasonTheme() : choice))!
  document.documentElement.dataset.theme = theme.id
  localStorage.setItem('theme', choice)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bg)
}

export const getFont = (): FontId => FONTS.find((f) => f.id === read('font'))?.id ?? 'stories'

/** Google Fonts のスタイルシートを 1 枚読み込む (同じ id なら差し替え、q が空なら外す) */
function loadFonts(linkId: string, q: string) {
  let link = document.getElementById(linkId) as HTMLLinkElement | null
  if (!q) return link?.remove()
  if (!link) {
    link = document.createElement('link')
    link.id = linkId
    link.rel = 'stylesheet'
    document.head.append(link)
  }
  link.href = `https://fonts.googleapis.com/css2?${q}&display=swap`
}

export function applyFont(id: FontId) {
  const font = FONTS.find((f) => f.id === id)!
  document.documentElement.dataset.font = id
  localStorage.setItem('font', id)
  loadFonts('font-css', font.q)
}

export const getNameFont = (): NameFontId => NAME_FONTS.find((f) => f.id === read('nameFont'))?.id ?? 'shippori'

export function applyNameFont(id: NameFontId) {
  const font = NAME_FONTS.find((f) => f.id === id)!
  const root = document.documentElement.style
  // styles.css の --font-name / --name-weight を上書きする (標準のときは外して、本文の書体に戻す)
  if (font.family) root.setProperty('--font-name', `'${font.family}'`)
  else root.removeProperty('--font-name')
  root.setProperty('--name-weight', String(font.weight))
  localStorage.setItem('nameFont', id)
  loadFonts('name-font-css', font.q)
}
