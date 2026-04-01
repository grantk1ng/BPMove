const TrackPlayer = {
  setupPlayer: jest.fn(async () => {}),
  updateOptions: jest.fn(async () => {}),
  add: jest.fn(async () => {}),
  play: jest.fn(async () => {}),
  pause: jest.fn(async () => {}),
  reset: jest.fn(async () => {}),
  getPlaybackState: jest.fn(async () => ({state: 'none'})),
  getProgress: jest.fn(async () => ({position: 0, duration: 0, buffered: 0})),
  addEventListener: jest.fn(() => () => {}),
};

export default TrackPlayer;

export const Event = {
  PlaybackState: 'playback-state',
  PlaybackError: 'playback-error',
  PlaybackActiveTrackChanged: 'playback-active-track-changed',
};

export const State = {
  None: 'none',
  Playing: 'playing',
  Paused: 'paused',
  Stopped: 'stopped',
  Buffering: 'buffering',
  Ready: 'ready',
};

export const Capability = {
  Play: 'play',
  Pause: 'pause',
  SkipToNext: 'skip-to-next',
  SkipToPrevious: 'skip-to-previous',
};

export const AppKilledPlaybackBehavior = {
  ContinuePlayback: 'continue-playback',
  StopPlaybackAndRemoveNotification: 'stop-playback-and-remove-notification',
};
