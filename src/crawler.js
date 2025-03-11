import { FileDownload } from 'crawlee';

// Create a FileDownload - a custom crawler instance that will download files from URLs.
const crawler = new FileDownload({
    async requestHandler({ body, request, contentType, getKeyValueStore }) {
        const url = new URL(request.url);
        const kvs = await getKeyValueStore();

        await kvs.setValue(url.pathname.replace(/\//g, '_'), body, { contentType: contentType.type });
    },
});

// The initial list of URLs to crawl. Here we use just a few hard-coded URLs.
await crawler.addRequests([
    'https://www.twidouga.net/ko/ranking_t1.php',
]);

// Run the downloader and wait for it to finish.
await crawler.run();

console.log('Crawler finished.');