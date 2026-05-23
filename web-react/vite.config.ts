import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { analyzer } from 'vite-bundle-analyzer'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: process.env.BASE_URL || '/',
  resolve: {
    alias: {
      // Map server-shared to the actual server/shared/uno.ts for stress test imports
      'server-shared': fileURLToPath(new URL('../server/shared/uno.ts', import.meta.url)),
    },
  },
  server: {
    // Allow serving files from the repo root (for server/shared/ imports)
    fs: {
      allow: ['..'],
    },
  },
  plugins: [
    react({
      // React compiler disabled for debugging
    }),
    mode === 'analyze' &&
      analyzer({
        analyzerMode: 'server',
        openAnalyzer: false,
        reportTitle: 'bundle-stats',
      }),
  ],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'three-vendor': ['three'],
          'r3f-vendor': ['@react-three/fiber'],
          'colyseus-vendor': ['@colyseus/sdk', '@colyseus/react'],
        },
      },
    },
  },
}))
