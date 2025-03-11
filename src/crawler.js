import { CheerioCrawler } from 'crawlee';

const crawler = new CheerioCrawler({
    // Function called for each URL
    async requestHandler({ pushData, request, body }) {
        const regex = /https?.*mp4/g;
        const videoUrls = [];
        const found = body.match(regex);
        if (found) {
            videoUrls.push(...new Set(found));
            await pushData({
                vidoes: videoUrls,
            });
        }
    },
});

await crawler.addRequests([
    'https://www.twidouga.net/ko/ranking_t1.php',
    'https://www.twidouga.net/ko/ranking_t2.php',
]);

// Run the crawler
await crawler.run();

const cmd1 = 'wrangler kv:key put --namespace-id d620fc69264c4085bdf528b80014e6cc "t1" "$(cat ./storage/datasets/default/000000001.json)"';
const cmd2 = 'wrangler kv:key put --namespace-id d620fc69264c4085bdf528b80014e6cc "t2" "$(cat ./storage/datasets/default/000000002.json)"';
console.log(cmd1);
console.log(cmd2);