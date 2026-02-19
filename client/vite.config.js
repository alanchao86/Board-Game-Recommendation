import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
const basePath = process.env.VITE_BASE_PATH || "/recommendweb/"

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  base: basePath
})
