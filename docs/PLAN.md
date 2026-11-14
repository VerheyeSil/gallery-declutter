# Gallery Declutter: Plan

An Android app for cleaning up a messy photo gallery. You swipe through photos
to keep or delete them, sort them into albums with minimal effort, and browse
the result as a timeline. Everything runs on the phone, with no server and no
uploads.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Platform | Android first | It's the phone I use. Expo keeps iOS possible later. |
| Stack | React Native + Expo (TypeScript) | One codebase, fast testing with Expo Go, and `expo-media-library` covers listing, metadata, deleting and albums. |
| Scope | Start with what's **on the phone**. Old Google Photos cloud library next, PC photos later. | Lets us start right away. The app can only see photos stored on the device (see Phase 0). |
| PC | Later. No desktop app, just a one-off **gather script** that moves PC photos onto the phone. | The phone becomes the single source of truth. |
| Automation | The app *suggests*, and the user always decides | Nothing is deleted or filed without a swipe or tap. |
| Deleting | Collected in a "to delete" pile, then confirmed in one batch | Deleting is **permanent** after Android's confirmation dialog (there's no trash), so the in-app review step is the safety net. |
| Privacy | Fully on-device | Photos never leave the phone, so a public repo is fine. |
| Progress | Every handled photo is saved by ID with a timestamp, plus the time of the last visit | You never review a photo twice. Old photos imported later (e.g. from Google Photos) still show up, which a single "reviewed up to" date would miss. |
| Albums on Android | An album is a folder (`Pictures/<name>`). Photos are **moved**, not copied. | No duplicate files. WhatsApp chats may no longer show photos that were moved out of the WhatsApp folder. |

## Phase 0: Gather everything on the phone (in steps, not a blocker)

**Order:** (a) photos already on the phone, which the app can use right away →
(b) the old Google Photos cloud library → (c) PC photos.

**Limitation:** the app reads Android's on-device media store. Photos that exist
only in the Google Photos cloud are invisible to it, and since 2025 Google's
Photos API no longer lets apps read your whole library. Cloud-only photos
therefore have to be **downloaded to the phone** first, either with Google
Takeout (best for many photos) or with "Download" in the Google Photos app for
small batches.

Photos are currently spread over three sources:

1. **WhatsApp**, the biggest source, already on the phone (`Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images`).
2. **Google Photos (old library)**: download it with [Google Takeout](https://takeout.google.com).
3. **PC folders**.

Problems the gather step has to handle:

- **WhatsApp strips EXIF.** The real date only survives in the filename
  (`IMG-20240512-WA0003.jpg`). Without it, every photo looks like it was taken
  on the day it was copied.
- **Takeout puts dates in sidecar `.json` files** (`photoTakenTime`), and file
  timestamps become the download date.
- **Duplicates across sources**: the same photo is often in WhatsApp, Google
  Photos *and* on the PC.

Plan: a small **Python script on the PC** (`tools/gather/`) that:

1. Scans the PC folders and the unzipped Takeout export.
2. Works out the real "taken" date for each file (EXIF → Takeout JSON → filename pattern → file date).
3. Writes that date into EXIF (or at least the file modified time) so the phone sorts it correctly.
4. Removes exact duplicates (by hash) and reports near-duplicates.
5. Outputs one clean folder to copy to the phone over USB, for example into `Pictures/Imported`.

WhatsApp photos already on the phone get their dates fixed in the app itself,
by parsing the filename.

## Phase 1: MVP swipe deck ✅ built

- Ask for photo access (`expo-media-library`).
- **Queues**: "Screenshots", "WhatsApp", "Everything", each oldest-first or per month.
- **Swipe deck**:
  - → right: **keep**
  - ← left: **delete** (into the pending pile)
  - ↑ up: **add to album** (Phase 3)
  - Undo button
- **Review & delete** screen: a grid of the pending pile, deselect any photo, then one batch delete.
- Remember which photos were already reviewed, so they don't come back (local storage / SQLite).
- Progress counter ("1,240 of 8,512 reviewed · 3.1 GB freed").

## Phase 2: Smarter trash detection

Automatic queues of likely trash:

- Screenshots (`Screenshots` folder/bucket)
- WhatsApp junk: memes, stickers, forwarded images (heuristics: no EXIF, typical sizes, received in groups)
- Exact and near-duplicates (perceptual hash), and bursts: keep the sharpest one
- Blurry or very dark photos (sharpness/brightness score)
- Photos of documents, receipts and whiteboards (on-device ML Kit labels)

## Phase 3: Albums ✅ built (swipe-up picker + event suggestions, time-based)

1. **Swipe up → quick album picker**: recent albums as chips, plus "New album…".
2. **Suggested events**: cluster photos by time (and GPS when available) into
   events like "Barcelona · 12–16 Mar 2025" or "Sat 4 May 2024". You accept,
   rename, merge or skip each one with a tap, and it becomes a real album.
3. Later: themed suggestions from on-device labels (food, pets, documents…).

Note: WhatsApp photos have no GPS, so their events are grouped by time only.

## Phase 4: Timeline & map

- Scrollable timeline of events → months → years
- Map view for photos that have GPS
- "On this day"

## Open questions

- Should photos that were kept be moved/copied into albums, or only tagged?
  (Moving on Android changes folders, which other apps can see.)
- Should the pending pile be batched per session or kept across sessions?
