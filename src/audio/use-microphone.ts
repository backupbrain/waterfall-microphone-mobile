import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  useAudioStream,
  type AudioStreamBuffer,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { MicError, Microphone, MicStatus, SampleListener } from './types';

const REQUESTED_SAMPLE_RATE = 48000;

function classifyError(error: unknown): MicError {
  const message = error instanceof Error ? error.message : String(error);
  if (/permission|denied|not authori[sz]ed/i.test(message)) {
    return { code: 'denied', message, canOpenSettings: true };
  }
  if (/holding|in use|busy|already/i.test(message)) {
    return { code: 'busy', message };
  }
  if (/no (audio )?input|not available|unavailable|no microphone|not found/i.test(message)) {
    return { code: 'not-found', message };
  }
  return { code: 'unknown', message };
}

/**
 * Native microphone source backed by expo-audio's PCM stream.
 * Delivers mono float samples to `onSamples`, pauses while the app is in the
 * background, and resumes when it returns to the foreground.
 */
export function useMicrophone(onSamples: SampleListener): Microphone {
  const listenerRef = useRef(onSamples);
  const wantedRef = useRef(false);
  const monoScratch = useRef<Float32Array | null>(null);
  const [status, setStatus] = useState<MicStatus>('idle');
  const [error, setError] = useState<MicError | null>(null);

  useEffect(() => {
    listenerRef.current = onSamples;
  }, [onSamples]);

  const { stream } = useAudioStream({
    sampleRate: REQUESTED_SAMPLE_RATE,
    channels: 1,
    encoding: 'float32',
    onBuffer: (buffer: AudioStreamBuffer) => {
      const frames = Math.floor(buffer.data.byteLength / 4);
      if (frames === 0) return;
      const data = new Float32Array(buffer.data, 0, frames);
      const channels = Math.max(1, buffer.channels | 0);
      if (channels === 1) {
        listenerRef.current(data, buffer.sampleRate);
        return;
      }
      const frameCount = Math.floor(frames / channels);
      let mono = monoScratch.current;
      if (!mono || mono.length < frameCount) {
        mono = new Float32Array(frameCount);
        monoScratch.current = mono;
      }
      for (let f = 0; f < frameCount; f++) {
        let sum = 0;
        const base = f * channels;
        for (let c = 0; c < channels; c++) sum += data[base + c];
        mono[f] = sum / channels;
      }
      listenerRef.current(mono.subarray(0, frameCount), buffer.sampleRate);
    },
  });

  const stop = useCallback(() => {
    wantedRef.current = false;
    try {
      stream.stop();
    } catch {
      // Already stopped or released.
    }
    setStatus('idle');
  }, [stream]);

  const start = useCallback(async () => {
    setError(null);
    setStatus('starting');
    wantedRef.current = true;
    try {
      let permission = await getRecordingPermissionsAsync();
      if (!permission.granted) {
        permission = await requestRecordingPermissionsAsync();
      }
      if (!permission.granted) {
        wantedRef.current = false;
        setError({ code: 'denied', canOpenSettings: !permission.canAskAgain });
        setStatus('idle');
        return;
      }
      await stream.start();
      setStatus('listening');
    } catch (e) {
      wantedRef.current = false;
      setError(classifyError(e));
      setStatus('idle');
    }
  }, [stream]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (wantedRef.current && !stream.isStreaming) {
          stream.start().catch((e: unknown) => {
            wantedRef.current = false;
            setError(classifyError(e));
            setStatus('idle');
          });
        }
      } else if (state === 'background' && stream.isStreaming) {
        try {
          stream.stop();
        } catch {
          // Nothing to release.
        }
      }
    });
    return () => subscription.remove();
  }, [stream]);

  useEffect(() => {
    return () => {
      wantedRef.current = false;
      try {
        stream.stop();
      } catch {
        // Already released.
      }
    };
  }, [stream]);

  return { status, error, start, stop };
}
