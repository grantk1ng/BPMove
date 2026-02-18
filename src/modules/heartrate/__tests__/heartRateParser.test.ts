import {parseHeartRateMeasurement} from '../utils/heartRateParser';

describe('parseHeartRateMeasurement', () => {
  it('parses uint8 HR format with no extras', () => {
    // Flags: 0x00 (uint8 HR, no contact, no energy, no RR)
    // HR: 72
    const result = parseHeartRateMeasurement([0x00, 72]);
    expect(result.bpm).toBe(72);
    expect(result.sensorContact).toBe(false);
    expect(result.rrIntervals).toEqual([]);
    expect(result.energyExpended).toBeNull();
  });

  it('parses uint16 HR format', () => {
    // Flags: 0x01 (uint16 HR)
    // HR: 0x0100 = 256 (little endian)
    const result = parseHeartRateMeasurement([0x01, 0x00, 0x01]);
    expect(result.bpm).toBe(256);
  });

  it('parses sensor contact supported and detected', () => {
    // Flags: 0x06 (bits 1+2 set: contact supported + detected)
    // HR: 85
    const result = parseHeartRateMeasurement([0x06, 85]);
    expect(result.bpm).toBe(85);
    expect(result.sensorContact).toBe(true);
  });

  it('parses sensor contact supported but not detected', () => {
    // Flags: 0x04 (bit 2 set: contact supported, bit 1 clear: not detected)
    const result = parseHeartRateMeasurement([0x04, 85]);
    expect(result.sensorContact).toBe(false);
  });

  it('parses energy expended field', () => {
    // Flags: 0x08 (energy expended present)
    // HR: 70
    // Energy: 0x0032 = 50 kJ (little endian)
    const result = parseHeartRateMeasurement([0x08, 70, 0x32, 0x00]);
    expect(result.bpm).toBe(70);
    expect(result.energyExpended).toBe(50);
  });

  it('parses RR intervals', () => {
    // Flags: 0x10 (RR interval present)
    // HR: 75
    // RR1: 0x0400 = 1024 (in 1/1024 sec = 1000ms)
    // RR2: 0x0380 = 896 (in 1/1024 sec ≈ 875ms)
    const result = parseHeartRateMeasurement([
      0x10, 75, 0x00, 0x04, 0x80, 0x03,
    ]);
    expect(result.bpm).toBe(75);
    expect(result.rrIntervals).toHaveLength(2);
    expect(result.rrIntervals[0]).toBe(1000);
    expect(result.rrIntervals[1]).toBe(875);
  });

  it('parses uint16 HR with energy and RR intervals', () => {
    // Flags: 0x19 (uint16 + energy + RR)
    // HR: 0x0096 = 150 (little endian)
    // Energy: 0x0064 = 100 kJ
    // RR: 0x0200 = 512 (in 1/1024 sec = 500ms)
    const result = parseHeartRateMeasurement([
      0x19, 0x96, 0x00, 0x64, 0x00, 0x00, 0x02,
    ]);
    expect(result.bpm).toBe(150);
    expect(result.energyExpended).toBe(100);
    expect(result.rrIntervals).toHaveLength(1);
    expect(result.rrIntervals[0]).toBe(500);
  });

  it('throws on insufficient bytes', () => {
    expect(() => parseHeartRateMeasurement([0x00])).toThrow();
  });

  it('throws on uint16 format with insufficient bytes', () => {
    expect(() => parseHeartRateMeasurement([0x01, 0x60])).toThrow();
  });
});
