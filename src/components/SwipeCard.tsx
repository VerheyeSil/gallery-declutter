import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { formatDay } from '../lib/dates';
import type { Photo } from '../lib/queues';
import { colors } from '../theme';

export type SwipeAction = 'keep' | 'delete' | 'album';

const SWIPE_X = 110;
const SWIPE_UP = 130;
const UNDER_SCALE = 0.95;

type Props = {
  photo: Photo;
  /** Only the top card reacts to swipes; the ones below are already loaded and waiting. */
  active: boolean;
  /** Size of the area the card fills. */
  width: number;
  height: number;
  onSwipe: (action: SwipeAction) => void;
};

/**
 * Fill the card ("cover") when the photo's shape is close to the card's, so
 * nothing important gets cropped. Otherwise show the whole photo ("contain"),
 * e.g. landscape photos on a portrait screen.
 */
function fitFor(photo: Photo, width: number, height: number): 'cover' | 'contain' {
  if (!photo.width || !photo.height || !width || !height) return 'contain';
  const ratio = photo.width / photo.height / (width / height);
  return ratio > 0.8 && ratio < 1.25 ? 'cover' : 'contain';
}

export function SwipeCard({ photo, active, width, height, onSwipe }: Props) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(active ? 1 : UNDER_SCALE);

  // A card that moves up to the top grows smoothly instead of jumping.
  useEffect(() => {
    scale.value = withTiming(active ? 1 : UNDER_SCALE, { duration: 160 });
  }, [active, scale]);

  const pan = usePanGesture({
    enabled: active,
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
      { rotate: `${interpolate(x.value, [-width, width], [-12, 12])}deg` },
      { scale: scale.value },
    ],
  }));
  const keepStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [20, SWIPE_X], [0, 1], 'clamp') }));
  const deleteStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-SWIPE_X, -20], [1, 0], 'clamp') }));
  const albumStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [-SWIPE_UP, -20], [1, 0], 'clamp') }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, { width, height }, cardStyle]}>
        <Image
          source={{ uri: photo.id }}
          style={StyleSheet.absoluteFill}
          contentFit={fitFor(photo, width, height)}
          recyclingKey={photo.id}
        />
        {active && (
          <>
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
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 18,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  date: { color: '#fff', fontSize: 17, fontWeight: '600' },
  meta: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },
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
