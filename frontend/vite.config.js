import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Mengizinkan semua domain trycloudflare.com
    allowedHosts: ['.trycloudflare.com']
  }
})
