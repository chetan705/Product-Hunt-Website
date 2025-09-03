import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // Important for Replit
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      },
      '/linkedin-api': {
        target: 'https://api.tryspecter.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/linkedin-api/, '')
      }
    }
  },
  preview: {
    port: 5173,
    host: true // Important for Replit
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  base: './', // Important for Replit deployment
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.[jt]sx?$/,
    exclude: []
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx'
      }
    }
  }
})
