import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Inject app version (from package.json) into the build so the footer can show it.
const here = dirname(fileURLToPath(import.meta.url))
let appVersion = 'dev'
try {
  const pkg = JSON.parse(readFileSync(resolve(here, 'package.json'), 'utf-8'))
  appVersion = pkg?.version ?? appVersion
} catch {
  // keep "dev"
}

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/@mui/x-data-grid') || id.includes('/@mui/x-date-pickers')) return 'vendor-mui-x'
          if (id.includes('/@mui/') || id.includes('/@emotion/')) return 'vendor-mui'
          if (id.includes('/quill') || id.includes('/parchment') || id.includes('quill-delta')) return 'vendor-quill'
          if (id.includes('/recharts') || id.includes('recharts-scale') || id.includes('/d3-') || id.includes('/victory-')) return 'vendor-charts'
          if (id.includes('/axios/')) return 'vendor-axios'
          return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 750,
  },
})
