import { Button, Card, Chip, Typography } from 'heroui-native';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { FadeIn, FadeOut } from 'react-native-reanimated';

import { AnimatedView } from './animated-view';
import { Icon } from './icon';

import type { MicError, MicErrorCode } from '@/audio/types';

interface ErrorCardProps {
  error: MicError;
  onRetry: () => void;
}

const isWeb = Platform.OS === 'web';

const COPY: Record<MicErrorCode, { title: string; body: string }> = {
  denied: {
    title: 'Microphone access is off',
    body: isWeb
      ? 'Allow the microphone for this site from the icon in your browser’s address bar, then try again.'
      : 'Waterfall needs the microphone to draw sound. Allow access in Settings, then try again.',
  },
  'not-found': {
    title: 'No microphone found',
    body: 'Connect or enable a microphone, then try again.',
  },
  busy: {
    title: 'The microphone is busy',
    body: 'Another app or tab may be using it. Close that, then try again.',
  },
  unsupported: {
    title: 'This browser can’t capture audio',
    body: 'Try a current version of Chrome, Safari, Firefox, or Edge.',
  },
  insecure: {
    title: 'A secure connection is required',
    body: 'Browsers only share the microphone over HTTPS (or on localhost).',
  },
  unknown: {
    title: 'The microphone didn’t start',
    body: 'Something went wrong while opening the microphone.',
  },
};

export function ErrorCard({ error, onRetry }: ErrorCardProps) {
  const copy = COPY[error.code];
  const canOpenSettings = !isWeb && !!error.canOpenSettings;

  return (
    <AnimatedView
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={StyleSheet.absoluteFill}
      className="items-center justify-center bg-background/70 px-6"
    >
      <Card className="w-full max-w-md gap-5 p-6">
        <Card.Header className="gap-3">
          <View className="flex-row items-center gap-2">
            <Chip variant="soft" color="danger" size="sm">
              <Icon name="mic-off" size={12} className="text-danger-soft-foreground" />
              <Chip.Label>Microphone</Chip.Label>
            </Chip>
          </View>
          <Card.Title>{copy.title}</Card.Title>
          <Card.Description>{copy.body}</Card.Description>
          {error.code === 'unknown' && error.message ? (
            <Typography type="code" color="muted" className="text-xs">
              {error.message}
            </Typography>
          ) : null}
        </Card.Header>
        <Card.Footer className="flex-row flex-wrap justify-end gap-3">
          {canOpenSettings && (
            <Button variant="secondary" onPress={() => void Linking.openSettings()}>
              <Icon name="settings" size={16} className="text-accent" />
              <Button.Label>Open Settings</Button.Label>
            </Button>
          )}
          <Button onPress={onRetry}>
            <Icon name="refresh-cw" size={16} className="text-accent-foreground" />
            <Button.Label>Try again</Button.Label>
          </Button>
        </Card.Footer>
      </Card>
    </AnimatedView>
  );
}
