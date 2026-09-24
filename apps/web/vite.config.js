import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

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
        target: 'http://localhost:5001',
        changeOrigin: true,
        xfwd: true,
      },
      '/ws': {
        target: 'ws://localhost:5001',
        ws: true,
        // 不改写 Host：后端 /ws/devtools 握手校验 Origin 与 Host 同源（changeOrigin 会让 Host 变成 5001 而被拒）
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          // 常用 vendor 独立分包，便于浏览器长缓存；页面级依赖由动态 import 自动拆分
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'radix-ui': ['radix-ui'],
          motion: ['motion'],
        },
      },
    },
  },
})
