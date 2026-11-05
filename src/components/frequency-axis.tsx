import { Typography } from 'heroui-native';
import { View } from 'react-native';

import { formatHzShort } from '@/utils/format';

interface FrequencyAxisProps {
  width: number;
  nyquist: number;
  logScale: boolean;
  top: number;
}

const LOG_FLOOR_HZ = 20;
const LOG_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const LINEAR_STEPS = [250, 500, 1000, 2000, 2500, 5000, 10000];
const MIN_LABEL_SPACING = 64;
const LABEL_WIDTH = 56;

function linearTicks(nyquist: number, width: number): number[] {
  const step =
    LINEAR_STEPS.find((candidate) => width / (nyquist / candidate) >= MIN_LABEL_SPACING) ??
    LINEAR_STEPS[LINEAR_STEPS.length - 1];
  const ticks: number[] = [];
  for (let f = step; f < nyquist - step * 0.6; f += step) ticks.push(f);
  ticks.push(nyquist);
  return ticks;
}

function logTicks(nyquist: number, width: number): number[] {
  const scale = width / Math.log(nyquist / LOG_FLOOR_HZ);
  const ticks: number[] = [];
  let lastX = -Infinity;
  for (const f of LOG_TICKS) {
    if (f >= nyquist) break;
    const x = Math.log(f / LOG_FLOOR_HZ) * scale;
    if (x - lastX >= MIN_LABEL_SPACING * 0.75) {
      ticks.push(f);
      lastX = x;
    }
  }
  if (width - lastX >= MIN_LABEL_SPACING * 0.75) ticks.push(nyquist);
  return ticks;
}

/** Frequency labels along the top edge, matching the renderer's scale mapping. */
export function FrequencyAxis({ width, nyquist, logScale, top }: FrequencyAxisProps) {
  if (width <= 0 || nyquist <= 0) return null;

  const ticks = logScale ? logTicks(nyquist, width) : linearTicks(nyquist, width);
  const xFor = (f: number) =>
    logScale
      ? (Math.log(f / LOG_FLOOR_HZ) / Math.log(nyquist / LOG_FLOOR_HZ)) * width
      : (f / nyquist) * width;

  return (
    <View pointerEvents="none" className="absolute left-0 right-0" style={{ top }}>
      {ticks.map((f) => {
        const x = xFor(f);
        const left = Math.min(Math.max(x - LABEL_WIDTH / 2, 0), width - LABEL_WIDTH);
        return (
          <View key={f} className="absolute items-center" style={{ left, width: LABEL_WIDTH }}>
            <View
              className="h-2 w-px bg-foreground/40"
              style={{ transform: [{ translateX: x - left - LABEL_WIDTH / 2 }] }}
            />
            <Typography
              type="body-xs"
              color="muted"
              className="font-mono"
              style={{ textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 4 }}
            >
              {formatHzShort(f)}
            </Typography>
          </View>
        );
      })}
    </View>
  );
}
