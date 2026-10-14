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
    // Sound has moved to Menu while retaining immediate, persisted toggling.
    const sound=page.locator('#soundToggle');
    assert(!(await sound.isVisible()),'Utility controls must stay out of primary navigation');
    await page.locator('#menuToggle').click();
    assert(await sound.isVisible(),'Menu must expose the sound toggle');
    assert(await sound.getAttribute('aria-pressed')==='true','Sound should start enabled');
    await sound.click();
    assert(await sound.getAttribute('aria-pressed')==='false','Mute must respond immediately');
    assert((await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')).preferences.fxMuted))===true,
      'Mute preference must be persisted with the existing save');
    await page.reload({waitUntil:'load'});
    await page.locator('#menuToggle').click();
    assert(await sound.getAttribute('aria-pressed')==='false','Muted setting must survive reload');
    await sound.click();
    assert(await sound.getAttribute('aria-pressed')==='true','Sound should be re-enableable from mobile');
    assert(await page.locator('#nav button').count()===4,'Only four primary destinations belong in navigation');
    assert(await page.locator('aside').count()===0,'Portfolio and history cannot occupy a permanent gameplay sidebar');

    // Only the Arsenal Case is live. The metal/wood/other maps are used
    // solely for wear, not procedural collectible finishes or themed cases.
    await page.getByRole('button',{name:'Cases',exact:true}).click();
    assert(await page.locator('.case-choice').count()===4,'Storefront must show four case choices');
    await page.getByRole('button',{name:'View Arsenal Case'}).click();
    const caseShop=await page.locator('#main').textContent();
    // Uploaded closed crate appears in the shop with native transparency, not SVG.
    const closedCase=page.locator('#main .hero .arsenal-case-closed img').first();
    await closedCase.waitFor({state:'visible',timeout:15000});
    const closedArt=await closedCase.evaluate(async img=>{
      await img.decode();
      const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
      const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
      return {width:img.naturalWidth,height:img.naturalHeight,
        alpha:ctx.getImageData(0,0,1,1).data[3],src:img.getAttribute('src')};
    });
    assert(closedArt.width===800&&closedArt.height===800&&closedArt.alpha===0&&
      closedArt.src.includes('arsenal-case-closed-800.webp'),
      'Shop must show exact owner-supplied Arsenal Case art with real transparent background');
    const fit=await page.locator('#main .hero .case-art').first().evaluate(frame=>{
      const img=frame.querySelector('.arsenal-case-image img');
      const art=frame.querySelector('.arsenal-case-image');
      const box=frame.getBoundingClientRect(),inner=art.getBoundingClientRect(),
        image=img.getBoundingClientRect();
      const cs=getComputedStyle(img),container=getComputedStyle(frame);
      return {height:box.height,width:box.width,objectFit:cs.objectFit,
        insetTop:inner.top-box.top,insetBottom:box.bottom-inner.bottom,
        insetLeft:inner.left-box.left,insetRight:box.right-inner.right,
        imageWidth:image.width,imageHeight:image.height,
        overflow:container.overflow};
    });
    assert(fit.objectFit==='contain'&&fit.height>=230,
      'Closed case must be contained within a sufficiently tall iPhone shop frame: '+JSON.stringify(fit));
    assert(fit.insetTop>=-1&&fit.insetBottom>=-1&&fit.insetLeft>=-1&&fit.insetRight>=-1,
      'No part of the closed case image may overflow the cropped shop frame: '+JSON.stringify(fit));

    // Spec Ops 0.6.3: the closed chest must occupy the entire framed shop
    // artwork area on iPhone, not show a 145px sliver of its 800px image.
    await page.getByRole('button',{name:'View Spec Ops Case'}).click();
    const specOpsShopArt=page.locator('.spec-ops-section .spec-ops-case-closed img');
    await specOpsShopArt.waitFor({state:'visible',timeout:15000});
    await specOpsShopArt.scrollIntoViewIfNeeded();
    const specOpsFit=await specOpsShopArt.evaluate(async img=>{
      await img.decode();
      const frame=img.closest('.cartel-case-art');
      const art=img.closest('.spec-ops-case-image');
      const box=frame.getBoundingClientRect();
      const inner=art.getBoundingClientRect();
      const image=img.getBoundingClientRect();
      const css=getComputedStyle(img);
      const holder=getComputedStyle(art);
      const cv=document.createElement('canvas');
      cv.width=img.naturalWidth;cv.height=img.naturalHeight;
      const cx=cv.getContext('2d');cx.drawImage(img,0,0);
      return {
        width:img.naturalWidth,height:img.naturalHeight,
        alphaCorner:cx.getImageData(0,0,1,1).data[3],
        alphaCenter:cx.getImageData(400,400,1,1).data[3],
        source:img.getAttribute('src'),fit:css.objectFit,
        frameHeight:box.height,frameWidth:box.width,
        holderHeight:inner.height,holderWidth:inner.width,
        imageHeight:image.height,imageWidth:image.width,
        top:image.top-box.top,bottom:box.bottom-image.bottom,
        left:image.left-box.left,right:box.right-image.right,
        frameOverflow:getComputedStyle(frame).overflow,
        holderOverflow:holder.overflow
      };
    });
    assert(specOpsFit.width===800&&specOpsFit.height===800&&
      specOpsFit.alphaCorner===0&&specOpsFit.alphaCenter>0&&
      specOpsFit.source.includes('spec-ops-case-closed-800.webp'),
      'Spec Ops shop must load the actual transparent owner-provided case: '+JSON.stringify(specOpsFit));
    assert(specOpsFit.fit==='contain'&&specOpsFit.frameHeight>=230&&
      specOpsFit.holderHeight>=specOpsFit.frameHeight-28&&
      specOpsFit.imageHeight>=specOpsFit.frameHeight-28&&
      Math.min(specOpsFit.top,specOpsFit.bottom,specOpsFit.left,specOpsFit.right)>=-1,
      'Spec Ops artwork must be fully centered and contained inside its mobile frame: '+JSON.stringify(specOpsFit));


    // 0.7.2: Both case poses and all five user-uploaded Lavish skins
    // must load uncropped on the same iPhone viewport as the other cases.
    await page.getByRole('button',{name:'View Lavish Case'}).click();
    const lavishPreview=await page.locator('.lavish-section .curated-case-image img').evaluate(async img=>{
      await img.decode();
      const frame=img.closest('.cartel-case-art'),holder=img.closest('.curated-case-image');
      const box=frame.getBoundingClientRect(),pic=img.getBoundingClientRect(),
        wrap=holder.getBoundingClientRect();
      const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
      const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
      return {src:img.getAttribute('src'),width:img.naturalWidth,height:img.naturalHeight,
       transparent:ctx.getImageData(0,0,1,1).data[3]===0,
       frameHeight:box.height,holderHeight:wrap.height,
       fit:getComputedStyle(img).objectFit,inside:
       pic.left>=box.left-1&&pic.right<=box.right+1&&
       pic.top>=box.top-1&&pic.bottom<=box.bottom+1};
    });
    assert(lavishPreview.src.includes('lavish-case-closed-800.webp')&&
      lavishPreview.width===800&&lavishPreview.height===800&&lavishPreview.transparent&&
      lavishPreview.frameHeight>=230&&lavishPreview.holderHeight>=lavishPreview.frameHeight-28&&
      lavishPreview.fit==='contain'&&lavishPreview.inside,
      'Lavish closed case must remain fully framed on iPhone: '+JSON.stringify(lavishPreview));
    const lavishArt=await page.evaluate(async()=>{
      const reg=window.LootHubCaseRegistry;
      const entry=reg.get('lavish');
      const outcomes=[];
      for(const item of entry.items){
       const shell=document.createElement('div');
       shell.innerHTML=visualArt({...item,id:'smoke-lavish-'+item.tier,wearGrade:0},'inspect');
       const img=shell.querySelector('img'),render=shell.querySelector('.approved-skin');
       try{
         await img.decode();
         const cv=document.createElement('canvas');cv.width=2;cv.height=2;
         const cx=cv.getContext('2d');cx.drawImage(img,0,0);
         outcomes.push({weapon:item.weapon,src:img.getAttribute('src'),
           ok:img.naturalWidth===1600&&img.naturalHeight===1600&&
           cx.getImageData(0,0,1,1).data[3]===0&&
           render?.dataset.finish==='Lavish'});
       }catch(error){outcomes.push({weapon:item.weapon,ok:false,error:String(error)})}
      }
      const open=document.createElement('div');
      open.innerHTML=visualArt({kind:'case',caseId:'lavish'},'open');
      const img=open.querySelector('img');
      await img.decode();
      return {outcomes,open:img.getAttribute('src'),openSize:img.naturalWidth,
       price:reg.priceFor('lavish'),shop:entry.items.length};
    });
    assert(lavishArt.price===75&&lavishArt.shop===5&&
      lavishArt.open.includes('lavish-case-open-1254.webp')&&lavishArt.openSize===1254&&
      lavishArt.outcomes.length===5&&lavishArt.outcomes.every(x=>x.ok),
      'Lavish must use exact uploaded weapon art and open chest: '+JSON.stringify(lavishArt));
    assert(await page.locator('#multi-qty-lavish').count()===1,
      'Lavish shop needs the same five-case purchase controls as earlier releases');

    assert(caseShop.includes('Double-Barrel Shotgun'),
      '25th official gun must appear in the available Arsenal Case weapon gallery');
    await page.getByRole('button',{name:'View Arsenal Case'}).click();
    await page.locator('.case-catalog-details').first().locator('summary').click();
    const gunCard=page.locator('#main .item').filter({
      has:page.getByRole('heading',{name:'Double-Barrel Shotgun',exact:true})
    });
    assert(await gunCard.count()===1,'New shotgun must have one separate official catalog entry');
    await gunCard.getByRole('button',{name:'View weapon'}).click();
    const gun=page.locator('.dialog .master-raster[data-weapon-model="Double-Barrel Shotgun"] img');
    await gun.waitFor({state:'visible'});
    await page.waitForFunction(()=>{
      const element=document.querySelector('.dialog .master-raster[data-weapon-model="Double-Barrel Shotgun"] img');
      return element&&element.complete&&element.naturalWidth===1600&&element.naturalHeight===800;
    },null,{timeout:15000});
    assert((await gun.getAttribute('src')).includes('double-barrel-shotgun-neutral-1600.webp'),
      'Shotgun inspection must use its exact uploaded neutral master art');
    await page.evaluate(()=>closeDialog());
    assert(caseShop.includes('Arsenal Case'),'Arsenal Case must remain in the store');
    assert(!caseShop.includes('Blackout Case')&&!caseShop.includes('Damascus Case'),
      'Retired procedural cases must no longer be displayed');
    assert(await page.getByRole('button',{name:'Buy Blackout Case'}).count()===0&&
      await page.getByRole('button',{name:'Buy Damascus Case'}).count()===0,
      'Retired cases must not remain purchasable');
    const wearOnly=await page.evaluate(()=>({
      lineCount:window.LootHubSkinLines.lines.length,
      materialPath:window.LootHubWearMaterials.materialPath('AK-47'),
      paintMask:window.LootHubWearMaterials.maskPath('AK-47')
    }));
    assert(wearOnly.lineCount===0&&wearOnly.materialPath?.endsWith('--material-1600.png')&&
      wearOnly.paintMask?.endsWith('--paint-main-1600.png'),
      'Wear-material classification and coating masks must survive case removal');

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
    assert(['Red Devil','Glory','High Stakes','The Hydra','The Luck O The Irish','Predator','Blossom','Kryptonite','Blood Thirsty','Crimson Delight','Cartel','Spec Ops','Lavish',...releasedNames].includes(approvedName),'NPC inventory used an unapproved cosmetic');
    await page.locator('#npcKindFilter').selectOption('skin');
    await page.locator('#npcSearch').fill(approvedName.toUpperCase());
    assert(await page.locator('.npc-listing').count()>=1,'Skin type and approved-finish search must find matching listings');
    await page.locator('.npc-listing').first().getByRole('button',{name:'Inspect'}).click();
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
    await page.locator('#walletButton').click();
    await page.getByRole('button',{name:'Earn coins',exact:true}).click();
    await waitForVisible('text=MicroTasks');
    for (let i = 0; i < 25; i++) {
      await page.getByRole('button', { name: /Earn 1 coin/ }).click();
    }
    assert((await page.locator('#wallet').textContent()).includes('25'), 'Earning must credit 25 coins');

    await page.getByRole('button', { name: 'Cases', exact: true }).click();
    await page.getByRole('button',{name:'View Arsenal Case'}).click();
    await page.locator('#multi-qty-arsenal').selectOption('1');
    await page.locator('.hero .multi-shop-actions button').first().click();
    await page.getByRole('heading', { name: '1 Arsenal Case bought' }).waitFor({ state: 'visible', timeout: 10000 });
    assert((await page.locator('#wallet').textContent()).includes('0'), 'Case purchase must debit wallet');

    await page.getByRole('button', { name: 'Keep sealed' }).click();
    await page.getByRole('button', { name: 'Inventory', exact: true }).click();
    await waitForVisible('.item');
    assert(await page.locator('.item').count() === 1, 'Purchase must create one owned sealed case');
    const sealed=await page.evaluate(()=>JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1')).items[0]);
    assert(!Object.prototype.hasOwnProperty.call(sealed,'wearGrade'),'Sealed case must not have a wear grade');

    await page.reload({ waitUntil: 'load' });
    assert(await page.locator('.item').count() === 1, 'Case ownership must survive page reload');

    await page.getByRole('button', { name: 'Inspect / trade' }).click();
    const sealedArt=page.locator('.dialog .arsenal-case-closed img');
    await sealedArt.waitFor({state:'visible',timeout:15000});
    assert((await sealedArt.getAttribute('src')).includes('arsenal-case-closed-1254.webp'),
      'Inspect and inventory must use the original closed crate in its full native resolution');
    await page.locator('.dialog').getByRole('button', { name: 'Open case' }).click();
    assert(await page.locator('.arsenal-opening-prop').count()===0,
      'Open crate must not obstruct the scrolling spin reel');
    assert(await page.locator('.reel-stage .arsenal-case-open').count()===0,
      'Open Arsenal crate belongs on the final reward screen only');
    const spinAppearance=await page.evaluate(()=>{
      const reel=document.querySelector('.reel-stage'),
        status=document.querySelector('.spin-pulse'),marker=document.querySelector('.reel .pointer');
      return {statusAnimation:getComputedStyle(status).animationName,
        pointerGlow:getComputedStyle(marker).boxShadow,
        pointerFilter:getComputedStyle(marker).filter,
        reelBackground:getComputedStyle(reel).backgroundImage};
    });
    assert(spinAppearance.statusAnimation==='none'&&spinAppearance.pointerGlow==='none'&&
      spinAppearance.pointerFilter==='none',
      'Rarity/glow effects should be reserved for the final reveal: '+JSON.stringify(spinAppearance));
    // Presentation is upgraded, but the stored result and 48-slot reel are unchanged.
    assert(await page.locator('.reel-stage .reel #track').isVisible(),
      'Case opening must show the new spotlighted reel stage');
    assert(await page.locator('.spin-pulse').isVisible(),
      'The player should see a clear spin-in-progress indicator');
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
    await page.waitForFunction(()=>{
      const img=document.querySelector('.reveal-art .master-raster img');
      return img&&img.complete&&img.naturalWidth>0;
    },null,{timeout:15000});
    const revealed=await page.evaluate(()=>{
      const art=document.querySelector('.reveal-art .master-raster');
      return {weapon:art?.dataset.weaponModel,finish:art?.dataset.finish,loaded:!!art?.querySelector('img')?.naturalWidth};
    });
    assert(revealed.weapon===winner.weapon,'Revealed reward model differs from the reel');
    assert(revealed.finish===winner.finish,'The revealed finish differs from the reel or an unapproved skin appeared');
    assert(revealed.loaded,'Base-weapon inspect image failed to load');
    const prizeCase=page.locator('.arsenal-reward-display .arsenal-reward-crate .arsenal-case-open img');
    await prizeCase.waitFor({state:'visible',timeout:15000});
    assert(await page.locator('.arsenal-reward-display .arsenal-reward-weapon .master-raster').count()===1,
      'Reward must float above the uploaded open Arsenal crate');
    assert((await prizeCase.getAttribute('src')).includes('arsenal-case-open-1254.webp'),
      'Reward must use the original open-case image rather than a synthetic stand-in');
    assert(await page.locator('.reward-reveal').isVisible(),
      'Opening a case must animate into a visible rarity-themed result');
    assert((await page.locator('.reward-reveal').getAttribute('class')).includes('rarity-'),
      'Reward reveal must be styled using the actual prize rarity');
    const wearName=['Pristine','Lightly Worn','Field-Tested','Heavily Worn','Battle-Scarred'][expectedReward.wearGrade];
    const wearFactor=[1,.95,.85,.7,.55][expectedReward.wearGrade];
    assert((await page.locator('.dialog').textContent()).includes('Condition: '+wearName),
      'Case opening must show the exact rolled wear grade');
    assert((await page.locator('.dialog').textContent()).includes(wearFactor.toFixed(2)+'×'),
      'Case reveal must show the corresponding wear multiplier');
    assert((await page.locator('.dialog').textContent()).includes('Condition-adjusted value'),
      'Case reveal must explain the condition-adjusted value');

    await waitForVisible('text=Estimated market value');
    await page.locator('.reward-fast-actions').getByRole('button', { name: 'Inspect' }).click();
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


    page.once('dialog',confirmation=>confirmation.accept());
    await page.locator('.dialog').getByRole('button', { name: /Instant sell/ }).click();
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
    await page.locator('#walletButton').click();
    await page.getByRole('button',{name:'Earn coins',exact:true}).click();
    while(Number((await page.locator('#wallet').textContent()).replace(/[^0-9]/g, '')) < 25){
      await page.getByRole('button', { name: /Earn 1 coin/ }).click();
    }
    await page.getByRole('button', { name: 'Cases', exact: true }).click();
    await page.getByRole('button',{name:'View Arsenal Case'}).click();
    await page.locator('#multi-qty-arsenal').selectOption('1');
    await page.locator('.hero .multi-shop-actions button').first().click();
    await page.getByRole('button', { name: 'Keep sealed' }).click();
    await page.getByRole('button', { name: 'Inventory', exact: true }).click();
    await page.getByRole('button', { name: 'Inspect / trade' }).click();
    await page.getByRole('button', { name: 'List for sale' }).click();
    await page.locator('#listPrice').fill('22');
    assert((await page.locator('#listingNet').textContent()).includes('20'), 'Live listing proceeds should account for fees');
    assert((await page.locator('#listingFee').textContent()).includes('2'), 'Live listing fee quote missing');
    await page.getByRole('button', { name: 'List for sale' }).click();
    assert(await page.getByText('My Trading Desk Listings').count() === 1, 'Listing must show in marketplace');
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

    await page.locator('#menuToggle').click();
    await page.getByRole('button',{name:'Backups & saves'}).click();
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
    await page.locator('#menuToggle').click();
    await page.getByRole('button',{name:'Backups & saves'}).click();
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
    await page.locator('#walletButton').click();
    await page.getByRole('button',{name:'Earn coins',exact:true}).click();
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
    await page.locator('#walletButton').click();
    await page.getByRole('button',{name:'Earn coins',exact:true}).click();
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
    await page.locator('#marketOwnedResults .item').first().getByRole('button',{name:'Trading Desk'}).click();
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
    const wearGroup=page.locator('#inventoryGrid .inventory-group')
      .filter({has:page.locator('[data-wear-seed="wear-visual-proof"]')});
    if(await wearGroup.count()&&!(await wearGroup.evaluate(el=>el.open)))
      await wearGroup.locator('summary').click();
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
    // Later economy tests need the full inventory; filters now intentionally persist.
    await page.locator('#filter').selectOption('all');
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
    assert(maps.total===25&&maps.unique===25,'Material map must exist for every master');
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
    // Cartel Case: all five original assets must load, drop pool must be separate
    // from Arsenal, and sealed cases must survive the live mobile purchase flow.
    const cartelArt=await page.evaluate(async()=>{
      const out=[],pool=cartelCatalog;
      for(const item of pool){
        const source=window.LootHubSkinArt?.[item.weapon+'|Cartel'];
        const node=document.createElement('div');
        node.innerHTML=visualArt({...item,id:'smoke-'+item.tier,wearGrade:0},'inspect');
        const img=node.querySelector('.approved-skin > img');
        let ok=false,alpha=255;
        if(img){
          try{
            await img.decode();
            const cv=document.createElement('canvas');cv.width=2;cv.height=2;
            const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
            alpha=ctx.getImageData(0,0,1,1).data[3];
            ok=img.naturalWidth>=1500&&alpha===0&&
              source&&['400','800','1600'].every(size=>source[size]?.length>1000);
          }catch(_){}
        }
        out.push({name:item.weapon,tier:item.tier,ok:!!ok,alpha});
      }
      return {out,masterCount:catalog.length,arsenal:dropCatalog.length,market:allMarketCatalog.length,
        casePrice:cartelCase.casePrice};
    });
    assert(cartelArt.masterCount===25&&cartelArt.arsenal===35&&cartelArt.market===50,
      'Cartel must not change the 25-master Arsenal drop pool');
    assert(cartelArt.casePrice===75,'Cartel Case price must be 75 coins');
    assert(cartelArt.out.length===5&&cartelArt.out.every(x=>x.ok),
      'Cartel artwork must be transparent high-resolution original assets: '+JSON.stringify(cartelArt.out));
    await page.evaluate(()=>{
      s.coins=Math.max(s.coins,350);
      save();
      go('Cases');
    });
    await page.getByRole('button',{name:'View Cartel Case'}).click();
    assert(await page.locator('#multi-qty-cartel').count()===1&&
      await page.locator('.cartel-section').first().locator('.multi-shop-actions button').count()===2,
      'Cartel shop must support one to five sealed or instant-open purchases');
    const cartelShopArt=page.locator('.cartel-case-art .cartel-case-closed img');
    await cartelShopArt.waitFor({state:'visible',timeout:15000});
    await cartelShopArt.scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>{
      const img=document.querySelector('.cartel-case-art .cartel-case-closed img');
      return img&&img.complete&&img.naturalWidth===800;
    },null,{timeout:15000});
    const chestShop=await cartelShopArt.evaluate(async img=>{
      await img.decode();
      const cv=document.createElement('canvas');
      cv.width=img.naturalWidth;cv.height=img.naturalHeight;
      const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
      const frame=img.closest('.cartel-case-art'),rect=frame.getBoundingClientRect();
      const inner=img.getBoundingClientRect();
      return {width:img.naturalWidth,height:img.naturalHeight,
        alpha:ctx.getImageData(0,0,1,1).data[3],src:img.getAttribute('src'),
        frameHeight:rect.height,top:inner.top-rect.top,bottom:rect.bottom-inner.bottom,
        left:inner.left-rect.left,right:rect.right-inner.right,fit:getComputedStyle(img).objectFit};
    });
    assert(chestShop.width===800&&chestShop.height===800&&chestShop.alpha===0&&
      chestShop.src.includes('cartel-case-closed-800.webp'),'Cartel shop must load the original transparent chest');
    assert(chestShop.frameHeight>=230&&chestShop.fit==='contain'&&
      Math.min(chestShop.top,chestShop.bottom,chestShop.left,chestShop.right)>=-1,
      'Cartel shop chest must fit fully on iPhone: '+JSON.stringify(chestShop));
    await page.evaluate(()=>buyCartelCase()); // Keep the legacy single-case reel under test.
    const cartelOwned=await page.evaluate(()=>s.items.find(x=>x.kind==='case'&&x.caseId==='cartel'));
    assert(cartelOwned&&cartelOwned.paid===75,
      'Cartel purchase must create one 75-coin sealed case');
    assert((await page.locator('.dialog').textContent()).includes('Cartel Case'),
      'Purchased Cartel case must be labeled distinctly from Arsenal');
    const cartelInspect=page.locator('.dialog .cartel-case-closed img');
    await cartelInspect.waitFor({state:'visible',timeout:15000});
    assert((await cartelInspect.getAttribute('src')).includes('cartel-case-closed-1254.webp'),
      'Cartel inspect should show the full-resolution owner-supplied closed chest');
    await page.locator('.dialog').getByRole('button',{name:'Open case'}).click();
    assert(await page.locator('.arsenal-opening-prop,.cartel-opening-prop,.cartel-case-open').count()===0,
      'Cartel chest should never obstruct the spinning weapon reel');
    const cartelSaved=await page.evaluate(()=>s.items.find(x=>x.kind==='skin'&&x.skin==='Cartel'));
    assert(cartelSaved&&cartelSaved.wearGrade>=0&&cartelSaved.wearGrade<=4,
      'Cartel drop must save as an approved skin with its own persistent wear grade');
    assert(cartelArt.out.some(x=>x.name===cartelSaved.weapon&&x.tier===cartelSaved.tier),
      'Cartel reel awarded a foreign or wrongly-tiered item');
    assert(await page.locator('#track .tile').count()===48,
      'Cartel opening must have the normal 48-item animation');
    await page.getByRole('button',{name:'Skip animation'}).click();
    const cartelOpened=page.locator('.cartel-reward-display .arsenal-reward-crate .cartel-case-open img');
    await cartelOpened.waitFor({state:'visible',timeout:15000});
    const cartonSize=await cartelOpened.evaluate(async img=>{
      await img.decode();return [img.naturalWidth,img.naturalHeight];
    });
    assert(cartonSize[0]===1254&&cartonSize[1]===1254&&
      (await cartelOpened.getAttribute('src')).includes('cartel-case-open-1254.webp'),
      'Final Cartel reveal needs the exact high-resolution open chest');
    assert(await page.locator('.cartel-reward-display .arsenal-reward-weapon').count()===1,
      'The won Cartel weapon should appear above the opened chest');
    assert((await page.locator('.dialog').textContent()).includes(cartelSaved.weapon+' | Cartel'),
      'Cartel reveal must match the committed prize');
    await page.locator('.reward-fast-actions').getByRole('button',{name:'Keep',exact:true}).click();
    await page.reload({waitUntil:'load'});
    assert((await page.evaluate((id)=>s.items.some(x=>x.kind==='skin'&&x.skin==='Cartel'&&x.id===id),cartelSaved.id))===true,
      'Cartel reward must persist through a full page reload');

    // Patch 0.6.0: buy & open five Arsenal cases with all five reels visible
    // at once in the iPhone viewport; prizes must exist before animation.
    await page.evaluate(()=>{s.coins=2000;save();go('Cases')});
    await page.getByRole('button',{name:'View Cartel Case'}).click();
    assert(await page.locator('#multi-qty-cartel').count()===1,
      'Cartel shop needs a 1–5 bundle selector after selecting Cartel');
    await page.getByRole('button',{name:'View Arsenal Case'}).click();
    assert(await page.locator('#multi-qty-arsenal').count()===1,
      'Arsenal shop needs a 1–5 bundle selector after selecting Arsenal');
    await page.locator('#multi-qty-arsenal').selectOption('5');
    const beforeMulti=await page.evaluate(()=>({
      n:s.items.length,c:s.coins,opened:s.openings,spent:s.spent
    }));
    await page.locator('.hero .multi-shop-actions .primary').click();
    assert(await page.locator('.multi-lane').count()===5,'Five independent reels should spin together');
    assert(await page.locator('.multi-lane .tile').count()===70,
      'Multi-open should render fourteen lightweight preview tiles per reel');
    const dims=await page.evaluate(()=>[...document.querySelectorAll('.multi-lane .reel')].map(x=>{
      const r=x.getBoundingClientRect();
      return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};
    }));
    const viewport=page.viewportSize();
    assert(dims.length===5&&dims.every(d=>d.top>=0&&d.bottom<=viewport.height&&
      d.left>=0&&d.right<=viewport.width),
      'All five compact reels must fit on the iPhone viewport: '+JSON.stringify(dims));
    const savedMulti=await page.evaluate(()=>({
      n:s.items.length,c:s.coins,opened:s.openings,spent:s.spent,items:s.items.slice(-5)
    }));
    assert(savedMulti.n===beforeMulti.n+5&&savedMulti.c===beforeMulti.c-125&&
      savedMulti.opened===beforeMulti.opened+5&&savedMulti.spent===beforeMulti.spent+125,
      'Five bundled Arsenal cases must be charged and opened exactly once');
    assert(savedMulti.items.every(x=>x.kind==='weapon'||(x.kind==='skin'&&x.skin!=='Cartel')),
      'Arsenal bundle must use Arsenal case drop table, never Cartel skins');
    assert(savedMulti.items.every(x=>Number.isInteger(x.wearGrade)),
      'Every multi-open reward needs its own saved condition roll');
    const persistedMulti=await page.evaluate(()=>{
      const saved=JSON.parse(localStorage.getItem('loothub-arsenal-alpha-v1'));
      return {n:saved.items.length,opened:saved.openings,ids:saved.items.slice(-5).map(x=>x.id)};
    });
    assert(persistedMulti.n===savedMulti.n&&persistedMulti.opened===savedMulti.opened&&
      JSON.stringify(persistedMulti.ids)===JSON.stringify(savedMulti.items.map(x=>x.id)),
      'All multi-reel winners must be saved before the player sees the spin');
    await page.getByRole('button',{name:'Reveal all'}).click();
    assert(await page.locator('.multi-prize').count()===5,
      'Final multi-open reveal must show five individual reward cards');
    assert(await page.locator('.multi-prize-chest .arsenal-case-open img').count()===5,
      'Opened case thumbnails belong only on the completed result screen');
    assert(await page.locator('.multi-reward-pick').count()===5,
      'Each newly opened reward must have a selectable sell control');
    assert((await page.locator('#multiRewardToolbar').textContent()).includes('0 selected'),
      'No weapons are selected for selling automatically');
    await page.locator('.multi-reward-pick:not(:disabled)').first().check();
    assert((await page.locator('#multiRewardToolbar').textContent()).includes('1 selected'),
      'The sale total must update as each reward is selected');
    await page.getByRole('button',{name:'Clear selection'}).click();
    assert((await page.locator('#multiRewardToolbar').textContent()).includes('0 selected'),
      'Clearing selections must preserve every reward');

    await page.getByRole('button',{name:'Keep all'}).click();
    await page.reload({waitUntil:'load'});
    const reloadedIds=await page.evaluate(()=>s.items.slice(-5).map(x=>x.id));
    assert(JSON.stringify(reloadedIds)===JSON.stringify(persistedMulti.ids),
      'Multi-open prize identities must survive a full browser restart');
    // Mixed owned cases can be selected, and the mobile picker can unselect
    // specific cases without purchasing anything.
    await page.evaluate(()=>{
      s.items.push({id:'mobile-bulk-arsenal',kind:'case',paid:25},
        {id:'mobile-bulk-cartel',kind:'case',caseId:'cartel',paid:75});
      save();go('Inventory');
    });
    await page.getByRole('button',{name:'Open up to 5 cases'}).click();
    assert(await page.locator('.multi-case-group').count()===2);
    assert(JSON.stringify(await page.locator('.multi-case-counter span').allTextContents())==='["1","1"]',
      'Case picker must display one selected per type without a scrolling checkbox list');
    await page.getByRole('button',{name:'Open 2 cases'}).click();
    assert(await page.locator('.multi-lane').count()===2);
    assert((await page.locator('.multi-lane-header').allTextContents()).some(x=>x.includes('Cartel')));
    await page.getByRole('button',{name:'Reveal all'}).click();
    assert(await page.locator('.multi-prize').count()===2);
    assert(await page.locator('.multi-prize-chest .cartel-case-open img').count()===1,
      'Mixed multi-open must use the corresponding opened Cartel case art');
    await page.getByRole('button',{name:'Keep all'}).click();


    // Patch 0.6.1: permanent collection discovery, iPhone book and one-time
    // free 25-case completion reward. Fixture uses approved collection items.
    await page.evaluate(()=>{
      const defs=window.LootHubCollections.definitions;
      const additions=defs.flatMap(c=>c.items.map((x,i)=>({
        id:'smoke-collection-'+c.id+'-'+i,kind:x.kind,
        weapon:x.weapon,skin:x.skin,tier:x.tier,base:x.base,wearGrade:2
      })));
      s.items.push(...additions);
      save();go('Cases');
    });
    await page.getByRole('button',{name:'Collections',exact:true}).click();
    assert((await page.evaluate(()=>s.tab))==='Collections','Collections must be a primary saved destination');
    assert(await page.locator('.collection-panel').count()===4,
      'The iPhone Collection Book must show Arsenal, Cartel, Spec Ops and Lavish progress');
    assert((await page.locator('.collection-book').textContent()).includes('35 / 35'),
      'Owned original weapons and Arsenal skins must all count once');
    assert((await page.locator('.collection-book').textContent()).includes('5 / 5'),
      'Cartel collection should recognize five exact user-approved skins');
    await page.getByRole('button',{name:'View collection'}).nth(1).click();
    assert(await page.locator('.collection-tile').count()===5,
      'The Cartel book needs five actual collection item tiles');
    assert(await page.locator('.collection-tile.discovered').count()===5,
      'Every owner-approved Cartel skin should display discovered credit');
    await page.getByRole('button',{name:'Claim 25 Cartel Cases'}).click();
    assert(await page.locator('.collection-grant').isVisible());
    const cartelReward=await page.evaluate(()=>({
      cases:s.items.filter(x=>x.kind==='case'&&x.caseId==='cartel'),
      claimed:s.collections.progress['cartel-v1'].claimedAt
    }));
    assert(cartelReward.cases.length===25&&cartelReward.claimed>0,
      'Completing Cartel should save exactly 25 free sealed Cartel Cases');
    assert(cartelReward.cases.every(x=>x.paid===0&&x.collectionId==='cartel-v1'),
      'Collection cases must preserve free reward provenance');
    await page.getByRole('button',{name:'Keep collecting'}).click();
    assert((await page.locator('.collection-book').textContent()).includes('Reward claimed'),
      'The completion button must become permanently claimed');
    await page.reload({waitUntil:'load'});
    const restore=await page.evaluate(()=>({
      count:s.items.filter(x=>x.kind==='case'&&x.caseId==='cartel').length,
      claimed:s.collections.progress['cartel-v1'].claimedAt,
      discovery:s.collections.progress['cartel-v1'].seen.length
    }));
    assert(restore.count===25&&restore.claimed===cartelReward.claimed&&restore.discovery===5,
      'Claim and permanent collection history must survive reloading');
    await page.evaluate(()=>openCollectionBook());
    await page.getByRole('button',{name:'View collection'}).first().click();
    assert(await page.locator('.collection-tile').count()===35,
      'Arsenal Collection Book must show all original 25 weapons and ten skins');
    assert(await page.locator('.collection-tile.discovered').count()===35);
    await page.getByRole('button',{name:'Claim 25 Arsenal Cases'}).click();
    assert(await page.locator('.collection-grant').isVisible());
    assert(await page.evaluate(()=>s.items.filter(x=>x.kind==='case'&&!x.caseId&&
       x.collectionId==='arsenal-v1').length)===25,
      'Arsenal completion must grant exactly 25 sealed Arsenal Cases');
    await page.getByRole('button',{name:'View cases'}).click();
    assert(await page.getByRole('button',{name:'Open up to 5 cases'}).count()===1,
      'Free completion cases must work in the existing 1–5 case opening flow');

    // Rewarded cases are ordinary unopened items usable in five-reel opening.
    await page.evaluate(()=>go('Inventory'));
    const rewardsBefore=await page.evaluate(()=>s.items.filter(x=>x.kind==='case'&&
      x.rewardSource==='collection').length);
    assert(rewardsBefore===50,'Both completed collections should grant 50 sealed cases');
    await page.getByRole('button',{name:'Open up to 5 cases'}).click();
    await page.getByRole('button',{name:'Open 5 cases'}).click();
    assert(await page.locator('.multi-lane').count()===5,
      'Collection rewards must be compatible with simultaneous five-case opening');
    await page.getByRole('button',{name:'Reveal all'}).click();
    assert(await page.locator('.multi-prize').count()===5);
    await page.getByRole('button',{name:'Keep all'}).click();
    await page.reload({waitUntil:'load'});
    const afterCollectionReload=await page.evaluate(()=>({
      arsenal:window.LootHubCollections.progress(s,'arsenal-v1'),
      cartel:window.LootHubCollections.progress(s,'cartel-v1'),
      remaining:s.items.filter(x=>x.kind==='case'&&x.rewardSource==='collection').length
    }));
    assert(afterCollectionReload.arsenal.found===35&&afterCollectionReload.cartel.found===5&&
      afterCollectionReload.arsenal.claimed&&afterCollectionReload.cartel.claimed,
      'Collection records and one-time rewards must persist after reload');
    assert(afterCollectionReload.remaining===45,
      'After opening five, forty-five awarded cases should remain sealed');
    assert(await page.evaluate(()=>claimCollection('cartel-v1'))===false,
      'Claiming again must never grant another 25 cases');


    async function selectGroupedInventoryCopy(id){
      const checkbox=page.locator('input[onchange*="'+id+'"]');
      const group=page.locator('#inventoryGrid .inventory-group').filter({has:checkbox});
      if(await group.count()&&!(await group.first().evaluate(el=>el.open)))
        await group.first().locator('summary').click();
      await checkbox.check();
    }
    // v0.7.5: multi-select instant sale sells only weapons, at original
    // condition-adjusted values, with a single confirmation and saved wallet.
    await page.evaluate(()=>{
      s.items.push(
        {id:'mobile-bulk-sale-a',kind:'weapon',weapon:'AK-47',tier:2,base:100,wearGrade:0},
        {id:'mobile-bulk-sale-b',kind:'skin',weapon:'SPAS-12',skin:'Spec Ops',tier:2,base:100,wearGrade:4},
        {id:'mobile-bulk-sale-case',kind:'case',caseId:'lavish',paid:75});
      save();go('Inventory');
    });
    await page.getByRole('button',{name:'Select weapons to trade'}).click();
    const bulkBefore=await page.evaluate(()=>({coins:s.coins,sales:s.sales,rep:s.rep}));
    await selectGroupedInventoryCopy('mobile-bulk-sale-a');
    await selectGroupedInventoryCopy('mobile-bulk-sale-b');
    assert((await page.locator('#bulkSellToolbar').textContent()).includes('121 coins instant value'),
      'Bulk sell must quote original 78/43 condition-adjusted prices');
    assert(await page.getByRole('checkbox',{name:/Select Sealed/}).count()===0,
      'Sealed cases must not enter the weapon bulk-sale selection');
    page.once('dialog',confirmation=>confirmation.accept());
    await page.getByRole('button',{name:'Sell selected · 121 ◈'}).click();
    const bulkAfter=await page.evaluate(()=>({
      coins:s.coins,sales:s.sales,rep:s.rep,
      ids:s.items.filter(x=>x.id.startsWith('mobile-bulk-sale-')).map(x=>x.id)
    }));
    assert(bulkAfter.coins===bulkBefore.coins+121&&bulkAfter.sales===bulkBefore.sales+121&&
      bulkAfter.rep===bulkBefore.rep+2&&
      JSON.stringify(bulkAfter.ids)==='["mobile-bulk-sale-case"]',
      'Bulk sale must credit full quote once and preserve the sealed case');
    await page.reload({waitUntil:'load'});
    assert(await page.evaluate(()=>s.coins)===bulkAfter.coins,
      'Bulk sale wallet must survive an iPhone reload');

    // 0.7 iPhone auction and independent-price negotiation end-to-end.
    await page.evaluate(()=>{
      s.items.push({id:'mobile-auction-spas',kind:'skin',weapon:'SPAS-12',
        skin:'Spec Ops',tier:2,base:350,wearGrade:1});
      save();go('Inventory');
      window.LootHubAuctionUI.openEditor('mobile-auction-spas');
    });
    await page.locator('#auctionStartingBid').waitFor({state:'visible'});
    await page.locator('#auctionStartingBid').fill('220');
    await page.locator('#auctionDuration').selectOption('1');
    await page.getByRole('button',{name:'Start auction'}).click();
    assert(await page.locator('#market-auctions .auction-listing').count()===1,
      'Auction should appear in the Auction House after the item enters escrow');
    const auctionView=await page.locator('#market-auctions .auction-listing').evaluate(node=>{
      const rect=node.getBoundingClientRect();
      const button=node.querySelector('button');
      return {left:rect.left,right:rect.right,width:window.innerWidth,
        hasBids:!!button,buttonHeight:button?.getBoundingClientRect().height};
    });
    assert(auctionView.left>=-1&&auctionView.right<=auctionView.width+1&&
      auctionView.hasBids&&auctionView.buttonHeight>=42,
      'Auction House must fit iPhone width with usable controls: '+JSON.stringify(auctionView));
    await page.getByRole('button',{name:'View bids'}).click();
    assert(await page.locator('.dialog .auction-bid-history').count()===1);
    await page.getByRole('button',{name:'Close',exact:true}).click();
    const auctionBefore=await page.evaluate(()=>({
      coins:s.coins,owned:s.items.some(x=>x.id==='mobile-auction-spas')
    }));
    assert(!auctionBefore.owned,'Auction escrow must remove the owned item');
    await page.evaluate(()=>{
      const auction=s.listings.find(x=>x.item.id==='mobile-auction-spas');
      auction.createdAt=Date.now()-3600000-1500;
      auction.endsAt=auction.createdAt+3600000;
      auction.nextSlot=0;auction.bids=[];auction.highestBid=0;auction.highestBidder=null;
      save();render();
    });
    assert(await page.locator('#market-auctions .auction-listing').count()===0,
      'Expired auction must settle or return the weapon after offline catch-up');
    const auctionAfter=await page.evaluate(()=>({
      coins:s.coins,owned:s.items.some(x=>x.id==='mobile-auction-spas'),
      notices:s.market.notifications,
      sold:s.market.notifications.some(x=>x.type==='sold')
    }));
    assert(auctionAfter.sold?auctionAfter.coins>auctionBefore.coins:auctionAfter.owned,
      'Expired auction must either pay out or return the identical item');
    assert(auctionAfter.notices.length>=1,'Auction results must produce notifications');
    assert(await page.locator('#market-alerts .market-notice').count()>=1,
      'Auction notifications should be visible on an iPhone');
    await page.reload({waitUntil:'load'});
    const stable=await page.evaluate(()=>({
      coins:s.coins,notifications:s.market.notifications.length,
      auction:s.listings.some(x=>x.item.id==='mobile-auction-spas')
    }));
    assert(stable.coins===auctionAfter.coins&&stable.notifications===auctionAfter.notices.length&&
      stable.auction===false,'Refreshing must not duplicate the sale or reset the auction');

    // v0.7.5: early accept an existing high bid on a 12-real-hour auction.
    await page.evaluate(()=>{
      s.items.push({id:'mobile-early-auction',kind:'weapon',weapon:'AK-47',tier:2,base:350,wearGrade:1});
      save();
      go('Inventory');
      window.LootHubAuctionUI.openEditor('mobile-early-auction');
    });
    await page.locator('#auctionStartingBid').fill('100');
    await page.locator('#auctionDuration').selectOption('12');
    await page.getByRole('button',{name:'Start auction'}).click();
    const earlyNoBid=page.locator('#market-auctions .auction-listing')
      .filter({hasText:'AK-47'});
    assert(await earlyNoBid.count()===1,'Twelve-hour auction must enter escrow');
    await earlyNoBid.getByRole('button',{name:'View bids'}).click();
    assert(await page.getByRole('button',{name:/Accept highest bid/}).count()===0,
      'Unbid auctions cannot be accepted early');
    await page.getByRole('button',{name:'Close',exact:true}).click();
    await page.evaluate(()=>{
      const l=s.listings.find(x=>x.item.id==='mobile-early-auction');
      const buyer=window.LootHubTraders.ensure(s).find(x=>x.role==='buyer');
      l.bids=[{bidder:buyer.id,amount:200,at:l.createdAt}];
      l.highestBid=200;l.highestBidder=buyer.id;
      save();render();
    });
    const earlyCoins=await page.evaluate(()=>s.coins);
    const inlineAccept=earlyNoBid.getByRole('button',{name:/Accept bid/});
    assert((await inlineAccept.textContent()).includes('190'),
      'Auction listing must show the net payout directly beside Accept Bid');
    page.once('dialog',confirmation=>confirmation.accept());
    await inlineAccept.click();
    const earlyState=await page.evaluate(()=>({
      coins:s.coins,open:s.listings.some(x=>x.item.id==='mobile-early-auction'),
      owns:s.items.some(x=>x.id==='mobile-early-auction'),
      notice:s.market.notifications.filter(x=>x.type==='sold'&&x.message.includes('sold early')).length
    }));
    assert(earlyState.coins===earlyCoins+190&&!earlyState.open&&!earlyState.owns&&
      earlyState.notice===1,'Early acceptance must settle exactly one funded bid and end auction');
    await page.reload({waitUntil:'load'});
    assert(await page.evaluate(()=>s.coins)===earlyState.coins&&
      await page.locator('#market-auctions .auction-listing').filter({hasText:'AK-47'}).count()===0,
      'Early accepted auctions must not settle again after reload');

    await page.evaluate(()=>{
      s.items.push({id:'mobile-desk-spas',kind:'skin',weapon:'SPAS-12',
        skin:'Spec Ops',tier:2,base:350,wearGrade:1});
      save();go('Market');
      listItem('mobile-desk-spas');
    });
    await page.locator('#listPrice').fill('519');
    await page.getByRole('button',{name:'List for sale'}).click();
    assert(await page.locator('#market-listings .listing-line').count()>=1,
      'Trading Desk listing must remain separate from completed auctions');
    await page.locator('#market-listings .listing-line').last().getByRole('button',{name:'Review offer'}).click();
    const deskOffer=await page.evaluate(()=>{
      const n=s.market.negotiations.find(x=>x.listingId==='listing-mobile-desk-spas');
      const l=s.listings.find(x=>x.id==='listing-mobile-desk-spas');
      return {bid:n.npcOffer,ceiling:n.threshold,ask:n.initialAsk,
        reference:window.LootHubEconomy.marketValue(s,l.item)};
    });
    assert(deskOffer.ceiling<=Math.ceil(deskOffer.reference*1.25)&&
      deskOffer.bid<=deskOffer.ceiling&&deskOffer.bid<519,
      'NPCs must not scale their valuation with the inflated 519 coin asking price');
    await page.locator('#negotiationAmount').fill('543');
    await page.getByRole('button',{name:'Final offer'}).click();
    assert((await page.locator('.dialog').textContent()).includes('walked away'),
      'Unreasonable final offers must be rejected, not guaranteed deals');
    assert(await page.evaluate(()=>s.items.every(x=>x.id!=='mobile-desk-spas')),
      'A rejected negotiation must leave the weapon in escrow without a payout');
    await page.reload({waitUntil:'load'});
    assert(await page.evaluate(()=>s.listings.some(x=>x.id==='listing-mobile-desk-spas')),
      'Pending Trading Desk escrow and rejection history survive reload');

    // v0.7.6 — Buy & Open without case details, then repeat and sell from the reward screen.
    await page.evaluate(()=>{s.coins=Math.max(s.coins,500);save();go('Cases')});
    const fastCard=page.locator('.case-choice-lavish');
    assert(await fastCard.getByRole('button',{name:'Buy & Open'}).count()===1,
      'Each case card needs one direct purchase/open button');
    await fastCard.locator('#fast-qty-lavish').selectOption('1');
    const beforeFast=await page.evaluate(()=>({coins:s.coins,openings:s.openings,items:s.items.length}));
    await fastCard.getByRole('button',{name:'Buy & Open'}).click();
    assert(await page.locator('.multi-spin-screen').count()===1,
      'Direct opening should not enter case details or inventory');
    await page.getByRole('button',{name:'Reveal all'}).click();
    assert(await page.locator('.dialog .reward-fast-actions').count()===1,
      'One-case reveal must offer Keep, Sell, and Open Again directly');
    const firstFast=await page.evaluate(()=>({
      coins:s.coins,openings:s.openings,item:s.items[s.items.length-1],
      last:s.preferences.lastCaseId,qty:s.preferences.fastCaseQuantity
    }));
    assert(firstFast.coins===beforeFast.coins-75&&firstFast.openings===beforeFast.openings+1&&
      firstFast.item.skin==='Lavish'&&firstFast.qty===1&&firstFast.last==='lavish',
      'One tap must debit once, create one permanent reward, and remember case choice');
    await page.locator('.dialog .repeat-case-button').click();
    await page.getByRole('button',{name:'Reveal all'}).click();
    const repeated=await page.evaluate(()=>({coins:s.coins,openings:s.openings,items:s.items.length}));
    assert(repeated.coins===firstFast.coins-75&&repeated.openings===firstFast.openings+1&&
      repeated.items===beforeFast.items+2,'Open Again must buy and reveal another of the same case');
    const sellQuote=await page.evaluate(()=>
      window.LootHubMarketTransactions.instantSellPrice(s.items[s.items.length-1]));
    page.once('dialog',confirmation=>confirmation.accept());
    await page.locator('.dialog').getByRole('button',{name:/Instant sell/}).click();
    const soldFast=await page.evaluate(()=>({coins:s.coins,items:s.items.length}));
    assert(soldFast.coins===repeated.coins+sellQuote&&soldFast.items===repeated.items-1,
      'Reward screen instant sale credits exact existing quote only once');
    assert((await page.locator('.dialog').textContent()).includes('Open same case again'));
    await page.reload({waitUntil:'load'});
    const persistedFast=await page.evaluate(()=>({
      coins:s.coins,qty:s.preferences.fastCaseQuantity,last:s.preferences.lastCaseId
    }));
    assert(persistedFast.coins===soldFast.coins&&persistedFast.qty===1&&persistedFast.last==='lavish',
      'Wallet and recent case preference must survive reload');
    await page.locator('#fast-qty-cartel').selectOption('3');
    assert((await page.locator('#fast-total-cartel').textContent()).includes('225 coins total'),
      'Quick selector should immediately reflect quantity and price without another screen');


    // v0.7.7 end-to-end: keep a protected rare reward, sell two common ones.
    await page.evaluate(()=>{s.coins=Math.max(s.coins,1000);save();go('Cases')});
    await page.locator('#fast-qty-arsenal').selectOption('3');
    await page.locator('.case-choice-arsenal').getByRole('button',{name:'Buy & Open'}).click();
    const rewardIds=await page.evaluate(()=>{
      const ids=pending.rewards.map(x=>x.id);
      for(let i=0;i<2;i++){pending.rewards[i].tier=0;pending.rewards[i].base=40}
      pending.rewards[2].tier=4;pending.rewards[2].base=4200;
      save();return ids;
    });
    await page.getByRole('button',{name:'Reveal all'}).click();
    assert(await page.locator('.multi-reward-pick:disabled').count()===1,
      'Legendary rewards cannot be selected without an explicit unlock');
    const quote=await page.evaluate(ids=>ids.slice(0,2).reduce((sum,id)=>
      sum+window.LootHubMarketTransactions.instantSellPrice(s.items.find(x=>x.id===id)),0),rewardIds);
    await page.getByRole('button',{name:'Select Common & Uncommon'}).click();
    assert(await page.locator('.multi-reward-pick:checked').count()===2,
      'Select Common must not include the protected Legendary');
    const walletBefore=await page.evaluate(()=>s.coins);
    page.once('dialog',d=>d.accept());
    await page.locator('#multiRewardToolbar').getByRole('button',{name:/Sell selected/}).click();
    const afterSale=await page.evaluate(ids=>({
      coins:s.coins,remaining:ids.filter(id=>s.items.some(x=>x.id===id))
    }),rewardIds);
    assert(afterSale.coins===walletBefore+quote&&
      JSON.stringify(afterSale.remaining)===JSON.stringify([rewardIds[2]]),
      'Selling selected rewards must credit exact total and preserve unselected Legendary');
    assert(await page.locator('.multi-reward-manager .multi-prize').count()===1,
      'Sale stays in the reward screen with the protected item visible');
    await page.getByRole('button',{name:'Keep all'}).click();
    await page.reload({waitUntil:'load'});
    assert(await page.evaluate(id=>s.items.some(x=>x.id===id),rewardIds[2]),
      'Kept Legendary must still exist after reloading the browser');
    assert(await page.evaluate(()=>s.coins)===afterSale.coins,
      'Bulk sale proceeds must persist across reload');

    // v0.7.8: perform a weapon sale and 12h auction directly from Inventory cards.
    await page.evaluate(()=>{
      s.items.push(
        {id:'mobile-quick-sell',kind:'weapon',weapon:'AK-47',tier:2,base:100,wearGrade:0},
        {id:'mobile-quick-auction',kind:'skin',weapon:'SPAS-12',skin:'Spec Ops',tier:2,base:350,wearGrade:1},
        {id:'mobile-quick-sealed',kind:'case',paid:25}
      );
      save();go('Inventory');
    });
    const sellCard=page.locator('#inventoryGrid .item').filter({hasText:'AK-47'})
      .filter({has:page.locator('button[onclick*=mobile-quick-sell]')});
    const sellGroup=page.locator('#inventoryGrid .inventory-group').filter({has:sellCard});
    if(await sellGroup.count()&&!(await sellGroup.first().evaluate(el=>el.open)))
      await sellGroup.first().locator('summary').click();
    assert(await sellCard.getByRole('button',{name:'Sell · 78 ◈'}).count()===1,
      'Inventory should display a condition-adjusted instant-sale action');
    const quickBefore=await page.evaluate(()=>s.coins);
    page.once('dialog',d=>d.accept());
    await sellCard.getByRole('button',{name:'Sell · 78 ◈'}).click();
    assert(await page.evaluate(()=>s.coins)===quickBefore+78&&
      await page.evaluate(()=>s.items.every(x=>x.id!=='mobile-quick-sell')),
      'Inline sale must pay once and remove only the selected weapon');
    const auctionCard=page.locator('#inventoryGrid .item')
      .filter({has:page.locator('button[onclick*=mobile-quick-auction]')});
    const auctionGroup=page.locator('#inventoryGrid .inventory-group').filter({has:auctionCard});
    if(await auctionGroup.count()&&!(await auctionGroup.first().evaluate(el=>el.open)))
      await auctionGroup.first().locator('summary').click();
    assert(await auctionCard.getByRole('button',{name:'Auction · 12h'}).count()===1,
      'Inventory should offer a 12-hour quick auction without opening the editor');
    page.once('dialog',d=>d.accept());
    await auctionCard.getByRole('button',{name:'Auction · 12h'}).click();
    const quickAuction=await page.evaluate(()=>{
      const listing=s.listings.find(x=>x.item.id==='mobile-quick-auction');
      return {id:listing?.id,duration:listing?.durationHours,
        owned:s.items.some(x=>x.id==='mobile-quick-auction'),start:listing?.ask};
    });
    assert(quickAuction.id&&quickAuction.duration===12&&!quickAuction.owned&&quickAuction.start>0,
      'One quick-auction confirmation must escrow the item for 12 hours');
    const sealedOwned=await page.evaluate(()=>s.items.some(x=>x.id==='mobile-quick-sealed'));
    assert(sealedOwned,'Quick trading must not touch sealed cases');
    await page.evaluate(()=>{
      const listing=s.listings.find(x=>x.item.id==='mobile-quick-auction');
      const buyer=window.LootHubTraders.ensure(s).find(x=>x.role==='buyer');
      listing.bids=[{bidder:buyer.id,amount:200,at:listing.createdAt}];
      listing.highestBid=200;listing.highestBidder=buyer.id;
      save();render();
    });
    const directAccept=page.locator('#market-auctions .auction-listing')
      .filter({hasText:'SPAS-12'}).getByRole('button',{name:/Accept bid/});
    assert((await directAccept.textContent()).includes('190'),
      'Inline auction controls must show after-fee proceeds');
    const proceedsBefore=await page.evaluate(()=>s.coins);
    page.once('dialog',d=>d.accept());
    await directAccept.click();
    assert(await page.evaluate(()=>s.coins)===proceedsBefore+190&&
      await page.evaluate(()=>s.listings.every(x=>x.item.id!=='mobile-quick-auction')),
      'Inline bid acceptance must settle exactly once');
    await page.reload({waitUntil:'load'});
    assert(await page.evaluate(()=>s.coins)===proceedsBefore+190,
      'Direct trading wallet and auction settlement must persist after reload');

    // v0.7.9: select two weapons once, quick-auction both, then accept both
    // highest funded bids from the Market screen with a single confirmation.
    await page.evaluate(()=>{
      s.items.push(
       {id:'batch-mobile-one',kind:'weapon',weapon:'AK-47',tier:1,base:100,wearGrade:0},
       {id:'batch-mobile-two',kind:'weapon',weapon:'MP5',tier:1,base:110,wearGrade:0},
       {id:'batch-mobile-sealed',kind:'case',paid:25}
      );
      save();go('Inventory');
    });
    await page.getByRole('button',{name:'Select weapons to trade'}).click();
    await selectGroupedInventoryCopy('batch-mobile-one');
    await selectGroupedInventoryCopy('batch-mobile-two');
    assert((await page.locator('#bulkSellToolbar').textContent()).includes('Auction selected · 12h'),
      'Bulk selection toolbar must let users auction the same selected weapons');
    page.once('dialog',d=>d.accept());
    await page.getByRole('button',{name:'Auction selected · 12h'}).click();
    const created=await page.evaluate(()=>({
      listings:s.listings.filter(l=>['batch-mobile-one','batch-mobile-two'].includes(l.item.id))
        .map(l=>({id:l.id,hours:l.durationHours})),
      stillOwned:s.items.filter(x=>['batch-mobile-one','batch-mobile-two','batch-mobile-sealed'].includes(x.id)).map(x=>x.id)
    }));
    assert(created.listings.length===2&&created.listings.every(x=>x.hours===12)&&
      JSON.stringify(created.stillOwned)==='["batch-mobile-sealed"]',
      'Both weapons must enter separate 12-hour escrow; sealed cases remain owned');
    await page.evaluate(()=>{
      const buyers=window.LootHubTraders.ensure(s).filter(t=>t.role==='buyer');
      buyers[0].wallet=Math.max(buyers[0].wallet,5000);
      buyers[1].wallet=Math.max(buyers[1].wallet,5000);
      const bids=[100,150],ids=['batch-mobile-one','batch-mobile-two'];
      ids.forEach((id,i)=>{
        const listing=s.listings.find(l=>l.item.id===id);
        listing.bids=[{bidder:buyers[i].id,amount:bids[i],at:listing.createdAt}];
        listing.highestBid=bids[i];listing.highestBidder=buyers[i].id;
      });
      save();render();
    });
    await page.locator('input[onchange*="listing-batch-mobile-one"]').check();
    await page.locator('input[onchange*="listing-batch-mobile-two"]').check();
    assert((await page.locator('#batchBidToolbar').textContent()).includes('237 ◈ combined net payout'),
      'Selected auction offers should display the exact combined after-fee payout');
    const batchBalance=await page.evaluate(()=>s.coins);
    page.once('dialog',d=>d.accept());
    await page.locator('#batchBidToolbar').getByRole('button',{name:/Accept selected/}).click();
    const settled=await page.evaluate(()=>({
      coins:s.coins,listingIds:s.listings.filter(l=>l.item.id.startsWith('batch-mobile-')).map(l=>l.id),
      sealed:s.items.some(x=>x.id==='batch-mobile-sealed')
    }));
    assert(settled.coins===batchBalance+237&&settled.listingIds.length===0&&settled.sealed,
      'Selected bids must settle once, transfer both items and leave unrelated cases alone');
    await page.reload({waitUntil:'load'});
    assert(await page.evaluate(()=>s.coins)===settled.coins,
      'Bulk auction settlement must survive reload without double payment');

    // v0.8.0: large-inventory presentation keeps every individual ID accessible.
    await page.evaluate(()=>{
      // Isolate this end-of-flow UI fixture from previous case-opening drops.
      s.items=s.items.filter(x=>x.kind==='case');
      s.items.push(
        {id:'smart-best',kind:'weapon',weapon:'Tec-9',tier:0,base:100,wearGrade:0},
        {id:'smart-mid',kind:'weapon',weapon:'Tec-9',tier:0,base:100,wearGrade:2},
        {id:'smart-worn',kind:'weapon',weapon:'Tec-9',tier:0,base:100,wearGrade:4},
        {id:'smart-rare-best',kind:'weapon',weapon:'M134 Minigun',tier:4,base:1700,wearGrade:0},
        {id:'smart-rare-worn',kind:'weapon',weapon:'M134 Minigun',tier:4,base:1700,wearGrade:4}
      );
      s.preferences.inventoryRarity='all';
      s.preferences.inventorySort='newest';
      s.preferences.inventoryQuick='all';
      save();go('Inventory');
    });
    const lowGroup=page.locator('.inventory-group').filter({hasText:'Tec-9'});
    assert(await lowGroup.count()===1,
      'Duplicate base weapons must occupy one compact expandable group');
    assert((await lowGroup.locator('summary').textContent()).includes('3 owned'));
    await lowGroup.locator('summary').click();
    assert(await lowGroup.locator('.item:visible').count()===3,
      'Expanding a group must expose each individually tradable copy');
    assert(await page.locator('.inventory-group').filter({hasText:'M134 Minigun'}).count()===1,
      'Rare duplicate weapons should also group without being sold');
    await page.getByRole('button',{name:'Select weapons to trade'}).click();
    await page.getByRole('button',{name:'Select Duplicates'}).click();
    const safeSelected=await page.evaluate(()=>[...bulkSellIds].sort());
    assert(JSON.stringify(safeSelected)===JSON.stringify(['smart-mid','smart-worn']),
      'Duplicate shortcut must retain best-condition weapon and avoid Legendary mass selection');
    await page.locator('#inventorySort').selectOption('value');
    assert(await page.evaluate(()=>bulkSellIds.size)===2,
      'Changing sort must retain the current batch selection');
    await page.getByRole('button',{name:'Duplicates',exact:true}).click();
    assert(await page.evaluate(()=>bulkSellIds.size)===2,
      'Changing inventory filter must not lose already selected weapons');
    await page.reload({waitUntil:'load'});
    assert(await page.evaluate(()=>s.preferences.inventorySort)==='value'&&
      await page.evaluate(()=>s.preferences.inventoryQuick)==='duplicates',
      'Last-used sort and quick filter must persist across reload');
    assert(await page.evaluate(()=>s.items.filter(x=>['smart-best','smart-mid','smart-worn',
      'smart-rare-best','smart-rare-worn'].includes(x.id)).length)===5,
      'Sorting and grouping may not merge or remove any owned copies');

    await page.screenshot({ path: path.resolve(__dirname, 'mobile-smoke.png'), fullPage: true });
    console.log('PASS: Mobile earning → case purchase → saved inventory → case opening → sale → saved wallet');
  } finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err => { console.error('FAIL:', err.stack || err); process.exit(1); });
