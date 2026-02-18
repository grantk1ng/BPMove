import type {
  HeartRateReading,
  ConnectionState,
  BleDeviceInfo,
} from '../modules/heartrate/types';
import type {
  BPMTarget,
  AlgorithmState,
  AlgorithmMode,
} from '../modules/algorithm/types';
import type {TrackMetadata, PlaybackState} from '../modules/music/types';

/**
 * Central event map. Every event in the system is defined here.
 * Provides compile-time safety for all emit/subscribe calls.
 */
export interface EventMap {
  'hr:reading': HeartRateReading;
  'hr:connected': BleDeviceInfo;
  'hr:disconnected': {deviceId: string; reason: string};
  'hr:connectionStateChanged': ConnectionState;
  'hr:scanResult': BleDeviceInfo;
  'hr:error': {message: string; code: string | null};

  'algo:target': BPMTarget;
  'algo:stateChanged': AlgorithmState;
  'algo:modeChanged': {from: AlgorithmMode; to: AlgorithmMode; timestamp: number};

  'music:changed': TrackMetadata;
  'music:playbackStateChanged': PlaybackState;
  'music:error': {message: string};

  'session:started': {sessionId: string};
  'session:ended': {sessionId: string; reason: string};
}
