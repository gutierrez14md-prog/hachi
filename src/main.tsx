import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { sweepPhotos } from './db'
import { applyFont, applyNameFont, getFont, getNameFont } from './lib/appearance'
import './styles.css'

applyFont(getFont())
applyNameFont(getNameFont())
sweepPhotos().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 開発中は Vite のモジュールをキャッシュしてしまうので、本番ビルドでのみ登録する
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
}

// iPhone の Safari は viewport の指定を無視してピンチで拡大するので、その操作自体を止める
for (const type of ['gesturestart', 'gesturechange'])
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false })

// ブラウザの都合でデータが消されにくくなるよう、永続ストレージを要求しておく
navigator.storage?.persist?.()
