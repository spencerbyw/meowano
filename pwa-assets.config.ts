import {
  appleSplashScreenSizes,
  createAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
  type AppleDeviceSize,
} from '@vite-pwa/assets-generator/config'

// Launch screens for the installed iOS app: the cat on the app's background colour
// (light and dark), so opening it doesn't flash white. Many devices share a screen
// size, so generate each size once. Skips the 4" iPhone SE, which can't run iOS 16+.
const splashSizes: Record<string, AppleDeviceSize> = {}
for (const size of Object.values(appleSplashScreenSizes) as AppleDeviceSize[]) {
  if (size.width < 750) continue
  splashSizes[`${size.width}x${size.height}`] = size
}

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
    appleSplashScreens: createAppleSplashScreens(
      {
        // The icon is (1 - padding) of the screen's shorter side.
        padding: 0.7,
        // Same as --color-bg in src/styles/tokens.css.
        resizeOptions: { background: '#fff8f1', fit: 'contain' },
        darkResizeOptions: { background: '#1e1a2b', fit: 'contain' },
        linkMediaOptions: { log: true, addMediaScreen: true, basePath: '/' },
        name: (landscape, size, dark) =>
          `splash/${landscape ? 'landscape' : 'portrait'}-${dark ? 'dark' : 'light'}-${size.width}x${size.height}.png`,
      },
      [],
      splashSizes,
    ),
  },
  images: ['public/favicon.svg'],
})
