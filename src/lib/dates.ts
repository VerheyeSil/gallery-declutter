// Working out when a photo was really taken.
//
// WhatsApp strips EXIF, so the media store often has no "date taken" for
// WhatsApp images. The file's modified time is then just the time it was
// received or copied. The filename (IMG-20240512-WA0003.jpg) still holds the
// real day, so we prefer it whenever the media store has nothing better.

const DAY_MS = 24 * 60 * 60 * 1000;

// Patterns are tried in order. Groups: year, month, day, [hour, minute, second].
const FILENAME_PATTERNS: RegExp[] = [
  // WhatsApp: IMG-20240512-WA0003.jpg, VID-20240512-WA0001.mp4
  /(?:IMG|VID)-(\d{4})(\d{2})(\d{2})-WA\d+/i,
  // Screenshots: Screenshot_20240512-142233.png, Screenshot_2024-05-12-14-22-33-123_com.app.png
  /Screenshot_(\d{4})-?(\d{2})-?(\d{2})[-_](\d{2})-?(\d{2})-?(\d{2})/i,
  // Camera: IMG_20240512_142233.jpg, PXL_20240512_142233123.jpg, 20240512_142233.jpg
  /(?:^|[^\d])(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/,
];

/** Parses a date from a filename, in local time. Returns null when nothing plausible is found. */
export function dateFromFilename(filename: string | null | undefined): number | null {
  if (!filename) return null;
  for (const pattern of FILENAME_PATTERNS) {
    const m = filename.match(pattern);
    if (!m) continue;
    const [y, mo, d, h = '0', mi = '0', s = '0'] = m.slice(1);
    const year = Number(y);
    const month = Number(mo);
    const day = Number(d);
    if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) continue;
    const date = new Date(year, month - 1, day, Number(h), Number(mi), Number(s));
    // Rejects overflow like 31 February.
    if (date.getMonth() !== month - 1) continue;
    return date.getTime();
  }
  return null;
}

/**
 * Best guess for when a photo was taken (ms since epoch).
 * Order: media-store date taken (if it agrees with the filename) → filename date
 * → media-store date taken → modified time → 0.
 */
export function takenAt(
  filename: string | null | undefined,
  creationTime: number | null | undefined,
  modificationTime: number | null | undefined,
): number {
  const fromName = dateFromFilename(filename);
  if (fromName !== null) {
    // WhatsApp names only carry the day; a media-store time on (about) that day is more precise.
    if (creationTime && Math.abs(creationTime - fromName) < 1.5 * DAY_MS) return creationTime;
    return fromName;
  }
  return creationTime || modificationTime || 0;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Sat 4 May 2024" */
export function formatDay(ms: number): string {
  const d = new Date(ms);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Sat 4 May 2024", "4–6 May 2024", "28 Apr – 2 May 2024" or "30 Dec 2023 – 2 Jan 2024". */
export function formatRange(startMs: number, endMs: number): string {
  const a = new Date(startMs);
  const b = new Date(endMs);
  const sameYear = a.getFullYear() === b.getFullYear();
  const sameMonth = sameYear && a.getMonth() === b.getMonth();
  if (sameMonth && a.getDate() === b.getDate()) return formatDay(startMs);
  if (sameMonth) return `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  if (sameYear) {
    return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  }
  return `${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}
