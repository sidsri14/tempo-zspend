import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve(__dirname, '.'),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@zspend': resolve(__dirname, '../src'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: { port: 5201 },
})