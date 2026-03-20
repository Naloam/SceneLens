export const documentDirectory = 'file:///mock-documents/';
export const cacheDirectory = 'file:///mock-cache/';
export const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
} as const;

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

export const writeAsStringAsync = jest.fn(async () => {});

export const getContentUriAsync = jest.fn(async (uri: string) => `content://${uri.replace('file:///', '')}`);
