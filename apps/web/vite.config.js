import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@douyinfe/semi-ui/dist/css/semi.min.css': path.resolve(
        __dirname,
        'node_modules/@douyinfe/semi-ui/dist/css/semi.min.css'
      ),
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
        changeOrigin: true,
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
          'semi-ui': ['@douyinfe/semi-ui', '@douyinfe/semi-icons'],
        },
      },
    },
  },
})
