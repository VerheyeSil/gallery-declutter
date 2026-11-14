// Which photos go into which swipe queue.

export type Photo = {
  /** Android content URI, e.g. content://media/external/images/media/123. Also usable as image source. */
  id: string;
  filename: string;
  /** Folder ("album" on Android) the photo lives in, e.g. "WhatsApp Images", "Camera". */
  folder: string;
  takenAt: number;
  /** When the file last changed on this phone; roughly when it arrived. */
  modifiedAt: number;
};

export type QueueId = 'new' | 'screenshots' | 'whatsapp' | 'camera' | 'all';

export const QUEUES: { id: QueueId; title: string; subtitle: string }[] = [
  { id: 'new', title: 'New since last visit', subtitle: 'Photos that arrived since you last opened the app' },
  { id: 'screenshots', title: 'Screenshots', subtitle: 'Usually the quickest wins' },
  { id: 'whatsapp', title: 'WhatsApp', subtitle: 'Memes, forwards and everything people sent you' },
  { id: 'camera', title: 'Camera', subtitle: 'Photos you took yourself' },
  { id: 'all', title: 'Everything', subtitle: 'All photos, oldest first' },
];

export const isScreenshot = (p: Photo) => /screenshot/i.test(p.folder) || /^screenshot/i.test(p.filename);
export const isWhatsApp = (p: Photo) => /whatsapp/i.test(p.folder) || /-WA\d+/i.test(p.filename);
export const isCamera = (p: Photo) => /^camera$/i.test(p.folder);

/**
 * Folders photos arrive in by default. Photos in any other folder are already
 * in an album, so the album maker doesn't suggest them again.
 */
const UNSORTED_FOLDERS = /^(camera|whatsapp.*|download|downloads|pictures|dcim|images|screenshots|imported|)$/i;
export const isUnsortedFolder = (folder: string) => UNSORTED_FOLDERS.test(folder.trim());

export function inQueue(queue: QueueId, photo: Photo, lastVisitAt: number | null): boolean {
  switch (queue) {
    case 'new':
      return lastVisitAt !== null && photo.modifiedAt > lastVisitAt;
    case 'screenshots':
      return isScreenshot(photo);
    case 'whatsapp':
      return isWhatsApp(photo);
    case 'camera':
      return isCamera(photo);
    case 'all':
      return true;
  }
}

/** Photos for a queue, oldest first. */
export function buildQueue(queue: QueueId, photos: Photo[], lastVisitAt: number | null): Photo[] {
  return photos.filter((p) => inQueue(queue, p, lastVisitAt)).sort((a, b) => a.takenAt - b.takenAt);
}
