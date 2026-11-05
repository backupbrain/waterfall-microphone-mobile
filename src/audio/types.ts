export type MicStatus = 'idle' | 'starting' | 'listening';

export type MicErrorCode =
  | 'unsupported'
  | 'insecure'
  | 'denied'
  | 'not-found'
  | 'busy'
  | 'unknown';

export interface MicError {
  code: MicErrorCode;
  /** Raw message from the platform, shown for `unknown` errors. */
  message?: string;
  /** True when the user must flip the permission in system settings. */
  canOpenSettings?: boolean;
}

/** Receives mono PCM samples in the range -1..1. The array is only valid during the call. */
export type SampleListener = (samples: Float32Array, sampleRate: number) => void;

export interface Microphone {
  status: MicStatus;
  error: MicError | null;
  start: () => Promise<void>;
  stop: () => void;
}
