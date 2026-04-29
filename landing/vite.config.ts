import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/* Served at the root of nas.imaginarystorage.com (custom domain configured
 * via landing/public/CNAME).  Override with VITE_BASE if previewing under
 * a sub-path. */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE ?? '/',
  build: { outDir: 'dist' },
})
