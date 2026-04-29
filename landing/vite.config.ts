import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/* GH Pages publishes under /<repo>/, so the build needs the matching
 * base.  Override at build time with VITE_BASE=/ for previews from
 * roots other than github.io. */
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE ?? (mode === 'production' ? '/imaginary-storage-nas/' : '/'),
  build: { outDir: 'dist' },
}))
