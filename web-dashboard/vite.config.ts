// SPDX-License-Identifier: MIT
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      // Bind to all interfaces so other machines on the same network
      // (e.g. KRP phones on the same Wi-Fi, or the 10.42.0.x hotspot range)
      // can reach the dev server at http://<your-ip>:5173/
      // Override with: npm run dev -- --host 10.42.0.1   (specific IP only)
      host: true,
      port: 5173,
      proxy: {
        // In dev, forward /api → backend (avoids CORS, mirrors prod nginx layout)
        '/api': {
          target: env.VITE_API_BASE || 'http://localhost:8080',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      target: 'es2020',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            recharts: ['recharts'],
            leaflet: ['leaflet', 'react-leaflet'],
          },
        },
      },
    },
  };
});
