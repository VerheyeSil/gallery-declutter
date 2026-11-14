import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateFromFilename, takenAt, formatRange } from '../src/lib/dates.ts';
import { clusterEvents } from '../src/lib/events.ts';
import { buildQueue, isUnsortedFolder, type Photo } from '../src/lib/queues.ts';

const local = (y: number, m: number, d: number, h = 0, mi = 0, s = 0) => new Date(y, m - 1, d, h, mi, s).getTime();
const HOUR = 3600_000;

test('parses WhatsApp, screenshot and camera filenames', () => {
  assert.equal(dateFromFilename('IMG-20240512-WA0003.jpg'), local(2024, 5, 12));
  assert.equal(dateFromFilename('Screenshot_20240512-142233.png'), local(2024, 5, 12, 14, 22, 33));
  assert.equal(dateFromFilename('Screenshot_2024-05-12-14-22-33-123_com.whatsapp.jpg'), local(2024, 5, 12, 14, 22, 33));
  assert.equal(dateFromFilename('PXL_20240512_142233123.jpg'), local(2024, 5, 12, 14, 22, 33));
  assert.equal(dateFromFilename('IMG_20240512_142233.jpg'), local(2024, 5, 12, 14, 22, 33));
});

test('rejects filenames without a plausible date', () => {
  assert.equal(dateFromFilename('holiday.jpg'), null);
  assert.equal(dateFromFilename('IMG-20240231-WA0001.jpg'), null); // 31 Feb
  assert.equal(dateFromFilename(null), null);
});

test('takenAt prefers the WhatsApp filename over a later received time', () => {
  const copiedLater = local(2026, 11, 1);
  assert.equal(takenAt('IMG-20240512-WA0003.jpg', null, copiedLater), local(2024, 5, 12));
  assert.equal(takenAt('IMG-20240512-WA0003.jpg', copiedLater, copiedLater), local(2024, 5, 12));
  // Media-store time on the same day is more precise, so it wins.
  assert.equal(takenAt('IMG-20240512-WA0003.jpg', local(2024, 5, 12, 18), null), local(2024, 5, 12, 18));
  assert.equal(takenAt('photo.jpg', null, 1234), 1234);
});

test('formats date ranges', () => {
  assert.equal(formatRange(local(2024, 5, 4, 10), local(2024, 5, 4, 20)), 'Sat 4 May 2024');
  assert.equal(formatRange(local(2024, 5, 4), local(2024, 5, 6)), '4–6 May 2024');
  assert.equal(formatRange(local(2024, 4, 28), local(2024, 5, 2)), '28 Apr – 2 May 2024');
  assert.equal(formatRange(local(2023, 12, 30), local(2024, 1, 2)), '30 Dec 2023 – 2 Jan 2024');
});

test('clusters photos into events split by time gaps', () => {
  const t0 = local(2024, 5, 4, 10);
  const photos = [
    ...Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, takenAt: t0 + i * HOUR })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: `b${i}`, takenAt: t0 + 48 * HOUR + i * HOUR })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, takenAt: t0 + 96 * HOUR + i * HOUR })),
    { id: 'undated', takenAt: 0 },
  ];
  const events = clusterEvents(photos);
  assert.deepEqual(events.map((e) => e.key), ['c0', 'a0']); // newest first, small group dropped
  assert.equal(events[1].photos.length, 6);
  assert.equal(events[1].end, t0 + 5 * HOUR);
});

test('builds queues oldest first', () => {
  const p = (id: string, folder: string, takenAt: number, modifiedAt = takenAt): Photo => ({
    id, filename: `${id}.jpg`, folder, takenAt, modifiedAt,
  });
  const photos = [p('s2', 'Screenshots', 20), p('w', 'WhatsApp Images', 5, 500), p('s1', 'Screenshots', 10)];
  assert.deepEqual(buildQueue('screenshots', photos, null).map((x) => x.id), ['s1', 's2']);
  assert.deepEqual(buildQueue('new', photos, 100).map((x) => x.id), ['w']);
  assert.deepEqual(buildQueue('new', photos, null), []);
});

test('recognises unsorted folders', () => {
  assert.ok(isUnsortedFolder('Camera'));
  assert.ok(isUnsortedFolder('WhatsApp Images'));
  assert.ok(!isUnsortedFolder('Barcelona 2025'));
});
