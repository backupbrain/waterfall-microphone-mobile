import { Chip } from 'heroui-native';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View, type GestureResponderEvent, type PointerEvent } from 'react-native';

import { formatHz } from '@/utils/format';

interface CursorOverlayProps {
  enabled: boolean;
  width: number;
  nyquist: number;
  logScale: boolean;
  labelTop: number;
  onTap: () => void;
}

const LOG_FLOOR_HZ = 20;
const TAP_SLOP = 8;

/**
 * Transparent layer over the waterfall: a tap toggles pause, dragging (or hovering
 * with a mouse) shows a hairline with the frequency under the pointer.
 */
export function CursorOverlay({
  enabled,
  width,
  nyquist,
  logScale,
  labelTop,
  onTap,
}: CursorOverlayProps) {
  const [cursorX, setCursorX] = useState<number | null>(null);
  const gesture = useRef({ startX: 0, startY: 0, moved: false });

  const frequencyAt = (x: number) => {
    const t = Math.min(1, Math.max(0, x / width));
    return logScale ? LOG_FLOOR_HZ * Math.pow(nyquist / LOG_FLOOR_HZ, t) : t * nyquist;
  };

  const onGrant = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    gesture.current = { startX: pageX, startY: pageY, moved: false };
  };

  const onMove = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    const g = gesture.current;
    if (!g.moved && Math.hypot(pageX - g.startX, pageY - g.startY) > TAP_SLOP) {
      g.moved = true;
    }
    if (g.moved) setCursorX(pageX);
  };

  const onRelease = () => {
    if (!gesture.current.moved) onTap();
    setCursorX(null);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.nativeEvent.pointerType !== 'mouse') return;
    setCursorX(event.nativeEvent.pageX);
  };

  const onPointerLeave = () => setCursorX(null);

  const showCursor = enabled && cursorX !== null;
  const labelLeft = showCursor ? Math.min(Math.max(cursorX - 48, 8), width - 104) : 0;

  return (
    <View
      style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => enabled}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={onRelease}
      onResponderTerminate={() => setCursorX(null)}
      {...(Platform.OS === 'web' && enabled ? { onPointerMove, onPointerLeave } : null)}
    >
      {showCursor && (
        <>
          <View
            pointerEvents="none"
            className="absolute top-0 bottom-0 w-px bg-foreground/70"
            style={{ left: cursorX }}
          />
          <View
            pointerEvents="none"
            className="absolute w-24 items-center"
            style={{ left: labelLeft, top: labelTop }}
          >
            <Chip variant="primary" color="default" size="sm">
              <Chip.Label className="font-mono tabular-nums">{formatHz(frequencyAt(cursorX))}</Chip.Label>
            </Chip>
          </View>
        </>
      )}
    </View>
  );
}
