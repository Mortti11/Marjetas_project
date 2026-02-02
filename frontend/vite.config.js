import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // During development, proxy API calls to the backend running on port 8000
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          leaflet: ['leaflet', 'react-leaflet'],
          charts: ['chart.js', 'react-chartjs-2'],
          // Add more as needed, e.g. dateFns: ['date-fns']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
