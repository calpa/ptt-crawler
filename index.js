const Apify = require('apify');

const {
    utils: { log },
} = Apify;

async function generateOutput (page) {
    const results = await page.$$eval('.r-ent', (elements) => elements.map(element => {
        let id;

        try {
            id = element.querySelector('.title').outerHTML.match(/\/[a-z]+\/[\w]+\/([\w.]+).html/)[0];
        } catch (error) {
            console.error(error);
        }

        return {
            nrec: element.querySelector('.nrec').innerText,
            // id: element.querySelector('.title').outerHTML,
            // id: title.href,
            id,
            title: element.querySelector('.title').innerText,
            author: element.querySelector('.meta .author').innerText,
            date: element.querySelector('.meta .date').innerText
        }
    }));

    return results;
}

Apify.main(async () => {
    const input = await Apify.getInput();
    if (!input || !input.scrapingBoard) {
        throw new Error('Please input scrapingBoard field');
    }

    const { scrapingBoard, pages = 3 } = input;

    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3723.0 Safari/537.36';
    const stopSelector = '#main-container > div.r-list-container.action-bar-margin.bbs-screen';

    const url = 'https://www.ptt.cc/bbs/' + scrapingBoard + '/index.html';

    log.info('Launching Puppeteer...');
    const launchContext = {
        launchOptions: {
            headless: true
        }
    }

    const browser = await Apify.launchPuppeteer(launchContext);
    const page = await browser.newPage()
    await page.setDefaultNavigationTimeout(180 * 1000); // 3 mins
    await page.setRequestInterception(true);

    page.on('request', request => {
        if (request.resourceType() === 'image')
            request.abort();
        else
            request.continue();
    });

    page.setUserAgent(userAgent);
    let items = []
    try {
        await page.goto(url);
        const over18Button = await page.$('.over18-button-container');
        if (over18Button) {
            over18Button.click();
        }
        await page.waitForSelector(stopSelector);

        const title = await page.title();
        log.info(`Title of the page "${url}" is "${title}".`);

        items = await generateOutput(page);

        for (let number = 0; number < pages; number++) {
            await page.click("#action-bar-container > div > div.btn-group.btn-group-paging > a:nth-child(2)");

            await page.waitForSelector(stopSelector);
            log.info(`Page loaded: ${page.url()}`)
            const currentPageItems = await generateOutput(page)
            log.info(`There are ${currentPageItems.length} threads in Page: ${page.url()}`)
            items = items.concat(currentPageItems)
        }

        // log.info(JSON.stringify(items))

        log.info(`Total numbers of items: ${items.length}`)

        const dataset = await Apify.openDataset(`ptt-${scrapingBoard}`)
        await dataset.pushData(items);
        console.log('Saving output...');


        console.log('Closing Puppeteer...');
        await browser.close();
        console.log('Done.');

    } catch (err) {
        console.error(err)
    }
});
