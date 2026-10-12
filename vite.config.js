import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite se usa para desarrollar (npm run dev): recarga la página al guardar cambios.
// La página de desarrollo es dev.html. La versión publicable (index.html) la genera build.mjs.
export default defineConfig({
  plugins: [react()],
  server: { open: '/dev.html' },
})
