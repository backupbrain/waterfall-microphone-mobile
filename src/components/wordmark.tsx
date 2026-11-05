import { Typography } from 'heroui-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface WordmarkProps {
  live: boolean;
  accent: string;
}

export function Wordmark({ live, accent }: WordmarkProps) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (live) {
      pulse.value = withRepeat(
        withTiming(0.2, { duration: 900, easing: Easing.bezier(0.42, 0, 0.58, 1) }),
        -1,
        true
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [live, pulse]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View className="flex-row items-center gap-2.5" pointerEvents="none">
      <Animated.View
        style={[
          { width: 8, height: 8, borderRadius: 4, backgroundColor: live ? accent : '#5A5F6A' },
          dotStyle,
        ]}
      />
      <Typography
        type="body-sm"
        weight="semibold"
        className="uppercase tracking-[3px] text-foreground"
        style={{ textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 6 }}
      >
        Waterfall
      </Typography>
    </View>
  );
}
