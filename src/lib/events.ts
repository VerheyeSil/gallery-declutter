// Groups photos into "events": runs of photos taken close together in time.
// A new event starts whenever there's a long enough gap between two photos.

export type Timed = { id: string; takenAt: number };

export type PhotoEvent<T extends Timed> = {
  /** Stable key (id of the first photo), used to remember skipped events. */
  key: string;
  start: number;
  end: number;
  photos: T[];
};

export type ClusterOptions = {
  /** Gap that splits two events. Default: 6 hours. */
  gapMs?: number;
  /** Smaller groups aren't suggested as albums. Default: 5. */
  minSize?: number;
};

export function clusterEvents<T extends Timed>(photos: T[], options: ClusterOptions = {}): PhotoEvent<T>[] {
  const gapMs = options.gapMs ?? 6 * 60 * 60 * 1000;
  const minSize = options.minSize ?? 5;

  const sorted = photos.filter((p) => p.takenAt > 0).sort((a, b) => a.takenAt - b.takenAt);
  const groups: T[][] = [];
  let current: T[] = [];
  for (const photo of sorted) {
    const last = current[current.length - 1];
    if (last && photo.takenAt - last.takenAt > gapMs) {
      groups.push(current);
      current = [];
    }
    current.push(photo);
  }
  if (current.length) groups.push(current);

  return groups
    .filter((g) => g.length >= minSize)
    .map((g) => ({ key: g[0].id, start: g[0].takenAt, end: g[g.length - 1].takenAt, photos: g }))
    .reverse(); // newest first
}
