import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { analyzer } from 'vite-bundle-analyzer'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: process.env.BASE_URL || '/',
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
