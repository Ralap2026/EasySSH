import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  build: {
    outDir: 'dist-renderer'
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['better-sqlite3', 'ssh2', 'socks-proxy-agent', 'socks']
            }
          }
        }
      },
      preload: {
        input: 'electron/preload.ts',
      },
      renderer: {}
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
