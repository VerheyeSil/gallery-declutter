import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LibraryProvider } from '../state/library';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <LibraryProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'Gallery Declutter' }} />
            <Stack.Screen name="deck/[queue]" options={{ title: '' }} />
            <Stack.Screen name="review" options={{ title: 'Review & apply' }} />
            <Stack.Screen name="albums" options={{ title: 'Album maker' }} />
          </Stack>
        </LibraryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
