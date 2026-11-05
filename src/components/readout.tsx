import { Chip } from 'heroui-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { SpectrumEngine } from '@/audio/spectrum-engine';
import { formatDb, formatHz } from '@/utils/format';

interface ReadoutProps {
  engine: SpectrumEngine;
  listening: boolean;
  paused: boolean;
}

/** Live peak-frequency and level badges, refreshed a few times a second. */
export function Readout({ engine, listening, paused }: ReadoutProps) {
  const [peak, setPeak] = useState({ hz: '—', db: '' });

  useEffect(() => {
    if (!listening || paused) return;
    const update = () => {
      const next = { hz: formatHz(engine.peakHz), db: formatDb(engine.peakDb) };
      setPeak((prev) => (prev.hz === next.hz && prev.db === next.db ? prev : next));
    };
    update();
    const id = setInterval(update, 150);
    return () => clearInterval(id);
  }, [engine, listening, paused]);

  if (!listening) return null;

  return (
    <View className="flex-row items-center gap-2" pointerEvents="none">
      {paused && (
        <Chip variant="soft" color="warning" size="sm">
          <Chip.Label>Paused</Chip.Label>
        </Chip>
      )}
      <Chip variant="secondary" size="sm">
        <Chip.Label className="font-mono tabular-nums">{peak.hz}</Chip.Label>
      </Chip>
      <Chip variant="tertiary" size="sm">
        <Chip.Label className="font-mono tabular-nums">{peak.db}</Chip.Label>
      </Chip>
    </View>
  );
}
