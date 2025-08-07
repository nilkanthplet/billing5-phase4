import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    envDir: './',
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'date-fns', 'html2pdf.js'],
      exclude: ['lucide-react']
    },
    build: {
      commonjsOptions: {
        include: [/node_modules/],
      },
    },
    server: {
      watch: {
        usePolling: true
      }
    }
  };
});
