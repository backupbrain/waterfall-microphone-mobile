/**
 * Iterative radix-2 complex FFT. Tables and scratch buffers are allocated once so
 * the hot path (`magnitudes`) performs no allocations.
 */
export class FFT {
  readonly size: number;
  private readonly cosTable: Float32Array;
  private readonly sinTable: Float32Array;
  private readonly reverse: Uint32Array;
  private readonly re: Float32Array;
  private readonly im: Float32Array;

  constructor(size: number) {
    if (size < 2 || (size & (size - 1)) !== 0) {
      throw new Error('FFT size must be a power of two');
    }
    this.size = size;

    const half = size / 2;
    this.cosTable = new Float32Array(half);
    this.sinTable = new Float32Array(half);
    for (let i = 0; i < half; i++) {
      const angle = (-2 * Math.PI * i) / size;
      this.cosTable[i] = Math.cos(angle);
      this.sinTable[i] = Math.sin(angle);
    }

    const bits = Math.round(Math.log2(size));
    this.reverse = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      let reversed = 0;
      let value = i;
      for (let b = 0; b < bits; b++) {
        reversed = (reversed << 1) | (value & 1);
        value >>= 1;
      }
      this.reverse[i] = reversed >>> 0;
    }

    this.re = new Float32Array(size);
    this.im = new Float32Array(size);
  }

  /**
   * Multiplies `input` by `window`, transforms it, and writes `size / 2` linear
   * magnitudes into `out`.
   */
  magnitudes(input: Float32Array, window: Float32Array, out: Float32Array): void {
    const n = this.size;
    const re = this.re;
    const im = this.im;
    const rev = this.reverse;
    const cos = this.cosTable;
    const sin = this.sinTable;

    for (let i = 0; i < n; i++) {
      re[i] = input[rev[i]] * window[rev[i]];
      im[i] = 0;
    }

    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const step = n / len;
      for (let start = 0; start < n; start += len) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const wr = cos[k];
          const wi = sin[k];
          const a = start + j;
          const b = a + half;
          const tr = re[b] * wr - im[b] * wi;
          const ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }

    const bins = n >> 1;
    for (let i = 0; i < bins; i++) {
      out[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    }
  }
}

/** Periodic Hann window. */
export function hannWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
  }
  return window;
}
