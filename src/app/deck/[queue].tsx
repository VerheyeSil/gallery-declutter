import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlbumPicker } from '../../components/AlbumPicker';
import { StaticCard, SwipeCard, type SwipeAction } from '../../components/SwipeCard';
import { QUEUES, buildQueue, type QueueId } from '../../lib/queues';
import { useLibrary, type PhotoSnapshot } from '../../state/library';
import { colors } from '../../theme';

type UndoEntry = { id: string; snap: PhotoSnapshot };

export default function Deck() {
  const { queue: queueParam } = useLocalSearchParams<{ queue: string }>();
  const queueId = (QUEUES.find((q) => q.id === queueParam)?.id ?? 'all') as QueueId;
  const queueInfo = QUEUES.find((q) => q.id === queueId)!;
  const { photos, saved, isHandled, keep, markDelete, assignAlbum, snapshot, restore } = useLibrary();
  const insets = useSafeAreaInsets();

  // Built once per library load, so the order stays put while you swipe.
  const queue = useMemo(() => buildQueue(queueId, photos, saved.lastVisitAt), [queueId, photos, saved.lastVisitAt]);
  const todo = useMemo(() => queue.filter((p) => !isHandled(p.id)), [queue, isHandled]);
  const [current, next] = todo;

  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [lastAlbum, setLastAlbum] = useState<string | null>(null);

  const decide = useCallback(
    (action: SwipeAction | 'same-album') => {
      if (!current) return;
      if (action === 'album') {
        setPickerFor(current.id);
        return;
      }
      setUndoStack((s) => [...s.slice(-49), { id: current.id, snap: snapshot(current.id) }]);
      if (action === 'keep') keep(current.id);
      else if (action === 'delete') markDelete(current.id);
      else if (lastAlbum) assignAlbum([current.id], lastAlbum);
    },
    [current, snapshot, keep, markDelete, assignAlbum, lastAlbum],
  );

  const pickAlbum = (album: string) => {
    if (pickerFor) {
      setUndoStack((s) => [...s.slice(-49), { id: pickerFor, snap: snapshot(pickerFor) }]);
      assignAlbum([pickerFor], album);
      setLastAlbum(album);
    }
    setPickerFor(null);
  };

  const undo = () => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    restore(last.id, last.snap);
    setUndoStack((s) => s.slice(0, -1));
  };

  const pendingDeletes = Object.keys(saved.pendingDelete).length;

  return (
    <View style={[styles.page, { paddingBottom: insets.bottom + 12 }]}>
      <Stack.Screen options={{ title: `${queueInfo.title} · ${todo.length.toLocaleString()} left` }} />

      <View style={styles.deck}>
        {current ? (
          <>
            {next && <StaticCard key={next.id} photo={next} />}
            <SwipeCard key={current.id} photo={current} onSwipe={decide} />
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>All done here 🎉</Text>
            <Text style={styles.muted}>
              {pendingDeletes > 0
                ? `${pendingDeletes} photos are waiting to be deleted.`
                : 'Nothing left to review in this queue.'}
            </Text>
            <Pressable style={styles.primary} onPress={() => router.replace('/review')}>
              <Text style={styles.primaryText}>Review & apply</Text>
            </Pressable>
          </View>
        )}
      </View>

      {current && (
        <>
          <View style={styles.actions}>
            <RoundButton label="✕" color={colors.delete} onPress={() => decide('delete')} />
            <RoundButton label="↶" color={colors.muted} small onPress={undo} disabled={!undoStack.length} />
            <RoundButton label="▤" color={colors.album} onPress={() => decide('album')} />
            <RoundButton label="✓" color={colors.keep} onPress={() => decide('keep')} />
          </View>
          {lastAlbum && (
            <Pressable style={styles.sameAlbum} onPress={() => decide('same-album')}>
              <Text style={styles.sameAlbumText} numberOfLines={1}>
                ↑ Also into “{lastAlbum}”
              </Text>
            </Pressable>
          )}
        </>
      )}

      <AlbumPicker visible={pickerFor !== null} onPick={pickAlbum} onClose={() => setPickerFor(null)} />
    </View>
  );
}

function RoundButton(props: { label: string; color: string; onPress: () => void; small?: boolean; disabled?: boolean }) {
  const size = props.small ? 48 : 64;
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [
        styles.round,
        { width: size, height: size, borderRadius: size / 2, borderColor: props.color },
        (pressed || props.disabled) && { opacity: 0.4 },
      ]}
    >
      <Text style={[styles.roundLabel, { color: props.color, fontSize: props.small ? 22 : 28 }]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingTop: 8 },
  deck: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  primary: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  actions: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', paddingHorizontal: 16 },
  round: { borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  roundLabel: { fontWeight: '700' },
  sameAlbum: { alignSelf: 'center', marginTop: 10, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.card },
  sameAlbumText: { color: colors.album, fontSize: 14, maxWidth: 260 },
});
