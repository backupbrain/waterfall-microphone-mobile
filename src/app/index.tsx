import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SpectrumEngine } from '@/audio/spectrum-engine';
import { useMicrophone } from '@/audio/use-microphone';
import { CursorOverlay } from '@/components/cursor-overlay';
import { ErrorCard } from '@/components/error-card';
import { FrequencyAxis } from '@/components/frequency-axis';
import { InfoDialog } from '@/components/info-dialog';
import { Readout } from '@/components/readout';
import { StartGate } from '@/components/start-gate';
import { Toolbar } from '@/components/toolbar';
import { Wordmark } from '@/components/wordmark';
import { PALETTES, getPaletteLut } from '@/waterfall/colormaps';
import { Waterfall } from '@/waterfall/waterfall';

const COMPACT_BREAKPOINT = 640;

export default function WaterfallScreen() {
  const engine = useMemo(() => new SpectrumEngine(), []);
  const onSamples = useCallback(
    (samples: Float32Array, sampleRate: number) => engine.push(samples, sampleRate),
    [engine]
  );
  const { status, error, start, stop } = useMicrophone(onSamples);

  const [paused, setPaused] = useState(false);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [logScale, setLogScale] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [sampleRate, setSampleRate] = useState(engine.sampleRate);

  useEffect(() => engine.subscribeSampleRate(setSampleRate), [engine]);

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < COMPACT_BREAKPOINT;

  const palette = PALETTES[paletteIndex];
  const lut = getPaletteLut(palette);
  const nyquist = sampleRate / 2;
  const listening = status === 'listening';
  const starting = status === 'starting';

  const handleStart = useCallback(() => {
    engine.reset();
    setPaused(false);
    void start();
  }, [engine, start]);

  const handleStop = useCallback(() => {
    stop();
    setPaused(false);
  }, [stop]);

  const togglePause = useCallback(() => {
    if (listening) setPaused((value) => !value);
  }, [listening]);

  const nextPalette = useCallback(() => {
    setPaletteIndex((index) => (index + 1) % PALETTES.length);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      switch (event.key) {
        case ' ':
          event.preventDefault();
          togglePause();
          break;
        case 'p':
        case 'P':
          nextPalette();
          break;
        case 'l':
        case 'L':
          setLogScale((value) => !value);
          break;
        case 'i':
        case 'I':
          setInfoOpen((value) => !value);
          break;
        case 'Escape':
          setInfoOpen(false);
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePause, nextPalette]);

  const toolbar = (
    <Toolbar
      listening={listening}
      paused={paused}
      onTogglePause={togglePause}
      palette={palette}
      onNextPalette={nextPalette}
      logScale={logScale}
      onScaleChange={setLogScale}
      onInfo={() => setInfoOpen(true)}
      compact={compact}
    />
  );

  return (
    <View className="flex-1 bg-background">
      <Waterfall
        engine={engine}
        paused={paused}
        lut={lut}
        logScale={logScale}
        style={StyleSheet.absoluteFill}
      />

      {listening && (
        <FrequencyAxis width={width} nyquist={nyquist} logScale={logScale} top={insets.top + 6} />
      )}

      <CursorOverlay
        enabled={listening}
        width={width}
        nyquist={nyquist}
        logScale={logScale}
        labelTop={insets.top + 40}
        onTap={togglePause}
      />

      {!listening && !error && <StartGate starting={starting} onStart={handleStart} />}
      {error && <ErrorCard error={error} onRetry={handleStart} />}

      <View
        pointerEvents="box-none"
        className="absolute inset-x-0 bottom-0 gap-3 px-4"
        style={{ paddingBottom: insets.bottom + 14, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }}
      >
        {compact ? (
          <>
            <View pointerEvents="box-none" className="flex-row items-center justify-between">
              <Wordmark live={listening && !paused} accent={palette.accent} />
              <Readout engine={engine} listening={listening} paused={paused} />
            </View>
            <View pointerEvents="box-none" className="items-center">
              {toolbar}
            </View>
          </>
        ) : (
          <View pointerEvents="box-none" className="flex-row items-center justify-between">
            <View pointerEvents="box-none" className="flex-1">
              <Wordmark live={listening && !paused} accent={palette.accent} />
            </View>
            {toolbar}
            <View pointerEvents="box-none" className="flex-1 items-end">
              <Readout engine={engine} listening={listening} paused={paused} />
            </View>
          </View>
        )}
      </View>

      <InfoDialog
        isOpen={infoOpen}
        onOpenChange={setInfoOpen}
        listening={listening}
        onStop={handleStop}
        sampleRate={sampleRate}
      />
    </View>
  );
}
