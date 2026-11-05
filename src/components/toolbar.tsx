import { Button, Surface, Tabs } from 'heroui-native';
import { View } from 'react-native';

import { Icon } from './icon';

import { samplePalette, type Palette } from '@/waterfall/colormaps';

interface ToolbarProps {
  listening: boolean;
  paused: boolean;
  onTogglePause: () => void;
  palette: Palette;
  onNextPalette: () => void;
  logScale: boolean;
  onScaleChange: (log: boolean) => void;
  onInfo: () => void;
  compact: boolean;
}

export function Toolbar({
  listening,
  paused,
  onTogglePause,
  palette,
  onNextPalette,
  logScale,
  onScaleChange,
  onInfo,
  compact,
}: ToolbarProps) {
  const swatches = samplePalette(palette, 6);

  return (
    <Surface className="flex-row items-center gap-1 rounded-full border border-border px-2 py-1.5">
      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        isDisabled={!listening}
        onPress={onTogglePause}
        accessibilityLabel={paused ? 'Resume' : 'Pause'}
      >
        <Icon name={paused ? 'play' : 'pause'} size={18} className="text-foreground" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onPress={onNextPalette}
        accessibilityLabel={`Palette: ${palette.name}. Press for the next palette`}
      >
        <View className="flex-row gap-0.5">
          {swatches.map((color, index) => (
            <View key={index} className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
          ))}
        </View>
        {!compact && <Button.Label>{palette.name}</Button.Label>}
      </Button>

      <Tabs
        value={logScale ? 'log' : 'lin'}
        onValueChange={(value) => onScaleChange(value === 'log')}
        variant="secondary"
      >
        <Tabs.List className="rounded-full">
          <Tabs.Indicator className="rounded-full" />
          <Tabs.Trigger value="lin" accessibilityLabel="Linear frequency scale">
            <Tabs.Label>Lin</Tabs.Label>
          </Tabs.Trigger>
          <Tabs.Trigger value="log" accessibilityLabel="Logarithmic frequency scale">
            <Tabs.Label>Log</Tabs.Label>
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        onPress={onInfo}
        accessibilityLabel="About Waterfall"
      >
        <Icon name="info" size={18} className="text-foreground" />
      </Button>
    </Surface>
  );
}
