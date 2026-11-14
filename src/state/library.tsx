// App-wide state: the photo library on the phone, plus everything you've
// decided about it. Decisions are saved on the phone so you never review
// the same photo twice.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Album, Asset, AssetField, MediaType, Query, requestPermissionsAsync, type PermissionResponse } from 'expo-media-library';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { takenAt } from '../lib/dates';
import type { Photo } from '../lib/queues';

const STORAGE_KEY = 'gallery-declutter/state/v1';

export type Saved = {
  /** Photos you've finished with (kept or put in an album) → when you did it. Never shown again. */
  reviewed: Record<string, number>;
  /** Photos marked for deletion → when. Deleted for real from the Review screen. */
  pendingDelete: Record<string, number>;
  /** Photos waiting to be moved into an album → album name. */
  pendingAlbum: Record<string, string>;
  /** Albums made with this app (shown first in the album picker). */
  myAlbums: string[];
  /** Event suggestions you skipped (event key → when). */
  skippedEvents: Record<string, number>;
  /** When the app was opened before the current visit ("new since last visit" uses this). */
  lastVisitAt: number | null;
  /** When the current visit started; becomes lastVisitAt on the next launch. */
  openedAt: number | null;
};

const EMPTY: Saved = {
  reviewed: {},
  pendingDelete: {},
  pendingAlbum: {},
  myAlbums: [],
  skippedEvents: {},
  lastVisitAt: null,
  openedAt: null,
};

/** One photo's saved state, for undo. */
export type PhotoSnapshot = { reviewed?: number; pendingDelete?: number; pendingAlbum?: string };

type Status = 'loading' | 'no-permission' | 'ready' | 'error';

type LibraryContext = {
  status: Status;
  error: string | null;
  limitedAccess: boolean;
  photos: Photo[];
  /** Existing folders on the phone, for the album picker. */
  deviceAlbums: string[];
  saved: Saved;
  isHandled: (id: string) => boolean;
  keep: (id: string) => void;
  markDelete: (id: string) => void;
  assignAlbum: (ids: string[], album: string) => void;
  snapshot: (id: string) => PhotoSnapshot;
  restore: (id: string, snap: PhotoSnapshot) => void;
  unmarkDelete: (id: string) => void;
  unassignAlbum: (id: string) => void;
  skipEvent: (key: string) => void;
  applyDeletes: () => Promise<number>;
  applyAlbums: () => Promise<number>;
  reload: () => Promise<void>;
  requestAccess: () => Promise<void>;
};

const Ctx = createContext<LibraryContext | null>(null);

export function useLibrary(): LibraryContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return ctx;
}

function without<T>(record: Record<string, T>, ids: Iterable<string>): Record<string, T> {
  const next = { ...record };
  for (const id of ids) delete next[id];
  return next;
}

async function loadPhotos(): Promise<{ photos: Photo[]; albums: string[] }> {
  const metas = await new Query().eq(AssetField.MEDIA_TYPE, MediaType.IMAGE).exeForMetadata();

  // Android stores each photo in exactly one folder ("album"); look up which.
  const folderOf = new Map<string, string>();
  const albumTitles: string[] = [];
  for (const album of await Album.getAll()) {
    const title = await album.getTitle();
    albumTitles.push(title);
    const inAlbum = await new Query().album(album).eq(AssetField.MEDIA_TYPE, MediaType.IMAGE).exeForMetadata();
    for (const m of inAlbum) folderOf.set(String(m.id), title);
  }

  const photos = metas.map((m) => {
    const id = String(m.id);
    const filename = m.filename ?? '';
    return {
      id,
      filename,
      folder: folderOf.get(id) ?? '',
      takenAt: takenAt(filename, m.creationTime, m.modificationTime),
      modifiedAt: m.modificationTime ?? 0,
    };
  });
  return { photos, albums: [...new Set(albumTitles)].sort((a, b) => a.localeCompare(b)) };
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [limitedAccess, setLimitedAccess] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [deviceAlbums, setDeviceAlbums] = useState<string[]>([]);
  const [saved, setSaved] = useState<Saved>(EMPTY);
  const savedLoaded = useRef(false);
  const [savedReady, setSavedReady] = useState(false);

  // Load saved decisions once, and record this visit.
  useEffect(() => {
    (async () => {
      let restored = EMPTY;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) restored = { ...EMPTY, ...JSON.parse(raw) };
      } catch (e) {
        console.warn('Could not read saved progress', e);
      }
      setSaved({ ...restored, lastVisitAt: restored.openedAt ?? restored.lastVisitAt, openedAt: Date.now() });
      savedLoaded.current = true;
      setSavedReady(true);
    })();
  }, []);

  // Save decisions shortly after every change.
  useEffect(() => {
    if (!savedLoaded.current) return;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved)).catch((e) => console.warn('Could not save progress', e));
    }, 300);
    return () => clearTimeout(timer);
  }, [saved]);

  const reload = useCallback(async () => {
    try {
      const { photos: loaded, albums } = await loadPhotos();
      setPhotos(loaded);
      setDeviceAlbums(albums);
      // Forget pending actions for photos that no longer exist (e.g. deleted in another app).
      const existing = new Set(loaded.map((p) => p.id));
      setSaved((s) => ({
        ...s,
        pendingDelete: Object.fromEntries(Object.entries(s.pendingDelete).filter(([id]) => existing.has(id))),
        pendingAlbum: Object.fromEntries(Object.entries(s.pendingAlbum).filter(([id]) => existing.has(id))),
      }));
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, []);

  const onPermission = useCallback(
    async (permission: PermissionResponse) => {
      if (!permission.granted) {
        setStatus('no-permission');
        return;
      }
      setLimitedAccess(permission.accessPrivileges === 'limited');
      await reload();
    },
    [reload],
  );

  const requestAccess = useCallback(async () => {
    setStatus('loading');
    await onPermission(await requestPermissionsAsync(false, ['photo']));
  }, [onPermission]);

  // Ask for photo access (or reuse an earlier grant) when the app starts.
  useEffect(() => {
    requestPermissionsAsync(false, ['photo']).then(onPermission);
  }, [onPermission]);

  const isHandled = useCallback(
    (id: string) => id in saved.reviewed || id in saved.pendingDelete,
    [saved.reviewed, saved.pendingDelete],
  );

  const keep = useCallback((id: string) => {
    setSaved((s) => ({ ...s, reviewed: { ...s.reviewed, [id]: Date.now() } }));
  }, []);

  const markDelete = useCallback((id: string) => {
    setSaved((s) => ({
      ...s,
      reviewed: without(s.reviewed, [id]),
      pendingAlbum: without(s.pendingAlbum, [id]),
      pendingDelete: { ...s.pendingDelete, [id]: Date.now() },
    }));
  }, []);

  const assignAlbum = useCallback((ids: string[], album: string) => {
    const name = album.trim();
    if (!name) return;
    const now = Date.now();
    setSaved((s) => {
      const reviewed = { ...s.reviewed };
      const pendingAlbum = { ...s.pendingAlbum };
      for (const id of ids) {
        reviewed[id] = now;
        pendingAlbum[id] = name;
      }
      return { ...s, reviewed, pendingAlbum, pendingDelete: without(s.pendingDelete, ids) };
    });
  }, []);

  const snapshot = useCallback(
    (id: string): PhotoSnapshot => ({
      reviewed: saved.reviewed[id],
      pendingDelete: saved.pendingDelete[id],
      pendingAlbum: saved.pendingAlbum[id],
    }),
    [saved],
  );

  const restore = useCallback((id: string, snap: PhotoSnapshot) => {
    setSaved((s) => {
      const put = <T,>(record: Record<string, T>, value: T | undefined) =>
        value === undefined ? without(record, [id]) : { ...record, [id]: value };
      return {
        ...s,
        reviewed: put(s.reviewed, snap.reviewed),
        pendingDelete: put(s.pendingDelete, snap.pendingDelete),
        pendingAlbum: put(s.pendingAlbum, snap.pendingAlbum),
      };
    });
  }, []);

  // Taking a photo off the delete list means you want to keep it.
  const unmarkDelete = useCallback((id: string) => {
    setSaved((s) => ({ ...s, pendingDelete: without(s.pendingDelete, [id]), reviewed: { ...s.reviewed, [id]: Date.now() } }));
  }, []);

  const unassignAlbum = useCallback((id: string) => {
    setSaved((s) => ({ ...s, pendingAlbum: without(s.pendingAlbum, [id]) }));
  }, []);

  const skipEvent = useCallback((key: string) => {
    setSaved((s) => ({ ...s, skippedEvents: { ...s.skippedEvents, [key]: Date.now() } }));
  }, []);

  const applyDeletes = useCallback(async () => {
    const ids = Object.keys(saved.pendingDelete);
    if (!ids.length) return 0;
    // Android shows its own "Allow … to delete N items?" dialog. If you
    // decline, this throws and the photos stay on the list.
    await Asset.delete(ids.map((id) => new Asset(id)));
    setSaved((s) => ({ ...s, pendingDelete: without(s.pendingDelete, ids) }));
    await reload();
    return ids.length;
  }, [saved.pendingDelete, reload]);

  const applyAlbums = useCallback(async () => {
    const byAlbum = new Map<string, string[]>();
    for (const [id, name] of Object.entries(saved.pendingAlbum)) {
      byAlbum.set(name, [...(byAlbum.get(name) ?? []), id]);
    }
    let moved = 0;
    try {
      for (const [name, ids] of byAlbum) {
        const assets = ids.map((id) => new Asset(id));
        // Android albums are folders: photos are *moved* into Pictures/<name>.
        const existing = await Album.get(name);
        if (existing) await existing.add(assets);
        else await Album.create(name, assets, true);
        moved += ids.length;
        setSaved((s) => ({
          ...s,
          pendingAlbum: without(s.pendingAlbum, ids),
          myAlbums: s.myAlbums.includes(name) ? s.myAlbums : [name, ...s.myAlbums],
        }));
      }
    } finally {
      await reload();
    }
    return moved;
  }, [saved.pendingAlbum, reload]);

  // Don't show any queue before saved progress is loaded, or reviewed photos would flash by again.
  const effectiveStatus: Status = status === 'ready' && !savedReady ? 'loading' : status;

  const value = useMemo<LibraryContext>(
    () => ({
      status: effectiveStatus, error, limitedAccess, photos, deviceAlbums, saved, isHandled, keep, markDelete, assignAlbum,
      snapshot, restore, unmarkDelete, unassignAlbum, skipEvent, applyDeletes, applyAlbums, reload, requestAccess,
    }),
    [effectiveStatus, error, limitedAccess, photos, deviceAlbums, saved, isHandled, keep, markDelete, assignAlbum,
      snapshot, restore, unmarkDelete, unassignAlbum, skipEvent, applyDeletes, applyAlbums, reload, requestAccess],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
