export const ApiScope = {
  AppRemoteControlScope: 'app-remote-control',
  UserLibraryReadScope: 'user-library-read',
  UserReadPlaybackStateScope: 'user-read-playback-state',
  UserReadCurrentlyPlayingScope: 'user-read-currently-playing',
  UserModifyPlaybackStateScope: 'user-modify-playback-state',
  PlaylistReadPrivateScope: 'playlist-read-private',
};

export const auth = {
  authorize: jest.fn().mockResolvedValue({
    accessToken: 'mock-token',
    refreshToken: 'mock-refresh',
    expirationDate: new Date(Date.now() + 3600000).toISOString(),
    expired: false,
  }),
  endSession: jest.fn().mockResolvedValue(undefined),
  getSession: jest.fn().mockResolvedValue(undefined),
};

export const remote = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  isConnectedAsync: jest.fn().mockResolvedValue(false),
  playUri: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn().mockResolvedValue(undefined),
  resume: jest.fn().mockResolvedValue(undefined),
  getPlayerState: jest.fn().mockResolvedValue({
    track: {name: 'Mock Track', uri: 'spotify:track:123', duration: 200000},
    playbackPosition: 0,
    isPaused: true,
  }),
  on: jest.fn(),
};
