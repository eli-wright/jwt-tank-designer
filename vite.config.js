import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Change 'jwt-tank-designer' below to match your GitHub repository name
// e.g. if your repo URL is https://github.com/yourname/my-repo → base: '/my-repo/'
export default defineConfig({
  plugins: [react()],
  base: '/jwt-tank-designer/',
})
