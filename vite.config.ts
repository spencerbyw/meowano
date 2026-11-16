import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Which build this is, shown at the bottom of settings: the commit's short hash and
 * date. Falls back to the hosting provider's commit variable (and the build time)
 * if the build machine has no git history.
 */
function buildInfo() {
  try {
    const [hash, date] = execSync('git log -1 --format=%h%n%cI', { encoding: 'utf8' })
      .trim()
      .split('\n')
    return { hash, date }
  } catch {
    const sha = process.env.VERCEL_GIT_COMMIT_SHA
    return { hash: sha ? sha.slice(0, 7) : 'dev', date: new Date().toISOString() }
  }
}
const build = buildInfo()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_HASH__: JSON.stringify(build.hash),
    __BUILD_DATE__: JSON.stringify(build.date),
  },
  build: {
    // VexFlow embeds the Bravura music font (~1 MB). It's cached offline by the PWA.
    chunkSizeWarningLimit: 1200,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Kiano — Purrfect pitch!',
        short_name: 'Kiano',
        description: 'Practice reading notes and chords on the piano staff.',
        theme_color: '#ff7aae',
        background_color: '#fff8f1',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Each device only uses one or two iOS launch screens, so don't precache all 76.
        globIgnores: ['splash/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
})
