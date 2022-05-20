const Apify = require('apify');

const {
    utils: { log },
} = Apify;

Apify.main(async () => {
    const input = await Apify.getInput();
    if (!input || !input.scrapingBoard) {
        throw new Error('Please input scrapingBoard field');
    }

    const { scrapingBoard, pages = 3 } = input;
    const requestQueue = await Apify.openRequestQueue();

    const url = 'https://www.ptt.cc/bbs/' + scrapingBoard + '/index.html';

    await requestQueue.addRequest({ url });

    let items = []

    const handlePageFunction = async ({ request, $ }) => {
        const title = $('title').text();

        log.info(`The title of "${request.url}" is: ${title}.`);
        if (request.url === url) {
            const maxNumber = $('#action-bar-container > div > div.btn-group.btn-group-paging > a:nth-child(2)').attr('href').match(/index([0-9]+).html/)[1]
            log.info(maxNumber);
            const urls = Array.from(Array(pages).keys()).map(i => ({
                url: `https://www.ptt.cc/bbs/${scrapingBoard}/index${maxNumber - i}.html`
            }));
            for (const url of urls) {
                await requestQueue.addRequest(url)
            }
        }

        const results = $('.r-ent').map(function (index, element) {
            return {
                nrec: $(this).find('.nrec').text(),
                id: $(this).find('.title a').attr('href'),
                title: $(this).find('.title a').text(),
                author: $(this).find('.meta .author').text(),
                date: $(this).find('.meta .date').text()
            }
        }).get()

        items = items.concat(results);
    };

    // Set up the crawler, passing a single options object as an argument.
    const crawler = new Apify.CheerioCrawler({
        requestQueue,
        handlePageFunction,
    });

    await crawler.run();

    await requestQueue.isFinished();

    log.info(`Crawler finished, items: ${items.length}`)

    // Use Default Dataset associated with the actor
    await Apify.pushData(items);
    console.log('Saving output...');
});