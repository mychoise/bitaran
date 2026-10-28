import { distanceInMetres } from './geo.util.js';

describe('distanceInMetres', () => {
  it('is zero for the same point', () => {
    expect(
      distanceInMetres({ lat: 27.7, lng: 85.3 }, { lat: 27.7, lng: 85.3 }),
    ).toBe(0);
  });

  it('matches known distances', () => {
    // One degree of latitude is about 111.2 km anywhere.
    expect(
      distanceInMetres({ lat: 27, lng: 85.3 }, { lat: 28, lng: 85.3 }),
    ).toBeCloseTo(111_195, -1);
    // Kathmandu Durbar Square to Patan Durbar Square: about 3.9 km.
    const d = distanceInMetres(
      { lat: 27.7044, lng: 85.3073 },
      { lat: 27.6727, lng: 85.3253 },
    );
    expect(d).toBeGreaterThan(3800);
    expect(d).toBeLessThan(4000);
  });

  it('is symmetric and handles antipodes', () => {
    const a = { lat: 27.6985, lng: 85.2961 };
    const b = { lat: 27.6849, lng: 85.2981 };
    expect(distanceInMetres(a, b)).toBeCloseTo(distanceInMetres(b, a), 6);
    expect(
      distanceInMetres({ lat: 0, lng: 0 }, { lat: 0, lng: 180 }),
    ).toBeCloseTo(Math.PI * 6_371_008.8, 0);
  });
});
