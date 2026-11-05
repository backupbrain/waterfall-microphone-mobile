import { Button, Chip, Dialog, Separator, Typography } from 'heroui-native';
import { Platform, ScrollView, View, useWindowDimensions } from 'react-native';

import { Icon } from './icon';

import { formatHz } from '@/utils/format';

interface InfoDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  listening: boolean;
  onStop: () => void;
  sampleRate: number;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-start gap-3">
      <Chip variant="soft" size="sm" className="mt-0.5 min-w-24 justify-center">
        <Chip.Label>{label}</Chip.Label>
      </Chip>
      <Typography type="body-sm" color="muted" className="flex-1">
        {children}
      </Typography>
    </View>
  );
}

export function InfoDialog({ isOpen, onOpenChange, listening, onStop, sampleRate }: InfoDialogProps) {
  const { height } = useWindowDimensions();
  const nyquist = sampleRate / 2;

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content
          isSwipeable={false}
          // Reanimated's web entering animation mis-positions absolutely-placed portal content.
          animation={Platform.OS === 'web' ? 'disabled' : undefined}
          className="mx-auto w-full max-w-lg gap-4"
        >
          <Dialog.Close variant="ghost" className="absolute top-3 inset-e-3 z-50" />
          <View className="gap-1.5 pr-10">
            <Dialog.Title>What you’re looking at</Dialog.Title>
            <Dialog.Description>
              Waterfall listens to the microphone and paints the spectrum of sound as it happens.
              It is an instrument and an artwork: the room draws itself.
            </Dialog.Description>
          </View>

          <ScrollView
            style={{ maxHeight: Math.min(360, Math.max(120, height * 0.5 - 120)) }}
            contentContainerClassName="gap-4"
            showsVerticalScrollIndicator={false}
          >
            <View className="gap-3">
              <Row label="Left → right">
                Pitch, from 0 Hz up to {formatHz(nyquist)}: the highest frequency this microphone
                delivers at {Math.round(sampleRate / 100) / 10} kHz sampling.
              </Row>
              <Row label="Top → bottom">
                Time. New sound appears at the top edge and falls away below.
              </Row>
              <Row label="Brightness">
                Loudness. The range adapts to the room, so a quiet space still glows faintly and a
                loud one never washes out.
              </Row>
            </View>

            <Separator />

            <View className="gap-2">
              <Typography type="body-sm" weight="semibold">
                Try it
              </Typography>
              <Typography type="body-sm" color="muted">
                Whistle a rising note and watch it climb. Clap for a bright vertical bar across every
                pitch. Jingle keys to light up the far right. Hum low and the left edge warms.
              </Typography>
            </View>

            <Separator />

            <View className="gap-2">
              <Typography type="body-sm" weight="semibold">
                Controls
              </Typography>
              <Typography type="body-sm" color="muted">
                Tap the waterfall to freeze it. Drag across it to read the frequency under your
                finger. Use the bar below to pause, change the palette, or switch between a linear
                and logarithmic pitch axis.
                {Platform.OS === 'web'
                  ? ' On a keyboard: Space pauses, P changes palette, L toggles the scale, I opens this panel.'
                  : ''}
              </Typography>
            </View>

            <Separator />

            <Typography type="body-xs" color="muted">
              Audio is analysed on this device in real time. Nothing is recorded, stored, or
              uploaded.
            </Typography>
          </ScrollView>

          <View className="flex-row justify-end gap-3">
            {listening && (
              <Button
                variant="danger-soft"
                onPress={() => {
                  onStop();
                  onOpenChange(false);
                }}
              >
                <Icon name="mic-off" size={16} className="text-danger-soft-foreground" />
                <Button.Label>Stop listening</Button.Label>
              </Button>
            )}
            <Button variant="tertiary" onPress={() => onOpenChange(false)}>
              Done
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
