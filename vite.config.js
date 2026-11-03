import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      // 避免 Service Worker 攔截 /api，導致 POST 收據辨識回傳 HTML 或失敗
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/*.woff', '**/*-cyrillic*.woff2', '**/*-vietnamese*.woff2'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: '旅遊手帳',
        short_name: '旅遊手帳',
        description: '旅途中記帳、掃描收據、整理回憶的旅遊筆記',
        theme_color: '#1F3A68',
        background_color: '#FBF8F1',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    open: true,
    proxy: {
      // 與 Vercel 同源代理一致：本地 dev 可更新匯率（見 api/exchange-rates.js）
      '/api/exchange-rates': {
        target: 'https://api.frankfurter.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/exchange-rates/, '/latest'),
      },
    },
  },
});
