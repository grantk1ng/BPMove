/**
 * Parses the Bluetooth GATT Heart Rate Measurement characteristic (0x2A37).
 *
 * Byte layout (per Bluetooth SIG spec):
 *   Byte 0: Flags
 *     - Bit 0: HR format (0 = uint8, 1 = uint16)
 *     - Bit 1-2: Sensor contact status
 *     - Bit 3: Energy expended present
 *     - Bit 4: RR-interval present
 *   Byte 1(+2): Heart rate value
 *   Optional: Energy expended (uint16 LE)
 *   Optional: RR-intervals (uint16 LE each, in 1/1024 sec units)
 */
export interface ParsedHeartRate {
  bpm: number;
  sensorContact: boolean;
  rrIntervals: number[];
  energyExpended: number | null;
}

export function parseHeartRateMeasurement(bytes: number[]): ParsedHeartRate {
  if (bytes.length < 2) {
    throw new Error('Heart rate measurement requires at least 2 bytes');
  }

  const flags = bytes[0];
  const isUint16 = (flags & 0x01) !== 0;
  const sensorContactSupported = (flags & 0x04) !== 0;
  const sensorContact = sensorContactSupported ? (flags & 0x02) !== 0 : false;
  const energyExpendedPresent = (flags & 0x08) !== 0;
  const rrIntervalPresent = (flags & 0x10) !== 0;

  let offset = 1;

  // Parse heart rate value
  let bpm: number;
  if (isUint16) {
    if (bytes.length < 3) {
      throw new Error('uint16 HR format requires at least 3 bytes');
    }
    bpm = bytes[offset] | (bytes[offset + 1] << 8);
    offset += 2;
  } else {
    bpm = bytes[offset];
    offset += 1;
  }

  // Parse energy expended
  let energyExpended: number | null = null;
  if (energyExpendedPresent) {
    if (offset + 2 > bytes.length) {
      throw new Error('Energy expended field expected but not enough bytes');
    }
    energyExpended = bytes[offset] | (bytes[offset + 1] << 8);
    offset += 2;
  }

  // Parse RR intervals
  const rrIntervals: number[] = [];
  if (rrIntervalPresent) {
    while (offset + 1 < bytes.length) {
      const rawRR = bytes[offset] | (bytes[offset + 1] << 8);
      // Convert from 1/1024 seconds to milliseconds
      rrIntervals.push(Math.round((rawRR / 1024) * 1000));
      offset += 2;
    }
  }

  return {bpm, sensorContact, rrIntervals, energyExpended};
}
