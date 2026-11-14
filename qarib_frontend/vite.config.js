import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'QARIB_DEV_')
  const https = env.QARIB_DEV_HTTPS_CERT && env.QARIB_DEV_HTTPS_KEY
    ? { cert: readFileSync(env.QARIB_DEV_HTTPS_CERT), key: readFileSync(env.QARIB_DEV_HTTPS_KEY) }
    : undefined

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      https,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
    },
  }
})
