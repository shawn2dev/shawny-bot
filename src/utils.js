import * as cheerio from 'cheerio';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: 'https://www.twidouga.net/',
};

function redactSecret(value, secret) {
  if (!secret) return value.slice(0, 1000);
  return value
    .replaceAll(secret, '[REDACTED]')
    .replaceAll(encodeURIComponent(secret), '[REDACTED]')
    .slice(0, 1000);
}

export async function getRandomMp4(url, options = {}) {
  const { scraperApiKey } = options;
  const service = scraperApiKey ? 'ScraperAPI' : 'origin server';
  const fetchUrl = scraperApiKey
    ? `https://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}`
    : url;
  const response = await fetch(fetchUrl, {
    headers: scraperApiKey ? {} : BROWSER_HEADERS,
  });

  if (!response.ok) {
    const responseBody = await response.text();
    const error = new Error(
      `Failed to fetch URL: ${response.status} ${response.statusText}`,
    );
    error.details = {
      stage: 'fetch',
      service,
      targetUrl: url,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      retryAfter: response.headers.get('retry-after'),
      responseBody: redactSecret(responseBody, scraperApiKey),
    };
    throw error;
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const mp4Urls = [];

  $('a[href$=".mp4"], [data-video]').each((i, el) => {
    const candidates = [$(el).attr('href'), $(el).attr('data-video')];
    for (const candidate of candidates) {
      if (!candidate) continue;
      // Make absolute URL if relative
      const absoluteUrl = new URL(candidate, url).href;
      if (!mp4Urls.includes(absoluteUrl)) mp4Urls.push(absoluteUrl);
    }
  });

  if (mp4Urls.length === 0) {
    const error = new Error('No MP4 files found at the given URL');
    error.details = {
      stage: 'parse',
      service,
      targetUrl: url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      responseLength: html.length,
    };
    throw error;
  }

  const randomIndex = Math.floor(Math.random() * mp4Urls.length);
  return mp4Urls[randomIndex];
}
