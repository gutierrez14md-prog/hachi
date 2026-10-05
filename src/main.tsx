import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 開発中は Vite のモジュールをキャッシュしてしまうので、本番ビルドでのみ登録する
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
}

// ブラウザの都合でデータが消されにくくなるよう、永続ストレージを要求しておく
navigator.storage?.persist?.()
