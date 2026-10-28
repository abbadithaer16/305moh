import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `vite build --mode artifact` inlines everything into one HTML file for the hosted preview.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'artifact' ? [viteSingleFile()] : [])],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: { assetsInlineLimit: mode === 'artifact' ? 100_000_000 : 4096 },
}))
