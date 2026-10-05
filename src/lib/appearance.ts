// テーマとフォント。描画前に決まっていてほしいので IndexedDB ではなく localStorage に持つ
// (テーマは index.html のインラインスクリプトが先に <html data-theme> へ反映する)
export type Theme = 'light' | 'dark'

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

const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}

export const getTheme = (): Theme => (read('theme') === 'dark' ? 'dark' : 'light')

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem('theme', theme)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121212' : '#ecf0ed')
}

export const getFont = (): FontId => FONTS.find((f) => f.id === read('font'))?.id ?? 'stories'

export function applyFont(id: FontId) {
  const font = FONTS.find((f) => f.id === id)!
  document.documentElement.dataset.font = id
  localStorage.setItem('font', id)
  let link = document.getElementById('font-css') as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = 'font-css'
    link.rel = 'stylesheet'
    document.head.append(link)
  }
  link.href = `https://fonts.googleapis.com/css2?${font.q}&display=swap`
}
