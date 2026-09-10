import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Root backend tanpa /api — target proxy media (cth: https://xxx.ngrok-free.dev)
  const apiRoot = (env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '')

  return {
    plugins: [react()],
    server: {
      // Tunnel dev: trycloudflare, loca.lt, ngrok (request API bypass interstitial
      // via header ngrok-skip-browser-warning di src/api/client.js)
      allowedHosts: ['.trycloudflare.com', '.loca.lt', '.ngrok-free.dev', '.ngrok.io', '.ngrok.app'],
      // /uploads diproxy same-origin: <img>/<audio> tak bisa kirim custom header,
      // jadi request langsung ke ngrok kena interstitial HTML → ORB block.
      // Lewat proxy, header skip disuntik server-side (node, bukan browser).
      // Prod tak terpengaruh (proxy hanya ada di vite dev; helper di bawah
      // hanya rewrite saat DEV).
      proxy: {
        '/uploads': {
          target: apiRoot,
          changeOrigin: true,
          headers: { 'ngrok-skip-browser-warning': 'true' },
        },
      },
    },
  }
})
