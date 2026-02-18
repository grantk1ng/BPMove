/** Raw heart rate reading from BLE device */
export interface HeartRateReading {
  /** Heart rate in beats per minute */
  bpm: number;
  /** Unix timestamp in milliseconds when the reading was received */
  timestamp: number;
  /** Whether the sensor detected skin contact (if supported) */
  sensorContact: boolean;
  /** RR intervals in milliseconds (inter-beat intervals), if present */
  rrIntervals: number[];
  /** Energy expended in kilojoules, if present (resets periodically) */
  energyExpended: number | null;
}

/** BLE device information for discovered heart rate monitors */
export interface BleDeviceInfo {
  id: string;
  name: string | null;
  rssi: number;
}

/** Connection lifecycle states */
export type ConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

/** Public interface for HeartRateService — enables mocking */
export interface HeartRateServiceInterface {
  startScan(): void;
  stopScan(): void;
  connect(deviceId: string): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionState(): ConnectionState;
  getLastReading(): HeartRateReading | null;
  destroy(): void;
}
