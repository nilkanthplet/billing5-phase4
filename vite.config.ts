import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'date-fns'],
    exclude: ['lucide-react']
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['lucide-react', 'framer-motion'],
          supabase: ['@supabase/supabase-js'],
          utils: ['date-fns']
        }
      }
    }
  },
  server: {
    watch: {
      usePolling: true
    }
  }
});