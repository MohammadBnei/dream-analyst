import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '191388b7caf4.ngrok-free.app'
    ]
  }
})
