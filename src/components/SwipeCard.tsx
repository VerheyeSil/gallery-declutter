import { Image } from 'expo-image';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { formatDay } from '../lib/dates';
import type { Photo } from '../lib/queues';
import { colors } from '../theme';

export type SwipeAction = 'keep' | 'delete' | 'album';

const SWIPE_X = 110;
const SWIPE_UP = 130;

type Props = {
  photo: Photo;
  onSwipe: (action: SwipeAction) => void;
};

export function SwipeCard({ photo, onSwipe }: Props) {
  const { width, height } = useWindowDimensions();
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const pan = usePanGesture({
    onUpdate: (e) => {
      'worklet';
      x.value = e.translationX;
      y.value = e.translationY;
    },
    onDeactivate: (e) => {
      'worklet';
      const flungUp = e.translationY < -SWIPE_UP && Math.abs(e.translationX) < SWIPE_X * 1.5;
      if (flungUp) {
        // The album picker opens; the card springs back so it can be swiped again if you cancel.
        x.value = withSpring(0);
        y.value = withSpring(0);
        scheduleOnRN(onSwipe, 'album');
      } else if (e.translationX > SWIPE_X || e.translationX < -SWIPE_X) {
        const action: SwipeAction = e.translationX > 0 ? 'keep' : 'delete';
        x.value = withTiming(Math.sign(e.translationX) * width * 1.5, { duration: 180 }, (done) => {
          if (done) scheduleOnRN(onSwipe, action);
        });
      } else {
        x.value = withSpring(0);
        y.value = withSpring(0);
      }
    },
  });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-width, width], [-15, 15])}deg` },
    ],
  }));
  const keepStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [20, SWIPE_X], [0, 1], 'clamp') }));
  const deleteStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-SWIPE_X, -20], [1, 0], 'clamp') }));
  const albumStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [-SWIPE_UP, -20], [1, 0], 'clamp') }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, { height: height * 0.62 }, cardStyle]}>
        <Image source={{ uri: photo.id }} style={styles.image} contentFit="contain" recyclingKey={photo.id} transition={100} />
        <View style={styles.caption}>
          <Text style={styles.date}>{photo.takenAt ? formatDay(photo.takenAt) : 'Unknown date'}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {photo.folder || 'No folder'} · {photo.filename}
          </Text>
        </View>
        <Animated.View style={[styles.stamp, styles.stampKeep, keepStyle]}>
          <Text style={[styles.stampText, { color: colors.keep }]}>KEEP</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampDelete, deleteStyle]}>
          <Text style={[styles.stampText, { color: colors.delete }]}>DELETE</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampAlbum, albumStyle]}>
          <Text style={[styles.stampText, { color: colors.album }]}>ALBUM</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

/** The card underneath the top one: same look, no gestures. */
export function StaticCard({ photo }: { photo: Photo }) {
  const { height } = useWindowDimensions();
  return (
    <View style={[styles.card, styles.under, { height: height * 0.62 }]}>
      <Image source={{ uri: photo.id }} style={styles.image} contentFit="contain" recyclingKey={photo.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    borderRadius: 20,
    backgroundColor: colors.card,
    overflow: 'hidden',
    elevation: 4,
  },
  under: { transform: [{ scale: 0.95 }, { translateY: 14 }], opacity: 0.7 },
  image: { flex: 1, backgroundColor: '#000' },
  caption: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card },
  date: { color: colors.text, fontSize: 17, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  stamp: {
    position: 'absolute',
    top: 32,
    borderWidth: 4,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  stampKeep: { left: 24, borderColor: colors.keep, transform: [{ rotate: '-12deg' }] },
  stampDelete: { right: 24, borderColor: colors.delete, transform: [{ rotate: '12deg' }] },
  stampAlbum: { alignSelf: 'center', top: 80, borderColor: colors.album },
  stampText: { fontSize: 32, fontWeight: '800', letterSpacing: 2 },
});
