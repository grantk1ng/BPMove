module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-ble-plx|react-native-track-player|react-native-safe-area-context|react-native-svg|react-native-screens|react-native-fs|react-native-share|react-native-background-actions|react-native-permissions|react-native-spotify-remote|react-native-config|@react-native-async-storage)/)',
  ],
  moduleNameMapper: {
    '\\.(mp3|wav|aac|ogg|flac)$': '<rootDir>/__mocks__/audioFileMock.ts',
  },
};
