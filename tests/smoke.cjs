const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('node:http');

const root = path.resolve(__dirname,'..');
const mimes={'.html':'text/html','.js':'application/javascript','.css':'text/css',
  '.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};

(async () => {
  // GitHub Pages serves all masters and material maps from one HTTPS origin.
  // Local HTTP reproduces that origin for getImageData; file:// taints PNG/WebP canvases.
  const server=http.createServer((req,res)=>{
    try{
      const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const file=path.resolve(root,'.'+route);
      if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
      fs.readFile(file,(err,data)=>{
        if(err){res.writeHead(404);res.end();return}
        res.setHeader('Content-Type',mimes[path.extname(file)]||'application/octet-stream');
        res.writeHead(200);res.end(data);
      });
    }catch(_){res.writeHead(400);res.end()}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = 'http://127.0.0.1:' + server.address().port + '/index.html';

  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const waitForVisible = async (selector) => page.locator(selector).waitFor({ state: 'visible', timeout: 10000 });
  try {
    await page.goto(url, { waitUntil: 'load' });
    await waitForVisible('.brand');
    // Owner-supplied skins must load full-resolution transparent art in real Chromium, not just in the manifest.
    const skinsRendered=await page.evaluate(async()=>{
      const defs=[
        ['Tactical Machete','Predator',2,260],
        ['Desert Eagle','Blossom',3,950],
        ['Karambit','Kryptonite',4,3800],
        ['SPAS-12','Blood Thirsty',3,1100],
        ['AWP','Crimson Delight',4,4200]
      ];
      const results=[];
      for(const [weapon,skin,tier,base] of defs){
        const wrapper=document.createElement('div');
        wrapper.innerHTML=visualArt({id:'smoke-'+skin,kind:'skin',weapon,skin,tier,base,wearGrade:0},'inspect');
        const render=wrapper.querySelector('.approved-skin'),img=render?.querySelector('img');
        if(!img){results.push({weapon,skin,ok:false,reason:'missing img'});continue}
        try{
          await img.decode();
          const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;
          const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
          const alpha=ctx.getImageData(0,0,1,1).data[3];
          const neutral=visualArt({kind:'weapon',weapon,tier,base},'inspect');
          results.push({weapon,skin,ok:img.naturalWidth>=1500&&alpha===0&&
            render.dataset.finish===skin&&render.dataset.wearGrade==='0'&&
            !neutral.includes('data-finish='),size:img.naturalWidth,alpha});
        }catch(err){results.push({weapon,skin,ok:false,reason:String(err)})}
      }
      return results;
    });
    assert(skinsRendered.length===5&&skinsRendered.every(x=>x.ok),
      'Owner-approved cosmetics must all load as 1600px transparent, separate inspection art: '+JSON.stringify(skinsRendered));

    assert((await page.locator('#wallet').textContent()).includes('0'), 'New account must start at zero coins');

    // Paid Blackout case: test in an isolated mobile browser context so the
    // existing new-account economy smoke scenario remains untouched.
    const paidPage=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
    await paidPage.goto(url,{waitUntil:'load'});
    await paidPage.getByRole('button',{name:'Cases',exact:true}).click();
    assert(await paidPage.getByRole('button',{name:'Buy Blackout Case'}).count()===1,
      'Paid Blackout case must be visible in the Cases store');
    assert((await paidPage.locator('#main').textContent()).includes('5 weapon variants'),
      'Blackout drop pool must remain limited to five guns');
    await paidPage.locator('.item').filter({has:paidPage.getByRole('heading',{name:'Blackout Case',exact:true})}).getByRole('button',{name:'View collection'}).click();
    assert(await paidPage.locator('.dialog .item').count()===5,
      'Published Blackout collection must list five inspectable guns');
    await paidPage.waitForFunction(()=>[...document.querySelectorAll('.dialog .universal-skin img')].length===5&&
      [...document.querySelectorAll('.dialog .universal-skin img')].every(i=>i.complete&&i.naturalWidth>=800),
      null,{timeout:15000});
    await paidPage.getByRole('button',{name:'Close',exact:true}).last().click();
    await paidPage.evaluate(()=>{for(let i=0;i<25;i++)clickEarn()});
    await paidPage.getByRole('button',{name:'Buy Blackout Case'}).click();
    await paidPage.getByRole('heading',{name:'Sealed Blackout Case',exact:true}).waitFor();
    const bought=await paidPage.evaluate(()=>({coins:s.coins,items:s.items.map(x=>({
      id:x.id,kind:x.kind,caseId:x.caseId,paid:x.paid}))}));
    assert(bought.coins===0&&bought.items.length===1&&
      bought.items[0].kind==='case'&&bought.items[0].caseId==='blackout'&&
      bought.items[0].paid===25,'Paid Blackout case purchase must save a real sealed case');
    await paidPage.getByRole('button',{name:'Open case'}).click();
    await paidPage.getByRole('button',{name:'Skip animation'}).click();
    await paidPage.waitForFunction(()=>{
      const image=document.querySelector('.dialog .universal-skin img');
      return image&&image.complete&&image.naturalWidth===1600;
    },null,{timeout:15000});
    const prize=await paidPage.evaluate(()=>({
      name:s.items[0].weapon,skin:s.items[0].skin,kind:s.items[0].kind,
      grade:s.items[0].wearGrade,openings:s.openings,coins:s.coins,
      registered:window.LootHubSkinLines.isRegistered(s.items[0]),
      id:s.items[0].id
    }));
    assert(prize.kind==='skin'&&prize.skin==='Blackout'&&prize.registered&&
      prize.coins===0&&prize.openings===1&&prize.grade>=0&&prize.grade<=4,
      'Case opening must give a persistent real Blackout skin with actual artwork');
    await paidPage.reload({waitUntil:'load'});
    const persistence=await paidPage.evaluate(()=>({
      id:s.items[0].id,skin:s.items[0].skin,coins:s.coins,openings:s.openings
    }));
    assert(persistence.id===prize.id&&persistence.skin==='Blackout'&&
      persistence.coins===0&&persistence.openings===1,
      'Blackout collectible, coins and openings must survive reload');
    await paidPage.close();

    // Damascus uses a different five-weapon roster and three independent
    // material textures, but the same real paid-case inventory/opening flow.
    const damascusPage=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
    await damascusPage.goto(url,{waitUntil:'load'});
    await damascusPage.getByRole('button',{name:'Cases',exact:true}).click();
    assert(await damascusPage.getByRole('button',{name:'Buy Damascus Case'}).count()===1,
      'Damascus Case should be purchasable from the Cases shop');
    const dCard=damascusPage.locator('.item').filter({
      has:damascusPage.getByRole('heading',{name:'Damascus Case',exact:true})
    });
    assert((await dCard.textContent()).includes('5 weapon variants'),'Damascus should include exactly five skins');
    await dCard.getByRole('button',{name:'View collection'}).click();
    assert(await damascusPage.locator('.dialog .item').count()===5,
      'Damascus collection preview must include five guns');
    await damascusPage.waitForFunction(()=>{
      const images=[...document.querySelectorAll('.dialog .universal-skin img')];
      return images.length===5&&images.every(i=>i.complete&&i.naturalWidth>=800&&
        i.src.includes('/damascus/'));
    },null,{timeout:18000});
    await damascusPage.getByRole('button',{name:'Close',exact:true}).last().click();
    await damascusPage.evaluate(()=>{for(let i=0;i<25;i++)clickEarn()});
    await damascusPage.getByRole('button',{name:'Buy Damascus Case'}).click();
    await damascusPage.getByRole('heading',{name:'Sealed Damascus Case',exact:true}).waitFor();
    const dBought=await damascusPage.evaluate(()=>({
      coins:s.coins,spent:s.spent,caseId:s.items[0]?.caseId,
      paid:s.items[0]?.paid,kind:s.items[0]?.kind
    }));
    assert(dBought.coins===0&&dBought.spent===25&&dBought.caseId==='damascus'&&
      dBought.paid===25&&dBought.kind==='case',
      'Damascus Case must cost 25 coins and store a sealed case');
    await damascusPage.getByRole('button',{name:'Open case'}).click();
    await damascusPage.getByRole('button',{name:'Skip animation'}).click();
    await damascusPage.waitForFunction(()=>{
      const image=document.querySelector('.dialog .universal-skin img');
      return image&&image.complete&&image.naturalWidth===1600&&image.src.includes('/damascus/');
    },null,{timeout:18000});
    const dPrize=await damascusPage.evaluate(()=>({
      id:s.items[0]?.id,weapon:s.items[0]?.weapon,skin:s.items[0]?.skin,
      skinLine:s.items[0]?.skinLine,grade:s.items[0]?.wearGrade,
      openings:s.openings,registered:window.LootHubSkinLines.isRegistered(s.items[0])
    }));
    assert(['Glock-18','Colt .45 Revolver','AK-47','M1 Garand','Karambit'].includes(dPrize.weapon)&&
      dPrize.skin==='Damascus'&&dPrize.skinLine==='damascus'&&dPrize.registered&&
      dPrize.openings===1&&dPrize.grade>=0&&dPrize.grade<=4,
      'Damascus opening must award one real, registered five-weapon cosmetic');
    await damascusPage.reload({waitUntil:'load'});
    const dSaved=await damascusPage.evaluate(()=>({
      id:s.items[0]?.id,skin:s.items[0]?.skin,coins:s.coins,openings:s.openings
    }));
    assert(dSaved.id===dPrize.id&&dSaved.skin==='Damascus'&&dSaved.coins===0&&dSaved.openings===1,
      'Damascus reward and payment must survive mobile reload');
    await damascusPage.close();

    // 0.4.2: browsing is live on iPhone and stock must not reroll on reload.
    await page.getByRole('button', { name: 'Market', exact: true }).click();
    await page.locator('.npc-listing').first().waitFor({state:'visible',timeout:10000});
    assert(await page.locator('.npc-listing').count()===15,'Initial NPC market stock should contain 15 listings');
    assert(await page.locator('.market-shortcuts button').count()===4,'Mobile market needs four section shortcuts');
    assert(await page.locator('#marketOwnedSearch').count()===1,'Inventory trading search must exist');
    await page.locator('#npcAffordability').selectOption('affordable');
    assert(await page.locator('.npc-listing').count()===0,'Zero-coin player cannot afford initial NPC offers');
    await page.getByRole('button',{name:'Reset filters'}).click();
    assert(await page.locator('.npc-listing').count()===15,'Reset must restore all NPC listings');
    assert(await page.locator('.market-pulse-item').count()===8,'Market Pulse needs eight index cards');
    assert((await page.locator('.market-pulse-section').textContent()).includes('Base '),'Price index should show base estimates');
    const firstHistory=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')).market.priceHistory);
    assert(Object.keys(firstHistory).length===0,'Merely opening the market should not create sales history');
    assert(await page.locator('.market-trader-profile').count()===6,'The buyer directory must display all six specialists');
    const initialTraders=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')).market.traders);
    assert(initialTraders.length===16&&new Set(initialTraders.map(t=>t.style)).size===6,
      'Trader identities and all six temperaments must be saved');
    const baselineWear=await page.evaluate(()=>{
      const game=JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1'));
      return {schema:game.wearSchemaVersion,items:game.market.npcListings.map(x=>({
        kind:x.item.kind,hasGrade:Object.prototype.hasOwnProperty.call(x.item,'wearGrade'),grade:x.item.wearGrade
      }))};
    });
    assert(baselineWear.schema===1,'Wear data schema must exist in saved progress');
    assert(baselineWear.items.every(x=>x.kind==='case'?!x.hasGrade:
      (x.hasGrade&&Number.isInteger(x.grade)&&x.grade>=0&&x.grade<=4)),
      'New marketplace stock must have a valid condition; sealed cases must remain ungraded');
    assert(await page.locator('.npc-listing .wear-grade').count()>0,
      'Marketplace needs visible condition ratings for every NPC weapon or skin');
    assert((await page.locator('.npc-listing .wear-grade').first().textContent()).includes('Condition:'),
      'NPC condition must be readable on mobile');
    const originalNpcOffers=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')).market.npcListings);
    const approvedOriginal=originalNpcOffers.find(x=>x.item.kind==='skin');
    const approvedName=approvedOriginal?.item.skin;
    const releasedNames=await page.evaluate(()=>window.LootHubSkinLines.lines.map(x=>x.name));
    assert(['Red Devil','Glory','High Stakes','The Hydra','The Luck O The Irish','Predator','Blossom','Kryptonite','Blood Thirsty','Crimson Delight',...releasedNames].includes(approvedName),'NPC inventory used an unapproved cosmetic');
    await page.locator('#npcKindFilter').selectOption('skin');
    await page.locator('#npcSearch').fill(approvedName.toUpperCase());
    assert(await page.locator('.npc-listing').count()===1,'Skin type and weapon-name search must work together');
    await page.locator('.npc-listing').getByRole('button',{name:'Inspect'}).click();
    assert((await page.locator('.dialog h2').textContent()).includes(approvedName),'Inspect must show exact approved finish');
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
    const sealed=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')).items[0]);
    assert(!Object.prototype.hasOwnProperty.call(sealed,'wearGrade'),'Sealed case must not have a wear grade');

    await page.reload({ waitUntil: 'load' });
    assert(await page.locator('.item').count() === 1, 'Case ownership must survive page reload');

    await page.getByRole('button', { name: 'Inspect / trade' }).click();
    await page.getByRole('button', { name: 'Open case' }).click();
    // The entire reel must use approved neutral base-weapon masters.
    const expectedReward=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')).items.find(x=>x.kind==='weapon'||x.kind==='skin'));
    assert(expectedReward&&(expectedReward.kind==='weapon'||['Red Devil','Glory','High Stakes','The Hydra','The Luck O The Irish','Predator','Blossom','Kryptonite','Blood Thirsty','Crimson Delight'].includes(expectedReward.skin)),'Case awarded an unapproved skin');
    assert(Number.isInteger(expectedReward.wearGrade)&&expectedReward.wearGrade>=0&&
      expectedReward.wearGrade<=4,'Fresh reward must have one valid persistent wear grade');
    await page.waitForFunction(() => [...document.querySelectorAll('#track .master-raster > img')].every(img=>img.complete&&img.naturalWidth>0),null,{timeout:15000});
    const reelArt=await page.evaluate(()=>[...document.querySelectorAll('#track .tile')].map(tile=>{
      const art=tile.querySelector('.master-raster');
      return {index:Number(tile.dataset.reelIndex),weapon:art?.dataset.weaponModel,finish:art?.dataset.finish,loaded:!!art?.querySelector('img')?.naturalWidth};
    }));
    assert(reelArt.length===48,'Must show 48 reel tiles');
    assert(reelArt.every(x=>x.loaded),'Some base masters failed to load');
    assert(reelArt.every(x=>!x.finish||['Red Devil','Glory','High Stakes','The Hydra','The Luck O The Irish','Predator','Blossom','Kryptonite','Blood Thirsty','Crimson Delight'].includes(x.finish)),'An unapproved cosmetic finish appeared on the reel');
    const winner=reelArt.find(x=>x.index===42);
    assert(winner.weapon===expectedReward.weapon,'The winning base weapon does not match saved reward');
    await page.screenshot({path:path.resolve(__dirname,'reel-colors.png')});
    const persistedReward=await page.evaluate(id=>
      JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')).items.find(x=>x.id===id),
      expectedReward.id);
    assert(persistedReward.wearGrade===expectedReward.wearGrade,
      'Reward wear roll must be committed before case animation completes');
    await page.getByRole('button', { name: 'Skip animation' }).click();
    const revealed=await page.evaluate(()=>{
      const art=document.querySelector('.reveal-art .master-raster');
      return {weapon:art?.dataset.weaponModel,finish:art?.dataset.finish,loaded:!!art?.querySelector('img')?.naturalWidth};
    });
    assert(revealed.weapon===winner.weapon,'Revealed reward model differs from the reel');
    assert(revealed.finish===winner.finish,'The revealed finish differs from the reel or an unapproved skin appeared');
    assert(revealed.loaded,'Base-weapon inspect image failed to load');
    const wearName=['Pristine','Lightly Worn','Field-Tested','Heavily Worn','Battle-Scarred'][expectedReward.wearGrade];
    const wearFactor=[1,.95,.85,.7,.55][expectedReward.wearGrade];
    assert((await page.locator('.dialog').textContent()).includes('Condition: '+wearName),
      'Case opening must show the exact rolled wear grade');
    assert((await page.locator('.dialog').textContent()).includes(wearFactor.toFixed(2)+'×'),
      'Case reveal must show the corresponding wear multiplier');
    assert((await page.locator('.dialog').textContent()).includes('Condition-adjusted value'),
      'Case reveal must explain the condition-adjusted value');

    await waitForVisible('text=Estimated market value');
    await page.getByRole('button', { name: 'Inspect / sell' }).click();
    assert(await page.getByRole('button', { name: /Instant sell/ }).isVisible(), 'Opened base weapon must be sellable');
    const inspectedText=await page.locator('.dialog').textContent();
    assert(inspectedText.includes('Condition: '+wearName),'Weapon inspection must show saved wear');
    assert(inspectedText.includes('Base value (Pristine)')&&
      inspectedText.includes('Wear modifier')&&
      inspectedText.includes('Condition-adjusted value')&&
      inspectedText.includes('Estimated market value'),'Inspection must show full pricing breakdown');
    const adjusted=await page.evaluate(item=>{
      return window.LootHubMarketCore.estimated(item);
    },expectedReward);
    assert(adjusted===Math.max(1,Math.round(expectedReward.base*wearFactor)),
      'Displayed condition value must match pricing engine');


    await page.getByRole('button', { name: /Instant sell/ }).click();
    assert(await page.locator('.item').count() === 0, 'Sold item must leave inventory');
    const cash = Number((await page.locator('#wallet').textContent()).replace(/[^0-9]/g, ''));
    assert(cash > 0, 'Sale must credit wallet');

    await page.reload({ waitUntil: 'load' });
    const after = Number((await page.locator('#wallet').textContent()).replace(/[^0-9]/g, ''));
    assert(after === cash, 'Wallet must persist after reload');
    assert(await page.locator('.item').count() === 0, 'Sold item must not reappear after reload');
    assert((await page.evaluate(()=>window.LootHubWear.ROLL_WEIGHTS.join(',')))==='8,22,40,22,8',
      'Published wear probabilities must match the independent grade roll table');
    assert((await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')).wearSchemaVersion))===1,
      'Condition foundation must persist on reload');
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
    const itemMarketKey=cheapestOffer.item.kind==='case'?'case':
      cheapestOffer.item.kind+':'+encodeURIComponent(cheapestOffer.item.weapon.toLowerCase())+
        (cheapestOffer.item.kind==='skin'?':'+encodeURIComponent(cheapestOffer.item.skin.toLowerCase()):'');
    const tradeSignal=purchased.market.priceHistory[itemMarketKey];
    assert(tradeSignal&&tradeSignal.volume===1&&tradeSignal.recent[0].side==='buy',
      'Completed marketplace purchase must add a saved demand signal');
    assert(tradeSignal.recent[0].price===cheapestOffer.ask,
      'Price history must reflect the exact executed trade');
    await page.reload({waitUntil:'load'});
    const afterReload=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')));
    assert(afterReload.items.some(x=>x.id===cheapestOffer.item.id),'Purchased NPC item must survive reload');
    assert(JSON.stringify(afterReload.market.priceHistory[itemMarketKey])===JSON.stringify(tradeSignal),
      'Dynamic prices should not reroll during a reload');
    assert(!afterReload.market.npcListings.some(x=>x.id===cheapestOffer.id),'Purchased listing must not regenerate');
    assert(errors.length===0,'Browser errors after NPC market purchase: '+errors.join('; '));

    // 0.4.3: live buyer-side haggling persists a rejected offer through reload.
    await page.getByRole('button',{name:'Market',exact:true}).click();
    const bargain=await page.evaluate(()=>{
      const a=JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')).market.npcListings;
      return a.reduce((best,x)=>!best||x.ask<best.ask?x:best,null);
    });
    assert(bargain,'Market lost NPC stock during save recovery');
    const bargainCard=page.locator('.npc-listing').filter({
      has:page.locator('button[onclick*="'+bargain.id+'"]')
    });
    await bargainCard.getByRole('button',{name:'Make offer'}).click();
    assert(await page.locator('.offer-history').isVisible(),'Negotiation transcript must display');
    await page.locator('#negotiationAmount').fill('1');
    await page.getByRole('button',{name:'Send offer'}).click();
    const sent=await page.evaluate(id=>{
      const saved=JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1'));
      return saved.market.negotiations.find(x=>x.id==='buy:'+id);
    },bargain.id);
    assert(sent.rounds===1,'Submitted offer should use one negotiation attempt');
    await page.reload({waitUntil:'load'});
    const bargainAgain=page.locator('.npc-listing').filter({
      has:page.locator('button[onclick*="'+bargain.id+'"]')
    });
    await bargainAgain.getByRole('button',{name:'Make offer'}).click();
    const reloadedNegotiation=await page.evaluate(id=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')).market.negotiations.find(x=>x.id==='buy:'+id),bargain.id);
    assert(reloadedNegotiation.rounds===1,'Reload must preserve consumed offers');
    await page.getByRole('button',{name:/^Accept /}).click();
    const agreedBuy=await page.evaluate(id=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')).market.negotiations.find(x=>x.id==='buy:'+id),bargain.id);
    assert(agreedBuy.status==='agreed','Accepting seller counter must create agreement');
    await page.getByRole('button',{name:'Close negotiation'}).click();
    await page.getByRole('button',{name:'Earn',exact:true}).click();
    while(Number((await page.locator('#wallet').textContent()).replace(/[^0-9]/g,''))<agreedBuy.agreedPrice){
      await page.getByRole('button',{name:/Earn 1 coin/}).click();
    }
    await page.getByRole('button',{name:'Market',exact:true}).click();
    const buyAgain=page.locator('.npc-listing').filter({
      has:page.locator('button[onclick*="'+bargain.id+'"]')
    });
    await buyAgain.getByRole('button',{name:'Make offer'}).click();
    const beforeDeal=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')));
    await page.getByRole('button',{name:/Complete purchase/}).click();
    const afterDeal=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')));
    assert(afterDeal.coins===beforeDeal.coins-agreedBuy.agreedPrice,'Agreed purchase price must debit wallet');
    assert(afterDeal.items.some(x=>x.id===bargain.item.id),'Agreed NPC item must transfer exactly once');
    const traderBefore=beforeDeal.market.traders.find(t=>t.id===bargain.seller);
    const traderAfter=afterDeal.market.traders.find(t=>t.id===bargain.seller);
    assert(traderAfter.wallet===traderBefore.wallet+agreedBuy.agreedPrice,
      'NPC vendor must receive the exact purchase proceeds');
    assert(afterDeal.market.negotiations.find(x=>x.id==='buy:'+bargain.id).status==='completed','Deal must finalize');
    await page.reload({waitUntil:'load'});
    assert((await page.locator('#inventoryGrid .item').count())>=1,'Negotiated item must survive reload');

    // 0.4.3: listed player items receive persistent incoming buyer offers.
    await page.getByRole('button',{name:'Inventory',exact:true}).click();
    await page.locator('#inventoryGrid .item').first().getByRole('button',{name:'Inspect / trade'}).click();
    await page.getByRole('button',{name:'List for sale'}).click();
    await page.locator('#listPrice').fill('40');
    await page.getByRole('button',{name:'List for sale'}).click();
    await page.locator('.listing-line').first().getByRole('button',{name:'Review offer'}).click();
    const incoming=await page.evaluate(()=>{
      const data=JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1'));
      const id=data.listings[0].id;
      return data.market.negotiations.find(x=>x.kind==='sell'&&x.listingId===id&&x.listingCreatedAt===data.listings[0].createdAt);
    });
    assert(incoming&&incoming.npcOffer>0,'Player listing should receive an NPC buyer offer');
    await page.getByRole('button',{name:/^Accept /}).click();
    const preSale=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')));
    await page.getByRole('button',{name:/Complete sale/}).click();
    const postSale=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')));
    assert(postSale.coins===preSale.coins+Math.max(1,Math.floor(incoming.npcOffer*.95)),'Negotiated sale fee must be 5%');
    assert(postSale.listings.length===0,'Sold player item must leave escrow');
    const finished=Object.values(postSale.market.priceHistory).flatMap(x=>x.recent);
    assert(finished.some(x=>x.side==='sell'&&x.price===incoming.npcOffer),
      'Negotiated seller trade must contribute a bounded supply-side market signal');
    await page.getByRole('button',{name:'Market',exact:true}).click();
    assert(await page.locator('.market-pulse-item').count()===8,
      'Market Pulse must be usable after both trade directions');
    assert((await page.locator('.market-pulse-section').textContent()).includes('trades'),
      'Market Pulse needs completed-trade volume indicators');
    const buyerBefore=preSale.market.traders.find(t=>t.id===incoming.traderId);
    const buyerAfter=postSale.market.traders.find(t=>t.id===incoming.traderId);
    assert(buyerBefore&&buyerAfter&&buyerAfter.wallet===buyerBefore.wallet-incoming.npcOffer,
      'Buyer budget must be debited exactly once when the deal completes');
    assert(await page.locator('.trade-record').count()>=2,'Trade Desk must show persisted negotiations');
    await page.locator('#tradeStatusFilter').selectOption('complete');
    assert(await page.locator('.trade-record').count()>=2,'Completed trade filter should retain purchase and sale');
    await page.locator('.trade-record').first().getByRole('button',{name:'View history'}).click();
    assert(await page.getByText('SAVED NEGOTIATION HISTORY').count()===1,'Closed deal must have readable history');
    await page.getByRole('button',{name:'Close history'}).click();
    await page.locator('#tradeStatusFilter').selectOption('all');
    assert(errors.length===0,'Browser errors during haggling: '+errors.join('; '));
    // 0.4.6: reopening after long inactivity processes only bounded elapsed time.
    const balanceBeforeOffline=postSale.coins;
    await page.evaluate(()=>{
      s.market.lastSimulatedAt=Date.now()-20*3600000;
      save();
    });
    await page.reload({waitUntil:'load'});
    const afterOffline=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')));
    const report=afterOffline.market.lastOfflineReport;
    assert(report&&report.processedMinutes===480,'Catch-up must simulate only eight hours');
    assert(report.elapsedMinutes>=1199,'Long offline interval should be recognized');
    assert(afterOffline.coins===balanceBeforeOffline,'NPC-only offline activity must not mint player coins');
    assert(await page.locator('.offline-report').count()===1,'Offline market activity report must be visible');
    const afterOfflineCopy=JSON.stringify(afterOffline.market.priceHistory);
    await page.reload({waitUntil:'load'});
    const reopened=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')));
    assert(JSON.stringify(reopened.market.priceHistory)===afterOfflineCopy,
      'Reloading immediately cannot replay historical NPC trades');
    const removed=await page.evaluate(()=>{
      const id=s.market.npcListings[0].id;
      s.market.npcListings[0].expiresAt=Date.now()-1;
      s.market.lastNpcRefreshAt=Date.now()-24*3600000;
      save();
      return id;
    });
    await page.reload({waitUntil:'load'});
    const refreshed=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')));
    assert(!refreshed.market.npcListings.some(x=>x.id===removed),'Expired NPC listing must disappear');
    assert(refreshed.market.npcListings.length===15,'Expired NPC stock should restock without duplicate IDs');
    assert(new Set(refreshed.market.npcListings.map(x=>x.item.id)).size===15,
      'Restocked market items must preserve unique identities');
    assert(refreshed.market.lastOfflineReport.expired>=1,'Expiration must be included in report');
    assert(errors.length===0,'Browser errors after simulated offline return: '+errors.join('; '));
    // 0.4.7: full-inventory Market listing, search and pagination.
    await page.evaluate(()=>{
      for(let i=0;i<20;i++){
        s.items.push({id:'mobile-owned-'+i,kind:'weapon',weapon:'MP5',tier:1,base:12+i});
      }
      save();
    });
    await page.getByRole('button',{name:'Market',exact:true}).click();
    await page.locator('#marketOwnedSearch').fill('MP5');
    assert(await page.locator('#marketOwnedResults .item').count()===12,'Sell shelf should initially show 12 matched items');
    assert(await page.locator('#marketOwnedMore').count()===1,'Show more needed for larger inventory');
    const matchingCount=await page.evaluate(()=>s.items.filter(x=>x.weapon==='MP5').length);
    while(await page.locator('#marketOwnedMore').count()){
      await page.locator('#marketOwnedMore').click();
    }
    assert(await page.locator('#marketOwnedResults .item').count()===matchingCount,
      'Show more must reveal every matching inventory item, including earlier earned weapons');
    await page.locator('#marketOwnedResults .item').first().getByRole('button',{name:'List item'}).click();
    await page.locator('#listPrice').fill('35');
    await page.getByRole('button',{name:'List for sale'}).click();
    const listed=await page.evaluate(()=>{
      const data=JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1'));
      return data.listings.find(x=>x.item.id.startsWith('mobile-owned-'));
    });
    assert(listed&&listed.ask===35,'Full-inventory Market action must list the selected exact item');
    await page.locator('.listing-line').filter({
      has:page.locator('button[onclick*="'+listed.id+'"]')
    }).getByRole('button',{name:'Cancel'}).click();
    const restoredItem=await page.evaluate(id=>{
      const data=JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1'));
      return data.items.find(x=>x.id===id);
    },listed.item.id);
    assert(restoredItem&&restoredItem.base===listed.item.base,'Cancellation must return the original inventory item');
    assert(errors.length===0,'Mobile trading tools caused a browser exception: '+errors.join('; '));

    // 0.5.3 — confirm the actual canvas overlay renders over transparent masters.
    // The source WebP remains present/unchanged beneath the procedural surface.
    await page.evaluate(()=>{
      s.items.push({id:'wear-visual-proof',kind:'weapon',weapon:'MP5',tier:0,base:8,wearGrade:4});
      s.items.push({id:'wear-pristine-proof',kind:'weapon',weapon:'MP5',tier:0,base:8,wearGrade:0});
      s.items.push({id:'wear-skin-proof',kind:'skin',weapon:'MAC-10',skin:'Red Devil',tier:4,base:1800,wearGrade:3});
      save();
      inspect('wear-visual-proof');
    });
    await page.locator('.dialog .wear-overlay').waitFor({state:'attached',timeout:15000});
    const firstWear=await page.evaluate(()=>{
      const canvas=document.querySelector('.dialog canvas.wear-overlay');
      const original=document.querySelector('.dialog .master-raster > img');
      const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let touched=0,checksum=2166136261;
      for(let i=3;i<data.length;i+=4){
        if(data[i])touched++;
        if(i%31===3)checksum=Math.imul(checksum^data[i],16777619)>>>0;
      }
      return {touched,checksum,width:canvas.width,height:canvas.height,
        cornerAlpha:[data[3],data[(canvas.width-1)*4+3]],
        source:original.currentSrc,grade:canvas.parentElement.dataset.wearGrade};
    });
    assert(firstWear.touched>100,'Battle-Scarred overlay must render visible marks on the MP5');
    assert(firstWear.width>200&&firstWear.height>100,'Wear texture should be sharp on retina iPhone');
    assert(firstWear.cornerAlpha.every(alpha=>alpha===0),
      'Transparent weapon background must not receive wear pixels');
    assert(firstWear.grade==='4','Canvas must be associated with the correct permanent wear grade');
    await page.reload({waitUntil:'load'});
    await page.evaluate(()=>inspect('wear-visual-proof'));
    await page.locator('.dialog .wear-overlay').waitFor({state:'attached',timeout:15000});
    const secondWear=await page.evaluate(()=>{
      const canvas=document.querySelector('.dialog canvas.wear-overlay');
      const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let checksum=2166136261;
      for(let i=3;i<data.length;i+=4)if(i%31===3)checksum=Math.imul(checksum^data[i],16777619)>>>0;
      return {checksum,width:canvas.width,height:canvas.height,
        source:document.querySelector('.dialog .master-raster > img').currentSrc};
    });
    assert(secondWear.checksum===firstWear.checksum&&secondWear.width===firstWear.width,
      'The same collectible must keep an identical scratch pattern after reloading');
    assert(secondWear.source===firstWear.source,'Wear must not replace or re-encode the source art');
    await page.evaluate(()=>inspect('wear-pristine-proof'));
    assert(await page.locator('.dialog .wear-overlay').count()===0,
      'Pristine condition must not draw any overlay');
    const pristineSource=await page.locator('.dialog .master-raster > img').evaluate(img=>img.currentSrc);
    assert(pristineSource===firstWear.source,'Pristine and worn examples must use the same weapon master');
    await page.evaluate(()=>inspect('wear-skin-proof'));
    await page.locator('.dialog .wear-overlay').waitFor({state:'attached',timeout:15000});
    assert(await page.locator('.dialog .approved-skin .wear-overlay').count()===1,
      'Approved skin assets must use the same mask-based wear engine');
    await page.evaluate(()=>closeDialog());
    assert(errors.length===0,'Procedural wear generated browser exceptions: '+errors.join('; '));

    // 0.5.4 — wear is now visible on cards, filtered market results, listings and reels.
    await page.evaluate(()=>go('Inventory'));
    const ownedArt=page.locator('#inventoryGrid .master-raster[data-wear-seed="wear-visual-proof"]');
    assert(await ownedArt.count()===1,'Inventory art must retain its saved grade and seed');
    await ownedArt.scrollIntoViewIfNeeded();
    await ownedArt.locator('canvas.wear-overlay').waitFor({state:'attached',timeout:15000});
    assert((await ownedArt.locator('canvas.wear-overlay').count())===1,
      'Inventory card must draw a reusable weathered canvas');
    const intact=page.locator('#inventoryGrid .master-raster[data-wear-seed="wear-pristine-proof"]');
    assert(await intact.count()===1,'Pristine collectible must still display its untouched master');
    await intact.scrollIntoViewIfNeeded();
    assert(await intact.locator('canvas.wear-overlay').count()===0,
      'Pristine inventory cards must remain unweathered');
    await page.locator('#filter').selectOption({label:'Common'});
    const filtered=page.locator('#inventoryGrid .master-raster[data-wear-seed="wear-visual-proof"]');
    await filtered.scrollIntoViewIfNeeded();
    await filtered.locator('canvas.wear-overlay').waitFor({state:'attached',timeout:15000});
    await page.evaluate(()=>go('Market'));
    const npcWorn=await page.evaluate(()=>{
      const listing=s.market.npcListings.find(x=>x.item.kind==='weapon');
      if(!listing)throw Error('No NPC weapon to test wear');
      listing.item.wearGrade=4;
      save();
      go('Market');
      return {id:listing.item.id,weapon:listing.item.weapon};
    });
    await page.locator('#npcSearch').fill(npcWorn.weapon);
    const wornNpcCard=page.locator('#npcMarketResults .master-raster[data-wear-seed="'+npcWorn.id+'"]');
    assert(await wornNpcCard.count()===1,'Filtered NPC marketplace must retain exact item art metadata');
    await wornNpcCard.scrollIntoViewIfNeeded();
    await wornNpcCard.locator('canvas.wear-overlay').waitFor({state:'attached',timeout:15000});
    assert(await wornNpcCard.locator('canvas.wear-overlay').count()===1,
      'Dynamically filtered NPC listing must receive its visible wear overlay');
    await page.getByRole('button',{name:'Reset filters'}).click();
    await page.evaluate(()=>{
      const made=window.LootHubMarketTransactions.createListing(s,'wear-visual-proof',50,Date.now());
      if(!made)throw Error('Cannot list wear-proof item');
      save();
      go('Market');
    });
    const playerArt=page.locator('#market-listings .master-raster[data-wear-seed="wear-visual-proof"]');
    await playerArt.scrollIntoViewIfNeeded();
    await playerArt.locator('canvas.wear-overlay').waitFor({state:'attached',timeout:15000});
    assert(await playerArt.locator('canvas.wear-overlay').count()===1,
      'Player escrow listings need the same deterministic wear surface');
    await page.evaluate(()=>{
      window.LootHubMarketTransactions.cancelListing(s,s.listings.find(x=>x.item.id==='wear-visual-proof').id);
      s.items.push({id:'reel-visual-case',kind:'case',paid:25});
      save();
      openCase('reel-visual-case');
    });
    const tiles=page.locator('#track .tile');
    assert(await tiles.count()===48,'Wear-enabled reel must retain exactly 48 tiles');
    assert(await page.locator('#track .master-raster[data-wear-seed]').count()===48,
      'Reel previews and the winning tile must all carry grade/seed information');
    const reelWinner=await page.locator('#track .tile[data-reel-index="42"] .master-raster').evaluate(el=>({
      seed:el.dataset.wearSeed,grade:Number(el.dataset.wearGrade)
    }));
    const savedWinner=await page.evaluate(()=>s.items.find(x=>x.id===s.pendingReveal));
    assert(reelWinner.seed===savedWinner.id&&reelWinner.grade===savedWinner.wearGrade,
      'Actual reel prize must use the exact saved reward condition, not a preview roll');
    assert(await page.locator('#track .master-raster[data-wear-seed^="reel-preview-"]').count()===47,
      'Nonwinning reel cards must use transient sample IDs rather than fake saved collectibles');
    assert(!JSON.stringify(await page.evaluate(()=>s.items)).includes('reel-preview-'),
      'Temporary cosmetic reel previews may not enter real inventory');
    await page.getByRole('button',{name:'Skip animation'}).click();
    const revealedArt=page.locator('.reveal-art .master-raster[data-wear-seed="'+savedWinner.id+'"]');
    assert(await revealedArt.count()===1,'Reward reveal must keep winning item identity and wear');
    if(savedWinner.wearGrade>0){
      await revealedArt.locator('canvas.wear-overlay').waitFor({state:'attached',timeout:15000});
    }else{
      assert(await revealedArt.locator('canvas.wear-overlay').count()===0);
    }
    await page.evaluate(()=>closeDialog());
    assert(errors.length===0,'Full wear rollout produced browser errors: '+errors.join('; '));
    // 0.5.5a: all approved masters have material and silhouette maps.
    await page.evaluate(()=>inspect('wear-visual-proof'));
    const maps=await page.evaluate(async()=>{
      const api=window.LootHubWearMaterials;
      const weapons=Object.keys(window.LootHubSkinLines.modelSlugs);
      const entries=weapons.map(weapon=>({
        silhouette:api.silhouettePath(weapon),material:api.materialPath(weapon),
        finish:api.maskPath(weapon)
      }));
      const load=src=>new Promise(resolve=>{
        const image=new Image();
        image.onload=()=>resolve({ok:true,w:image.naturalWidth,h:image.naturalHeight});
        image.onerror=()=>resolve({ok:false});
        image.src=src;
      });
      const samples=await Promise.all(entries.slice(0,4).flatMap(e=>[load(e.silhouette),load(e.material)]));
      return {total:weapons.length,unique:new Set(entries.map(e=>e.material)).size,
        samples,allowedMetal:api.eligibility('metal',.5,.5,1).rust,
        forbiddenWood:!api.eligibility('wood',.5,.5,1).rust,
        forbiddenOther:!api.eligibility('other',.5,.5,1).rust,
        metadata:document.querySelector('.dialog [data-material-mask]')?.dataset.materialMask};
    });
    assert(maps.total===24&&maps.unique===24,'Material map must exist for every master');
    assert(maps.samples.every(x=>x.ok&&x.w===1600&&x.h===800),
      'Silhouette and material PNGs must load at native 1600x800 resolution');
    assert(maps.allowedMetal&&maps.forbiddenWood&&maps.forbiddenOther,
      'Material-aware rust eligibility must exclude wood and nonmetal');
    assert(maps.metadata&&maps.metadata.includes('mp5--material-1600.png'),
      'Each weapon card must point to the corresponding material map');
    await page.evaluate(()=>closeDialog());

    // 0.5.5b: real PNG material maps gate weathering pixels on iPhone.
    const grades=[];
    for(let grade=1;grade<=4;grade++){
      await page.evaluate(g=>{
        s.items.push({id:'AK-material-grade-'+g,kind:'weapon',weapon:'AK-47',
          base:100,tier:2,wearGrade:g});
        inspect('AK-material-grade-'+g);
      },grade);
      const surface=page.locator('.dialog .master-raster[data-wear-seed="AK-material-grade-'+grade+'"]');
      await surface.locator('canvas.wear-overlay').waitFor({state:'attached',timeout:15000});
      grades.push(await surface.evaluate(el=>{
        const c=el.querySelector('canvas.wear-overlay');
        const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
        let active=0,checksum=2166136261;
        for(let k=3;k<p.length;k+=4){
          if(p[k])active++;
          if(k%173===3)checksum=Math.imul(checksum^p[k],16777619)>>>0;
        }
        return {active,checksum,material:el.dataset.wearMaterial,channels:Number(el.dataset.wearChannels)};
      }));
    }
    assert(grades.every(g=>g.active>40&&g.material==='three-channel'),
      'Every non-Pristine grade must be produced by actual material-aware wear passes');
    assert(new Set(grades.map(g=>g.checksum)).size===4,
      'Each wear grade must produce a visibly distinct deterministic overlay');
    assert(grades[3].active>grades[0].active*1.4,
      'Battle-Scarred must have materially more wear than Lightly Worn');
    const corrosion=await page.evaluate(async()=>{
      const api=window.LootHubWearMaterials;
      const renderer=window.LootHubWearRenderer;
      const [material,paint]=await Promise.all([api.decodeMaterial('AK-47'),api.decode('AK-47')]);
      if(!material||!paint)return {loaded:false};
      const ele=document.querySelector('.dialog .master-raster');
      const full=ele.querySelector('canvas.wear-overlay');
      const image=ele.querySelector('img');
      const scale=Math.min(full.width/image.naturalWidth,full.height/image.naturalHeight);
      const dw=image.naturalWidth*scale,dh=image.naturalHeight*scale;
      const geo={x:(full.width-dw)/2,y:(full.height-dh)/2,w:dw,h:dh};
      let totalRust=0,metalRust=0,woodRust=0,otherRust=0,protectedRust=0;
      for(let trial=0;trial<8;trial++){
        const channel=renderer.renderLayer(document,full.width,full.height,
          'AK-rust-test-'+trial,4,'rust',geo,material,paint,'AK-47',api);
        if(!channel)continue;
        const data=channel.getContext('2d').getImageData(0,0,channel.width,channel.height).data;
        for(let y=0;y<channel.height;y++)for(let x=0;x<channel.width;x++){
          const pos=(y*channel.width+x)*4;
          if(!data[pos+3])continue;
          totalRust++;
          const u=(x+.5-geo.x)/geo.w,v=(y+.5-geo.y)/geo.h;
          const kind=api.sampleMaterial(material.pixels,material.width,material.height,u,v);
          const profile=api.getProfile('AK-47');
          const restricted=api.inRects(profile.protectedRects,u,v)||
            api.inRects(profile.wear.protectedRects,u,v);
          if(restricted)protectedRust++;
          if(kind==='metal')metalRust++;
          if(kind==='wood')woodRust++;
          if(kind==='other')otherRust++;
        }
        if(totalRust>60)break;
      }
      return {loaded:true,totalRust,metalRust,woodRust,otherRust,protectedRust};
    });
    assert(corrosion.loaded,'Real metal/wood/other PNG and paint mask must decode on iPhone');
    assert(corrosion.totalRust>60,'Test should exercise visible corrosion on genuine metal pixels');
    assert(corrosion.metalRust===corrosion.totalRust,'All rust pixels must be classed as actual metal');
    assert(corrosion.woodRust===0&&corrosion.otherRust===0&&corrosion.protectedRust===0,
      'No oxidation may spill onto wooden stocks, synthetic materials, or protected hardware');
    await page.evaluate(()=>closeDialog());
    assert(errors.length===0,'Material-aware filters raised browser errors: '+errors.join('; '));

    // 0.5.5c: confirm material-map refinements render correctly in real Chromium.
    const refined=await page.evaluate(async()=>{
      const api=window.LootHubWearMaterials;
      const expected=[
        ['AWP',.78,.44,'metal'],                // barrel no longer protected as optic
        ['AWP',.36,.31,'other'],                // actual scope keeps protected behavior
        ['FN SCAR-L',.44,.36,'metal'],         // central receiver
        ['FN SCAR-L',.70,.40,'other'],         // synthetic handguard
        ['M1 Garand',.19,.54,'wood'],         // wooden stock
        ['Glock-18',.28,.66,'other'],         // synthetic grip
        ['Tactical Tomahawk',.88,.48,'metal'] // exposed cutting head
      ];
      const out=[];
      for(const [weapon,x,y,wanted] of expected){
        const img=await api.decodeMaterial(weapon);
        const actual=img?api.sampleMaterial(img.pixels,img.width,img.height,x,y):'missing';
        const eligible=await api.inspect(weapon,x,y);
        out.push({weapon,wanted,actual,canRust:eligible.rust,source:!!img});
      }
      return out;
    });
    assert(refined.every(x=>x.source&&x.actual===x.wanted),
      'Material segmentation must agree with known visible parts: '+JSON.stringify(refined));
    assert(refined.every(x=>x.canRust===(x.wanted==='metal')),
      'No metal oxidation should be allowed on wood, polymer or protected optics');
    assert(errors.length===0,'Material map refinements produced browser errors: '+errors.join('; '));
    await page.screenshot({ path: path.resolve(__dirname, 'mobile-smoke.png'), fullPage: true });
    console.log('PASS: Mobile earning → case purchase → saved inventory → case opening → sale → saved wallet');
  } finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err => { console.error('FAIL:', err.stack || err); process.exit(1); });
