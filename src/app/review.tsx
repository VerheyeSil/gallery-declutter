import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, SectionList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Photo } from '../lib/queues';
import { useLibrary } from '../state/library';
import { colors } from '../theme';

const COLUMNS = 4;
const GAP = 4;

type Tab = 'delete' | 'albums';

export default function Review() {
  const { photos, saved, unmarkDelete, unassignAlbum, applyDeletes, applyAlbums } = useLibrary();
  const [tab, setTab] = useState<Tab>('delete');
  const [busy, setBusy] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tile = (width - 32 - GAP * (COLUMNS - 1)) / COLUMNS;

  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const toDelete = useMemo(
    () => Object.keys(saved.pendingDelete).map((id) => byId.get(id)).filter((p): p is Photo => !!p),
    [saved.pendingDelete, byId],
  );
  const albumSections = useMemo(() => {
    const groups = new Map<string, Photo[]>();
    for (const [id, album] of Object.entries(saved.pendingAlbum)) {
      const photo = byId.get(id);
      if (photo) groups.set(album, [...(groups.get(album) ?? []), photo]);
    }
    return [...groups.entries()].map(([album, list]) => ({
      title: album,
      count: list.length,
      data: chunk(list.sort((a, b) => a.takenAt - b.takenAt), COLUMNS),
    }));
  }, [saved.pendingAlbum, byId]);
  const albumPhotoCount = albumSections.reduce((n, s) => n + s.count, 0);

  const run = async (what: Tab) => {
    setBusy(true);
    try {
      const n = what === 'delete' ? await applyDeletes() : await applyAlbums();
      Alert.alert('Done', what === 'delete' ? `Deleted ${n} photos.` : `Moved ${n} photos into albums.`);
    } catch (e) {
      // Usually: you tapped "Deny" on Android's confirmation dialog.
      Alert.alert('Not applied', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const renderTile = (photo: Photo, onPress: () => void) => (
    <Pressable key={photo.id} onPress={onPress} style={{ width: tile, height: tile }}>
      <Image source={{ uri: photo.id }} style={styles.tile} contentFit="cover" recyclingKey={photo.id} />
    </Pressable>
  );

  return (
    <View style={[styles.page, { paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.tabs}>
        <TabButton active={tab === 'delete'} onPress={() => setTab('delete')} label={`To delete (${toDelete.length})`} />
        <TabButton active={tab === 'albums'} onPress={() => setTab('albums')} label={`To albums (${albumPhotoCount})`} />
      </View>

      {tab === 'delete' ? (
        <>
          <Text style={styles.hint}>Tap a photo to keep it after all. Deleting is permanent once you confirm.</Text>
          <FlatList
            data={toDelete}
            keyExtractor={(p) => p.id}
            numColumns={COLUMNS}
            columnWrapperStyle={{ gap: GAP }}
            contentContainerStyle={{ gap: GAP, paddingHorizontal: 16 }}
            renderItem={({ item }) => renderTile(item, () => unmarkDelete(item.id))}
            ListEmptyComponent={<Text style={styles.empty}>Nothing marked for deletion.</Text>}
          />
          <ApplyButton
            disabled={busy || toDelete.length === 0}
            busy={busy}
            color={colors.delete}
            label={`Delete ${toDelete.length} photos`}
            onPress={() => run('delete')}
          />
        </>
      ) : (
        <>
          <Text style={styles.hint}>
            Photos are moved into Pictures/&lt;album&gt;. Tap a photo to take it out of the album.
          </Text>
          <SectionList
            sections={albumSections}
            keyExtractor={(row) => row[0].id}
            contentContainerStyle={{ paddingHorizontal: 16, gap: GAP }}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionHeader}>
                {section.title} <Text style={styles.sectionCount}>· {section.count}</Text>
              </Text>
            )}
            renderItem={({ item: row }) => (
              <View style={{ flexDirection: 'row', gap: GAP }}>{row.map((p) => renderTile(p, () => unassignAlbum(p.id)))}</View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No photos waiting for an album.</Text>}
          />
          <ApplyButton
            disabled={busy || albumPhotoCount === 0}
            busy={busy}
            color={colors.album}
            label={`Move ${albumPhotoCount} photos into ${albumSections.length} albums`}
            onPress={() => run('albums')}
          />
        </>
      )}
    </View>
  );
}

function chunk<T>(list: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < list.length; i += size) rows.push(list.slice(i, i + size));
  return rows;
}

function TabButton(props: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress} style={[styles.tab, props.active && styles.tabActive]}>
      <Text style={[styles.tabText, props.active && styles.tabTextActive]}>{props.label}</Text>
    </Pressable>
  );
}

function ApplyButton(props: { label: string; color: string; disabled: boolean; busy: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={[styles.apply, { backgroundColor: props.color }, props.disabled && { opacity: 0.4 }]}
    >
      {props.busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.applyText}>{props.label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, gap: 10 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: colors.cardAlt },
  tabText: { color: colors.muted, fontWeight: '600' },
  tabTextActive: { color: colors.text },
  hint: { color: colors.muted, fontSize: 13, paddingHorizontal: 16 },
  tile: { flex: 1, borderRadius: 6, backgroundColor: colors.card },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 48 },
  sectionHeader: { color: colors.text, fontSize: 16, fontWeight: '700', paddingTop: 12, paddingBottom: 6, backgroundColor: colors.bg },
  sectionCount: { color: colors.muted, fontWeight: '400' },
  apply: { marginHorizontal: 16, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  applyText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
