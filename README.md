# Gallery Declutter

An Android app for decluttering your photo gallery. You swipe through photos
Tinder-style to keep or delete them, sort them into albums with minimal effort,
and browse everything as a timeline.

Everything runs on your phone, so photos never leave the device.

**Status:** first version: swipe deck + album maker. See [docs/PLAN.md](docs/PLAN.md).

## Features

Built:

- 👉 Swipe right to keep, 👈 left to delete, 👆 up to add to an album, with undo
- Queues: new since last visit, screenshots, WhatsApp, camera, everything
- Remembers every photo you've handled, so you never review one twice
- Review screen: check what will be deleted or moved, then apply in one go
- Album maker: suggests albums from days and trips (photos close together in time)
- Real dates for WhatsApp photos, taken from the filename

Planned:

- Duplicate, burst and blurry-photo detection
- Import of the old Google Photos library (Takeout) with correct dates
- Timeline and map view

## Development

Built with [Expo](https://expo.dev) (React Native + TypeScript, Expo Router).

The app needs full access to the photo library, which Expo Go can't fully
provide on Android, so it runs as its own build:

```bash
npm install
npx eas-cli@latest login                                     # free Expo account
npx eas-cli@latest build -p android --profile preview        # standalone APK, install on your phone
```

For live reloading while developing, build the `development` profile once,
install it, then run `npx expo start --tunnel` and open the project from the app.

```bash
npm run typecheck
npm test            # unit tests for dates, events and queues (node --test)
npx expo lint
```

### Code map

- `src/app/` screens (Expo Router): home, swipe deck, review & apply, album maker
- `src/state/library.tsx` photo library + saved progress (AsyncStorage)
- `src/lib/` pure logic: dates from filenames, event grouping, queues

## License

MIT
