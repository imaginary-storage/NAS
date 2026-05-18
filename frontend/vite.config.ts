import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

const version = fs
  .readFileSync(path.resolve(__dirname, '../VERSION'), 'utf-8')
  .trim()

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/login':    'http://localhost:8080',
      '/logout':   'http://localhost:8080',
      '/whoami':   'http://localhost:8080',
      '/sessions': 'http://localhost:8080',
      '/fs':       'http://localhost:8080',
      '/trash':    'http://localhost:8080',
      '/admin':    'http://localhost:8080',
      '/static':   'http://localhost:8080',
      '/version':  'http://localhost:8080',
    },
  },
  build: {
    outDir: '../www',
    emptyOutDir: true,
  },
})
