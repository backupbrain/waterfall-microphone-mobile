import '@/global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { HeroUINativeProvider } from 'heroui-native';
import { useLayoutEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Uniwind } from 'uniwind';

export default function RootLayout() {
  useLayoutEffect(() => {
    // The waterfall is always drawn on black, so the UI always uses the dark theme.
    Uniwind.setTheme('dark');
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000000' }}>
      <HeroUINativeProvider config={{ textProps: { maxFontSizeMultiplier: 1.6 }, toast: 'disabled' }}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
