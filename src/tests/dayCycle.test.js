import {expect, describe, it} from 'vitest';
import {
  time2yearRad,
  getSunset,
  getSunrise,
  getTodayCycle,
  getLatestEvent,
} from '../components/Ecosystem/dayCycle';

describe('dayCycle', () => {
  it('time2yearRad', () => {
    for (let d = 1; d < 365; d += 7) {
      const t = new Date(2024, 0, d);
      console.log(t, time2yearRad(t));
    }
    expect(1).toBe(1);
  });

  it('getSunset/getSunrise', () => {
    for (let d = 1; d < 365; d += 7) {
      const t = new Date(2024, 0, d);
      console.log(
        t,
        getSunset(t).toLocaleString(),
        getSunrise(t).toLocaleString()
      );
    }
    expect(1).toBe(1);
  });

  it('getEvent', () => {
    const la = new Date(1);
    const t = new Date().valueOf();
    const ds = getTodayCycle();
    for (const e of ds) {
      console.log('ts:', e.ts.toLocaleString(), 'name;', e.name);
    }
    for (let i = 0; i < 50; i++) {
      const t1 = new Date(t + i * 60 * 20 * 1000);
      console.log(t1.toLocaleString(), getLatestEvent(la, ds, t1));
    }
    expect(1).toBe(1);
  });
});
