import * as cheerio from 'cheerio';

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://www.twidouga.net/',
};

export async function getRandomMp4(url, options = {}) {
    const { scraperApiKey } = options;
    const fetchUrl = scraperApiKey
        ? `https://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}`
        : url;

    const loadHtml = async (targetUrl, headers = {}) => {
        const response = await fetch(targetUrl, {
            headers: scraperApiKey ? {} : { ...BROWSER_HEADERS, ...headers },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
        }

        return response.text();
    };

    let html;
    try {
        html = await loadHtml(fetchUrl);
    } catch (error) {
        const proxyUrl = `https://r.jina.ai/http://${url}`;
        try {
            html = await loadHtml(proxyUrl, { 'X-Requested-With': 'XMLHttpRequest' });
        } catch (proxyError) {
            throw proxyError;
        }
    }

    const $ = cheerio.load(html);
    const mp4Urls = [];

    $('[data-video$=".mp4"]').each((i, el) => {
        const dataVideo = $(el).attr('data-video');
        if (!dataVideo) {
            return;
        }

        // Make absolute URL if relative
        const absoluteUrl = new URL(dataVideo, url).href;
        mp4Urls.push(absoluteUrl);
    });
    
    if (mp4Urls.length === 0) {
        throw new Error('No MP4 files found at the given URL');
    }
    
    const randomIndex = Math.floor(Math.random() * mp4Urls.length);
    return mp4Urls[randomIndex];
}