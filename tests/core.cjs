// Node-only deterministic economy + save compatibility regression suite.
// Run: node tests/core.cjs
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const upgrade=fs.readFileSync(path.join(root,'upgrade.js'),'utf8');
const marketModules=['core','transactions','simulation','npc','traders','haggling','economy','offline','tools'].map(name=>fs.readFileSync(path.join(root,'market',name+'.js'),'utf8')).join('\n');
for(const name of ['core','transactions','simulation','npc','traders','haggling','economy','offline','tools'])assert(html.includes('<script src="./market/'+name+'.js"></script>'),'Missing market module '+name);
const masters=fs.readFileSync(path.join(root,'assets/weapon-masters.js'),'utf8');
assert(html.includes('<script src="./assets/weapon-masters.js"></script>'),'Art masters missing from page');
const scriptMatch=html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/i);
assert(scriptMatch,'Game script missing');
const script=masters+'\n'+marketModules+'\n'+upgrade+'\n'+scriptMatch[1];
const KEY='loothub-arsenal-alpha-v1';
const BACKUP=KEY+'-backup';
class LocalStore {
  constructor(){this.data=new Map()}
  getItem(k){return this.data.has(k)?this.data.get(k):null}
  setItem(k,v){this.data.set(k,String(v))}
  removeItem(k){this.data.delete(k)}
}
function boot(store=new LocalStore(),random=()=>0.001){
  const nodes=new Map(),alerts=[];
  const byId=id=>{
    if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',className:'',
      value:'',style:{},parentElement:{clientWidth:390}});
    return nodes.get(id)
  };
  const timers=new Map();
  const window={addEventListener(){}};
  const document={getElementById:byId,body:{appendChild(){}},createElement(){return {click(){},remove(){}}}};
  const context={localStorage:store,document,window,alert:m=>alerts.push(String(m)),
    confirm:()=>true,location:{reload(){}},setInterval:()=>0,
    setTimeout:(fn)=>{const id=timers.size+1;timers.set(id,fn);return id},
    clearTimeout:id=>timers.delete(id),requestAnimationFrame:()=>0,
    Math:Object.assign(Object.create(Math),{random}),console,
    URL:{createObjectURL:()=>'blob:demo',revokeObjectURL(){}},Blob:class{},
    FileReader:class{},Date,JSON,Number,String,Array,Object,Set,Map,Promise};
  vm.createContext(context);
  vm.runInContext(script,context,{filename:'loothub-game.js',timeout:10000});
  return {store,ctx:context,alerts,byId,run:(js)=>vm.runInContext(js,context,{timeout:10000}),
    state:()=>JSON.parse(vm.runInContext('JSON.stringify(s)',context)),
    persisted:()=>JSON.parse(store.getItem(KEY))};
}
function test(name,fn){
  try{fn();console.log('PASS',name)}catch(err){console.error('FAIL',name,'\n',err.stack);process.exitCode=1}
}

test('Arsenal Case contains 24 supplied base weapons and five owner-approved skins',()=>{
  const g=boot();
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
  const cat=JSON.parse(g.run('JSON.stringify(catalog)'));
  assert.equal(cat.length,24);
  assert.equal(manifest.items.length,24);
  assert.equal(manifest.approvedSkins.length,5);
  assert.equal(manifest.approvedSkins[0].displayName,'MAC-10 | Red Devil');
  assert.equal(manifest.catalogMode,'24-base-weapon-models-plus-five-user-approved-skins');
  const weaponNames=new Set();
  for(const [weapon,tier,base,emoji] of cat){
    assert.equal(typeof weapon,'string');
    assert(!weaponNames.has(weapon),'Duplicate weapon '+weapon);
    weaponNames.add(weapon);
    assert(Number.isInteger(tier)&&tier>=0&&tier<=4);
    assert(Number.isFinite(base)&&base>0);
    const entry=manifest.items.find(x=>x.weapon===weapon);
    assert(entry,'Missing '+weapon);
    assert.equal(entry.kind,'weapon');
    assert.equal(entry.baseValue,base);
    assert.equal(entry.tier,tier);
    assert.equal(entry.hasCosmeticSkin,false);
    assert.equal(entry.skin,null);
    assert.equal(entry.finish,null);
  }
  assert(weaponNames.has('M60')&&weaponNames.has('RPG-7'));
  for(const weapon of ['M1911','M1 Garand','Kar98k','Thompson SMG','FN SCAR-L','FN FAL','M134 Minigun'])assert(weaponNames.has(weapon));
  const live=JSON.parse(g.run('JSON.stringify(approvedSkins)'));
  assert.deepEqual(live,[['MAC-10','Red Devil',4,1800,'🔫'],
    ['RPG-7','Glory',3,1200,'🔫'],
    ['Colt .45 Revolver','High Stakes',3,900,'🔫'],
    ['Butterfly Knife','The Hydra',4,3600,'🗡️'],
    ['FN FAL','The Luck O The Irish',2,320,'🔫']]);
});
test('All active weapon masters resolve to neutral WebP art only',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
  assert.equal(manifest.neutralMasterPipeline.baseModelCount,24);
  for(const asset of manifest.items){
    if(asset.renderMode==='transparent-webp-file'){
      const buf=fs.readFileSync(path.join(root,asset.master));
      assert.equal(buf.toString('ascii',0,4),'RIFF',asset.weapon);
      assert.equal(buf.toString('ascii',8,12),'WEBP',asset.weapon);
    }else{
      assert.equal(asset.renderMode,'transparent-webp-data-uri');
      const file=fs.readFileSync(path.join(root,asset.master),'utf8');
      const sig=file.match(/"400":"([A-Za-z0-9+/=]+)","800":"([A-Za-z0-9+/=]+)","1600":"([A-Za-z0-9+/=]+)"/);
      assert(sig,'Missing master exports for '+asset.weapon);
      for(const data of sig.slice(1)){
        const buf=Buffer.from(data,'base64');
        assert.equal(buf.toString('ascii',0,4),'RIFF',asset.weapon);
        assert.equal(buf.toString('ascii',8,12),'WEBP',asset.weapon);
      }
    }
  }
});
test('M60 and RPG-7 render as neutral masters in reel and inspection',()=>{
  const g=boot();
  g.run("window.LootHubNeutralArt={'m60':{'400':'UklGR-demo','800':'UklGR-demo','1600':'UklGR-demo'},'rpg-7':{'400':'UklGR-demo','800':'UklGR-demo','1600':'UklGR-demo'}}");
  for(const weapon of ['M60','RPG-7']){
    for(const [context,size] of [['reel',400],['inventory',800],['inspect',1600]]){
      const html=g.run('visualArt({kind:"weapon",weapon:'+JSON.stringify(weapon)+',tier:2,base:100},'+JSON.stringify(context)+')');
      assert(html.includes('data-weapon-model="'+weapon+'"'));
      assert(html.includes('data-resolution="'+size+'"'));
      assert(html.includes('data-art-status="base"'));
      assert(html.includes('data:image/webp;base64,'));
      assert(!html.includes('data-finish='));
    }
  }
});
test('Old retired raster finishes stay disabled and user-approved finish alone appears',()=>{
  const g=boot();
  const obj={kind:'weapon',weapon:'Glock-18',tier:0,base:6};
  const img=g.run('visualArt('+JSON.stringify(obj)+',"inspect")');
  assert(img.includes('glock-18-neutral-1600.webp'));
  assert(!img.includes('--slate-grid'));
  assert(!img.includes('data-finish'));
  const menu=g.run('cases()');
  assert.equal((menu.match(/View weapon/g)||[]).length,24);
  assert.equal((menu.match(/View skin/g)||[]).length,5);
  assert(menu.includes('MAC-10 | Red Devil'));
  assert(menu.includes('Available base weapons'));
  for(const finish of ['Starfall','Slate Grid','Voltage Bloom','Crimson Circuit','Metro Fade']){
    assert(!menu.includes(finish),'Retired finish visible: '+finish);
  }
});
test('Every tier rewards an unskinned base weapon or the a registered approved finish',()=>{
  for(const [random,tier] of [[.01,0],[.75,1],[.94,2],[.98,3],[.999,4]]){
    const g=boot(new LocalStore(),()=>random);
    const x=JSON.parse(g.run('JSON.stringify(roll())'));
    assert.equal(x.tier,tier);
    assert.equal(typeof x.weapon,'string');
    assert(!('float' in x));
    assert(!('pattern' in x));
    assert(!('stattrak' in x));
    if(x.kind==='skin'){
      const approved=JSON.parse(g.run('JSON.stringify(approvedSkins)'));
      assert(approved.some(a=>a[0]===x.weapon&&a[1]===x.skin&&a[2]===tier));
      assert.equal(g.run('itemName('+JSON.stringify(x)+')'),x.weapon+' | '+x.skin);
    }else{
      assert.equal(x.kind,'weapon');
      assert(!('skin' in x));
      assert.equal(g.run('itemName('+JSON.stringify(x)+')'),x.weapon);
    }
  }
});
test('Former skins migrate once without losing inventory, listing, or values',()=>{
  const store=new LocalStore();
  const original={coins:900,items:[{id:'skin-A',kind:'skin',weapon:'AK-47',skin:'Crimson Circuit',tier:3,base:100,float:.02,pattern:777,stattrak:true,paid:25}],
    history:['historic sale preserved'],earned:900,spent:25,sales:0,rep:0,openings:1,serial:5,offers:{},tab:'Inventory',
    listings:[{id:'listing-skin-B',item:{id:'skin-B',kind:'skin',weapon:'USP-S',skin:'Dustline',tier:0,base:120,float:.6,pattern:99,stattrak:false},ask:240,createdAt:Date.now(),checkedAt:Date.now()}]};
  store.setItem(KEY,JSON.stringify(original));
  const game=boot(store);
  const migrated=game.state();
  assert.equal(migrated.coins,900);
  assert.equal(migrated.items.length,1);
  assert.equal(migrated.items[0].id,'skin-A');
  assert.equal(migrated.items[0].kind,'weapon');
  assert.equal(migrated.items[0].weapon,'AK-47');
  assert.equal(migrated.items[0].base,289);
  assert(!('skin' in migrated.items[0]));
  assert(!('float' in migrated.items[0]));
  assert(!('stattrak' in migrated.items[0]));
  assert.equal(migrated.listings[0].item.kind,'weapon');
  assert.equal(migrated.listings[0].item.weapon,'USP-S');
  assert.equal(migrated.listings[0].item.base,90);
  assert.equal(migrated.listings[0].ask,240);
  assert.equal(game.run('estimated(s.items[0])'),289);
  assert.equal(game.run('itemName(s.items[0])'),'AK-47');
  const reload=boot(game.store);
  assert.equal(reload.state().items[0].base,289,'Migration ran more than once');
  assert.equal(reload.state().listings[0].ask,240);
});
test('Previous version save uploads remain importable and normalize on load',()=>{
  const g=boot();
  const old=JSON.parse(g.run('JSON.stringify(s)'));
  old.items=[{id:'a1',kind:'skin',weapon:'Karambit',skin:'Golden Talon',tier:4,base:200,float:.32,pattern:1,stattrak:false}];
  assert.equal(g.run('safeUpload('+JSON.stringify(old)+')'),true);
  old.items[0].kind='weapon';delete old.items[0].skin;delete old.items[0].float;delete old.items[0].pattern;
  assert.equal(g.run('safeUpload('+JSON.stringify(old)+')'),true);
});
test('Base-only preview and case prize do not invent finish labels',()=>{
  const g=boot();
  g.run('previewCatalogWeapon(11)');
  const preview=g.byId('overlay').innerHTML;
  assert(preview.includes('M60'));
  assert(preview.includes('BASE WEAPON PREVIEW'));
  assert(!preview.includes(' | '));
  assert.equal(g.state().items.length,0);
  g.run('for(let i=0;i<25;i++)clickEarn();buy();openCase(s.items[0].id)');
  const reward=g.state().items[0];
  assert.equal(reward.kind,'weapon');
  assert(!('skin' in reward));
  const reel=g.byId('overlay').innerHTML;
  assert(reel.includes('data-reel-index="42"'));
  assert(reel.includes('data-weapon-model="'+reward.weapon+'"'));
  g.run('finishOpening()');
  const final=g.byId('overlay').innerHTML;
  assert(final.includes(reward.weapon));
  assert(final.includes('Base weapon · unskinned'));
});

test('Seven new original masters and owner-approved MAC-10 finish are real WebPs',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
  for(const slug of ['m1911','m1-garand','kar98k','thompson-smg','fn-scar-l','fn-fal','m134-minigun']){
    const a=manifest.items.find(x=>x.modelSlug===slug);
    assert(a&&a.sourceType==='user-supplied-original-image');
    const js=fs.readFileSync(path.join(root,'assets/neutral-art',slug+'.js'),'utf8');
    assert(js.includes('window.LootHubNeutralArt['+JSON.stringify(slug)+']'));
    const sizes=js.match(/"400":"([A-Za-z0-9+/=]+)","800":"([A-Za-z0-9+/=]+)","1600":"([A-Za-z0-9+/=]+)"/);
    assert(sizes);
    for(const base64 of sizes.slice(1)){
      const buf=Buffer.from(base64,'base64');
      assert.equal(buf.toString('ascii',0,4),'RIFF');
      assert.equal(buf.toString('ascii',8,12),'WEBP');
    }
  }
  const skin=manifest.approvedSkins[0];
  const source=fs.readFileSync(path.join(root,skin.finishArt),'utf8');
  assert(source.includes('window.LootHubSkinArt["MAC-10|Red Devil"]'));
  assert(source.includes('"1600":"UklGR'));
});
test('Red Devil is rendered and saved as a skin, not a replacement MAC-10 master',()=>{
  const g=boot();
  g.run("window.LootHubSkinArt={'MAC-10|Red Devil':{'400':'UklGR-test','800':'UklGR-test','1600':'UklGR-test'}}");
  g.run("window.LootHubNeutralArt={'mac-10':{'400':'UklGR-neutral','800':'UklGR-neutral','1600':'UklGR-neutral'}}");
  for(const [ctx,w] of [['reel',400],['inventory',800],['inspect',1600]]){
    const art=g.run('visualArt({kind:"skin",weapon:"MAC-10",skin:"Red Devil",tier:4,base:1800},'+JSON.stringify(ctx)+')');
    assert(art.includes('data-finish="Red Devil"'));
    assert(art.includes('data-art-status="approved-skin"'));
    assert(art.includes('data-resolution="'+w+'"'));
    const neutral=g.run('visualArt({kind:"weapon",weapon:"MAC-10",tier:0,base:8},'+JSON.stringify(ctx)+')');
    assert(neutral.includes('data-art-status="base"'));
    assert(!neutral.includes('Red Devil'));
  }
  const approved={coins:50,items:[{id:'red',kind:'skin',weapon:'MAC-10',skin:'Red Devil',tier:4,base:1800}],
    history:[],earned:50,spent:0,sales:0,rep:0,openings:1,serial:1,offers:{},tab:'Inventory'};
  const storage=new LocalStore();
  storage.setItem(KEY,JSON.stringify(approved));
  const reload=boot(storage);
  assert.equal(reload.state().items[0].kind,'skin');
  assert.equal(reload.state().items[0].skin,'Red Devil');
  assert.equal(reload.run('safeUpload(JSON.parse(JSON.stringify(s)))'),true);
  reload.run('previewApprovedSkin(0)');
  assert(reload.byId('overlay').innerHTML.includes('MAC-10 | Red Devil'));
});
test('All four newly approved cosmetics have real WebP art and survive save migration',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
  assert.equal(manifest.skinPipeline.activeSkinCount,5);
  const added=manifest.approvedSkins.slice(1), images={};
  assert.equal(added.length,4);
  for(const entry of added){
    assert(html.includes('<script src="./'+entry.finishArt+'"></script>'));
    assert.equal(entry.approved,true);
    const source=fs.readFileSync(path.join(root,entry.finishArt),'utf8'),win={};
    vm.runInNewContext(source,{window:win},{timeout:10000});
    const art=win.LootHubSkinArt[entry.weapon+'|'+entry.skin];
    assert(art,entry.displayName+' has no matching art');
    for(const size of ['400','800','1600']){
      const buf=Buffer.from(art[size],'base64');
      assert.equal(buf.toString('ascii',0,4),'RIFF');
      assert.equal(buf.toString('ascii',8,12),'WEBP');
      assert(buf.length>10000);
    }
    images[entry.weapon+'|'+entry.skin]={400:'UklGR-test',800:'UklGR-test',1600:'UklGR-test'};
  }
  const g=boot();
  g.run('window.LootHubSkinArt='+JSON.stringify(images));
  for(const entry of added){
    const item={kind:'skin',weapon:entry.weapon,skin:entry.skin,tier:entry.tier,base:entry.baseValue};
    for(const [context,size] of [['reel','400'],['inventory','800'],['inspect','1600']]){
      const art=g.run('visualArt('+JSON.stringify(item)+','+JSON.stringify(context)+')');
      assert(art.includes('data-art-status="approved-skin"'),entry.displayName);
      assert(art.includes('data-finish="'+entry.skin+'"'),entry.displayName);
      assert(art.includes('data-resolution="'+size+'"'),entry.displayName);
    }
  }
  const store=new LocalStore();
  const initial={coins:100,items:added.map((a,i)=>({id:'new-'+i,kind:'skin',weapon:a.weapon,skin:a.skin,tier:a.tier,base:a.baseValue})),listings:[],
    history:[],earned:100,spent:0,sales:0,rep:0,openings:4,serial:4,offers:{},tab:'Inventory'};
  store.setItem(KEY,JSON.stringify(initial));
  const game=boot(store);
  assert.deepEqual(game.state().items.map(x=>x.kind),['skin','skin','skin','skin']);
  assert.deepEqual(game.state().items.map(x=>x.skin),added.map(x=>x.skin));
  assert.equal(game.run('safeUpload(JSON.parse(JSON.stringify(s)))'),true);
  const tampered=game.state();tampered.items[0].skin='Unapproved';
  assert.equal(game.run('safeUpload('+JSON.stringify(tampered)+')'),false);
});
test('Brand-new profile starts at zero and persists baseline',()=>{
  const g=boot();
  assert.equal(g.state().coins,0);
  assert.equal(g.persisted().coins,0);
  assert.equal(g.persisted().version,4);
  assert.equal(typeof g.persisted().revision,'string');
});
test('Legacy alpha progress migrates without losing items or cash',()=>{
  const storage=new LocalStore();
  const old={coins:45,items:[{id:'old-case',kind:'case',paid:25}],
    history:['previous transaction'],earned:45,spent:25,sales:0,rep:0,
    openings:0,serial:1,offers:{},tab:'Inventory'};
  storage.setItem(KEY,JSON.stringify(old));
  const g=boot(storage);
  assert.equal(g.state().coins,45);
  assert.equal(g.state().items[0].id,'old-case');
  assert.equal(g.state().history[0],'previous transaction');
  assert.equal(g.persisted().version,4);
  assert.deepEqual(JSON.parse(JSON.stringify(g.persisted().listings)),[]);
});
test('Earn, buy, open once, and keep the reward across reload',()=>{
  const g=boot();
  g.run('for(let i=0;i<25;i++)clickEarn();buy()');
  assert.equal(g.state().coins,0);
  assert.equal(g.state().items.length,1);
  const caseId=g.state().items[0].id;
  g.run('openCase(s.items[0].id)');
  const opened=g.state();
  assert.equal(opened.items.length,1);
  assert.equal(opened.items[0].kind,'weapon');
  assert.equal(opened.openings,1);
  assert.equal(opened.pendingReveal,opened.items[0].id);
  const reloaded=boot(g.store);
  assert.equal(reloaded.state().items[0].id,opened.items[0].id);
  assert.equal(reloaded.state().openings,1);
  assert.equal(reloaded.state().pendingReveal,null);
  reloaded.run("openCase("+JSON.stringify(caseId)+")");
  assert.equal(reloaded.state().openings,1);
});
test('Listing escrow, cancel, and NPC purchase are journaled',()=>{
  const g=boot();
  g.run('for(let i=0;i<25;i++)clickEarn();buy();openCase(s.items[0].id);finishOpening()');
  g.byId('listPrice').value='1';
  g.run('submitListing(s.items[0].id)');
  assert.equal(g.state().items.length,0);
  assert.equal(g.state().listings.length,1);
  const again=boot(g.store);
  assert.equal(again.state().listings.length,1);
  again.run('cancelListing(s.listings[0].id)');
  assert.equal(again.state().items.length,1);
  again.byId('listPrice').value='1';
  again.run('submitListing(s.items[0].id)');
  again.run('s.listings[0].checkedAt=Date.now()-61000;marketTick()');
  assert.equal(again.state().listings.length,0);
  assert.equal(again.state().coins,1);
  assert(again.state().ledger.length>=5);
});
test('Corrupted primary recovers from last validated snapshot',()=>{
  const store=new LocalStore();
  const g=boot(store);
  g.run('clickEarn();clickEarn()');
  const previous=JSON.parse(store.getItem(BACKUP));
  assert(previous.coins>=1,'Backup should preserve earned coins');
  store.setItem(KEY,'{bad JSON');
  const recovered=boot(store);
  assert.equal(recovered.state().coins,previous.coins);
  assert.equal(recovered.persisted().coins,previous.coins);
  assert.equal(recovered.run('recoveryRequired'),false);
});
test('Unrecoverable invalid save is never silently overwritten',()=>{
  const store=new LocalStore();
  store.setItem(KEY,'{broken old save');
  store.setItem(BACKUP,'{broken backup');
  const g=boot(store);
  assert.equal(g.run('recoveryRequired'),true);
  g.run('clickEarn()');
  assert.equal(g.state().coins,0);
  assert.equal(store.getItem(KEY),'{broken old save');
  assert(g.alerts.length>=1);
  assert(g.run('saveHub()').includes('Save recovery required'));
});
test('A stale second tab cannot overwrite newer wallet changes',()=>{
  const store=new LocalStore();
  const first=boot(store);
  const second=boot(store);
  second.run('clickEarn()');
  assert.equal(second.persisted().coins,1);
  first.run('clickEarn()');
  assert.equal(first.persisted().coins,1);
  assert.equal(first.state().coins,0);
  assert.equal(first.run('saveConflict'),true);
  assert(first.alerts.length>=1);
});
test('Marketplace state migration preserves legacy listing, offers and item identities',()=>{
  const store=new LocalStore();
  const now=Date.now();
  const old={coins:79,items:[{id:'owned-case',kind:'case',paid:25}],
    listings:[{id:'listing-other',item:{id:'other',kind:'case',paid:25},ask:30,createdAt:now,checkedAt:now}],
    history:[],earned:79,spent:25,sales:0,rep:0,openings:0,serial:2,
    offers:{'sale-owned-case':{limit:24,attempts:1}},tab:'Market'};
  store.setItem(KEY,JSON.stringify(old));
  const g=boot(store),state=g.state();
  assert.equal(state.market.schemaVersion,1);
  assert.equal(state.market.npcListings.length,15,'An existing Market tab seeds NPC offers after migration');
  assert.equal(state.items[0].id,'owned-case');
  assert.equal(state.listings[0].item.id,'other');
  assert.equal(state.listings[0].ask,30);
  assert.equal(state.offers['sale-owned-case'].attempts,1);
  assert.equal(state.coins,79);
  assert(g.run('save()'));
  assert.equal(boot(store).state().market.schemaVersion,1);
  assert.equal(boot(store).state().listings[0].item.id,'other');
});
test('Market modules retain base weapon valuation and old sale odds',()=>{
  const g=boot();
  assert.equal(g.run("estimated({kind:'case'})"),25);
  assert.equal(g.run("estimated({kind:'weapon',base:135})"),135);
  assert.equal(g.run("estimated({kind:'skin',base:80})"),80);
  assert.equal(g.run('listingChance(.84)'),.65);
  assert.equal(g.run('listingChance(1.2)'),.08);
  assert.equal(g.run('listingChance(1.7)'),0);
});
test('Market transaction helper rejects a duplicate escrow settlement',()=>{
  const g=boot();
  g.run('for(let i=0;i<25;i++)clickEarn();buy()');
  const id=g.state().items[0].id;
  g.byId('listPrice').value='30';
  g.run('submitListing(s.items[0].id)');
  assert.equal(g.state().items.length,0);
  assert.equal(g.state().listings.length,1);
  const listingId='listing-'+id;
  assert.equal(g.run("window.LootHubMarketTransactions.createListing(s,"+JSON.stringify(id)+",30,Date.now())"),null);
  g.run("window.LootHubMarketTransactions.settleListing(s,"+JSON.stringify(listingId)+")");
  assert.equal(g.state().coins,28);
  assert.equal(g.state().sales,28);
  assert.equal(g.state().listings.length,0);
  assert.equal(g.run("window.LootHubMarketTransactions.settleListing(s,"+JSON.stringify(listingId)+")"),null);
  assert.equal(g.state().coins,28);
});
test('Universal listing quote uses the exact 5% success-only fee',()=>{
  const g=boot();
  assert.equal(g.run('window.LootHubMarketCore.listingQuote(100,80).net'),95);
  assert.equal(g.run('window.LootHubMarketCore.listingQuote(100,80).fee'),5);
  assert.equal(g.run('window.LootHubMarketCore.listingQuote(1,80).net'),1);
  assert.equal(g.run('window.LootHubMarketCore.listingQuote(0,80)'),null);
  assert.equal(g.run('window.LootHubMarketCore.listingQuote(10.5,80)'),null);
  assert.equal(g.run('window.LootHubMarketCore.listingQuote(100000001,80)'),null);
  assert.deepEqual(JSON.parse(g.run('JSON.stringify(window.LootHubMarketCore.suggestedPrices(100))')),[80,100,120,150]);
});
test('Any existing weapon or future-approved skin instance is eligible without changing the active case pool',()=>{
  const g=boot();
  g.run("s.items.push({id:'legacy-revolver',kind:'weapon',weapon:'Legacy Revolver',tier:1,base:120})");
  g.run("s.items.push({id:'future-approved-test',kind:'skin',weapon:'Test Weapon',skin:'Test Finish',tier:2,base:250,float:0.13,pattern:777})");
  const result=g.run("JSON.stringify([window.LootHubMarketTransactions.createListing(s,'legacy-revolver',135,Date.now()),window.LootHubMarketTransactions.createListing(s,'future-approved-test',300,Date.now())])");
  const listings=JSON.parse(result);
  assert.equal(listings.length,2);
  assert.equal(listings[0].item.weapon,'Legacy Revolver');
  assert.equal(listings[1].item.skin,'Test Finish');
  assert.equal(listings[1].item.pattern,777);
  assert.equal(g.run("window.LootHubMarketTransactions.cancelListing(s,'listing-future-approved-test').item.skin"),'Test Finish');
  assert.equal(g.run('catalog.length'),24,'Marketplace test must not change approved base pool');
  assert.equal(g.run('approvedSkins.length'),5,'Exactly the five owner-selected finishes may enter the case');
});
test('Price edit keeps item escrowed and preserves listing identity and reference data',()=>{
  const g=boot();
  g.run('for(let i=0;i<25;i++)clickEarn();buy()');
  const itemId=g.state().items[0].id;
  g.byId('listPrice').value='40';
  g.run('submitListing(s.items[0].id)');
  const before=g.state(),listing=before.listings[0];
  g.byId('listPrice').value='60';
  g.run("submitPriceEdit("+JSON.stringify(listing.id)+")");
  const after=g.state();
  assert.equal(after.items.length,0);
  assert.equal(after.coins,before.coins);
  assert.equal(after.listings.length,1);
  assert.equal(after.listings[0].id,listing.id);
  assert.equal(after.listings[0].item.id,itemId);
  assert.equal(after.listings[0].createdAt,listing.createdAt);
  assert.equal(after.listings[0].ask,60);
  assert(after.listings[0].updatedAt>=listing.createdAt);
  assert(after.listings[0].checkedAt>=listing.checkedAt);
  const reload=boot(g.store);
  assert.equal(reload.state().listings[0].ask,60);
  reload.run('cancelListing(s.listings[0].id)');
  assert.equal(reload.state().items[0].id,itemId);
  assert.equal(reload.state().listings.length,0);
});
test('Invalid and unchanged price edits do not charge coins, requeue items or reset time',()=>{
  const g=boot();
  g.run('for(let i=0;i<25;i++)clickEarn();buy()');
  g.byId('listPrice').value='40';
  g.run('submitListing(s.items[0].id)');
  const id=g.state().listings[0].id;
  const original=g.state(),n=original.ledger.length;
  for(const bad of ['0','-5','20.5','100000001','']){
    g.byId('listPrice').value=bad;
    g.run("submitPriceEdit("+JSON.stringify(id)+")");
    assert.equal(g.state().listings[0].ask,40);
    assert.equal(g.state().coins,original.coins);
    assert.equal(g.state().ledger.length,n);
  }
  g.byId('listPrice').value='40';
  g.run("submitPriceEdit("+JSON.stringify(id)+")");
  assert.equal(g.state().listings[0].checkedAt,original.listings[0].checkedAt);
  assert.equal(g.state().ledger.length,n);
  assert(g.alerts.length>=5);
});
test('Repricing never retroactively applies pending NPC ticks at the new price',()=>{
  const g=boot();
  g.run('for(let i=0;i<25;i++)clickEarn();buy()');
  g.byId('listPrice').value='100000000';
  g.run('submitListing(s.items[0].id)');
  g.run('s.listings[0].checkedAt=Date.now()-180000');
  const id=g.state().listings[0].id;
  g.byId('listPrice').value='1';
  g.run("submitPriceEdit("+JSON.stringify(id)+")");
  assert.equal(g.state().listings.length,1);
  assert.equal(g.state().listings[0].ask,1);
});
test('Stale tab cannot reprice or cancel another tab’s listing updates',()=>{
  const store=new LocalStore();
  const g=boot(store);
  g.run('for(let i=0;i<25;i++)clickEarn();buy()');
  g.byId('listPrice').value='30';
  g.run('submitListing(s.items[0].id)');
  const fresh=boot(store);
  fresh.byId('listPrice').value='55';
  fresh.run("submitPriceEdit(s.listings[0].id)");
  g.byId('listPrice').value='1';
  g.run("submitPriceEdit(s.listings[0].id)");
  assert.equal(g.persisted().listings[0].ask,55);
  assert.equal(g.run('saveConflict'),true);
  assert(g.alerts.length>=1);
});
test('NPC market stocks only approved weapons and cosmetic finishes',()=>{
  const g=boot();
  g.run("go('Market')");
  const state=g.state(),list=state.market.npcListings;
  assert.equal(list.length,15);
  assert.equal(state.market.npcInitialized,true);
  assert.equal(new Set(list.map(x=>x.id)).size,15);
  assert.equal(new Set(list.map(x=>x.item.id)).size,15);
  assert(list.some(x=>x.item.kind==='case'));
  assert(list.some(x=>x.item.kind==='weapon'));
  assert(list.some(x=>x.item.kind==='skin'&&x.item.weapon==='MAC-10'&&x.item.skin==='Red Devil'));
  const pool=JSON.parse(g.run('JSON.stringify(dropCatalog)'));
  for(const entry of list){
    assert(entry.id.startsWith('npc-list-'));
    assert(entry.item.id.startsWith('npc-item-'));
    assert(Number.isSafeInteger(entry.ask)&&entry.ask>=1);
    assert(entry.createdAt<entry.expiresAt);
    if(entry.item.kind==='case')continue;
    assert(pool.some(x=>x.kind===entry.item.kind&&x.weapon===entry.item.weapon&&
      x.skin===entry.item.skin&&x.tier===entry.item.tier&&x.base===entry.item.base),
      'Listing must originate from current approved catalog');
    assert(!('stattrak' in entry.item)&&!('float' in entry.item),'NPC generator invented item attributes');
  }
  assert.equal(g.run('catalog.length'),24);
  assert.equal(g.run('approvedSkins.length'),5);
});
test('NPC offers persist across tabs and page reload without rerolling',()=>{
  const g=boot();
  g.run("go('Market')");
  const saved=g.state().market.npcListings;
  g.run("go('Inventory');go('Market')");
  assert.deepEqual(g.state().market.npcListings,saved);
  const reloaded=boot(g.store);
  assert.deepEqual(reloaded.state().market.npcListings,saved);
});
test('NPC searches, rarity filters and price sorting work on saved inventory',()=>{
  const g=boot();
  g.run("go('Market')");
  const all=g.state().market.npcListings;
  const skins=JSON.parse(g.run("JSON.stringify(window.LootHubNPCMarket.filterNpcListings(s.market.npcListings,{kind:'skin',search:'RED DEVIL',tier:'4'}))"));
  assert.equal(skins.length,1);
  assert.equal(skins[0].item.skin,'Red Devil');
  const cases=JSON.parse(g.run("JSON.stringify(window.LootHubNPCMarket.filterNpcListings(s.market.npcListings,{kind:'case',tier:'2'}))"));
  assert(cases.length>=1);
  assert(cases.every(x=>x.item.kind==='case'));
  const cheap=JSON.parse(g.run("JSON.stringify(window.LootHubNPCMarket.filterNpcListings(s.market.npcListings,{sort:'price-asc'}))"));
  assert(cheap.every((x,i)=>i===0||cheap[i-1].ask<=x.ask));
  const sellers=JSON.parse(g.run("JSON.stringify(window.LootHubNPCMarket.filterNpcListings(s.market.npcListings,{search:'quartermaster'}))"));
  assert(sellers.some(x=>x.seller==='The Quartermaster'));
  assert.equal(all.length,15,'Sorting and filtering must not mutate listings');
});
test('NPC purchase transfers the exact item once, debits wallet and survives reload',()=>{
  const g=boot();
  g.run("go('Market')");
  const listings=g.state().market.npcListings;
  const legendary=listings.find(x=>x.item.kind==='skin');
  assert(legendary);
  g.run('s.coins=10000;save()');
  const starting=g.state().coins;
  g.run('buyNpcListing('+JSON.stringify(legendary.id)+')');
  const state=g.state();
  assert.equal(state.coins,starting-legendary.ask);
  assert.equal(state.spent,legendary.ask);
  assert.equal(state.market.npcListings.length,14);
  const acquired=state.items.find(x=>x.id===legendary.item.id);
  assert(acquired);
  assert.equal(acquired.weapon,legendary.item.weapon);
  assert.equal(acquired.skin,legendary.item.skin);
  assert.equal(acquired.base,legendary.item.base);
  assert.equal(acquired.paid,legendary.ask);
  assert.equal(state.ledger.at(-1).itemCount,1);
  g.run('buyNpcListing('+JSON.stringify(legendary.id)+')');
  assert.equal(g.state().coins,state.coins);
  assert.equal(g.state().items.length,1);
  const reload=boot(g.store);
  assert.equal(reload.state().items[0].id,legendary.item.id);
  assert.equal(reload.state().market.npcListings.length,14);
});
test('NPC listing cannot sell without funds or duplicate a player-owned instance',()=>{
  const g=boot();
  g.run("go('Market')");
  const offer=g.state().market.npcListings.find(x=>x.ask>0);
  const original=g.state();
  g.run('buyNpcListing('+JSON.stringify(offer.id)+')');
  assert.equal(g.state().coins,original.coins);
  assert.deepEqual(g.state().market.npcListings,original.market.npcListings);
  assert(g.alerts.length>0);
  g.run('s.coins=10000;s.items.push({...s.market.npcListings[0].item});save()');
  const id=g.state().market.npcListings[0].id,coins=g.state().coins;
  g.run('buyNpcListing('+JSON.stringify(id)+')');
  assert.equal(g.state().market.npcListings.length,15);
  assert.equal(g.state().coins,coins);
});
test('NPC listings refresh on elapsed time but not navigation, without identity reuse',()=>{
  const g=boot();
  g.run("go('Market')");
  const first=g.state().market.npcListings.map(x=>x.id);
  g.run('s.market.npcListings.shift();save()');
  g.run("go('Inventory');go('Market')");
  assert.equal(g.state().market.npcListings.length,14,'No free refresh from switching pages');
  g.run('s.market.lastNpcRefreshAt=Date.now()-1200001;save()');
  g.run("go('Inventory');go('Market')");
  const next=g.state().market.npcListings;
  assert.equal(next.length,15);
  assert.equal(new Set(next.map(x=>x.id)).size,15);
  assert(next.some(x=>!first.includes(x.id)));
  assert(next.filter(x=>first.includes(x.id)).every(x=>
    first.includes(x.id)),'Existing listing IDs must remain stable');
});
test('NPC import validation blocks tampered skins and duplicated item ownership',()=>{
  const g=boot();
  g.run("go('Market')");
  const original=g.state();
  assert.equal(g.run("safeUpload("+JSON.stringify(original)+")"),true);
  const tampered=JSON.parse(JSON.stringify(original));
  const skin=tampered.market.npcListings.find(x=>x.item.kind==='skin');
  skin.item.skin='Unapproved Cosmetic';
  assert.equal(g.run("safeUpload("+JSON.stringify(tampered)+")"),false);
  const duplicate=JSON.parse(JSON.stringify(original));
  duplicate.items.push({...duplicate.market.npcListings[0].item});
  assert.equal(g.run("safeUpload("+JSON.stringify(duplicate)+")"),false);
});
test('Buyer haggling persists across reload and declines cannot be rerolled',()=>{
  const g=boot();
  g.run("go('Market')");
  const id=g.state().market.npcListings[0].id;
  g.run("negotiateNpcListing("+JSON.stringify(id)+")");
  const opening=g.state().market.negotiations.find(x=>x.id==='buy:'+id);
  assert(opening&&opening.status==='open');
  const firstLimit=opening.threshold,firstCounter=opening.npcOffer;
  g.run("negotiateNpcListing("+JSON.stringify(id)+")");
  assert.equal(g.state().market.negotiations.filter(x=>x.id==='buy:'+id).length,1);
  assert.equal(g.state().market.negotiations.find(x=>x.id==='buy:'+id).threshold,firstLimit);
  const reloaded=boot(g.store);
  reloaded.run("negotiateNpcListing("+JSON.stringify(id)+")");
  const kept=reloaded.state().market.negotiations.find(x=>x.id==='buy:'+id);
  assert.equal(kept.threshold,firstLimit);
  assert.equal(kept.npcOffer,firstCounter);
  for(let i=0;i<3;i++){
    reloaded.byId('negotiationAmount').value='1';
    reloaded.run("sendNegotiationOffer('buy',"+JSON.stringify(id)+")");
  }
  const walked=reloaded.state().market.negotiations.find(x=>x.id==='buy:'+id);
  assert.equal(walked.status,'walked');
  assert.equal(walked.rounds,3);
  reloaded.run("negotiateNpcListing("+JSON.stringify(id)+")");
  assert.equal(reloaded.state().market.negotiations.find(x=>x.id==='buy:'+id).status,'walked');
  assert.equal(reloaded.run("window.LootHubHaggling.submit(s,'buy',"+JSON.stringify(id)+",50)"),null);
});
test('Seller accepts a negotiated offer but transfers only on explicit completion',()=>{
  const g=boot();
  g.run("go('Market')");
  const listing=g.state().market.npcListings.find(x=>x.ask>=6);
  assert(listing);
  g.run("negotiateNpcListing("+JSON.stringify(listing.id)+")");
  const n=g.state().market.negotiations.find(x=>x.id==='buy:'+listing.id);
  g.byId('negotiationAmount').value=String(n.threshold);
  g.run("sendNegotiationOffer('buy',"+JSON.stringify(listing.id)+")");
  const agreed=g.state().market.negotiations.find(x=>x.id==='buy:'+listing.id);
  assert.equal(agreed.status,'agreed');
  assert.equal(g.state().items.length,0);
  assert.equal(g.state().market.npcListings.length,15);
  assert.equal(g.run("window.LootHubMarketTransactions.buyNpcListing(s,"+JSON.stringify(listing.id)+",1)"),null,'Cannot forge a discount');
  g.run("completeMarketNegotiation('buy',"+JSON.stringify(listing.id)+")");
  assert.equal(g.state().items.length,0,'Lack of coins cannot transfer negotiated item');
  g.run('s.coins=10000;save()');
  g.run("completeMarketNegotiation('buy',"+JSON.stringify(listing.id)+")");
  const after=g.state();
  assert.equal(after.coins,10000-agreed.agreedPrice);
  assert.equal(after.items[0].id,listing.item.id);
  assert.equal(after.items[0].paid,agreed.agreedPrice);
  assert.equal(after.market.negotiations.find(x=>x.id==='buy:'+listing.id).status,'completed');
  g.run("completeMarketNegotiation('buy',"+JSON.stringify(listing.id)+")");
  assert.equal(g.state().items.length,1,'Negotiated item never transfers twice');
  assert.equal(g.state().coins,after.coins,'No duplicate wallet debit');
});
test('NPC seller counter can be accepted at a saved exact price',()=>{
  const g=boot();
  g.run("go('Market')");
  const listing=g.state().market.npcListings.find(x=>x.ask>=15);
  g.run("negotiateNpcListing("+JSON.stringify(listing.id)+")");
  g.byId('negotiationAmount').value='1';
  g.run("sendNegotiationOffer('buy',"+JSON.stringify(listing.id)+")");
  const pending=g.state().market.negotiations.find(x=>x.id==='buy:'+listing.id);
  assert.equal(pending.status,'open');
  const counter=pending.npcOffer;
  g.run("acceptMarketCounter('buy',"+JSON.stringify(listing.id)+")");
  const n=g.state().market.negotiations.find(x=>x.id==='buy:'+listing.id);
  assert.equal(n.status,'agreed');
  assert.equal(n.agreedPrice,counter);
  const restored=boot(g.store);
  assert.equal(restored.state().market.negotiations.find(x=>x.id==='buy:'+listing.id).agreedPrice,counter);
});
test('Player listings receive durable buyer offers, counters and 5% settlement fees',()=>{
  const g=boot();
  g.run('for(let i=0;i<25;i++)clickEarn();buy()');
  g.byId('listPrice').value='40';
  g.run('submitListing(s.items[0].id)');
  const listing=g.state().listings[0];
  const prior=g.state().coins;
  const incoming=g.state().market.negotiations.find(x=>x.kind==='sell'&&x.listingId===listing.id&&x.listingCreatedAt===listing.createdAt);
  assert(incoming);
  assert.equal(incoming.status,'open');
  assert(incoming.npcOffer>0);
  const reloaded=boot(g.store);
  assert.equal(reloaded.state().market.negotiations.find(x=>x.kind==='sell'&&x.listingId===listing.id&&x.listingCreatedAt===listing.createdAt).npcOffer,incoming.npcOffer);
  reloaded.run("reviewBuyerOffer("+JSON.stringify(listing.id)+")");
  reloaded.run("acceptMarketCounter('sell',"+JSON.stringify(listing.id)+")");
  const agreed=reloaded.state().market.negotiations.find(x=>x.kind==='sell'&&x.listingId===listing.id&&x.listingCreatedAt===listing.createdAt);
  assert.equal(agreed.agreedPrice,incoming.npcOffer);
  assert.equal(reloaded.run("window.LootHubMarketTransactions.settleListing(s,"+JSON.stringify(listing.id)+",1)"),null,'Cannot force a nonagreed sales price');
  reloaded.run("completeMarketNegotiation('sell',"+JSON.stringify(listing.id)+")");
  const final=reloaded.state();
  assert.equal(final.listings.length,0);
  assert.equal(final.items.length,0);
  assert.equal(final.coins,prior+Math.max(1,Math.floor(incoming.npcOffer*.95)));
  assert.equal(final.market.negotiations.find(x=>x.kind==='sell'&&x.listingId===listing.id&&x.listingCreatedAt===listing.createdAt).status,'completed');
  assert.equal(boot(g.store).state().market.negotiations.find(x=>x.kind==='sell'&&x.listingId===listing.id&&x.listingCreatedAt===listing.createdAt).status,'completed');
});
test('Repricing and listing disappearance invalidate pending haggling',()=>{
  const g=boot();
  g.run('for(let i=0;i<25;i++)clickEarn();buy()');
  g.byId('listPrice').value='99';
  g.run('submitListing(s.items[0].id)');
  const listing=g.state().listings[0];
  assert.equal(g.state().market.negotiations.find(x=>x.kind==='sell'&&x.listingId===listing.id&&x.listingCreatedAt===listing.createdAt).status,'open');
  g.byId('listPrice').value='101';
  g.run("submitPriceEdit("+JSON.stringify(listing.id)+")");
  assert.equal(g.state().market.negotiations.find(x=>x.kind==='sell'&&x.listingId===listing.id&&x.listingCreatedAt===listing.createdAt).status,'unavailable');
  g.run("reviewBuyerOffer("+JSON.stringify(listing.id)+")");
  assert.equal(g.state().market.negotiations.find(x=>x.kind==='sell'&&x.listingId===listing.id&&x.listingCreatedAt===listing.createdAt).status,'unavailable');
  const old=g.state().coins;
  g.run("completeMarketNegotiation('sell',"+JSON.stringify(listing.id)+")");
  assert.equal(g.state().coins,old);
  assert.equal(g.state().listings.length,1);
});
test('Cancelling and relisting the same item creates a separate buyer negotiation lifecycle',()=>{
  const g=boot();
  g.run('for(let i=0;i<25;i++)clickEarn();buy()');
  g.byId('listPrice').value='40';
  g.run('submitListing(s.items[0].id)');
  const original=g.state().listings[0],first=g.state().market.negotiations.find(x=>x.kind==='sell'&&x.listingCreatedAt===original.createdAt);
  assert(first&&first.status==='open');
  g.run("cancelListing("+JSON.stringify(original.id)+")");
  assert.equal(g.state().market.negotiations.find(x=>x.id===first.id).status,'unavailable');
  g.run('s.items[0].paid=25');
  g.byId('listPrice').value='40';
  // Force a later creation timestamp so the test is deterministic.
  g.run('window.LootHubMarketTransactions.createListing(s,s.items[0].id,40,Date.now()+5);save();');
  g.run("go('Market')");
  const secondListing=g.state().listings[0];
  const second=g.state().market.negotiations.find(x=>x.kind==='sell'&&x.listingCreatedAt===secondListing.createdAt);
  assert(second&&second.id!==first.id,'A genuinely new listing gets its own negotiation');
  assert.equal(second.status,'open');
  assert.equal(second.npcOffer,first.npcOffer,'The same buyer terms should not reroll from relisting');
  g.run('reviewBuyerOffer('+JSON.stringify(secondListing.id)+')');
  g.run("acceptMarketCounter('sell',"+JSON.stringify(secondListing.id)+")");
  g.run("completeMarketNegotiation('sell',"+JSON.stringify(secondListing.id)+")");
  assert.equal(g.state().listings.length,0);
  assert.equal(g.state().market.negotiations.find(x=>x.id===first.id).status,'unavailable');
  assert.equal(g.state().market.negotiations.find(x=>x.id===second.id).status,'completed');
});
test('NPCs retain 16 individual wallets, preferences and all six trading styles',()=>{
  const g=boot();
  g.run("go('Market')");
  const arr=g.state().market.traders;
  assert.equal(arr.length,16);
  assert.equal(new Set(arr.map(t=>t.id)).size,16);
  assert.equal(arr.filter(t=>t.role==='buyer').length,6);
  assert.equal(arr.filter(t=>t.role==='seller').length,10);
  assert.equal(new Set(arr.map(t=>t.style)).size,6);
  assert(arr.some(t=>t.focus.includes('skin')&&t.wallet>10000));
  assert(arr.every(t=>Number.isSafeInteger(t.wallet)&&t.wallet>0));
  const next=boot(g.store);
  assert.deepEqual(next.state().market.traders,arr);
  next.run("go('Inventory');go('Market')");
  assert.deepEqual(next.state().market.traders,arr);
});
test('Identical collectibles get different floors and patience from distinct sellers',()=>{
  const g=boot();
  g.run("go('Market')");
  const names=['NightShift','The Quartermaster','VaultKeeper'];
  const result=names.map(name=>JSON.parse(g.run(
    'JSON.stringify(window.LootHubTraders.terms(s,"buy",{id:"same-listing",seller:'+JSON.stringify(name)+
    ',ask:100,item:{id:"same-weapon",kind:"weapon",weapon:"MAC-10",tier:0,base:8},createdAt:1}))')));
  assert.deepEqual(result.map(x=>x.maxRounds),[2,3,4]);
  assert.equal(new Set(result.map(x=>x.threshold)).size,3);
  assert.equal(new Set(result.map(x=>x.concession)).size,3);
  assert.equal(new Set(result.map(x=>x.persona)).size,3);
});
test('Collector specialties change which buyer wants an item',()=>{
  const g=boot();
  g.run("go('Market')");
  const fixtures=[
    {id:'knife-offer',ask:450,item:{id:'knife',kind:'weapon',weapon:'Karambit',tier:4,base:1900}},
    {id:'rifle-offer',ask:450,item:{id:'rifle',kind:'weapon',weapon:'AK-47',tier:2,base:85}},
    {id:'case-offer',ask:30,item:{id:'case',kind:'case'}}
  ];
  const chosen=fixtures.map(x=>JSON.parse(g.run(
    'JSON.stringify(window.LootHubTraders.chooseBuyer(s,'+JSON.stringify(x)+'))')));
  assert(chosen.every(Boolean));
  assert(new Set(chosen.map(x=>x.id)).size>=2);
  assert(chosen[0].focus.includes('knife'));
  assert(chosen[1].focus.includes('rifle'));
  assert(chosen[2].focus.includes('case'));
});
test('Impatient seller walks after two rejected offers without a reset exploit',()=>{
  const g=boot();
  g.run("go('Market')");
  const l=g.state().market.npcListings.find(x=>x.seller==='NightShift');
  assert(l&&l.ask>1);
  g.run('negotiateNpcListing('+JSON.stringify(l.id)+')');
  const initial=g.state().market.negotiations.find(x=>x.id==='buy:'+l.id);
  assert.equal(initial.maxRounds,2);
  for(let i=0;i<2;i++){
    g.byId('negotiationAmount').value='1';
    g.run("sendNegotiationOffer('buy',"+JSON.stringify(l.id)+")");
  }
  assert.equal(g.state().market.negotiations.find(x=>x.id===initial.id).status,'walked');
  const again=boot(g.store);
  again.run('negotiateNpcListing('+JSON.stringify(l.id)+')');
  assert.equal(again.state().market.negotiations.find(x=>x.id===initial.id).rounds,2);
  assert.equal(again.state().market.negotiations.find(x=>x.id===initial.id).status,'walked');
});
test('Completing a negotiated player sale debits the buyer wallet exactly once',()=>{
  const g=boot();
  g.run('for(let i=0;i<25;i++)clickEarn();buy()');
  g.byId('listPrice').value='40';
  g.run('submitListing(s.items[0].id)');
  const l=g.state().listings[0],offer=g.state().market.negotiations.find(x=>x.kind==='sell'&&x.listingId===l.id);
  assert(offer&&offer.traderId);
  const before=g.state().market.traders.find(x=>x.id===offer.traderId).wallet;
  g.run("reviewBuyerOffer("+JSON.stringify(l.id)+")");
  g.run("acceptMarketCounter('sell',"+JSON.stringify(l.id)+")");
  assert.equal(g.state().market.traders.find(x=>x.id===offer.traderId).wallet,before);
  const price=g.state().market.negotiations.find(x=>x.id===offer.id).agreedPrice;
  g.run("completeMarketNegotiation('sell',"+JSON.stringify(l.id)+")");
  const after=g.state().market.traders.find(x=>x.id===offer.traderId);
  assert.equal(after.wallet,before-price);
  assert.equal(after.bought,1);
  const reload=boot(g.store);
  reload.run("completeMarketNegotiation('sell',"+JSON.stringify(l.id)+")");
  assert.equal(reload.state().market.traders.find(x=>x.id===offer.traderId).wallet,after.wallet);
});
test('A buyer without funds cannot settle an agreed price',()=>{
  const g=boot();
  g.run('for(let i=0;i<25;i++)clickEarn();buy()');
  g.byId('listPrice').value='40';
  g.run('submitListing(s.items[0].id)');
  const l=g.state().listings[0],offer=g.state().market.negotiations.find(x=>x.kind==='sell'&&x.listingId===l.id);
  g.run("acceptMarketCounter('sell',"+JSON.stringify(l.id)+")");
  const coins=g.state().coins;
  g.run('s.market.traders.find(x=>x.id==='+JSON.stringify(offer.traderId)+').wallet=0;save()');
  g.run("completeMarketNegotiation('sell',"+JSON.stringify(l.id)+")");
  assert.equal(g.state().coins,coins);
  assert.equal(g.state().listings.length,1);
  assert.equal(g.state().market.negotiations.find(x=>x.id===offer.id).status,'agreed');
});
test('NPC vendor wallets gain the amount paid for an approved inventory item',()=>{
  const g=boot();
  g.run("go('Market')");
  const l=g.state().market.npcListings.find(x=>x.ask<50);
  const vendor=g.state().market.traders.find(t=>t.name===l.seller);
  g.run('s.coins=10000;save()');
  g.run("buyNpcListing("+JSON.stringify(l.id)+")");
  const updated=g.state().market.traders.find(t=>t.id===vendor.id);
  assert.equal(updated.wallet,vendor.wallet+l.ask);
  assert.equal(updated.sold,1);
  assert.equal(g.run('catalog.length'),24);
  assert.equal(g.run('approvedSkins.length'),5);
});
test('Legacy negotiations retain agreed terms if personality fields were absent',()=>{
  const g=boot();
  g.run("go('Market')");
  const l=g.state().market.npcListings.find(x=>x.ask>=6);
  g.run("negotiateNpcListing("+JSON.stringify(l.id)+")");
  g.run('delete s.market.negotiations[0].persona;delete s.market.negotiations[0].traderId;delete s.market.negotiations[0].maxRounds;delete s.market.negotiations[0].concession;save()');
  const n=g.state().market.negotiations[0];
  g.run("negotiateNpcListing("+JSON.stringify(l.id)+")");
  assert.equal(g.state().market.negotiations[0].threshold,n.threshold);
  assert.equal(g.state().market.negotiations[0].npcOffer,n.npcOffer);
  assert.equal(g.state().market.negotiations[0].rounds,0);
  assert.equal(g.run('window.LootHubHaggling.MAX_ROUNDS'),3);
});
test('Market economy distinguishes stable base estimates from computed supply-sensitive values',()=>{
  const g=boot();
  g.run("go('Market')");
  const item={kind:'weapon',weapon:'AK-47',tier:2,base:85,id:'reference'};
  assert.equal(g.run('estimated('+JSON.stringify(item)+')'),85);
  const first=JSON.parse(g.run('JSON.stringify(window.LootHubEconomy.priceInfo(s,'+JSON.stringify(item)+'))'));
  assert.equal(first.base,85);
  assert(first.value>=60&&first.value<=115);
  assert(first.supply>=0);
  const initialHistory=JSON.stringify(g.state().market.priceHistory);
  g.run("go('Inventory');go('Market');go('Portfolio');go('Market')");
  assert.equal(JSON.stringify(g.state().market.priceHistory),initialHistory,
    'Rendering market or portfolio does not create a trade');
  assert.equal(g.run('estimated('+JSON.stringify(item)+')'),85);
});
test('Completed NPC item purchases register unique trade activity and persist after reload',()=>{
  const g=boot();
  g.run("go('Market')");
  const listing=g.state().market.npcListings.find(x=>x.item.kind==='weapon');
  const infoBefore=JSON.parse(g.run('JSON.stringify(window.LootHubEconomy.priceInfo(s,'+
    JSON.stringify(listing.item)+'))'));
  g.run('s.coins=10000;save()');
  g.run('buyNpcListing('+JSON.stringify(listing.id)+')');
  const after=g.state();
  const id=g.run('window.LootHubEconomy.key('+JSON.stringify(listing.item)+')');
  const entry=after.market.priceHistory[id];
  assert(entry);
  assert.equal(entry.volume,1);
  assert.equal(entry.recent[0].side,'buy');
  assert.equal(entry.recent[0].price,listing.ask);
  assert(entry.momentum>0,'A buyer transaction adds demand');
  const infoAfter=JSON.parse(g.run('JSON.stringify(window.LootHubEconomy.priceInfo(s,'+
    JSON.stringify(listing.item)+'))'));
  assert(infoAfter.value>=infoBefore.value);
  g.run('buyNpcListing('+JSON.stringify(listing.id)+')');
  assert.equal(g.state().market.priceHistory[id].volume,1,'No duplicate sale signal');
  assert.deepEqual(boot(g.store).state().market.priceHistory[id],entry);
});
test('Settling an NPC purchase from a player-owned listing adds a sale signal once',()=>{
  const g=boot();
  g.run('for(let i=0;i<25;i++)clickEarn();buy()');
  g.byId('listPrice').value='30';
  g.run('submitListing(s.items[0].id)');
  const item=g.state().listings[0].item;
  const id=g.run('window.LootHubEconomy.key('+JSON.stringify(item)+')');
  g.run('s.listings[0].checkedAt=Date.now()-60000');
  g.run('window.LootHubMarketSimulation.advanceListings(s,Date.now(),()=>0);save()');
  const state=g.state();
  assert.equal(state.listings.length,0);
  assert.equal(state.market.priceHistory[id].volume,1);
  assert.equal(state.market.priceHistory[id].recent[0].side,'sell');
  assert.equal(state.market.priceHistory[id].recent[0].price,30);
});
test('Price discovery is capped per model per day, ignores backward time and extreme asks',()=>{
  const g=boot();
  g.run("go('Market')");
  const obj={kind:'weapon',weapon:'M60',tier:2,base:105,id:'fake-test-instance'};
  const t=Date.now();
  for(let i=0;i<100;i++){
    g.run('window.LootHubEconomy.recordTrade(s,'+JSON.stringify(obj)+',100000000,"buy",'+t+')');
  }
  const state=g.state();
  const id=g.run('window.LootHubEconomy.key('+JSON.stringify(obj)+')');
  assert.equal(state.market.priceHistory[id].volume,6);
  assert.equal(state.market.priceHistory[id].recent.length,6);
  assert.equal(state.market.priceHistory[id].eventsToday,6);
  assert.equal(g.run('window.LootHubEconomy.recordTrade(s,'+JSON.stringify(obj)+',100000000,"buy",'+(t-86400000)+')'),false);
  const price=g.run('window.LootHubEconomy.marketValue(s,'+JSON.stringify(obj)+','+t+')');
  assert(price>=Math.round(105*.7)-1&&price<=Math.round(105*1.35)+1);
  assert.equal(g.run('window.LootHubEconomy.recordTrade(s,'+JSON.stringify(obj)+',0,"buy",'+(t+86400000)+')'),false);
  assert.equal(g.run('window.LootHubEconomy.recordTrade(s,'+JSON.stringify(obj)+',2,"invalid",'+(t+86400000)+')'),false);
  assert.equal(g.state().market.priceHistory[id].volume,6);
});
test('Dynamic market values decay predictably and remain within hard bounds',()=>{
  const g=boot();
  const obj={kind:'skin',weapon:'MAC-10',skin:'Red Devil',tier:4,base:1800,id:'approved-test'};
  const start=Date.now();
  const init=JSON.parse(g.run('JSON.stringify(window.LootHubEconomy.priceInfo(s,'+JSON.stringify(obj)+','+start+'))'));
  g.run('window.LootHubEconomy.recordTrade(s,'+JSON.stringify(obj)+',2500,"buy",'+start+')');
  const same=JSON.parse(g.run('JSON.stringify(window.LootHubEconomy.priceInfo(s,'+JSON.stringify(obj)+','+start+'))'));
  const later=JSON.parse(g.run('JSON.stringify(window.LootHubEconomy.priceInfo(s,'+JSON.stringify(obj)+','+(start+20*86400000)+'))'));
  assert(same.momentum>0);
  assert(later.momentum<same.momentum);
  assert(Math.abs(later.multiplier-1)<Math.abs(same.multiplier-1));
  assert(same.value>=1260&&same.value<=2430);
  assert.equal(init.base,1800);
});
test('Unsupported or corrupted trade histories fail import validation without harming legacy saves',()=>{
  const g=boot();
  const legacy=g.state();
  delete legacy.market.priceHistory;
  assert.equal(g.run('safeUpload('+JSON.stringify(legacy)+')'),false,'Malformed history fails schema');
  const compatible=g.state();
  compatible.market.priceHistory={};
  assert.equal(g.run('safeUpload('+JSON.stringify(compatible)+')'),true);
  const bad=g.state();
  bad.market.priceHistory={'weapon:test':{momentum:99,volume:1,updatedAt:Date.now(),
    lastDay:0,eventsToday:1,recent:[{at:Date.now(),price:4,side:'buy'}]}};
  assert.equal(g.run('safeUpload('+JSON.stringify(bad)+')'),false);
  assert.equal(g.state().market.priceHistory['weapon:test'],undefined);
});
test('Market Pulse and investment summaries show bounded market and unchanged base references',()=>{
  const g=boot();
  g.run("go('Market')");
  const html=g.run('enhancedMarket()');
  assert(html.includes('Market Pulse'));
  assert(html.includes('collectible markets'));
  assert(html.includes('Base '));
  assert(html.includes('Supply '));
  assert(html.includes('trades'));
  assert.equal((html.match(/class="market-pulse-item"/g)||[]).length,8);
  const portfolio=g.run('enhancedPortfolio()');
  assert(portfolio.includes('Base collectible estimate'));
  assert(portfolio.includes('Inventory market value'));
  assert.equal(g.run('catalog.length'),24);
  assert.equal(g.run('approvedSkins.length'),5);
});
test('Offline catch-up advances once with bounded NPC trades and exact budget transfers',()=>{
  const g=boot();
  g.run("go('Market')");
  const before=g.state(),now=Date.now()+4*3600000;
  const r=JSON.parse(g.run('JSON.stringify(window.LootHubOffline.advance(s,dropCatalog,'+now+',()=>0))'));
  assert.equal(r.npcSales,2,'Maximum two simulated NPC trades per return');
  assert.equal(r.processedMinutes,240);
  assert.equal(r.elapsedMinutes,240);
  assert.equal(g.state().market.lastSimulatedAt,now);
  assert.equal(g.state().market.npcListings.length,15,'Bounded restocking repairs sold inventory');
  assert.equal(g.state().coins,before.coins,'NPC-to-NPC trades never change player wallet');
  assert.deepEqual(g.state().items,before.items,'NPC-to-NPC trades never add phantom player items');
  assert(g.state().market.traders.some(x=>x.role==='buyer'&&x.bought>0));
  assert(g.state().market.traders.some(x=>x.role==='seller'&&x.sold>0));
  const history=Object.values(g.state().market.priceHistory);
  assert(history.some(x=>x.recent.some(y=>y.side==='buy')),
    'A real NPC-to-NPC settlement should update market price history');
  assert.equal(g.state().market.lastOfflineReport.npcSales,2);
  const a=JSON.parse(g.run('JSON.stringify(window.LootHubOffline.advance(s,dropCatalog,'+now+',()=>0))'));
  assert.equal(a.npcSales,0);
  assert.equal(a.restocked,0);
  assert.equal(a.processedMinutes,0);
  assert.equal(g.state().market.lastSimulatedAt,now);
});
test('Huge forward jump discards excess offline hours; backward clock earns nothing',()=>{
  const g=boot();
  g.run("go('Market')");
  const future=Date.now()+365*86400000;
  const r=JSON.parse(g.run('JSON.stringify(window.LootHubOffline.advance(s,dropCatalog,'+future+',()=>.99999))'));
  assert(r.elapsedMinutes>100000);
  assert.equal(r.processedMinutes,480,'At most eight elapsed hours are simulated');
  assert.equal(r.npcSales,0);
  assert.equal(g.state().market.lastSimulatedAt,future);
  const before=JSON.stringify(g.state());
  const rolled=JSON.parse(g.run('JSON.stringify(window.LootHubOffline.advance(s,dropCatalog,'+(future-86400000)+',()=>0))'));
  assert.equal(rolled.changed,false);
  assert.equal(rolled.npcSales,0);
  assert.equal(JSON.stringify(g.state()),before);
  const again=JSON.parse(g.run('JSON.stringify(window.LootHubOffline.advance(s,dropCatalog,'+future+',()=>0))'));
  assert.equal(again.npcSales,0,'Returning to same clock time cannot replay events');
});
test('NPC listings expire, refill from approved catalog, and void pending negotiations',()=>{
  const g=boot();
  g.run("go('Market')");
  const first=g.state().market.npcListings[0];
  g.run('negotiateNpcListing('+JSON.stringify(first.id)+')');
  const future=Date.now()+4*86400000;
  const result=JSON.parse(g.run('JSON.stringify(window.LootHubOffline.advance(s,dropCatalog,'+future+',()=>.999))'));
  assert.equal(result.expired,15);
  assert.equal(result.restocked,15);
  assert.equal(result.npcSales,0);
  assert.equal(g.state().market.npcListings.length,15);
  assert(!g.state().market.npcListings.some(x=>x.id===first.id));
  assert.equal(g.state().market.negotiations.find(x=>x.id==='buy:'+first.id).status,'unavailable');
  const approved=JSON.parse(g.run('JSON.stringify(dropCatalog)'));
  for(const l of g.state().market.npcListings){
    if(l.item.kind==='case')continue;
    assert(approved.some(x=>x.kind===l.item.kind&&x.weapon===l.item.weapon&&
      x.skin===l.item.skin),'Offline supply cannot generate unapproved cosmetics');
  }
  assert.equal(new Set(g.state().market.npcListings.map(x=>x.item.id)).size,15);
});
test('An agreed NPC listing is protected from other NPCs buying it during offline replay',()=>{
  const g=boot();
  g.run("go('Market')");
  const target=g.state().market.npcListings[0];
  g.run('negotiateNpcListing('+JSON.stringify(target.id)+')');
  g.run("acceptMarketCounter('buy',"+JSON.stringify(target.id)+")");
  const at=Date.now()+2*3600000;
  g.run('window.LootHubOffline.advance(s,dropCatalog,'+at+',()=>0)');
  const keep=g.state();
  assert(keep.market.npcListings.some(x=>x.id===target.id));
  assert.equal(keep.market.negotiations.find(x=>x.id==='buy:'+target.id).status,'agreed');
});
test('Player escrow uses existing 120-minute cap without retroactive repeated payout',()=>{
  const g=boot();
  g.run('for(let i=0;i<25;i++)clickEarn();buy()');
  g.byId('listPrice').value='100000000';
  g.run('submitListing(s.items[0].id)');
  g.run('s.listings[0].checkedAt=Date.now()-12*3600000');
  const result=JSON.parse(g.run('JSON.stringify(window.LootHubOffline.advance(s,dropCatalog,Date.now(),()=>.9999))'));
  assert.equal(result.playerSales.length,0);
  assert.equal(g.state().listings.length,1);
  assert(Date.now()-g.state().listings[0].checkedAt<2000,'Old checkedAt must be consumed');
  assert.equal(g.state().coins,0);
  const again=JSON.parse(g.run('JSON.stringify(window.LootHubOffline.advance(s,dropCatalog,Date.now(),()=>0))'));
  assert.equal(again.playerSales.length,0);
  assert.equal(g.state().listings.length,1);
});
test('Offline simulated market activity saves and remains stable after reopening the game',()=>{
  const g=boot();
  g.run("go('Market')");
  g.run('s.market.lastSimulatedAt=Date.now()-4*3600000;s.market.lastNpcRefreshAt=Date.now();save()');
  const r=g.run('marketTick()');
  assert(r.changed);
  const state=g.state();
  assert(state.market.lastOfflineReport.npcSales>0);
  assert(state.market.lastOfflineReport.processedMinutes>=239);
  assert.equal(g.persisted().market.lastSimulatedAt,state.market.lastSimulatedAt);
  const reloaded=boot(g.store);
  assert.deepEqual(reloaded.state().market.traders,state.market.traders);
  assert.deepEqual(reloaded.state().market.priceHistory,state.market.priceHistory);
  assert.equal(reloaded.state().market.lastOfflineReport.npcSales,state.market.lastOfflineReport.npcSales);
});
test('Offline activity report imports reject corrupt counts and preserve older save schemas',()=>{
  const g=boot();
  g.run("go('Market')");
  const old=g.state();
  delete old.market.lastOfflineReport;
  assert.equal(g.run('safeUpload('+JSON.stringify(old)+')'),true);
  const invalid=g.state();
  invalid.market.lastOfflineReport={at:Date.now(),elapsedMinutes:-3};
  assert.equal(g.run('safeUpload('+JSON.stringify(invalid)+')'),false);
  const current=g.state();
  assert.equal(g.run('safeUpload('+JSON.stringify(current)+')'),true);
  const view=g.run('enhancedMarket()');
  assert(view.includes('WHILE YOU WERE AWAY'));
});
test('Marketplace affordability filters work without changing NPC listings or wallet',()=>{
  const g=boot();
  g.run("go('Market')");
  const start=g.state();
  g.run('s.coins=15;save()');
  const affordable=JSON.parse(g.run('JSON.stringify(window.LootHubTradingTools.filterNpc(s,{affordability:"affordable"}))'));
  assert(affordable.every(x=>x.ask<=15));
  const below=JSON.parse(g.run('JSON.stringify(window.LootHubTradingTools.filterNpc(s,{affordability:"under-market"}))'));
  assert(below.every(x=>x.ask<=g.run('window.LootHubEconomy.marketValue(s,'+JSON.stringify(x.item)+')')));
  g.run('updateNpcMarketFilter("affordability","affordable")');
  assert.equal(g.run('npcMatches().length'),affordable.length);
  assert(g.run('enhancedMarket()').includes('Reset filters'));
  g.run('resetNpcMarketFilters()');
  assert.equal(g.run('npcMatches().length'),15);
  assert.equal(g.state().market.npcListings.length,start.market.npcListings.length);
  assert.deepEqual(g.state().market.npcListings,start.market.npcListings);
});
test('Full owned inventory is searchable, sorted and paginated in Market without reassigning items',()=>{
  const g=boot();
  g.run('for(let i=0;i<22;i++)s.items.push({id:"owned-"+i,kind:"weapon",weapon:i%2?"AK-47":"MP5",tier:1,base:i+10})');
  g.run("go('Market')");
  assert.equal(g.run('window.LootHubTradingTools.filterOwned(s,{}).length'),22);
  assert.equal((g.run('renderMarketOwnedResults()').match(/>List item<\/button>/g)||[]).length,12);
  assert(g.run('renderMarketOwnedResults()').includes('Show more'));
  g.run('showMoreMarketOwned()');
  assert.equal((g.run('renderMarketOwnedResults()').match(/>List item<\/button>/g)||[]).length,22);
  assert(!g.run('renderMarketOwnedResults()').includes('Show more'));
  g.run('updateMarketOwnedFilter("search","AK-47")');
  assert.equal(g.run('window.LootHubTradingTools.filterOwned(s,marketOwnedView).length'),11);
  assert.equal(g.run('marketOwnedView.limit'),12);
  g.run('updateMarketOwnedFilter("sort","value-desc")');
  const sorted=JSON.parse(g.run('JSON.stringify(window.LootHubTradingTools.filterOwned(s,marketOwnedView))'));
  assert(sorted.every((x,i)=>i===0||sorted[i-1].base>=x.base));
  assert.equal(g.state().items.length,22,'Filtering inventory must not create/remove collectibles');
  assert(g.run('enhancedMarket()').includes('marketOwnedSearch'));
});
test('Trading Desk filters show active and completed negotiations after reload',()=>{
  const g=boot();
  g.run("go('Market')");
  const offer=g.state().market.npcListings.find(x=>x.ask>2);
  g.run('negotiateNpcListing('+JSON.stringify(offer.id)+')');
  const active=g.state().market.negotiations.find(x=>x.id==='buy:'+offer.id);
  assert(active);
  assert.equal(active.itemName,offer.item.kind==='case'?'Sealed Arsenal Case':
    offer.item.weapon+(offer.item.skin?' | '+offer.item.skin:''));
  assert.equal(g.run('window.LootHubTradingTools.filterNegotiations(s,{status:"active"}).length')>=1,true);
  g.run('s.coins=100000;save()');
  g.run('acceptMarketCounter("buy",'+JSON.stringify(offer.id)+')');
  g.run('completeMarketNegotiation("buy",'+JSON.stringify(offer.id)+')');
  const completed=g.state().market.negotiations.find(x=>x.id===active.id);
  assert.equal(completed.status,'completed');
  assert.equal(g.run('window.LootHubTradingTools.filterNegotiations(s,{status:"complete"}).length'),1);
  g.run('updateTradeCenterFilter("status","complete")');
  assert(g.run('renderTradeCenterResults()').includes('View history'));
  g.run('openTradeRecord('+JSON.stringify(active.id)+')');
  assert(g.byId('overlay').innerHTML.includes('SAVED NEGOTIATION HISTORY'));
  assert(g.byId('overlay').innerHTML.includes('Trade completed'));
  assert(g.byId('overlay').innerHTML.includes(completed.itemName));
  const next=boot(g.store);
  next.run("go('Market')");
  next.run('openTradeRecord('+JSON.stringify(active.id)+')');
  assert(next.byId('overlay').innerHTML.includes(completed.itemName));
  assert.equal(next.state().market.negotiations.find(x=>x.id===active.id).status,'completed');
});
test('Trade records are read-only; closed deals and activity journal retain prior events',()=>{
  const g=boot();
  g.run("go('Market')");
  const l=g.state().market.npcListings.find(x=>x.ask>2);
  g.run('negotiateNpcListing('+JSON.stringify(l.id)+')');
  g.run('leaveMarketNegotiation("buy",'+JSON.stringify(l.id)+')');
  const before=JSON.stringify(g.state());
  g.run('openTradeRecord("buy:'+l.id+'")');
  g.run('renderTradeCenterResults()');
  g.run('window.LootHubTradingTools.marketJournal(s,12)');
  assert.equal(JSON.stringify(g.state()),before,'Inspecting a historical deal must not mutate game state');
  assert(g.byId('overlay').innerHTML.includes('read-only record'));
  assert.equal(g.run('window.LootHubTradingTools.filterNegotiations(s,{status:"closed"}).length'),1);
  g.run("s.ledger.push({at:Date.now(),message:'Listed Karambit for 40 coins',wallet:50})");
  assert.equal(g.run('window.LootHubTradingTools.marketJournal(s,12).length'),1);
  assert(g.run('tradeCenter()').includes('Recent Market Activity'));
});
test('Market layout offers mobile shortcuts, buyer filters and whole-inventory list controls',()=>{
  const g=boot();
  g.run("go('Market')");
  const html=g.run('enhancedMarket()');
  for(const value of ['market-browse','market-listings','market-offers','market-sell',
    'npcAffordability','marketOwnedSearch','marketOwnedKind','tradeStatusFilter','tradeKindFilter']){
    assert(html.includes(value),'Missing marketplace navigation/control: '+value);
  }
  assert.equal((html.match(/class="market-shortcuts"/g)||[]).length,1);
  assert.equal((html.match(/class="npc-listing"/g)||[]).length,15);
  assert.equal(g.run('catalog.length'),24);
  assert.equal(g.run('approvedSkins.length'),5);
});
if(process.exitCode)process.exit(process.exitCode);
console.log('All LootHub core regression tests passed.');
