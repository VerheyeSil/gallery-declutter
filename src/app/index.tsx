import { Link } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatDay } from '../lib/dates';
import { QUEUES, inQueue } from '../lib/queues';
import { useLibrary } from '../state/library';
import { colors } from '../theme';

export default function Home() {
  const { status, error, limitedAccess, photos, saved, isHandled, requestAccess } = useLibrary();

  const remaining = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of QUEUES) counts[q.id] = 0;
    for (const p of photos) {
      if (isHandled(p.id)) continue;
      for (const q of QUEUES) if (inQueue(q.id, p, saved.lastVisitAt)) counts[q.id]++;
    }
    return counts;
  }, [photos, isHandled, saved.lastVisitAt]);

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.muted}>Reading your gallery…</Text>
      </View>
    );
  }
  if (status === 'no-permission') {
    return (
      <View style={styles.center}>
        <Text style={styles.h2}>Photo access needed</Text>
        <Text style={styles.muted}>Everything stays on your phone. Nothing is uploaded.</Text>
        <Pressable style={styles.button} onPress={requestAccess}>
          <Text style={styles.buttonText}>Allow access</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openSettings()}>
          <Text style={styles.link}>Open settings</Text>
        </Pressable>
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.h2}>Something went wrong</Text>
        <Text style={styles.muted}>{error}</Text>
        <Pressable style={styles.button} onPress={requestAccess}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const reviewedCount = photos.filter((p) => isHandled(p.id)).length;
  const pendingDeletes = Object.keys(saved.pendingDelete).length;
  const pendingAlbums = Object.keys(saved.pendingAlbum).length;
  const progress = photos.length ? reviewedCount / photos.length : 0;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.stats}>
        <Text style={styles.big}>
          {reviewedCount.toLocaleString()} <Text style={styles.muted}>of {photos.length.toLocaleString()} reviewed</Text>
        </Text>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.muted}>
          {saved.lastVisitAt ? `Last visit: ${formatDay(saved.lastVisitAt)}` : 'First visit, welcome!'}
        </Text>
        {limitedAccess && (
          <Text style={styles.warning}>
            You gave access to some photos only. Allow all photos in settings to declutter everything.
          </Text>
        )}
      </View>

      {(pendingDeletes > 0 || pendingAlbums > 0) && (
        <Link href="/review" asChild>
          <Pressable style={[styles.row, styles.applyRow]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Review & apply</Text>
              <Text style={styles.rowSub}>
                {pendingDeletes} to delete · {pendingAlbums} to move into albums
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
      )}

      <Text style={styles.section}>Swipe</Text>
      <Text style={styles.legend}>← delete · keep → · ↑ add to album</Text>
      {QUEUES.filter((q) => q.id !== 'new' || saved.lastVisitAt !== null).map((q) => (
        <Link key={q.id} href={{ pathname: '/deck/[queue]', params: { queue: q.id } }} asChild>
          <Pressable style={styles.row} disabled={remaining[q.id] === 0}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, remaining[q.id] === 0 && styles.done]}>{q.title}</Text>
              <Text style={styles.rowSub}>{q.subtitle}</Text>
            </View>
            <Text style={styles.count}>{remaining[q.id] === 0 ? '✓' : remaining[q.id].toLocaleString()}</Text>
          </Pressable>
        </Link>
      ))}

      <Text style={styles.section}>Organise</Text>
      <Link href="/albums" asChild>
        <Pressable style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Album maker</Text>
            <Text style={styles.rowSub}>Turn days and trips into albums in one tap</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 48, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  h2: { color: colors.text, fontSize: 20, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  warning: { color: '#FFC857', fontSize: 13 },
  link: { color: colors.accent, fontSize: 15 },
  button: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  stats: { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 10 },
  big: { color: colors.text, fontSize: 26, fontWeight: '700' },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.keep },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 14 },
  legend: { color: colors.muted, fontSize: 13, marginTop: -6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  applyRow: { borderWidth: 1, borderColor: colors.delete },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  done: { color: colors.muted },
  count: { color: colors.text, fontSize: 18, fontWeight: '700' },
  chevron: { color: colors.muted, fontSize: 26 },
});
