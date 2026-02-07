import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
    const env = { ...loadEnv(mode, process.cwd(), ''), ...loadEnv(mode, process.cwd(), 'VITE_') };
    const analyzeBundle = process.env.ANALYZE === 'true';
    return {
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
