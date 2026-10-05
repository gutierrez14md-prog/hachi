import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base を相対にして、サブパス配下 (GitHub Pages など) でもそのまま動くようにする
export default defineConfig({
  base: './',
  plugins: [react()],
})
