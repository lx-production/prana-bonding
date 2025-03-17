import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // Only compress files larger than 10KB
      deleteOriginFile: false, // Keep the original uncompressed file
      compressionOptions: { level: 9 }, // Maximum compression level
    })
  ],
  base: '/stake/',
})
