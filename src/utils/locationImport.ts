export interface ImportedCoordinates {
  latitude: number;
  longitude: number;
}

const AMAP_SHORT_URL_PATTERN = /^https?:\/\/surl\.amap\.com\/[A-Za-z0-9]+/i;
const AMAP_PLACEHOLDER_PATTERN =
  /(?:surl\.amap\.com|m\.amap\.com\/callAPP|androidamap\?action=shorturl|viewMap\?sourceApplication=from_wb)/i;
const AMAP_Q_COORDINATES_PATTERN =
  /(?:^|[?&])q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|(?:%2C)|$)/i;
const AMAP_Q_SOURCE_PATTERN =
  /(?:^https?:\/\/(?:m|www)\.amap\.com\/\?q=|(?:^|[?&])android=androidamap|androidamap\?action=shorturl|(?:^|[?&])mo=https?:\/\/m\.amap\.com\/\?q=)/i;
const ZERO_COORDINATE_PATTERN =
  /(?:^|[?&])(?:q|position|location)=0(?:\.0+)?,0(?:\.0+)?(?:,|$)|(?:^|[?&])lat(?:itude)?=0(?:\.0+)?[&;](?:lng|lon|longitude)=0(?:\.0+)?|(?:^|[?&])(?:lng|lon|longitude)=0(?:\.0+)?[&;]lat(?:itude)?=0(?:\.0+)?/i;
const HTTP_URL_CANDIDATE_PATTERN = /https?:\/\/[^\s<>"'，。！？；、）】]+/gi;
const TRAILING_URL_PUNCTUATION_PATTERN = /[),.;!?，。！？；、】）>]+$/;
const RESOLVABLE_MAP_URL_PATTERN =
  /^https?:\/\/(?:surl\.amap\.com|uri\.amap\.com|(?:m|www)\.amap\.com|(?:api\.)?map\.baidu\.com|j\.map\.baidu\.com|apis\.map\.qq\.com|map\.qq\.com|maps\.app\.goo\.gl|maps\.apple\.com|www\.google\.com\/maps)\b/i;

export function isLikelyAmapShortUrl(text: string): boolean {
  return AMAP_SHORT_URL_PATTERN.test(text.trim());
}

export function isAmapPlaceholderLocationText(text: string): boolean {
  const normalized = normalizeImportText(text);
  return AMAP_PLACEHOLDER_PATTERN.test(normalized) && ZERO_COORDINATE_PATTERN.test(normalized);
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

function sanitizeCoordinates(
  coordinates: ImportedCoordinates | null,
  sourceText: string
): ImportedCoordinates | null {
  if (!coordinates) {
    return null;
  }

  // AMap short-link fallbacks frequently expose 0,0 placeholders. Treat them as unresolved.
  if (
    coordinates.latitude === 0 &&
    coordinates.longitude === 0 &&
    isAmapPlaceholderLocationText(sourceText)
  ) {
    return null;
  }

  return coordinates;
}

function safelyDecodeText(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function normalizeImportText(text: string): string {
  return safelyDecodeText(text)
    .replace(/\+/g, ' ')
    .replace(/[，﹐、]/g, ',')
    .replace(/[；]/g, ';')
    .replace(/[：]/g, ':')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')');
}

function trimUrlCandidate(text: string): string {
  return text.replace(TRAILING_URL_PUNCTUATION_PATTERN, '').trim();
}

function extractHttpUrlCandidates(text: string): string[] {
  const candidates = new Set<string>();

  for (const sourceText of [text, safelyDecodeText(text)]) {
    for (const match of sourceText.match(HTTP_URL_CANDIDATE_PATTERN) ?? []) {
      const candidate = trimUrlCandidate(match);
      if (candidate) {
        candidates.add(candidate);
      }
    }
  }

  return [...candidates];
}

function findAmapShortUrlCandidate(text: string): string | null {
  return extractHttpUrlCandidates(text).find((candidate) => AMAP_SHORT_URL_PATTERN.test(candidate)) ?? null;
}

export function extractAmapShortUrlCandidate(text: string): string | null {
  return findAmapShortUrlCandidate(text);
}

function findResolvableMapUrlCandidate(text: string): string | null {
  return (
    extractHttpUrlCandidates(text).find(
      (candidate) =>
        RESOLVABLE_MAP_URL_PATTERN.test(candidate) && !extractCoordinatesFromText(candidate)
    ) ?? null
  );
}

async function resolveUrlCandidate(
  url: string,
  fetchImpl: typeof fetch
): Promise<string> {
  try {
    let redirectedUrl: string | null = null;
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
    });

    if (response.url) {
      redirectedUrl = trimUrlCandidate(response.url.trim());
      if (redirectedUrl === url) {
        redirectedUrl = null;
      }
    }

    const responseText = await response.text();
    if (responseText?.trim() && extractCoordinatesFromText(responseText)) {
      return responseText.trim();
    }

    if (redirectedUrl) {
      return redirectedUrl;
    }
  } catch {
    // Keep the original shared text when provider-side expansion fails.
  }

  return url;
}

export async function resolveLocationImportText(
  text: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const normalized = text.trim();
  if (!normalized || extractCoordinatesFromText(normalized)) {
    return normalized;
  }

  const amapShortUrl = findAmapShortUrlCandidate(normalized);
  if (amapShortUrl) {
    const resolvedShortUrl = await resolveUrlCandidate(amapShortUrl, fetchImpl);
    if (resolvedShortUrl !== amapShortUrl) {
      return normalized.includes(amapShortUrl)
        ? normalized.replace(amapShortUrl, resolvedShortUrl)
        : resolvedShortUrl;
    }
  }

  const mapUrlCandidate = findResolvableMapUrlCandidate(normalized);
  if (!mapUrlCandidate) {
    return normalized;
  }

  const resolvedMapUrl = await resolveUrlCandidate(mapUrlCandidate, fetchImpl);
  if (resolvedMapUrl !== mapUrlCandidate) {
    return normalized.includes(mapUrlCandidate)
      ? normalized.replace(mapUrlCandidate, resolvedMapUrl)
      : resolvedMapUrl;
  }

  return normalized;
}

export function extractCoordinatesFromText(text: string): ImportedCoordinates | null {
  const normalized = normalizeImportText(text);

  const amapQMatch = normalized.match(AMAP_Q_COORDINATES_PATTERN);
  if (amapQMatch && AMAP_Q_SOURCE_PATTERN.test(normalized)) {
    return sanitizeCoordinates(
      buildCoordinates(Number.parseFloat(amapQMatch[2]), Number.parseFloat(amapQMatch[1])),
      normalized
    );
  }

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
      pattern:
        /(?:^|[?&])lat(?:itude)?=(-?\d+(?:\.\d+)?)[&;](?:lng|lon|longitude)=(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[1]), Number.parseFloat(match[2])),
    },
    {
      pattern:
        /(?:^|[?&])(?:lng|lon|longitude)=(-?\d+(?:\.\d+)?)[&;]lat(?:itude)?=(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[2]), Number.parseFloat(match[1])),
    },
    {
      pattern: /coord[:=](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[1]), Number.parseFloat(match[2])),
    },
    {
      pattern: /纬度[:\s]+(-?\d+(?:\.\d+)?)\s*[, ]+\s*经度[:\s]+(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[1]), Number.parseFloat(match[2])),
    },
    {
      pattern: /经度[:\s]+(-?\d+(?:\.\d+)?)\s*[, ]+\s*纬度[:\s]+(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[2]), Number.parseFloat(match[1])),
    },
    {
      pattern:
        /latitude[:\s=]+(-?\d+(?:\.\d+)?)\s*[, ]+\s*(?:lng|lon|longitude)[:\s=]+(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[1]), Number.parseFloat(match[2])),
    },
    {
      pattern:
        /(?:lng|lon|longitude)[:\s=]+(-?\d+(?:\.\d+)?)\s*[, ]+\s*latitude[:\s=]+(-?\d+(?:\.\d+)?)/i,
      map: (match) => buildCoordinates(Number.parseFloat(match[2]), Number.parseFloat(match[1])),
    },
  ];

  for (const { pattern, map } of explicitPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const coordinates = map(match);
      if (coordinates) {
        return sanitizeCoordinates(coordinates, normalized);
      }
    }
  }

  const fallback = normalized.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!fallback) {
    return null;
  }

  return sanitizeCoordinates(
    buildCoordinates(
      Number.parseFloat(fallback[1]),
      Number.parseFloat(fallback[2])
    ),
    normalized
  );
}
