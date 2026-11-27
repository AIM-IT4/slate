import { toToolElapsed } from '../formatToolElapsed';

describe('toToolElapsed', () => {
  it.each([
    [0, { unit: 'seconds', value: 0 }],
    [-500, { unit: 'seconds', value: 0 }],
    [59_999, { unit: 'seconds', value: 59 }],
    [60_000, { unit: 'minutes', value: 1 }],
    [70_000, { unit: 'minutes', value: 1.2 }],
    [1_180_000, { unit: 'minutes', value: 19.7 }],
    [3_590_000, { unit: 'minutes', value: 59.8 }],
    [3_599_000, { unit: 'hours', value: 1 }],
    [5_400_000, { unit: 'hours', value: 1.5 }],
  ])('formats %d ms', (ms, expected) => {
    expect(toToolElapsed(ms)).toEqual(expected);
  });
});
