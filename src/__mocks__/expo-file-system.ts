export const cacheDirectory = 'file:///mock-cache/';

export const getInfoAsync = jest.fn(async (uri: string) => ({
  exists: uri.startsWith('file:///mock-cache/existing-'),
  size: 1024,
  uri,
}));

export const downloadAsync = jest.fn(async (from: string, to: string) => ({
  uri: to,
  status: 200,
  headers: {},
  md5: null,
}));
