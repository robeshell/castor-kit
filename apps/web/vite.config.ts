import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Port of the api dev server the proxy forwards to (API_PORT, like the api's PORT, lets a second checkout run beside the first)
const apiPort = process.env.API_PORT || '5001'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
        xfwd: true,
      },
      '/ws': {
        target: `ws://localhost:${apiPort}`,
        ws: true,
        // Don't rewrite Host: the backend /ws/devtools handshake checks that Origin and Host are same-origin (changeOrigin would make Host the api port and get rejected)
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          // Split common vendors into their own chunks for long-term browser caching; page-level dependencies are split automatically via dynamic import
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'radix-ui': ['radix-ui'],
          motion: ['motion'],
        },
      },
    },
  },
})
