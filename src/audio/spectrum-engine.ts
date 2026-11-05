import { FFT, hannWindow } from './fft';

export const FFT_SIZE = 4096;
export const BIN_COUNT = FFT_SIZE / 2;

/** Target number of waterfall rows produced per second of audio. */
const ROWS_PER_SECOND = 48;
/** Rows buffered between the audio thread and the renderer before the oldest are dropped. */
const QUEUE_ROWS = 96;
/** The display always spans at least this many decibels. */
const MIN_RANGE_DB = 48;
const DB_SILENCE = -160;
const DB_SCALE = 20 / Math.LN10;

/**
 * Turns a stream of PCM samples into quantised waterfall rows.
 *
 * Samples are accumulated in a ring buffer; every `hop` samples a Hann-windowed
 * FFT runs over the most recent `FFT_SIZE` samples and the result is mapped to
 * 0..255 using a slowly adapting floor/ceiling so quiet rooms and loud rooms both
 * fill the colour range. Rows wait in a bounded queue until the renderer drains them.
 */
export class SpectrumEngine {
  private readonly fft = new FFT(FFT_SIZE);
  private readonly window = hannWindow(FFT_SIZE);
  private readonly windowGain: number;
  private readonly history = new Float32Array(FFT_SIZE);
  private historyPos = 0;
  private readonly frame = new Float32Array(FFT_SIZE);
  private readonly magnitudes = new Float32Array(BIN_COUNT);
  private readonly queue = new Uint8Array(QUEUE_ROWS * BIN_COUNT);
  private queueHead = 0;
  private queueLength = 0;
  private samplesSinceRow = 0;
  private hop = Math.round(48000 / ROWS_PER_SECOND);

  /** Latest spectrum in dBFS, one value per bin. */
  readonly decibels = new Float32Array(BIN_COUNT).fill(DB_SILENCE);

  sampleRate = 48000;
  floorDb = -95;
  ceilingDb = -35;
  peakHz = 0;
  peakDb = DB_SILENCE;
  /** Total rows produced since the last reset. */
  rowCount = 0;
  private sampleRateListener: ((sampleRate: number) => void) | null = null;

  constructor() {
    let sum = 0;
    for (let i = 0; i < FFT_SIZE; i++) sum += this.window[i];
    // A full-scale sine produces a peak magnitude of amplitude * sum / 2.
    this.windowGain = 2 / sum;
  }

  /** Registers a listener for sample-rate changes (fires on the first buffer too). Returns an unsubscribe function. */
  subscribeSampleRate(listener: (sampleRate: number) => void): () => void {
    this.sampleRateListener = listener;
    return () => {
      if (this.sampleRateListener === listener) this.sampleRateListener = null;
    };
  }

  get nyquist(): number {
    return this.sampleRate / 2;
  }

  get rowsPerSecond(): number {
    return this.sampleRate / this.hop;
  }

  /** Feed mono samples. Safe to call from any callback; never allocates. */
  push(samples: Float32Array, sampleRate: number): void {
    if (sampleRate > 0 && sampleRate !== this.sampleRate) {
      this.sampleRate = sampleRate;
      this.hop = Math.max(256, Math.round(sampleRate / ROWS_PER_SECOND));
      this.sampleRateListener?.(sampleRate);
    }

    const history = this.history;
    const mask = FFT_SIZE - 1;
    let pos = this.historyPos;
    let since = this.samplesSinceRow;
    const hop = this.hop;

    for (let i = 0; i < samples.length; i++) {
      history[pos] = samples[i];
      pos = (pos + 1) & mask;
      if (++since >= hop) {
        since = 0;
        this.historyPos = pos;
        this.analyze();
      }
    }

    this.historyPos = pos;
    this.samplesSinceRow = since;
  }

  /** Hands every pending row to `fn` in chronological order and empties the queue. */
  drain(fn: (row: Uint8Array) => void): void {
    while (this.queueLength > 0) {
      const offset = this.queueHead * BIN_COUNT;
      fn(this.queue.subarray(offset, offset + BIN_COUNT));
      this.queueHead = (this.queueHead + 1) % QUEUE_ROWS;
      this.queueLength--;
    }
  }

  /** Throws away pending rows without rendering them (used while paused). */
  discard(): void {
    this.queueHead = 0;
    this.queueLength = 0;
  }

  reset(): void {
    this.history.fill(0);
    this.historyPos = 0;
    this.samplesSinceRow = 0;
    this.decibels.fill(DB_SILENCE);
    this.floorDb = -95;
    this.ceilingDb = -35;
    this.peakHz = 0;
    this.peakDb = DB_SILENCE;
    this.rowCount = 0;
    this.discard();
  }

  private analyze(): void {
    const frame = this.frame;
    const history = this.history;
    const pos = this.historyPos;
    frame.set(history.subarray(pos), 0);
    frame.set(history.subarray(0, pos), FFT_SIZE - pos);

    const magnitudes = this.magnitudes;
    this.fft.magnitudes(frame, this.window, magnitudes);

    const decibels = this.decibels;
    const gain = this.windowGain;
    let maxDb = DB_SILENCE;
    let peakBin = 1;
    let sum = 0;
    for (let i = 0; i < BIN_COUNT; i++) {
      const db = DB_SCALE * Math.log(magnitudes[i] * gain + 1e-9);
      decibels[i] = db;
      if (i >= 2) {
        sum += db;
        if (db > maxDb) {
          maxDb = db;
          peakBin = i;
        }
      }
    }
    const mean = sum / (BIN_COUNT - 2);

    // Floor follows the average level: drops quickly, rises slowly so transients do not wash out.
    this.floorDb += (mean - this.floorDb) * (mean < this.floorDb ? 0.1 : 0.01);
    // Ceiling snaps up to new peaks and relaxes slowly.
    this.ceilingDb += (maxDb - this.ceilingDb) * (maxDb > this.ceilingDb ? 0.5 : 0.004);
    if (this.ceilingDb < this.floorDb + MIN_RANGE_DB) {
      this.ceilingDb = this.floorDb + MIN_RANGE_DB;
    }

    this.peakHz = (peakBin * this.sampleRate) / FFT_SIZE;
    this.peakDb = maxDb;

    if (this.queueLength === QUEUE_ROWS) {
      this.queueHead = (this.queueHead + 1) % QUEUE_ROWS;
    } else {
      this.queueLength++;
    }
    const rowIndex = (this.queueHead + this.queueLength - 1) % QUEUE_ROWS;
    const offset = rowIndex * BIN_COUNT;
    const queue = this.queue;
    const low = this.floorDb + 3;
    const scale = 255 / (this.ceilingDb - low);
    for (let i = 0; i < BIN_COUNT; i++) {
      const v = (decibels[i] - low) * scale;
      queue[offset + i] = v <= 0 ? 0 : v >= 255 ? 255 : v | 0;
    }
    this.rowCount++;
  }
}
