import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// favicon.svg already draws its own pink rounded square, so the home-screen icons
// need little or no extra padding (the preset's default 30% shrank the cat).
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // Android crops maskable icons to a circle ~80% wide; 8% keeps the ear tips inside.
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0.08,
      resizeOptions: { background: '#ff7aae' },
    },
    // iOS rounds the corners itself, so fill the whole square.
    apple: {
      ...minimal2023Preset.apple,
      padding: 0,
      resizeOptions: { background: '#ff7aae' },
    },
  },
  images: ['public/favicon.svg'],
})
