import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
let appVersion = 'dev'
try {
  const pkg = JSON.parse(readFileSync(resolve(here, 'package.json'), 'utf-8'))
  appVersion = pkg?.version ?? appVersion
} catch {
  // keep "dev"
}

const frontendNodeModules = resolve(here, 'node_modules')
const sharedAliases = {
  '@shared': resolve(here, '../shared/src'),
  react: resolve(frontendNodeModules, 'react'),
  'react-dom': resolve(frontendNodeModules, 'react-dom'),
  'react/jsx-runtime': resolve(frontendNodeModules, 'react/jsx-runtime.js'),
  'react/jsx-dev-runtime': resolve(frontendNodeModules, 'react/jsx-dev-runtime.js'),
  axios: resolve(frontendNodeModules, 'axios'),
  'react-router-dom': resolve(frontendNodeModules, 'react-router-dom'),
  '@mui/material': resolve(frontendNodeModules, '@mui/material'),
  '@mui/icons-material': resolve(frontendNodeModules, '@mui/icons-material'),
  '@mui/x-data-grid': resolve(frontendNodeModules, '@mui/x-data-grid'),
  '@emotion/react': resolve(frontendNodeModules, '@emotion/react'),
  '@emotion/styled': resolve(frontendNodeModules, '@emotion/styled'),
  recharts: resolve(frontendNodeModules, 'recharts'),
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: sharedAliases,
    dedupe: ['react', 'react-dom', '@emotion/react'],
  },
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
          if (id.includes('/@mui/icons-material')) return 'vendor-mui-icons'
          if (id.includes('/@mui/x-data-grid')) return 'vendor-mui-x'
          if (id.includes('/@emotion/')) return 'vendor-emotion'
          if (id.includes('/@mui/')) return 'vendor-mui'
          if (id.includes('/recharts') || id.includes('/d3-')) return 'vendor-charts'
          if (id.includes('/axios/')) return 'vendor-axios'
          return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 750,
  },
})
