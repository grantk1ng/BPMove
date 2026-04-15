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
import type {
  TrackMetadata,
  PlaybackState,
  ProviderPlaybackState,
} from '../modules/music/types';

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
  'music:providerPlaybackChanged': ProviderPlaybackState;
  'music:error': {message: string};
  'music:trackEnded': {trackId: string};

  'session:started': {sessionId: string};
  'session:ended': {sessionId: string; reason: string};

  'provider:loading': {providerName: string};
  'provider:ready': {providerName: string; trackCount: number};
  'provider:error': {providerName: string; error: string};
  'provider:fallback': {from: string; to: string; reason: string};
  'music:trackSwitchBlocked': {reason: string; cooldownRemainingMs: number};
}
