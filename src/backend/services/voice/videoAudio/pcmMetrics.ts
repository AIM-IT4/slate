export type PcmMetrics = {
  samples: number;
  sumSquares: number;
  peak: number;
  clipped: number;
  quietWindows: number;
  windows: number;
};
export const emptyPcmMetrics = (): PcmMetrics => ({
  samples: 0,
  sumSquares: 0,
  peak: 0,
  clipped: 0,
  quietWindows: 0,
  windows: 0,
});

/** Only the decoder's bounded mono PCM16 windows are admitted. No whole-video byte read. */
export function measurePcmWave(bytes: Uint8Array): PcmMetrics {
  if (bytes.length < 44 || bytes.length > 16 * 1024 * 1024)
    throw new Error('Invalid decoded audio size');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== 0x52494646 || view.getUint32(8) !== 0x57415645)
    throw new Error('Invalid WAV');
  let rate = 0,
    dataStart = 0,
    dataBytes = 0;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = view.getUint32(offset),
      length = view.getUint32(offset + 4, true),
      start = offset + 8;
    if (start + length > bytes.length) throw new Error('Truncated WAV');
    if (kind === 0x666d7420) {
      if (
        length < 16 ||
        view.getUint16(start, true) !== 1 ||
        view.getUint16(start + 2, true) !== 1 ||
        view.getUint16(start + 14, true) !== 16
      )
        throw new Error('Expected mono PCM16');
      rate = view.getUint32(start + 4, true);
    }
    if (kind === 0x64617461) {
      dataStart = start;
      dataBytes = length;
    }
    offset = start + length + (length % 2);
  }
  if (!rate || !dataStart || !dataBytes || dataBytes % 2 || dataBytes / 2 > rate * 30 + 2)
    throw new Error('Invalid audio window');
  const result = emptyPcmMetrics();
  const windowSize = Math.max(1, Math.round(rate * 0.02));
  let power = 0,
    count = 0;
  for (let offset = dataStart; offset < dataStart + dataBytes; offset += 2) {
    const sample = view.getInt16(offset, true) / 32768,
      magnitude = Math.abs(sample);
    result.samples++;
    result.sumSquares += sample * sample;
    result.peak = Math.max(result.peak, magnitude);
    if (magnitude >= 32760 / 32768) result.clipped++;
    power += sample * sample;
    count++;
    if (count === windowSize || offset + 2 === dataStart + dataBytes) {
      result.windows++;
      if (power / count < 0.00001) result.quietWindows++;
      power = 0;
      count = 0;
    }
  }
  return result;
}
export function audioLevels(metrics: PcmMetrics) {
  const db = (amplitude: number) =>
    Math.max(-96, Math.round(20 * Math.log10(Math.max(amplitude, 0.000001)) * 10) / 10);
  return {
    rmsDbfs: db(Math.sqrt(metrics.sumSquares / Math.max(1, metrics.samples))),
    peakDbfs: db(metrics.peak),
    clippedSamplePercent:
      Math.round((metrics.clipped / Math.max(1, metrics.samples)) * 10000) / 100,
    quietWindowPercent:
      Math.round((metrics.quietWindows / Math.max(1, metrics.windows)) * 10000) / 100,
  };
}
