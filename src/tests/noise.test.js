import {expect, describe, it} from 'vitest';
import NoiseGenerator from '../components/Ecosystem/noise';

describe('noise', () => {
  it('generation', () => {
    const n = new NoiseGenerator(1, 0.0000001);
    const start = new Date('2024-06-01T12:00:00');
    const end = new Date('2024-06-03T12:00:00');
    const delta = (end.getTime() - start.getTime()) / (24*6*3);

    for (let d = start.getTime(); d < end.getTime(); d += delta) {
      console.log(new Date(d), n.getValue(d));
    }
    expect(1).toBe(1);
  });
});
