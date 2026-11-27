import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Public URL of the deployed site — fills %VITE_SITE_URL% in index.html (canonical, og:url, og:image, JSON-LD).
process.env.VITE_SITE_URL ??= 'https://www.godot.sk/ashop';

export default defineConfig(() => {
  // BASE_PATH=/ashop serves the whole app from a subdirectory (default: domain root).
  const base = (process.env.BASE_PATH || '').replace(/\/+$/, '') + '/';
  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
