import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { isUnsortedFolder } from '../lib/queues';
import { useLibrary } from '../state/library';
import { colors } from '../theme';

type Props = {
  visible: boolean;
  title?: string;
  /** Pre-filled name for a new album (e.g. an event's date range). */
  suggestedName?: string;
  onPick: (album: string) => void;
  onClose: () => void;
};

/** Bottom sheet for choosing an existing album or typing a new one. */
export function AlbumPicker(props: Props) {
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      {/* Mounted only while open, so the name field starts fresh each time. */}
      {props.visible && <Sheet {...props} />}
    </Modal>
  );
}

function Sheet({ title = 'Add to album', suggestedName = '', onPick, onClose }: Props) {
  const { saved, deviceAlbums } = useLibrary();
  const [name, setName] = useState(suggestedName);

  // Albums you're filling right now come first, then ones made in this app, then other folders.
  const choices = useMemo(() => {
    const pending = [...new Set(Object.values(saved.pendingAlbum))];
    const others = deviceAlbums.filter((a) => !isUnsortedFolder(a));
    return [...new Set([...pending, ...saved.myAlbums, ...others])];
  }, [saved.pendingAlbum, saved.myAlbums, deviceAlbums]);

  const filtered = name.trim()
    ? choices.filter((c) => c.toLowerCase().includes(name.trim().toLowerCase()))
    : choices;
  const exactMatch = choices.some((c) => c.toLowerCase() === name.trim().toLowerCase());

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior="height" style={styles.sheet}>
        <Text style={styles.title}>{title}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Album name (new or existing)"
          placeholderTextColor={colors.muted}
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={() => name.trim() && onPick(name.trim())}
        />
        {name.trim() !== '' && !exactMatch && (
          <Pressable style={[styles.chip, styles.newChip]} onPress={() => onPick(name.trim())}>
            <Text style={styles.chipText}>＋ New album “{name.trim()}”</Text>
          </Pressable>
        )}
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          <View style={styles.chips}>
            {filtered.map((album) => (
              <Pressable key={album} style={styles.chip} onPress={() => onPick(album)}>
                <Text style={styles.chipText}>{album}</Text>
              </Pressable>
            ))}
            {filtered.length === 0 && !name.trim() && (
              <Text style={styles.hint}>No albums yet. Type a name to make your first one.</Text>
            )}
          </View>
        </ScrollView>
        <Pressable onPress={onClose} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  input: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  list: { marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.cardAlt, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  newChip: { alignSelf: 'flex-start', marginTop: 12, backgroundColor: colors.album },
  chipText: { color: colors.text, fontSize: 15 },
  hint: { color: colors.muted },
  cancel: { alignItems: 'center', paddingTop: 16 },
  cancelText: { color: colors.muted, fontSize: 16 },
});
