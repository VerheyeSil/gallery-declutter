# Gallery Declutter: Plan

An Android app for cleaning up a messy photo gallery: swipe through photos to
keep or delete them, and sort the keepers into albums with minimal effort.

**Local only.** No Google Photos, no cloud accounts, no server. Photos stay on
the phone and sync to the PC over the home network.

## The big picture

Gallery Declutter is deliberately **one focused tool**, not a full gallery app.
It sits in a fully local setup together with existing open-source tools:

```
 Phone                                      PC
┌──────────────────────────┐   Syncthing   ┌──────────────────────────┐
│ Gallery Declutter        │ ◄───────────► │ Photo folders            │
│  · swipe: keep / delete  │  (local Wi-Fi,│  · backup + versioning   │
│  · sort into albums      │   no cloud)   │                          │
│    (= folders)           │               │ Immich (optional)        │
└──────────────────────────┘               │  · timeline, map, faces, │
                                           │    search                │
                                           └──────────────────────────┘
```

- **Gallery Declutter** does what other tools do badly: decluttering fast and
  sorting into albums, tuned to this gallery (mostly WhatsApp).
- **[Syncthing](https://syncthing.net)** keeps phone and PC folders in sync over
  the local network. Android albums are folders, so albums made in the app show
  up as folders on the PC.
- **[Immich](https://immich.app)** (optional, self-hosted on the PC) covers
  timeline, map, face grouping and search. That's why this app won't build its
  own timeline.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Cloud | None. Google Photos is out. | Keep everything local and private. |
| Platform | Android | It's the phone in use. Expo keeps iOS possible later. |
| Stack | React Native + Expo (TypeScript, Expo Router), standalone APK via EAS | Expo Go can't fully access the media library on Android. |
| Scope | A focused declutter + album tool. No gallery, timeline or map. | Those already exist (Immich). Effort goes where nothing good exists. |
| PC sync | Syncthing, not built ourselves | Mature, local, open source. |
| Automation | The app *suggests*, the user always decides | Nothing is deleted or filed without a swipe or tap. |
| Deleting | Collected in a "to delete" pile, then confirmed in one batch | Deleting is **permanent** after Android's confirmation (no trash). The in-app review step, plus Syncthing versioning on the PC, are the safety nets. |
| Progress | Every handled photo is saved by ID with a timestamp, plus the time of the last visit | You never review a photo twice. Old photos imported later still show up, which a single "reviewed up to" date would miss. |
| Albums | An album is a folder (`Pictures/<name>`). Photos are **moved**, not copied. | No duplicate files, and albums sync to the PC as plain folders. WhatsApp chats may no longer show moved photos. |
| Privacy | Fully on-device, public repo | No photo data ever leaves your own devices. |

## Done

### v0.1: Swipe deck + album maker ✅

- Swipe right to keep, left to delete, up to add to an album, with undo
- "Also into <last album>" shortcut button
- Queues: new since last visit, screenshots, WhatsApp, camera, everything (oldest first)
- Progress saved per photo, so photos are never reviewed twice
- Review & apply screen: check deletes and album moves, then apply in one batch
- Album maker: suggests albums from events (photos close together in time); include/exclude photos, rename, or skip
- Real dates for WhatsApp photos from the filename (`IMG-20240512-WA0003.jpg`)

### v0.1.1: Swipe polish ✅

- Fixed black flicker after each swipe (the next card is now pre-loaded underneath instead of rebuilt)
- The photo fills the whole card, with the caption overlaid; landscape photos are shown in full

## Next

### 1. Try it for real (now)

Use it for a week on the WhatsApp backlog. Write down what feels slow or wrong.

### 2. Set up local sync with the PC

No code, just setup (document it in `docs/SYNC.md`):

- Install Syncthing on the PC and Syncthing-Fork on Android.
- Share `DCIM/Camera`, `Pictures` (albums made by the app), and `WhatsApp Images` if wanted.
- **Turn on file versioning on the PC side** ("Staggered" or "Trash Can"), so a
  photo deleted on the phone can still be recovered on the PC.
- Decide the direction per folder: two-way, or phone → PC ("Send Only").

### 3. Smarter trash detection

Extra queues of likely trash, all computed on the phone:

- **Duplicates & bursts**: exact duplicates (hash) and near-duplicates
  (perceptual hash); show them side by side and keep the best one
- **WhatsApp junk**: memes, stickers, forwards (heuristics: image size, no
  camera data, many received at once)
- **Blurry or very dark** photos (sharpness/brightness score)
- **Documents, receipts, whiteboards** (on-device image labels)

### 4. Bring in the other photos

- **Old Google Photos library**: download it once with
  [Google Takeout](https://takeout.google.com), then never use Google Photos again.
  Takeout keeps dates in sidecar `.json` files (`photoTakenTime`) and file dates
  become the download date, so dates need fixing.
- **PC photos**: with Syncthing they can reach the phone, or be decluttered on
  the PC.
- A small **gather script** on the PC (`tools/gather/`): reads Takeout + PC
  folders, fixes dates (EXIF → Takeout JSON → filename → file date), removes
  exact duplicates, and outputs one clean folder that Syncthing sends to the
  phone (`Pictures/Imported`). The app then treats it like any other queue.

### 5. Album maker improvements

- Merge two neighbouring event suggestions
- Use GPS (when present) to split events by place and suggest names with the city
- Themed suggestions from on-device labels (food, pets, documents…)

## Not planned

- **Timeline / map / face grouping / search**: use Immich on the PC.
- **Cloud backup**: Syncthing to the PC (plus your own PC backup) covers it.

## Open questions

- Two-way sync, or phone → PC only? Two-way means deletes on the PC also remove photos on the phone.
- Should WhatsApp photos be moved into albums (out of the WhatsApp folder), or copied instead?
- Export/import of the app's progress, so a reinstall doesn't forget what's reviewed?
