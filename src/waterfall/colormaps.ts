export interface Palette {
  id: string;
  name: string;
  /** UI accent colour drawn from the bright end of the palette. */
  accent: string;
  stops: [position: number, hex: string][];
}

export const PALETTES: Palette[] = [
  {
    id: 'ember',
    name: 'Ember',
    accent: '#F9A03F',
    stops: [
      [0, '#000000'],
      [0.14, '#180A2E'],
      [0.34, '#5B1668'],
      [0.54, '#B5305A'],
      [0.72, '#EE7A36'],
      [0.88, '#FAD03C'],
      [1, '#FFFBE8'],
    ],
  },
  {
    id: 'abyss',
    name: 'Abyss',
    accent: '#5FE2FF',
    stops: [
      [0, '#000000'],
      [0.2, '#040F38'],
      [0.45, '#0A4D8C'],
      [0.66, '#17A5CC'],
      [0.86, '#9BF2FF'],
      [1, '#FFFFFF'],
    ],
  },
  {
    id: 'aurora',
    name: 'Aurora',
    accent: '#6FE3A1',
    stops: [
      [0, '#000000'],
      [0.2, '#0A1A2A'],
      [0.45, '#0E6B5C'],
      [0.68, '#55D18C'],
      [0.88, '#E9F7A5'],
      [1, '#FFFFFF'],
    ],
  },
  {
    id: 'rose',
    name: 'Rose',
    accent: '#FF8BC8',
    stops: [
      [0, '#000000'],
      [0.24, '#2A0B2E'],
      [0.5, '#881C6E'],
      [0.72, '#E84B9E'],
      [0.9, '#FFB5D8'],
      [1, '#FFFFFF'],
    ],
  },
  {
    id: 'graphite',
    name: 'Graphite',
    accent: '#D9DCE3',
    stops: [
      [0, '#000000'],
      [0.5, '#5A5F6A'],
      [1, '#FFFFFF'],
    ],
  },
];

export const LUT_SIZE = 256;

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const lutCache = new Map<string, Uint8Array>();

/** Builds (and caches) a 256-entry RGBA lookup table for a palette. */
export function getPaletteLut(palette: Palette): Uint8Array {
  const cached = lutCache.get(palette.id);
  if (cached) return cached;

  const lut = new Uint8Array(LUT_SIZE * 4);
  const stops = palette.stops.map(([t, hex]) => ({ t, rgb: hexToRgb(hex) }));
  for (let i = 0; i < LUT_SIZE; i++) {
    const t = i / (LUT_SIZE - 1);
    let upper = stops.findIndex((s) => s.t >= t);
    if (upper <= 0) upper = Math.max(1, upper === 0 ? 1 : stops.length - 1);
    const a = stops[upper - 1];
    const b = stops[upper];
    const span = b.t - a.t || 1;
    const mix = Math.min(1, Math.max(0, (t - a.t) / span));
    for (let c = 0; c < 3; c++) {
      lut[i * 4 + c] = Math.round(a.rgb[c] + (b.rgb[c] - a.rgb[c]) * mix);
    }
    lut[i * 4 + 3] = 255;
  }
  lutCache.set(palette.id, lut);
  return lut;
}

/** Returns CSS colour strings sampled evenly across the palette (for swatches). */
export function samplePalette(palette: Palette, count: number): string[] {
  const lut = getPaletteLut(palette);
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const index = Math.round((i / (count - 1)) * (LUT_SIZE - 1)) * 4;
    colors.push(`rgb(${lut[index]}, ${lut[index + 1]}, ${lut[index + 2]})`);
  }
  return colors;
}
