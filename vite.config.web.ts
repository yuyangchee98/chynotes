import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: '/',
  server: {
    port: 5189,
    host: true, // Allow access from other devices
  },
  build: {
    outDir: 'dist-web',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index-web.html'),
      },
    },
  },
})
