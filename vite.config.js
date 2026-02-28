import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // ローカル開発・テスト時は相対パス、本番ビルド時は絶対パス
  // 環境変数 LOCAL_BUILD=true でローカル用ビルド
  const base = process.env.LOCAL_BUILD === 'true' ? './' : '/multipdf-viewer/'
  
  return {
    plugins: [react()],
    base: base,
    build: {
      outDir: 'dist',
    },
  }
})
