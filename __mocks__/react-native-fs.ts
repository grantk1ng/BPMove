export default {
  DocumentDirectoryPath: '/mock/documents',
  CachesDirectoryPath: '/mock/caches',
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(''),
  unlink: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(true),
};
