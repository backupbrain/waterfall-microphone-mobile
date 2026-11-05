import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { memo, useCallback, useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { WaterfallRenderer } from './waterfall-renderer';

import { BIN_COUNT, type SpectrumEngine } from '@/audio/spectrum-engine';

/** Rows kept in the texture; must be a power of two for wrapping. */
const TEXTURE_ROWS = 1024;
/** Seconds of history visible from the top edge to the bottom edge. */
const VISIBLE_SECONDS = 12;
const LOG_FLOOR_HZ = 20;

export interface WaterfallProps {
  engine: SpectrumEngine;
  paused: boolean;
  lut: Uint8Array;
  logScale: boolean;
  style?: StyleProp<ViewStyle>;
}

interface LoopState {
  renderer: WaterfallRenderer | null;
  gl: ExpoWebGLRenderingContext | null;
  frame: number;
  lut: Uint8Array | null;
  dirty: boolean;
}

/**
 * GPU waterfall. Drains rows from the engine every animation frame and uploads
 * them into the renderer's ring texture. Props are mirrored into a ref so the
 * render loop never has to be re-created.
 */
export const Waterfall = memo(function Waterfall({
  engine,
  paused,
  lut,
  logScale,
  style,
}: WaterfallProps) {
  const propsRef = useRef({ paused, lut, logScale });
  const loop = useRef<LoopState>({ renderer: null, gl: null, frame: 0, lut: null, dirty: true });

  useEffect(() => {
    propsRef.current = { paused, lut, logScale };
    loop.current.dirty = true;
  }, [paused, lut, logScale]);

  const stop = useCallback(() => {
    const state = loop.current;
    if (state.frame) cancelAnimationFrame(state.frame);
    state.frame = 0;
    state.renderer?.dispose();
    state.renderer = null;
    state.gl = null;
    state.lut = null;
  }, []);

  const onContextCreate = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      stop();
      const state = loop.current;
      let renderer: WaterfallRenderer;
      try {
        renderer = new WaterfallRenderer(gl, BIN_COUNT, TEXTURE_ROWS);
      } catch (error) {
        console.warn('Waterfall renderer unavailable', error);
        return;
      }
      state.renderer = renderer;
      state.gl = gl;
      state.dirty = true;

      const tick = () => {
        state.frame = requestAnimationFrame(tick);
        if (state.renderer !== renderer) return;
        if (typeof gl.isContextLost === 'function' && gl.isContextLost()) return;

        const { paused: isPaused, lut: currentLut, logScale: isLog } = propsRef.current;
        let dirty = state.dirty;

        if (state.lut !== currentLut) {
          renderer.setPalette(currentLut);
          state.lut = currentLut;
          dirty = true;
        }

        if (isPaused) {
          engine.discard();
        } else {
          engine.drain((row) => {
            renderer.pushRow(row);
            dirty = true;
          });
        }

        renderer.logScale = isLog;
        renderer.minFrequencyFraction = LOG_FLOOR_HZ / engine.nyquist;
        renderer.visibleRows = Math.min(
          TEXTURE_ROWS,
          Math.max(64, Math.round(engine.rowsPerSecond * VISIBLE_SECONDS))
        );

        if (dirty || !isPaused) {
          renderer.draw();
          state.dirty = false;
        }
      };
      state.frame = requestAnimationFrame(tick);
    },
    [engine, stop]
  );

  useEffect(() => stop, [stop]);

  return <GLView style={style} onContextCreate={onContextCreate} msaaSamples={0} />;
});
