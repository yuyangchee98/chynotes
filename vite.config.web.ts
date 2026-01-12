import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Plugin to serve index-web.html as the default page
function serveWebHtml(): Plugin {
  return {
    name: 'serve-web-html',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/' || req.url === '/index.html') {
          const webHtmlPath = path.resolve(__dirname, 'index-web.html')
          const html = fs.readFileSync(webHtmlPath, 'utf-8')
          server.transformIndexHtml('/', html).then((transformed) => {
            res.setHeader('Content-Type', 'text/html')
            res.end(transformed)
          })
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), serveWebHtml()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: '/',
  server: {
    port: 5189,
    host: true,
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
