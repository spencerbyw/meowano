# Kiano — Purrfect pitch!

A little web app for practicing reading notes, intervals and chords on the piano staff.
Built for phones and tablets on the music stand; installable as a PWA.

## Development

```bash
npm install
npm run dev        # start the dev server
npm run build      # typecheck + production build
npm run lint       # oxlint
npm run format     # prettier
```

## Layout

- `src/music/` — theory helpers, ranges, question generator, answer formatting
- `src/settings/` — settings types, presets, persisted store, theme hook
- `src/components/` — UI components (VexFlow staff, footer, …)
- `src/i18n/` — i18next setup and English strings
- `src/styles/` — design tokens and global styles

App icons are generated from `public/favicon.svg` with `npm run pwa-assets`.
