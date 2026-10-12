const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = 'file://' + path.resolve(__dirname, '../index.html');

  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const waitForVisible = async (selector) => page.locator(selector).waitFor({ state: 'visible', timeout: 10000 });
  try {
    await page.goto(url, { waitUntil: 'load' });
    await waitForVisible('.brand');
    assert((await page.locator('#wallet').textContent()).includes('0'), 'New account must start at zero coins');

    await page.getByRole('button', { name: 'Earn', exact: true }).click();
    await waitForVisible('text=MicroTasks');
    for (let i = 0; i < 25; i++) {
      await page.getByRole('button', { name: /Earn 1 coin/ }).click();
    }
    assert((await page.locator('#wallet').textContent()).includes('25'), 'Earning must credit 25 coins');

    await page.getByRole('button', { name: 'Cases', exact: true }).click();
    await page.getByRole('button', { name: 'Purchase case' }).click();
    await waitForVisible('text=Sealed Arsenal Case');
    assert((await page.locator('#wallet').textContent()).includes('0'), 'Case purchase must debit wallet');

    await page.getByRole('button', { name: 'Keep item' }).click();
    await page.getByRole('button', { name: 'Inventory', exact: true }).click();
    await waitForVisible('.item');
    assert(await page.locator('.item').count() === 1, 'Purchase must create one owned sealed case');

    await page.reload({ waitUntil: 'load' });
    assert(await page.locator('.item').count() === 1, 'Case ownership must survive page reload');

    await page.getByRole('button', { name: 'Inspect / trade' }).click();
    await page.getByRole('button', { name: 'Open case' }).click();
    // Regression: every reel card must use the same per-item finish shader
    // as the inspect screen, not a CSS rule leaking from its neighbors.
    const expectedReward=await page.evaluate(() => JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')).items.find(x => x.kind==='skin'));
    const reelColors=await page.evaluate(() => [...document.querySelectorAll('#track .tile')].map(tile=>{
      const art=tile.querySelector('.weapon-master,.master-raster');
      const image=tile.querySelector('.master-raster > img');
      const svg=tile.querySelector('svg.arsenal-master');
      const colored=svg?.querySelector('.finish');
      const gradient=svg?.querySelector('linearGradient[id$="f"]');
      return {
        index:Number(tile.dataset.reelIndex),
        weapon:art?.dataset.weaponModel,finish:art?.dataset.finish,
        kind:image?'bitmap':'svg',
        src:image?.getAttribute('src'),
        loaded:image?image.complete&&image.naturalWidth>0:null,
        rootId:svg?.id,
        computedFill:colored?getComputedStyle(colored).fill:'',
        stops:[...(gradient?.querySelectorAll('stop')||[])].map(x=>x.getAttribute('stop-color'))
      };
    }));
    // Fail if any new bitmap is referenced but broken or still pending after loading.
    await page.waitForFunction(() => [...document.querySelectorAll('#track .master-raster > img')].every(img => img.complete && img.naturalWidth > 0),undefined,{timeout:5000}).catch(()=>{throw Error('Opening reel has broken bitmap artwork')});
    assert(reelColors.length===48,'Reel must have 48 item tiles');
    const vectorCards=reelColors.filter(x=>x.kind==='svg');
    const rasterCards=reelColors.filter(x=>x.kind==='bitmap');
    assert(vectorCards.every(x=>x.rootId&&x.stops.length===3&&x.computedFill.includes('#'+x.rootId+'f')),
      'A vector reel SVG finish is leaking styles from neighboring weapons');
    assert(new Set(vectorCards.map(x=>x.rootId)).size===vectorCards.length,
      'Every vector reel art instance needs its own paint scope');
    assert(new Set(vectorCards.map(x=>x.stops.join(','))).size>1,
      'Different vector weapon finishes unexpectedly share one palette');
    const bitmapCatalog={
      'Glock-18|Slate Grid':'glock-18--slate-grid',
      'AK-47|Ghostline':'ak-47--ghostline',
      'AK-47|Crimson Circuit':'ak-47--crimson-circuit',
      'AWP|Night Watch':'awp--night-watch',
      'AWP|Eclipse':'awp--eclipse',
      'M4A4|Voltage Bloom':'m4a4--voltage-bloom',
      'Karambit|Golden Talon':'karambit--golden-talon'
    };
    assert(rasterCards.every(x=>x.src?.includes(bitmapCatalog[x.weapon+'|'+x.finish]+'-400.webp')&&bitmapCatalog[x.weapon+'|'+x.finish]),
      'Reel bitmap does not match the correct weapon and finish');
    const winningTile=reelColors.find(x=>x.index===42);
    assert(winningTile?.weapon===expectedReward.weapon && winningTile?.finish===expectedReward.skin,
      'Winning reel card does not use the saved item and finish');
    await page.screenshot({path:path.resolve(__dirname,'reel-colors.png')});
    await page.getByRole('button', { name: 'Skip animation' }).click();
    const resultColors=await page.evaluate(()=>{
      const art=document.querySelector('.reveal-art .weapon-master,.reveal-art .master-raster');
      const image=art?.querySelector(':scope > img');
      const svg=art?.querySelector('svg.arsenal-master');
      return {
        weapon:art?.dataset.weaponModel,finish:art?.dataset.finish,
        kind:image?'bitmap':'svg',src:image?.getAttribute('src'),
        loaded:image?image.complete&&image.naturalWidth>0:null,
        stops:[...(svg?.querySelectorAll('linearGradient[id$="f"] stop')||[])].map(x=>x.getAttribute('stop-color'))
      };
    });
    assert(resultColors.weapon===winningTile.weapon && resultColors.finish===winningTile.finish,
      'Final reward art differs from the wheel item');
    if(winningTile.kind==='bitmap'){
      assert(resultColors.kind==='bitmap','Raster winning item changed rendering format');
      const slug=bitmapCatalog[winningTile.weapon+'|'+winningTile.finish];
      assert(slug&&resultColors.src?.includes(slug+'-1600.webp'),
        'Revealed winner must use its exact 1600px finish image');
      assert(winningTile.src?.includes(slug+'-400.webp'),
        'Winning reel must use its exact 400px finish image');
    }else{
      assert(JSON.stringify(resultColors.stops)===JSON.stringify(winningTile.stops),
        'Vector reward art changed its palette after the reel stops');
    }
    await waitForVisible('text=Estimated market value');
    await page.getByRole('button', { name: 'Inspect / sell' }).click();
    assert(await page.getByRole('button', { name: /Instant sell/ }).isVisible(), 'Opened skin must be sellable');

    await page.getByRole('button', { name: /Instant sell/ }).click();
    assert(await page.locator('.item').count() === 0, 'Sold item must leave inventory');
    const cash = Number((await page.locator('#wallet').textContent()).replace(/[^0-9]/g, ''));
    assert(cash > 0, 'Sale must credit wallet');

    await page.reload({ waitUntil: 'load' });
    const after = Number((await page.locator('#wallet').textContent()).replace(/[^0-9]/g, ''));
    assert(after === cash, 'Wallet must persist after reload');
    assert(await page.locator('.item').count() === 0, 'Sold item must not reappear after reload');
    assert(errors.length === 0, 'Browser console errors: ' + errors.join('; '));


    // Test the new save management and durable marketplace listings.
    await page.getByRole('button', { name: 'Earn', exact: true }).click();
    while(Number((await page.locator('#wallet').textContent()).replace(/[^0-9]/g, '')) < 25){
      await page.getByRole('button', { name: /Earn 1 coin/ }).click();
    }
    await page.getByRole('button', { name: 'Cases', exact: true }).click();
    await page.getByRole('button', { name: 'Purchase case' }).click();
    await page.getByRole('button', { name: 'List for sale' }).click();
    await page.locator('#listPrice').fill('22');
    await page.getByRole('button', { name: 'List for sale' }).click();
    assert(await page.getByText('My Market Listings').count() === 1, 'Listing must show in marketplace');
    assert((await page.locator('.listing-line').count())===1,'Listed case must be escrowed');
    await page.reload({ waitUntil: 'load' });
    await waitForVisible('.listing-line');
    assert(await page.locator('.listing-line').count()===1, 'Listings survive reload');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Inventory', exact: true }).click();
    assert(await page.locator('.item').count()===1, 'Cancel must return item to inventory');

    await page.getByRole('button', { name: 'Saves', exact: true }).click();
    await waitForVisible('text=My Save');
    assert(await page.getByText('Autosave active on this device.').count()===1, 'Autosave explanation missing');
    const saveBefore=await page.evaluate(() => JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')));
    assert(saveBefore.items.length===1 && saveBefore.ledger.length>=6,'Save must include inventory and history');
    const downloadEvent=page.waitForEvent('download');
    await page.getByRole('button', { name: /Download save backup/ }).click();
    const download=await downloadEvent;
    assert(download.suggestedFilename().endsWith('.json'),'Backup should download as JSON');

    // Corrupted primary recovers from the previous valid local snapshot.
    await page.evaluate(() => localStorage.setItem('loothub-arsenal-alpha-v1','{broken-json'));
    await page.reload({waitUntil:'load'});
    await waitForVisible('text=My Save');
    const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')));
    assert(restored.items.length===1,'Backup must restore inventory after primary corruption');
    assert(errors.length===0, 'Browser JavaScript errors: '+errors.join('; '));

    await page.screenshot({ path: path.resolve(__dirname, 'mobile-smoke.png'), fullPage: true });
    console.log('PASS: Mobile earning → case purchase → saved inventory → case opening → sale → saved wallet');
  } finally {
    await browser.close();
  }
})().catch(err => { console.error('FAIL:', err.stack || err); process.exit(1); });
