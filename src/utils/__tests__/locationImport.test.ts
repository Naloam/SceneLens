import { extractCoordinatesFromText } from '../locationImport';

describe('locationImport', () => {
  it('parses plain latitude and longitude pairs', () => {
    expect(extractCoordinatesFromText('39.9042, 116.4074')).toEqual({
      latitude: 39.9042,
      longitude: 116.4074,
    });
  });

  it('parses AMap marker URLs that use lng,lat ordering', () => {
    expect(
      extractCoordinatesFromText('https://uri.amap.com/marker?position=116.4074,39.9042&name=test')
    ).toEqual({
      latitude: 39.9042,
      longitude: 116.4074,
    });
  });

  it('parses location text shared from map apps', () => {
    expect(extractCoordinatesFromText('纬度: 31.2304, 经度: 121.4737')).toEqual({
      latitude: 31.2304,
      longitude: 121.4737,
    });
  });

  it('parses URLs that expose lat and lon query parameters', () => {
    expect(
      extractCoordinatesFromText('https://example.com/map?lat=31.2304&lon=121.4737')
    ).toEqual({
      latitude: 31.2304,
      longitude: 121.4737,
    });
  });

  it('parses navigation links that use destination coordinates', () => {
    expect(
      extractCoordinatesFromText('https://www.google.com/maps/dir/?api=1&destination=31.2304,121.4737')
    ).toEqual({
      latitude: 31.2304,
      longitude: 121.4737,
    });
  });

  it('parses app callback links that use the scenelens location-import scheme', () => {
    expect(
      extractCoordinatesFromText('scenelens://location-import?lat=31.2304&lng=121.4737')
    ).toEqual({
      latitude: 31.2304,
      longitude: 121.4737,
    });
  });

  it('ignores malformed URI encoding and still parses plain coordinates', () => {
    expect(extractCoordinatesFromText('100% ready: 39.9042,116.4074')).toEqual({
      latitude: 39.9042,
      longitude: 116.4074,
    });
  });

  it('returns null for invalid coordinates', () => {
    expect(extractCoordinatesFromText('200, 300')).toBeNull();
  });
});
