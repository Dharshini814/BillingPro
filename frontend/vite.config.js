import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Vaultly — Subscription Billing',
        short_name: 'Vaultly',
        description: 'Subscription billing & payment management platform',
        theme_color: '#D4A800',
        background_color: '#E8ECF3',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        screenshots: [
          { src: '/icons/screenshot-wide.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'Dashboard' },
          { src: '/icons/screenshot-narrow.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Mobile view' }
        ],
        categories: ['finance', 'business', 'productivity'],
        shortcuts: [
          { name: 'Dashboard', short_name: 'Dashboard', description: 'View subscription dashboard', url: '/', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Invoices',  short_name: 'Invoices',  description: 'Manage invoices',             url: '/invoices',  icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Customers', short_name: 'Customers', description: 'View customers',              url: '/customers', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache API responses for dashboard (stale-while-revalidate)
            urlPattern: /^https?:\/\/.*\/dashboard\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-dashboard',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 5 },
            }
          },
          {
            // Cache all other API calls with NetworkFirst
            urlPattern: /^https?:\/\/.*\/(customers|invoices|payments|plans|subscriptions|audit-logs).*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-data',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
              networkTimeoutSeconds: 10,
            }
          },
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          },
          {
            // Cache QR code images
            urlPattern: /^https:\/\/api\.qrserver\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'qr-codes', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 } }
          }
        ]
      },
      devOptions: { enabled: true }
    })
  ],
  server: {
    port: 5173,
    host: true,      // exposes on local network (0.0.0.0)
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
