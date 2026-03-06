import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function normalizeFsPath(value: string) {
  return value.replace(/^\\\\\?\\/, '')
}

const projectRoot = normalizeFsPath(fileURLToPath(new URL('./', import.meta.url)))
const srcRoot = normalizeFsPath(fileURLToPath(new URL('./src', import.meta.url)))

// https://vite.dev/config/
export default defineConfig({
  root: projectRoot,
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': srcRoot,
    },
  },
})
