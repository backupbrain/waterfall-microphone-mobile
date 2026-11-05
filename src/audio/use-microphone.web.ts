import { useCallback, useEffect, useRef, useState } from 'react';

import type { MicError, Microphone, MicStatus, SampleListener } from './types';

const CHUNK_SIZE = 1024;

/** Runs on the audio thread: groups 128-frame render quanta into transferable chunks. */
const WORKLET_SOURCE = `
class WaterfallCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(${CHUNK_SIZE});
    this.length = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    let i = 0;
    while (i < channel.length) {
      const take = Math.min(channel.length - i, ${CHUNK_SIZE} - this.length);
      this.buffer.set(channel.subarray(i, i + take), this.length);
      this.length += take;
      i += take;
      if (this.length === ${CHUNK_SIZE}) {
        this.port.postMessage(this.buffer, [this.buffer.buffer]);
        this.buffer = new Float32Array(${CHUNK_SIZE});
        this.length = 0;
      }
    }
    return true;
  }
}
registerProcessor('waterfall-capture', WaterfallCapture);
`;

type Session = {
  teardown: () => void;
};

function classifyError(error: unknown): MicError {
  const name = typeof error === 'object' && error && 'name' in error ? String(error.name) : '';
  const message = error instanceof Error ? error.message : String(error);
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return { code: 'denied', message };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return { code: 'not-found', message };
    case 'NotReadableError':
    case 'AbortError':
    case 'TrackStartError':
      return { code: 'busy', message };
    default:
      return { code: 'unknown', message };
  }
}

function getAudioContextClass(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function isSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    getAudioContextClass() !== null
  );
}

/**
 * Browser microphone source. Captures raw (unprocessed) audio through the Web
 * Audio API using an AudioWorklet, falling back to a ScriptProcessorNode where
 * worklets are unavailable.
 */
export function useMicrophone(onSamples: SampleListener): Microphone {
  const listenerRef = useRef(onSamples);
  const sessionRef = useRef<Session | null>(null);
  const [status, setStatus] = useState<MicStatus>('idle');
  const [error, setError] = useState<MicError | null>(null);

  useEffect(() => {
    listenerRef.current = onSamples;
  }, [onSamples]);

  const stop = useCallback(() => {
    sessionRef.current?.teardown();
    sessionRef.current = null;
    setStatus('idle');
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!isSupported()) {
      const insecure = typeof window !== 'undefined' && window.isSecureContext === false;
      setError({ code: insecure ? 'insecure' : 'unsupported' });
      return;
    }
    sessionRef.current?.teardown();
    sessionRef.current = null;
    setStatus('starting');

    // Create the context synchronously inside the user gesture so autoplay policies allow it.
    const Context = getAudioContextClass()!;
    const context = new Context({ latencyHint: 'interactive' });
    let media: MediaStream | null = null;

    try {
      await context.resume();
      media = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const source = context.createMediaStreamSource(media);
      const sink = context.createGain();
      sink.gain.value = 0;
      sink.connect(context.destination);

      let node: AudioNode;
      let disposeNode: () => void;
      try {
        if (!context.audioWorklet) throw new Error('AudioWorklet unavailable');
        const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
        try {
          await context.audioWorklet.addModule(url);
        } finally {
          URL.revokeObjectURL(url);
        }
        const worklet = new AudioWorkletNode(context, 'waterfall-capture', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        });
        worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
          listenerRef.current(event.data, context.sampleRate);
        };
        node = worklet;
        disposeNode = () => {
          worklet.port.onmessage = null;
          worklet.disconnect();
        };
      } catch {
        const processor = context.createScriptProcessor(CHUNK_SIZE, 1, 1);
        processor.onaudioprocess = (event) => {
          listenerRef.current(event.inputBuffer.getChannelData(0), context.sampleRate);
        };
        node = processor;
        disposeNode = () => {
          processor.onaudioprocess = null;
          processor.disconnect();
        };
      }

      source.connect(node);
      node.connect(sink);

      const teardown = () => {
        disposeNode();
        source.disconnect();
        sink.disconnect();
        media?.getTracks().forEach((track) => track.stop());
        void context.close().catch(() => undefined);
      };
      sessionRef.current = { teardown };

      const [track] = media.getAudioTracks();
      track?.addEventListener('ended', () => {
        if (sessionRef.current?.teardown !== teardown) return;
        teardown();
        sessionRef.current = null;
        setError({ code: 'not-found', message: 'The microphone was disconnected.' });
        setStatus('idle');
      });

      setStatus('listening');
    } catch (e) {
      media?.getTracks().forEach((track) => track.stop());
      void context.close().catch(() => undefined);
      setError(classifyError(e));
      setStatus('idle');
    }
  }, []);

  useEffect(() => {
    return () => {
      sessionRef.current?.teardown();
      sessionRef.current = null;
    };
  }, []);

  return { status, error, start, stop };
}
