# Working on Do.T

- **Claude** leads: architecture, code, reviews, direction.
- **GPT** assists with UI polish and artwork.

## Rules
- Mobile-first (390×844). Test on Android WebView and iOS WKWebView behaviour, not only desktop Chrome.
- Theme tokens live in `src/styles.css` (`bg`, `gold`, `gold-light`, `live`…). Don't hard-code new colours.
- Icons: add to `src/components/icons.tsx` (24px grid, 1.6 stroke).
- No third-party logos, posters or key art in our own designs. Generated art only (`Poster`, `Skyline`, `StationArt`, `ChannelArt`).
  Exception: podcast cover art from each show's public feed, shown next to that show (standard podcast-directory use).
- Only add streams that are public and cross-origin playable; keep `catalog.ts` as the single source.
- `npm run build` must pass before pushing; CI builds the Android APK on every push to `main`.
