import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/manual-labor/',
  build: { rollupOptions: { output: { manualChunks: id => id.includes('/node_modules/@supabase/') ? 'supabase' : undefined } } },
  server: { allowedHosts: ['terminal.local'] },
});
