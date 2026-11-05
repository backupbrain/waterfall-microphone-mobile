/** Formats a frequency for display, e.g. 440 Hz, 2.4 kHz, 24 kHz. */
export function formatHz(hz: number): string {
  if (!Number.isFinite(hz) || hz < 0) return '—';
  if (hz < 1000) return `${Math.round(hz)} Hz`;
  const k = hz / 1000;
  return `${k >= 10 ? k.toFixed(1) : k.toFixed(2)} kHz`;
}

/** Short axis label: 500, 2k, 10k. */
export function formatHzShort(hz: number): string {
  if (hz < 1000) return `${Math.round(hz)}`;
  const k = hz / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

export function formatDb(db: number): string {
  if (!Number.isFinite(db) || db < -150) return '−∞ dB';
  const rounded = Math.round(db);
  return `${rounded < 0 ? '−' : ''}${Math.abs(rounded)} dB`;
}
