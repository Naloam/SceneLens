export interface ImportedCoordinates {
  latitude: number;
  longitude: number;
}

function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function buildCoordinates(latitude: number, longitude: number): ImportedCoordinates | null {
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function safelyDecodeText(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

export function extractCoordinatesFromText(text: string): ImportedCoordinates | null {
  const normalized = safelyDecodeText(text).replace(/\+/g, ' ');

  const explicitPatterns: Array<{
    pattern: RegExp;
    map: (match: RegExpMatchArray) => ImportedCoordinates | null;
  }> = [
    {
      // AMap marker URL uses position=lng,lat
      pattern: /(?:^|[?&])position=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[2]), Number.parseFloat(match[1])),
    },
    {
      pattern: /(?:^|[?&])location=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[1]), Number.parseFloat(match[2])),
    },
    {
      pattern: /(?:^|[?&])(?:query|center|ll|sll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[1]), Number.parseFloat(match[2])),
    },
    {
      pattern: /(?:^|[?&])q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[1]), Number.parseFloat(match[2])),
    },
    {
      pattern: /(?:^|[?&])(?:query|q)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\([^)]*\)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[1]), Number.parseFloat(match[2])),
    },
    {
      pattern: /(?:^|[?&])(?:destination|dest|daddr)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[1]), Number.parseFloat(match[2])),
    },
    {
      pattern: /(?:^|[?&])lat(?:itude)?=(-?\d+(?:\.\d+)?)[&;](?:lng|lon|longitude)=(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[1]), Number.parseFloat(match[2])),
    },
    {
      pattern: /(?:^|[?&])(?:lng|lon|longitude)=(-?\d+(?:\.\d+)?)[&;]lat(?:itude)?=(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[2]), Number.parseFloat(match[1])),
    },
    {
      pattern: /coord[:=](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[1]), Number.parseFloat(match[2])),
    },
    {
      pattern: /纬度[：:\s]+(-?\d+(?:\.\d+)?)\s*[，, ]+\s*经度[：:\s]+(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[1]), Number.parseFloat(match[2])),
    },
    {
      pattern: /经度[：:\s]+(-?\d+(?:\.\d+)?)\s*[，, ]+\s*纬度[：:\s]+(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[2]), Number.parseFloat(match[1])),
    },
    {
      pattern: /lat(?:itude)?[：:\s=]+(-?\d+(?:\.\d+)?)\s*[，, ]+\s*(?:lng|lon|longitude)[：:\s=]+(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[1]), Number.parseFloat(match[2])),
    },
    {
      pattern: /(?:lng|lon|longitude)[：:\s=]+(-?\d+(?:\.\d+)?)\s*[，, ]+\s*lat(?:itude)?[：:\s=]+(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[2]), Number.parseFloat(match[1])),
    },
  ];

  for (const { pattern, map } of explicitPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const coordinates = map(match);
      if (coordinates) {
        return coordinates;
      }
    }
  }

  const fallback = normalized.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!fallback) {
    return null;
  }

  return buildCoordinates(
    Number.parseFloat(fallback[1]),
    Number.parseFloat(fallback[2])
  );
}
