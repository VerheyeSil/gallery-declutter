// Album maker: suggests albums from "events", runs of photos taken close
// together in time. Accept, rename or skip each one.

import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AlbumPicker } from '../components/AlbumPicker';
import { formatRange } from '../lib/dates';
import { clusterEvents, type PhotoEvent } from '../lib/events';
import { isScreenshot, isUnsortedFolder, type Photo } from '../lib/queues';
import { useLibrary } from '../state/library';
import { colors } from '../theme';

const COLUMNS = 4;
const GAP = 4;

export default function AlbumMaker() {
  const { photos, saved, assignAlbum, skipEvent } = useLibrary();
  // Photos taken out of an event before making it an album (event key → ids).
  const [excluded, setExcluded] = useState<Record<string, Set<string>>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [picking, setPicking] = useState<PhotoEvent<Photo> | null>(null);

  // Only photos that aren't in an album yet, aren't screenshots and aren't about to be deleted.
  const events = useMemo(() => {
    const candidates = photos.filter(
      (p) =>
        isUnsortedFolder(p.folder) &&
        !isScreenshot(p) &&
        !(p.id in saved.pendingDelete) &&
        !(p.id in saved.pendingAlbum),
    );
    return clusterEvents(candidates).filter((e) => !(e.key in saved.skippedEvents));
  }, [photos, saved.pendingDelete, saved.pendingAlbum, saved.skippedEvents]);

  const included = (event: PhotoEvent<Photo>) => event.photos.filter((p) => !excluded[event.key]?.has(p.id));

  const toggle = (eventKey: string, id: string) => {
    setExcluded((prev) => {
      const set = new Set(prev[eventKey]);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, [eventKey]: set };
    });
  };

  const pick = (album: string) => {
    if (picking) assignAlbum(included(picking).map((p) => p.id), album);
    setPicking(null);
  };

  return (
    <View style={styles.page}>
      <FlatList
        data={events}
        keyExtractor={(e) => e.key}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListHeaderComponent={
          <Text style={styles.intro}>
            Photos grouped by when they were taken. Make an album, or skip. Albums are created when you tap “Review &
            apply” on the home screen.
          </Text>
        }
        ListEmptyComponent={<Text style={styles.empty}>No more suggestions. Everything is sorted!</Text>}
        renderItem={({ item: event }) => (
          <EventCard
            event={event}
            included={included(event).length}
            excluded={excluded[event.key]}
            expanded={expanded === event.key}
            onToggleExpand={() => setExpanded((k) => (k === event.key ? null : event.key))}
            onTogglePhoto={(id) => toggle(event.key, id)}
            onMake={() => setPicking(event)}
            onSkip={() => skipEvent(event.key)}
          />
        )}
      />
      <AlbumPicker
        visible={picking !== null}
        title={picking ? `Album for ${included(picking).length} photos` : undefined}
        suggestedName={picking ? formatRange(picking.start, picking.end) : ''}
        onPick={pick}
        onClose={() => setPicking(null)}
      />
    </View>
  );
}

type EventCardProps = {
  event: PhotoEvent<Photo>;
  included: number;
  excluded: Set<string> | undefined;
  expanded: boolean;
  onToggleExpand: () => void;
  onTogglePhoto: (id: string) => void;
  onMake: () => void;
  onSkip: () => void;
};

function EventCard({ event, included, excluded, expanded, onToggleExpand, onTogglePhoto, onMake, onSkip }: EventCardProps) {
  const { width } = useWindowDimensions();
  const tile = (width - 32 - 24 - GAP * (COLUMNS - 1)) / COLUMNS;
  const shown = expanded ? event.photos : event.photos.slice(0, COLUMNS);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{formatRange(event.start, event.end)}</Text>
      <Text style={styles.sub}>
        {included === event.photos.length ? `${event.photos.length} photos` : `${included} of ${event.photos.length} photos`}
      </Text>
      <View style={styles.grid}>
        {shown.map((p) => {
          const out = excluded?.has(p.id);
          return (
            <Pressable key={p.id} onPress={() => (expanded ? onTogglePhoto(p.id) : onToggleExpand())}>
              <Image
                source={{ uri: p.id }}
                style={[{ width: tile, height: tile }, styles.tile, out && styles.tileOut]}
                contentFit="cover"
                recyclingKey={p.id}
              />
              {out && <Text style={styles.outMark}>✕</Text>}
            </Pressable>
          );
        })}
      </View>
      <Pressable onPress={onToggleExpand}>
        <Text style={styles.link}>{expanded ? 'Collapse' : `Show all ${event.photos.length} & pick which to include`}</Text>
      </Pressable>
      <View style={styles.buttons}>
        <Pressable style={[styles.button, styles.skip]} onPress={onSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.make, included === 0 && { opacity: 0.4 }]} onPress={onMake} disabled={included === 0}>
          <Text style={styles.makeText}>Make album</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  intro: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 48 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 12, gap: 8 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 13, marginTop: -4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { borderRadius: 6, backgroundColor: colors.cardAlt },
  tileOut: { opacity: 0.25 },
  outMark: { position: 'absolute', top: 4, right: 6, color: colors.delete, fontWeight: '800', fontSize: 16 },
  link: { color: colors.accent, fontSize: 14 },
  buttons: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  skip: { backgroundColor: colors.cardAlt },
  skipText: { color: colors.muted, fontWeight: '600' },
  make: { backgroundColor: colors.album },
  makeText: { color: '#fff', fontWeight: '700' },
});
