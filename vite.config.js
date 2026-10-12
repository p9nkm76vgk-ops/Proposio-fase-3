import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite se usa para desarrollar (npm run dev): recarga la página al guardar cambios.
// Páginas de desarrollo: dev.html (editor) y ver-dev.html?p=... (vista del cliente).
// Las versiones publicables (app.html y ver.html) las genera build.mjs.
export default defineConfig({
  plugins: [react()],
  server: { open: '/dev.html' },
})
