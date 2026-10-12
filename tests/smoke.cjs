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

    // 0.4.2: browsing is live on iPhone and stock must not reroll on reload.
    await page.getByRole('button', { name: 'Market', exact: true }).click();
    await page.locator('.npc-listing').first().waitFor({state:'visible',timeout:10000});
    assert(await page.locator('.npc-listing').count()===15,'Initial NPC market stock should contain 15 listings');
    const originalNpcOffers=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')).market.npcListings);
    const approvedOriginal=originalNpcOffers.find(x=>x.item.kind==='skin');
    assert(approvedOriginal?.item.skin==='Red Devil','NPC inventory used an unapproved cosmetic');
    await page.locator('#npcKindFilter').selectOption('skin');
    await page.locator('#npcSearch').fill('RED DEVIL');
    assert(await page.locator('.npc-listing').count()===1,'Skin type and weapon-name search must work together');
    await page.locator('.npc-listing').getByRole('button',{name:'Inspect'}).click();
    assert((await page.locator('.dialog h2').textContent()).includes('Red Devil'),'Inspect must show exact approved finish');
    await page.getByRole('button',{name:'Back to market'}).click();
    await page.locator('#npcSearch').fill('');
    await page.locator('#npcKindFilter').selectOption('all');
    await page.locator('#npcSortFilter').selectOption('price-desc');
    const sorted=await page.locator('.npc-listing-cost b').allTextContents();
    const amounts=sorted.map(x=>Number(x.replace(/[^0-9]/g,'')));
    assert(amounts.every((v,i)=>i===0||amounts[i-1]>=v),'High-to-low price sort must work');
    await page.reload({waitUntil:'load'});
    const sameNpcOffers=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')).market.npcListings);
    assert(JSON.stringify(originalNpcOffers)===JSON.stringify(sameNpcOffers),'Opening and reloading market must preserve NPC offers');
    await page.getByRole('button', { name: 'Earn', exact: true }).click();
    await waitForVisible('text=MicroTasks');
    for (let i = 0; i < 25; i++) {
      await page.getByRole('button', { name: /Earn 1 coin/ }).click();
    }
    assert((await page.locator('#wallet').textContent()).includes('25'), 'Earning must credit 25 coins');

    await page.getByRole('button', { name: 'Cases', exact: true }).click();
    await page.getByRole('button', { name: 'Purchase case' }).click();
    await page.getByRole('heading', { name: 'Sealed Arsenal Case', exact: true }).waitFor({ state: 'visible', timeout: 10000 });
    assert((await page.locator('#wallet').textContent()).includes('0'), 'Case purchase must debit wallet');

    await page.getByRole('button', { name: 'Keep item' }).click();
    await page.getByRole('button', { name: 'Inventory', exact: true }).click();
    await waitForVisible('.item');
    assert(await page.locator('.item').count() === 1, 'Purchase must create one owned sealed case');

    await page.reload({ waitUntil: 'load' });
    assert(await page.locator('.item').count() === 1, 'Case ownership must survive page reload');

    await page.getByRole('button', { name: 'Inspect / trade' }).click();
    await page.getByRole('button', { name: 'Open case' }).click();
    // The entire reel must use approved neutral base-weapon masters.
    const expectedReward=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')).items.find(x=>x.kind==='weapon'||x.kind==='skin'));
    assert(expectedReward&&(expectedReward.kind==='weapon'||(expectedReward.weapon==='MAC-10'&&expectedReward.skin==='Red Devil')),'Case awarded an unapproved skin');
    await page.waitForFunction(() => [...document.querySelectorAll('#track .master-raster > img')].every(img=>img.complete&&img.naturalWidth>0),null,{timeout:15000});
    const reelArt=await page.evaluate(()=>[...document.querySelectorAll('#track .tile')].map(tile=>{
      const art=tile.querySelector('.master-raster');
      return {index:Number(tile.dataset.reelIndex),weapon:art?.dataset.weaponModel,finish:art?.dataset.finish,loaded:!!art?.querySelector('img')?.naturalWidth};
    }));
    assert(reelArt.length===48,'Must show 48 reel tiles');
    assert(reelArt.every(x=>x.loaded),'Some base masters failed to load');
    assert(reelArt.every(x=>!x.finish||x.finish==='Red Devil'),'An unapproved cosmetic finish appeared on the reel');
    const winner=reelArt.find(x=>x.index===42);
    assert(winner.weapon===expectedReward.weapon,'The winning base weapon does not match saved reward');
    await page.screenshot({path:path.resolve(__dirname,'reel-colors.png')});
    await page.getByRole('button', { name: 'Skip animation' }).click();
    const revealed=await page.evaluate(()=>{
      const art=document.querySelector('.reveal-art .master-raster');
      return {weapon:art?.dataset.weaponModel,finish:art?.dataset.finish,loaded:!!art?.querySelector('img')?.naturalWidth};
    });
    assert(revealed.weapon===winner.weapon,'Revealed reward model differs from the reel');
    assert(revealed.finish===winner.finish,'The revealed finish differs from the reel or an unapproved skin appeared');
    assert(revealed.loaded,'Base-weapon inspect image failed to load');
    await waitForVisible('text=Estimated market value');
    await page.getByRole('button', { name: 'Inspect / sell' }).click();
    assert(await page.getByRole('button', { name: /Instant sell/ }).isVisible(), 'Opened base weapon must be sellable');

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
    assert((await page.locator('#listingNet').textContent()).includes('20'), 'Live listing proceeds should account for fees');
    assert((await page.locator('#listingFee').textContent()).includes('2'), 'Live listing fee quote missing');
    await page.getByRole('button', { name: 'List for sale' }).click();
    assert(await page.getByText('My Market Listings').count() === 1, 'Listing must show in marketplace');
    assert((await page.locator('.listing-line').count())===1,'Listed case must be escrowed');
    const marketFoundation=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')).market);
    assert(marketFoundation?.schemaVersion===1&&Array.isArray(marketFoundation.npcListings),'Marketplace schema missing from saved game');
    await page.reload({ waitUntil: 'load' });
    await waitForVisible('.listing-line');
    assert(await page.locator('.listing-line').count()===1, 'Listings survive reload');
    const beforeEdit=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')));
    const listedId=beforeEdit.listings[0].item.id;
    await page.getByRole('button',{name:'Edit price'}).click();
    await waitForVisible('#listPrice');
    assert((await page.locator('#listPrice').inputValue())==='22','Edit dialog must show current ask');
    await page.locator('#listPrice').fill('39');
    assert((await page.locator('#listingNet').textContent()).includes('37'),'Fee quote must respond to editing');
    await page.getByRole('button',{name:'Save price'}).click();
    assert((await page.locator('.listing-line').textContent()).includes('39 ◈ asking'),'Updated ask not visible in market');
    const afterEdit=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')));
    assert(afterEdit.listings.length===1 && afterEdit.listings[0].item.id===listedId,'Reprice must not replace escrowed item');
    assert(afterEdit.listings[0].ask===39,'Changed price must be saved');
    assert(afterEdit.coins===beforeEdit.coins,'Repricing must not charge player');
    await page.reload({waitUntil:'load'});
    assert((await page.locator('.listing-line').textContent()).includes('39 ◈ asking'),'Price edit lost after reload');
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

    // Purchase a specific affordable NPC listing and confirm the exact saved instance.
    await page.getByRole('button',{name:'Market',exact:true}).click();
    const cheapestOffer=await page.evaluate(()=>{
      const saved=JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1'));
      return saved.market.npcListings.reduce((best,x)=>!best||x.ask<best.ask?x:best,null);
    });
    assert(cheapestOffer,'NPC stock unexpectedly disappeared');
    await page.getByRole('button',{name:'Earn',exact:true}).click();
    while(Number((await page.locator('#wallet').textContent()).replace(/[^0-9]/g,''))<cheapestOffer.ask){
      await page.getByRole('button',{name:/Earn 1 coin/}).click();
    }
    await page.getByRole('button',{name:'Market',exact:true}).click();
    const npcCard=page.locator('.npc-listing').filter({
      has:page.locator('button[onclick*="'+cheapestOffer.id+'"]')
    });
    assert(await npcCard.count()===1,'NPC listing must remain identifiable by ID');
    await npcCard.getByRole('button',{name:'Inspect'}).click();
    const beforePurchase=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')));
    await page.getByRole('button',{name:/Buy for .* coins/}).click();
    const purchased=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')));
    assert(purchased.coins===beforePurchase.coins-cheapestOffer.ask,'NPC purchase must debit exactly the posted price');
    assert(purchased.market.npcListings.length===beforePurchase.market.npcListings.length-1,'Purchased NPC listing must disappear');
    assert(purchased.items.some(x=>x.id===cheapestOffer.item.id&&x.kind===cheapestOffer.item.kind),'Exact NPC item must transfer to inventory');
    await page.reload({waitUntil:'load'});
    const afterReload=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')));
    assert(afterReload.items.some(x=>x.id===cheapestOffer.item.id),'Purchased NPC item must survive reload');
    assert(!afterReload.market.npcListings.some(x=>x.id===cheapestOffer.id),'Purchased listing must not regenerate');
    assert(errors.length===0,'Browser errors after NPC market purchase: '+errors.join('; '));

    await page.screenshot({ path: path.resolve(__dirname, 'mobile-smoke.png'), fullPage: true });
    console.log('PASS: Mobile earning → case purchase → saved inventory → case opening → sale → saved wallet');
  } finally {
    await browser.close();
  }
})().catch(err => { console.error('FAIL:', err.stack || err); process.exit(1); });
