import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
    const env = { ...loadEnv(mode, process.cwd(), ''), ...loadEnv(mode, process.cwd(), 'VITE_') };
    const analyzeBundle = process.env.ANALYZE === 'true';
    return {
      envDir: path.resolve(__dirname),
      appType: 'spa',
      server: {
        port: 3000,
        host: '0.0.0.0',
        headers: {
          'Cache-Control': 'no-store',
        },
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
          manifest: {
            name: 'SafeSphere',
            short_name: 'SafeSphere',
            description: 'Disaster Preparedness and Emergency Response',
            start_url: '/',
            display: 'standalone',
            orientation: 'portrait-primary',
            theme_color: '#1d4ed8',
            background_color: '#f8fafc',
            categories: ['safety', 'emergency', 'utilities'],
            icons: [
              { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
              { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
              { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            cleanupOutdatedCaches: true,
          },
          devOptions: { enabled: false },
        }),
        ...(analyzeBundle
          ? [
              visualizer({
                open: true,
                gzipSize: true,
                brotliSize: true,
                filename: 'dist/stats.html',
              }),
            ]
          : []),
      ],
      define: {
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY ?? '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
        }
      },
      test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: './vitest.setup.ts',
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        coverage: {
          provider: 'istanbul',
          reporter: ['text', 'json', 'html'],
        },
      },
    };
});
