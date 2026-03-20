import { extractCoordinatesFromText } from '../locationImport';

describe('locationImport', () => {
  const beijing = {
    latitude: 39.9042,
    longitude: 116.4074,
  };

  const shanghai = {
    latitude: 31.2304,
    longitude: 121.4737,
  };

  it.each([
    {
      name: 'plain latitude and longitude pairs',
      input: '39.9042, 116.4074',
      expected: beijing,
    },
    {
      name: 'AMap marker URLs that use lng,lat ordering',
      input: 'https://uri.amap.com/marker?position=116.4074,39.9042&name=test',
      expected: beijing,
    },
    {
      name: 'Baidu marker URLs that expose location coordinates',
      input: 'baidumap://map/marker?location=31.2304,121.4737&title=test',
      expected: shanghai,
    },
    {
      name: 'Tencent marker share URLs',
      input: 'https://apis.map.qq.com/uri/v1/marker?marker=coord:31.2304,121.4737;title:test',
      expected: shanghai,
    },
    {
      name: 'Google search links that use query coordinates',
      input: 'https://www.google.com/maps/search/?api=1&query=31.2304,121.4737',
      expected: shanghai,
    },
    {
      name: 'Apple Maps links that use ll coordinates',
      input: 'https://maps.apple.com/?ll=31.2304,121.4737',
      expected: shanghai,
    },
    {
      name: 'URLs that expose lat and lon query parameters',
      input: 'https://example.com/map?lat=31.2304&lon=121.4737',
      expected: shanghai,
    },
    {
      name: 'URLs that expose lon and lat query parameters in reverse order',
      input: 'https://example.com/map?lng=121.4737&lat=31.2304',
      expected: shanghai,
    },
    {
      name: 'navigation links that use destination coordinates',
      input: 'https://www.google.com/maps/dir/?api=1&destination=31.2304,121.4737',
      expected: shanghai,
    },
    {
      name: 'geo URIs that include a labeled q parameter',
      input: 'geo:0,0?q=31.2304,121.4737(SceneLens)',
      expected: shanghai,
    },
    {
      name: 'app callback links that use the scenelens location-import scheme',
      input: 'scenelens://location-import?lat=31.2304&lng=121.4737',
      expected: shanghai,
    },
    {
      name: 'Chinese coordinate text shared from map apps',
      input: '纬度: 31.2304, 经度: 121.4737',
      expected: shanghai,
    },
    {
      name: 'Chinese coordinate text in longitude-first order',
      input: '经度: 121.4737, 纬度: 31.2304',
      expected: shanghai,
    },
    {
      name: 'English coordinate text in longitude-first order',
      input: 'longitude: 121.4737 latitude: 31.2304',
      expected: shanghai,
    },
    {
      name: 'malformed URI encoding while still containing plain coordinates',
      input: '100% ready: 39.9042,116.4074',
      expected: beijing,
    },
  ])('parses $name', ({ input, expected }) => {
    expect(extractCoordinatesFromText(input)).toEqual(expected);
  });

  it('returns null for invalid coordinates', () => {
    expect(extractCoordinatesFromText('200, 300')).toBeNull();
  });

  it('returns null for unsupported text without coordinates', () => {
    expect(extractCoordinatesFromText('把这个位置发给 SceneLens')).toBeNull();
  });

  it('rejects out-of-range coordinates even when they appear in provider-style parameters', () => {
    expect(
      extractCoordinatesFromText('https://www.google.com/maps/search/?api=1&query=131.2304,221.4737')
    ).toBeNull();
  });
});
