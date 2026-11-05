import { Button, Spinner, Typography, useThemeColor } from 'heroui-native';
import { StyleSheet, View } from 'react-native';
import { FadeIn, FadeOut } from 'react-native-reanimated';

import { AnimatedView } from './animated-view';
import { Icon } from './icon';

interface StartGateProps {
  starting: boolean;
  onStart: () => void;
}

export function StartGate({ starting, onStart }: StartGateProps) {
  const accentForeground = useThemeColor('accent-foreground');

  return (
    <AnimatedView
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(250)}
      style={StyleSheet.absoluteFill}
      className="items-center justify-center bg-background/70 px-6"
    >
      <View className="w-full max-w-md items-center gap-7">
        <View className="items-center gap-3">
          <Typography type="h1" align="center" className="font-light uppercase tracking-[8px]">
            Waterfall
          </Typography>
          <Typography type="body" color="muted" align="center">
            A live portrait of the sound around you. Every pitch the microphone can hear, painted
            as it happens.
          </Typography>
        </View>

        <Button size="lg" onPress={onStart} isDisabled={starting} className="min-w-60">
          {starting ? (
            <Spinner size="sm" color={accentForeground} />
          ) : (
            <Icon name="mic" size={18} className="text-accent-foreground" />
          )}
          <Button.Label>{starting ? 'Starting…' : 'Start listening'}</Button.Label>
        </Button>

        <Typography type="body-xs" color="muted" align="center">
          Uses the microphone. Nothing is recorded, stored, or sent anywhere.
        </Typography>
      </View>
    </AnimatedView>
  );
}
