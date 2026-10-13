// Node-only deterministic economy + save compatibility regression suite.
// Run: node tests/core.cjs
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const CURRENT_MANIFEST=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
const MASTER_COUNT=CURRENT_MANIFEST.items.length;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const upgrade=fs.readFileSync(path.join(root,'upgrade.js'),'utf8');
const feedback=fs.readFileSync(path.join(root,'market/feedback.js'),'utf8');
const multiCore=fs.readFileSync(path.join(root,'market/multi-open.js'),'utf8');
const multiUI=fs.readFileSync(path.join(root,'market/multi-open-ui.js'),'utf8');
const collectionCatalog=fs.readFileSync(path.join(root,'assets/collections.js'),'utf8');
const collectionCore=fs.readFileSync(path.join(root,'market/collections.js'),'utf8');
const collectionUI=fs.readFileSync(path.join(root,'market/collections-ui.js'),'utf8');
for(const p of ['assets/collections.js','market/collections.js','market/collections-ui.js'])
 assert(html.includes('<script src="./'+p+'"></script>'));

assert(html.includes('<script src="./market/multi-open.js"></script>'));
assert(html.includes('<script src="./market/multi-open-ui.js"></script>'));

const cartelData=fs.readFileSync(path.join(root,'assets/cartel-case.js'),'utf8');
const specOpsData=fs.readFileSync(path.join(root,'assets/spec-ops-case.js'),'utf8');
assert(html.includes('<script src="./assets/spec-ops-case.js"></script>'));
assert(html.includes('<script src="./assets/cartel-case.js"></script>'));
for(const slug of ['ak-47','rpg-7','tactical-machete','12-gauge-pump-shotgun','desert-eagle'])assert(html.includes('<script src="./assets/skins/'+slug+'--cartel.js"></script>'));

assert(html.includes('<script src="./market/feedback.js"></script>'),'Missing interaction feedback module');
const marketModules=['wear-materials','wear','wear-renderer','core','transactions','simulation','npc','traders','haggling','economy','auctions','auction-ui','offline','tools'].map(name=>fs.readFileSync(path.join(root,'market',name+'.js'),'utf8')).join('\n');
for(const name of ['wear-materials','wear','wear-renderer','core','transactions','simulation','npc','traders','haggling','economy','auctions','auction-ui','offline','tools'])assert(html.includes('<script src="./market/'+name+'.js"></script>'),'Missing market module '+name);
const masters=fs.readFileSync(path.join(root,'assets/weapon-masters.js'),'utf8');
const catalogData=fs.readFileSync(path.join(root,'assets/weapon-catalog.js'),'utf8');
assert(html.includes('<script src="./assets/weapon-catalog.js"></script>'));
assert(html.includes('<script src="./assets/weapon-masters.js"></script>'),'Art masters missing from page');
const scriptMatch=html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/i);
assert(scriptMatch,'Game script missing');
const universalData=fs.readFileSync(path.join(root,'assets/skin-lines/line-data.js'),'utf8');
const universalRegistry=fs.readFileSync(path.join(root,'market/skin-lines.js'),'utf8');
const materialProfiles=fs.readFileSync(path.join(root,'assets/skin-lines/paint-profile-data.js'),'utf8');
assert(html.includes('<script src="./assets/skin-lines/paint-profile-data.js"></script>'));

assert(html.includes('<script src="./assets/skin-lines/line-data.js"></script>'));
assert(html.includes('<script src="./market/skin-lines.js"></script>'));
const script=masters+'\n'+catalogData+'\n'+universalData+'\n'+cartelData+'\n'+specOpsData+'\n'+collectionCatalog+'\n'+universalRegistry+'\n'+materialProfiles+'\n'+marketModules+'\n'+feedback+'\n'+multiCore+'\n'+multiUI+'\n'+collectionCore+'\n'+collectionUI+'\n'+upgrade+'\n'+scriptMatch[1];
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

test('Procedural cases are retired and material maps remain wear-only',()=>{
  const g=boot();
  assert.equal(g.run('window.LootHubSkinLines.lines.length'),0);
  assert.equal(g.run('window.LootHubSkinLines.previewLines.length'),0);
  assert.equal(g.run('Object.keys(lineCatalogs).length'),0);
  assert.equal(g.run('allMarketCatalog.length'),g.run('dropCatalog.length')+10);
  assert.equal(g.run('dropCatalog.length'),MASTER_COUNT+g.run('approvedSkins.length'));
  const menu=g.run('universalCases()');
  assert(menu.includes('Arsenal Case'));
  assert(!menu.includes('Blackout Case'));
  assert(!menu.includes('Damascus Case'));
  assert(!menu.includes('Buy Blackout'));
  assert(!menu.includes('Buy Damascus'));
  assert.equal(g.run('window.LootHubSkinLines.getLine("blackout")'),null);
  assert.equal(g.run('window.LootHubSkinLines.getLine("damascus")'),null);
  assert.equal(g.run('window.LootHubSkinLines.isRegistered({kind:"skin",weapon:"AK-47",skin:"Damascus",skinLine:"damascus"})'),false);
  assert(g.run('window.LootHubWearMaterials.materialPath("AK-47")').includes('material-1600.png'),
    'Material maps must remain available for the separate wear renderer');
  assert(g.run('window.LootHubWearMaterials.maskPath("AK-47")').includes('paint-main-1600.png'),
    'Paint-main masks must remain available for wear');
});
test('Retired cases become Arsenal Cases and retired skins become neutral weapons without loss',()=>{
  const now=Date.now();
  const store=new LocalStore();
  const items=[
    {id:'sealed-blackout',kind:'case',caseId:'blackout',paid:25},
    {id:'sealed-damascus',kind:'case',caseId:'damascus',paid:25},
    {id:'open-blackout',kind:'skin',skinLine:'blackout',skin:'Blackout',weapon:'FN FAL',
      tier:2,base:216,paid:25,wearGrade:3},
    {id:'open-damascus',kind:'skin',skinLine:'damascus',skin:'Damascus',weapon:'AK-47',
      tier:2,base:170,paid:25,wearGrade:1},
    {id:'approved-skin',kind:'skin',skin:'Red Devil',weapon:'MAC-10',tier:4,base:1800,wearGrade:0}
  ];
  const old={coins:75,items,history:['Prior market history'],earned:125,spent:50,
    sales:0,rep:0,openings:2,serial:5,offers:{},tab:'Inventory',
    listings:[
      {id:'listing-retired-case',item:{id:'escrow-case',kind:'case',caseId:'blackout',paid:25},
        ask:36,createdAt:now,checkedAt:now},
      {id:'listing-retired-skin',item:{id:'escrow-skin',kind:'skin',skinLine:'damascus',skin:'Damascus',
        weapon:'Karambit',tier:4,base:3800,wearGrade:2},ask:3900,createdAt:now,checkedAt:now}
    ]};
  store.setItem(KEY,JSON.stringify(old));
  const g=boot(store),retired=g.state();
  assert.equal(retired.coins,75);
  assert.equal(retired.items.length,5);
  assert.equal(retired.openings,2);
  assert.equal(retired.spent,50);
  assert.equal(retired.history[0],'Prior market history');
  assert.deepEqual(retired.items.slice(0,2).map(x=>x.id),['sealed-blackout','sealed-damascus']);
  for(const x of retired.items.slice(0,2)){
    assert.equal(x.kind,'case');
    assert.equal(x.paid,25);
    assert(!Object.hasOwn(x,'caseId'),'Former themed case must now open as an Arsenal Case');
  }
  for(const x of retired.items.slice(2,4)){
    assert.equal(x.kind,'weapon');
    assert(!Object.hasOwn(x,'skinLine'));
    assert(!Object.hasOwn(x,'skin'));
    assert([1,3].includes(x.wearGrade));
  }
  assert.equal(retired.items[2].base,216);
  assert.equal(retired.items[3].base,170);
  assert.equal(retired.items[4].kind,'skin');
  assert.equal(retired.items[4].skin,'Red Devil');
  assert.equal(retired.listings.length,2);
  assert.equal(retired.listings[0].ask,36);
  assert.equal(retired.listings[0].item.id,'escrow-case');
  assert(!Object.hasOwn(retired.listings[0].item,'caseId'));
  assert.equal(retired.listings[1].ask,3900);
  assert.equal(retired.listings[1].item.kind,'weapon');
  assert.equal(retired.listings[1].item.id,'escrow-skin');
  assert(g.run('safeUpload('+JSON.stringify(old)+')'),
    'An older exported backup with retired cosmetic items must remain importable');
  g.run('save()');
  const reload=boot(store);
  assert.deepEqual(reload.state().items.slice(0,4),retired.items.slice(0,4),
    'Migration must be idempotent and preserve IDs, values, wear and balances');
  reload.run('openCase(s.items[0].id);finishOpening()');
  assert.equal(reload.state().openings,3);
  assert.equal(reload.state().items.length,5);
  assert(reload.state().items.some(x=>x.kind==='weapon'&&x.weapon==='Glock-18'),
    'Converted Arsenal Case must open through the normal reward pool');
});
test('Mosin-Nagant rename preserves legacy weapons, listings and trade history',()=>{
 const fresh=boot();
 assert.equal(fresh.run('window.LootHubWeaponCatalog.modelSlugs["Mosin-Nagant"]'),'kar98k');
 const entry=JSON.parse(fresh.run('JSON.stringify(window.LootHubCollections.definitions[0].items.find(x=>x.id==="kar98k--base"))'));
 assert.equal(entry.weapon,'Mosin-Nagant');
 const now=Date.now(),store=new LocalStore();
 const priceHistory={'weapon:kar98k':{momentum:.06,volume:2,updatedAt:now,
   lastDay:Math.floor(now/86400000),eventsToday:1,recent:[]}};
 store.setItem(KEY,JSON.stringify({coins:200,items:[{id:'owned-rifle',kind:'weapon',
   weapon:'Kar98k',tier:2,base:96,paid:25,wearGrade:2}],history:[],earned:225,
   spent:25,sales:0,rep:0,openings:1,serial:1,offers:{},tab:'Inventory',
   listings:[{id:'listed-rifle',item:{id:'escrow-rifle',kind:'weapon',weapon:'Kar98k',
     tier:2,base:96,wearGrade:1},ask:125,createdAt:now,checkedAt:now}],
   market:{schemaVersion:1,npcListings:[],negotiations:[],traders:[],priceHistory,
     lastSimulatedAt:now}}));
 const g=boot(store),state=g.state();
 assert.equal(state.items[0].weapon,'Mosin-Nagant');
 assert.equal(state.items[0].id,'owned-rifle');
 assert.equal(state.items[0].wearGrade,2);
 assert.equal(state.listings[0].item.weapon,'Mosin-Nagant');
 assert.equal(state.listings[0].ask,125);
 assert.equal(state.market.priceHistory['weapon:mosin-nagant'].volume,2);
 assert(!Object.hasOwn(state.market.priceHistory,'weapon:kar98k'));
 assert(state.collections.progress['arsenal-v1'].seen.includes('kar98k--base'));
 assert(g.run('window.LootHubWearMaterials.materialPath("Mosin-Nagant")').includes('kar98k'));
 g.run('save()');
 const reload=boot(store);
 assert.equal(reload.state().items[0].weapon,'Mosin-Nagant');
 assert.equal(reload.state().listings[0].item.weapon,'Mosin-Nagant');
});
test('Arsenal Case matches dynamically registered base weapons and ten owner-approved skins',()=>{
  const g=boot();
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
  const cat=JSON.parse(g.run('JSON.stringify(catalog)'));
  assert.equal(cat.length,MASTER_COUNT);
  assert.equal(manifest.items.length,MASTER_COUNT);
  assert.equal(manifest.approvedSkins.length,20);
  assert.equal(manifest.approvedSkins[0].displayName,'MAC-10 | Red Devil');
  assert(manifest.catalogMode.includes('base-weapon-models'),'Catalog mode must describe base models');
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
  for(const weapon of ['M1911','M1 Garand','Mosin-Nagant','Thompson SMG','FN SCAR-L','FN FAL','M134 Minigun'])assert(weaponNames.has(weapon));
  const live=JSON.parse(g.run('JSON.stringify(approvedSkins)'));
  assert.deepEqual(live,[['MAC-10','Red Devil',4,1800,'🔫'],
    ['RPG-7','Glory',3,1200,'🔫'],
    ['Colt .45 Revolver','High Stakes',3,900,'🔫'],
    ['Butterfly Knife','The Hydra',4,3600,'🗡️'],
    ['FN FAL','The Luck O The Irish',2,320,'🔫'],
    ['Tactical Machete','Predator',2,260,'🗡️'],
    ['Desert Eagle','Blossom',3,950,'🔫'],
    ['Karambit','Kryptonite',4,3800,'🗡️'],
    ['SPAS-12','Blood Thirsty',3,1100,'🔫'],
    ['AWP','Crimson Delight',4,4200,'🎯']]);
});
test('Official 25th weapon uses uploaded transparent double barrel and wear maps',()=>{
  const g=boot();
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
  const weapon='Double-Barrel Shotgun',slug='double-barrel-shotgun';
  assert(MASTER_COUNT>=25,'The original double barrel is the 25th weapon');
  assert.equal(manifest.items.length,MASTER_COUNT);
  assert.equal(manifest.items[24].weapon,weapon);
  assert.equal(manifest.neutralMasterPipeline.baseModelCount,MASTER_COUNT);
  const entry=manifest.items.find(x=>x.weapon===weapon);
  assert(entry,'New official shotgun is absent from catalog');
  assert.equal(entry.id,slug+'--base');
  assert.equal(entry.modelSlug,slug);
  assert.equal(entry.kind,'weapon');
  assert.equal(entry.tier,2);
  assert.equal(entry.baseValue,90);
  assert.equal(entry.skin,null);
  assert.equal(entry.finish,null);
  assert.equal(entry.hasCosmeticSkin,false);
  assert.equal(entry.sourceType,'user-supplied-original-image');
  assert.equal(entry.renderMode,'transparent-webp-file');
  assert.equal(entry.sourceImage,'assets/weapon-sources/'+slug+'-original.png');
  const uploaded=fs.readFileSync(path.join(root,entry.sourceImage));
  assert.equal(uploaded.toString('ascii',1,4),'PNG','Original source should stay an unmodified PNG');
  const catalog=JSON.parse(g.run('JSON.stringify(window.LootHubWeaponCatalog.catalog)'));
  assert.equal(catalog.length,MASTER_COUNT);
  assert.deepEqual(catalog[24],[weapon,2,90,'🔫']);
  assert.equal(g.run('window.LootHubSkinLines.modelSlugs["Double-Barrel Shotgun"]'),slug);
  for(const [view,width] of [['reel',400],['inventory',800],['inspect',1600]]){
    const file='assets/renders/masters/'+slug+'-neutral-'+width+'.webp';
    const data=fs.readFileSync(path.join(root,file));
    assert.equal(data.toString('ascii',0,4),'RIFF');
    assert.equal(data.toString('ascii',8,12),'WEBP');
    const art=g.run('visualArt({kind:"weapon",weapon:"Double-Barrel Shotgun",tier:2,base:90},'+JSON.stringify(view)+')');
    assert(art.includes('data-weapon-model="'+weapon+'"'));
    assert(art.includes('data-resolution="'+width+'"'));
    assert(art.includes(slug+'-neutral-'+width+'.webp'));
    assert(art.includes('data-art-status="base"'));
    assert(!art.includes('data-finish='));
  }
  const masks=['assets/skin-lines/materials/'+slug+'--silhouette-1600.png',
    'assets/skin-lines/materials/'+slug+'--material-1600.png',
    'assets/skin-lines/masks/'+slug+'--paint-main-1600.png'];
  for(const filename of masks){
    const bytes=fs.readFileSync(path.join(root,filename));
    assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a',
      'Wear map must be a native full-resolution PNG: '+filename);
  }
  const maskPath=g.run('window.LootHubWearMaterials.materialPath("Double-Barrel Shotgun")');
  assert(maskPath.endsWith(slug+'--material-1600.png'));
  assert.equal(g.run('window.LootHubSkinLines.lines.length'),0);
  assert.equal(g.run('approvedSkins.length'),10);
  assert(g.run('cases()').includes('Double-Barrel Shotgun'));
  assert(g.run('cases()').includes(MASTER_COUNT+' base weapons'));
  assert(!g.run('cases()').includes('Blackout Case'));
  assert(!g.run('cases()').includes('Damascus Case'));
  // Test actual loot generation at a rarity and random index that selects the
  // newly appended item without needing a hard-coded drop table.
  const all=JSON.parse(g.run('JSON.stringify(dropCatalog)'));
  assert.equal(all.filter(x=>x.weapon===weapon).length,1);
  assert.deepEqual(all.slice(-1).map(x=>x.skin),['Crimson Delight']);
  const fresh=boot();
  fresh.run('s.items.push({id:"double-barrel-25",kind:"weapon",weapon:"Double-Barrel Shotgun",tier:2,base:90,wearGrade:2});go("Inventory")');
  assert(fresh.run('inventory()').includes('Double-Barrel Shotgun'));
  assert(fresh.run('enhancedMarket()').includes('Double-Barrel Shotgun')||
    fresh.run('renderMarketOwnedResults()').includes('Double-Barrel Shotgun'),
    'Owned double barrel should be eligible for trading');
  fresh.run('save()');
  const reload=boot(fresh.store);
  assert(reload.state().items.some(x=>x.id==='double-barrel-25'&&x.weapon===weapon));
});
test('All active weapon masters resolve to neutral WebP art only',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
  assert.equal(manifest.neutralMasterPipeline.baseModelCount,MASTER_COUNT);
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
  assert.equal((menu.match(/View weapon/g)||[]).length,MASTER_COUNT);
  assert.equal((menu.match(/View skin/g)||[]).length,10);
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
  assert.equal(manifest.skinPipeline.activeSkinCount,20);
  const added=manifest.approvedSkins.slice(1,5), images={};
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

test('October five original skins load with valid transparent WebP in every view and are obtainable and tradeable',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
  assert.equal(manifest.approvedSkins.length,20);
  assert.equal(manifest.skinPipeline.activeSkinCount,20);
  assert.equal(manifest.neutralMasterPipeline.baseModelCount,MASTER_COUNT);
  assert.deepEqual(JSON.parse(boot().run('JSON.stringify(odds)')),[70,20,7.5,2,.5]);
  const added=manifest.approvedSkins.slice(5,10);
  assert.deepEqual(added.map(e=>e.displayName),[
    'Tactical Machete | Predator','Desert Eagle | Blossom','Karambit | Kryptonite',
    'SPAS-12 | Blood Thirsty','AWP | Crimson Delight'
  ]);
  const rendered={};
  for(const entry of added){
    assert(html.includes('<script src="./'+entry.finishArt+'"></script>'));
    assert.equal(entry.approved,true);
    assert.equal(entry.kind,'skin');
    assert(manifest.items.find(x=>x.weapon===entry.weapon),'Neutral original missing for '+entry.weapon);
    const source=fs.readFileSync(path.join(root,entry.finishArt),'utf8');
    const win={};
    vm.runInNewContext(source,{window:win},{timeout:10000});
    const art=win.LootHubSkinArt[entry.weapon+'|'+entry.skin];
    assert(art,entry.displayName+' image was not registered');
    for(const size of ['400','800','1600']){
      const buf=Buffer.from(art[size],'base64');
      assert.equal(buf.toString('ascii',0,4),'RIFF');
      assert.equal(buf.toString('ascii',8,12),'WEBP');
      assert(buf.length>10000,'Unexpectedly tiny artwork '+entry.displayName);
    }
    rendered[entry.weapon+'|'+entry.skin]={'400':'UklGR-demo','800':'UklGR-demo','1600':'UklGR-demo'};
  }
  const g=boot();
  g.run('window.LootHubSkinArt='+JSON.stringify(rendered));
  const pool=JSON.parse(g.run('JSON.stringify(dropCatalog)'));
  assert.equal(pool.filter(x=>x.kind==='skin').length,10);
  for(const entry of added){
    assert(pool.some(x=>x.weapon===entry.weapon&&x.skin===entry.skin&&x.kind==='skin'
      &&x.tier===entry.tier&&x.base===entry.baseValue),'Skin not in case pool');
    const item={id:'new-'+entry.id,kind:'skin',weapon:entry.weapon,skin:entry.skin,
      tier:entry.tier,base:entry.baseValue,wearGrade:3};
    for(const [context,size] of [['reel','400'],['inventory','800'],['inspect','1600']]){
      const art=g.run('visualArt('+JSON.stringify(item)+','+JSON.stringify(context)+')');
      assert(art.includes('data-art-status="approved-skin"'),entry.displayName);
      assert(art.includes('data-finish="'+entry.skin+'"'),entry.displayName);
      assert(art.includes('data-resolution="'+size+'"'),entry.displayName);
      assert(art.includes('data-wear-grade="3"'),entry.displayName);
    }
    assert.equal(g.run('isApprovedSkin('+JSON.stringify(item)+')'),true);
  }
  const original={coins:500,items:added.map((x,i)=>({id:'owner-'+i,kind:'skin',
    weapon:x.weapon,skin:x.skin,tier:x.tier,base:x.baseValue,wearGrade:i})),
    listings:[],history:[],earned:500,spent:0,sales:0,rep:0,openings:5,serial:6,
    offers:{},tab:'Inventory'};
  const store=new LocalStore();
  store.setItem(KEY,JSON.stringify(original));
  const reload=boot(store);
  assert.deepEqual(reload.state().items.map(x=>x.kind),['skin','skin','skin','skin','skin']);
  assert.deepEqual(reload.state().items.map(x=>x.skin),added.map(x=>x.skin));
  assert.deepEqual(reload.state().items.map(x=>x.wearGrade),[0,1,2,3,4]);
  assert.equal(reload.run('safeUpload(JSON.parse(JSON.stringify(s)))'),true);
  const bad=reload.state();bad.items[0].skin='not owner-approved';
  assert.equal(reload.run('safeUpload('+JSON.stringify(bad)+')'),false);
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
  assert.equal(g.run('catalog.length'),MASTER_COUNT,'Marketplace test must not change approved base pool');
  assert.equal(g.run('approvedSkins.length'),10,'Exactly the ten owner-selected finishes may enter the case');
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
  const pool=JSON.parse(g.run('JSON.stringify(allMarketCatalog)'));
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
  assert.equal(g.run('catalog.length'),MASTER_COUNT);
  assert.equal(g.run('approvedSkins.length'),10);
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
  assert.equal(g.run('catalog.length'),MASTER_COUNT);
  assert.equal(g.run('approvedSkins.length'),10);
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
  assert.equal(g.run('catalog.length'),MASTER_COUNT);
  assert.equal(g.run('approvedSkins.length'),10);
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
  assert.equal((g.run('renderMarketOwnedResults()').match(/>Trading Desk<\/button>/g)||[]).length,12);
  assert(g.run('renderMarketOwnedResults()').includes('Show more'));
  g.run('showMoreMarketOwned()');
  assert.equal((g.run('renderMarketOwnedResults()').match(/>Trading Desk<\/button>/g)||[]).length,22);
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
  assert.equal(g.run('catalog.length'),MASTER_COUNT);
  assert.equal(g.run('approvedSkins.length'),10);
});
test('Four-round collector walkaway remains importable after a full negotiation',()=>{
  const g=boot();
  g.run("go('Market')");
  const listing=g.state().market.npcListings.find(x=>x.seller==='VaultKeeper');
  assert(listing&&listing.ask>1);
  g.run("negotiateNpcListing("+JSON.stringify(listing.id)+")");
  const id='buy:'+listing.id;
  assert.equal(g.state().market.negotiations.find(x=>x.id===id).maxRounds,4);
  for(let i=0;i<4;i++){
    g.byId('negotiationAmount').value='1';
    g.run("sendNegotiationOffer('buy',"+JSON.stringify(listing.id)+")");
  }
  const n=g.state().market.negotiations.find(x=>x.id===id);
  assert.equal(n.rounds,4);
  assert.equal(n.status,'walked');
  assert.equal(g.run('safeUpload(JSON.parse(JSON.stringify(s)))'),true);
  const corrupt=g.state();
  corrupt.market.negotiations.find(x=>x.id===id).rounds=5;
  assert.equal(g.run('safeUpload('+JSON.stringify(corrupt)+')'),false);
});
test('Accepted buyer agreement reserves player escrow against automatic sale simulation',()=>{
  const g=boot();
  g.run('s.items.push({id:"protected-case",kind:"case",paid:25})');
  g.run('window.LootHubMarketTransactions.createListing(s,"protected-case",25,Date.now()-3600000)');
  const listing=g.state().listings.find(x=>x.item.id==='protected-case');
  g.run("reviewBuyerOffer("+JSON.stringify(listing.id)+")");
  g.run("acceptMarketCounter('sell',"+JSON.stringify(listing.id)+")");
  assert.equal(g.state().market.negotiations.find(x=>x.kind==='sell'&&x.listingId===listing.id).status,'agreed');
  const before=g.state();
  const result=JSON.parse(g.run('JSON.stringify(window.LootHubMarketSimulation.advanceListings(s,Date.now(),()=>0))'));
  assert.equal(result.sales.length,0);
  assert.equal(g.state().listings.length,1);
  assert.equal(g.state().coins,before.coins);
  assert(Date.now()-g.state().listings[0].checkedAt<2000,'Elapsed time on protected escrow is consumed');
  assert.equal(g.state().market.negotiations.find(x=>x.kind==='sell'&&x.listingId===listing.id).status,'agreed');
});
test('Direct purchase of an expired NPC listing is refused without spending coins',()=>{
  const g=boot();
  g.run("go('Market')");
  g.run('s.coins=100000;save()');
  const listing=g.state().market.npcListings[0];
  g.run('s.market.npcListings[0].expiresAt=Date.now()-1');
  const before=g.state();
  assert.equal(g.run('window.LootHubMarketTransactions.buyNpcListing(s,'+
    JSON.stringify(listing.id)+')'),null);
  assert.equal(g.state().coins,before.coins);
  assert.equal(g.state().items.length,before.items.length);
  assert.equal(g.state().market.npcListings.length,before.market.npcListings.length);
});
test('Other buyer agreements reserve funds before a negotiated seller payout',()=>{
  const g=boot();
  g.run('s.items.push({id:"reserved-a",kind:"case",paid:25},{id:"reserved-b",kind:"case",paid:25})');
  g.run('window.LootHubMarketTransactions.createListing(s,"reserved-a",40,Date.now()-9000)');
  g.run('window.LootHubMarketTransactions.createListing(s,"reserved-b",40,Date.now()-8000)');
  const listings=g.state().listings;
  for(const l of listings){
    g.run("reviewBuyerOffer("+JSON.stringify(l.id)+")");
    g.run("acceptMarketCounter('sell',"+JSON.stringify(l.id)+")");
  }
  const records=g.state().market.negotiations.filter(x=>x.kind==='sell'&&x.status==='agreed');
  assert.equal(records.length,2);
  const buyer=records[0].traderId,first=records[0],second=records[1];
  // Simulate two agreements owned by the same collector to exercise reservation logic.
  g.run('s.market.negotiations.find(x=>x.id==='+JSON.stringify(second.id)+').traderId='+JSON.stringify(buyer));
  g.run('s.market.traders.find(x=>x.id==='+JSON.stringify(buyer)+').wallet='+
    (first.agreedPrice+second.agreedPrice-1));
  const initial=g.state();
  const sold=g.run('window.LootHubMarketTransactions.settleListing(s,'+
    JSON.stringify(first.listingId)+','+first.agreedPrice+')');
  assert.equal(sold,null,'Competing accepted deals must not spend previously reserved funds');
  assert.equal(g.state().coins,initial.coins);
  assert.equal(g.state().listings.length,2);
  assert.equal(g.state().market.traders.find(x=>x.id===buyer).wallet,
    first.agreedPrice+second.agreedPrice-1);
});
test('Marketplace payouts and instant-sale arithmetic refuse unsafe integer overflow',()=>{
  const g=boot();
  g.run('s.items.push({id:"overflow-case",kind:"case",paid:25})');
  g.run('window.LootHubMarketTransactions.createListing(s,"overflow-case",40,Date.now())');
  const listing=g.state().listings[0];
  g.run('s.coins=Number.MAX_SAFE_INTEGER-1;s.sales=Number.MAX_SAFE_INTEGER-1');
  const original=g.state();
  const invalid=g.run('window.LootHubMarketTransactions.settleListing(s,'+
    JSON.stringify(listing.id)+')');
  assert.equal(invalid,null);
  assert.deepEqual(g.state().listings,original.listings);
  assert.equal(g.state().coins,original.coins);
  g.run('s.items.push({id:"quick-case",kind:"case",paid:25})');
  assert.equal(g.run('window.LootHubMarketTransactions.sellOwned(s,"quick-case",50,1)'),null);
  assert(g.state().items.some(x=>x.id==='quick-case'));
});
test('Legacy direct-buyer walkaway persists instead of generating fresh offers forever',()=>{
  const g=boot();
  g.run('s.items.push({id:"legacy-counter-case",kind:"case",paid:25})');
  for(let i=0;i<3;i++){
    g.run('sellOffer("legacy-counter-case")');
    g.byId('ask').value='100000000';
    g.run('respondOffer("legacy-counter-case")');
  }
  const first=g.state().offers['sale-legacy-counter-case'];
  assert(first&&first.closed&&first.attempts===3);
  assert.equal(g.state().items.length,1);
  g.run('sellOffer("legacy-counter-case")');
  g.byId('ask').value='1';
  g.run('respondOffer("legacy-counter-case")');
  assert.equal(g.state().offers['sale-legacy-counter-case'].attempts,3);
  assert.equal(g.state().items.length,1);
  assert.equal(g.state().sales,0);
});

test('0.5.0 defines five independent condition grades without changing published rarity odds',()=>{
  const g=boot();
  const wear=g.run('window.LootHubWear');
  assert.equal(wear.SCHEMA_VERSION,1);
  assert.deepEqual(JSON.parse(g.run('JSON.stringify(window.LootHubWear.GRADES.map(x=>x.name))')),
    ['Pristine','Lightly Worn','Field-Tested','Heavily Worn','Battle-Scarred']);
  for(let i=0;i<5;i++)assert.equal(g.run('window.LootHubWear.validGrade('+i+')'),true);
  for(const x of [-1,5,2.5,null,'3',NaN,Infinity]){
    assert.equal(g.run('window.LootHubWear.validGrade('+JSON.stringify(x)+')'),false);
  }
  assert.deepEqual(JSON.parse(g.run('JSON.stringify(odds)')),[70,20,7.5,2,.5]);
  assert.equal(g.run('catalog.length'),MASTER_COUNT);
  assert.equal(g.run('approvedSkins.length'),10);
  assert.equal(g.run('window.LootHubMarketCore.estimated({kind:"weapon",base:100,wearGrade:4})'),55);
  assert.equal(g.run('window.LootHubMarketCore.estimated({kind:"weapon",base:100,wearGrade:0})'),100);
});
test('0.5.0/0.5.1 sealed cases are ungraded and a zero RNG roll produces pristine stock',()=>{
  const g=boot();
  g.run('for(let i=0;i<25;i++)clickEarn();buy()');
  const sealed=g.state().items[0];
  assert.equal(sealed.kind,'case');
  assert.equal(Object.hasOwn(sealed,'wearGrade'),false);
  g.run("openCase(s.items[0].id);finishOpening()");
  const prize=g.state().items[0];
  assert(['weapon','skin'].includes(prize.kind));
  assert.equal(prize.wearGrade,0);
  assert.equal(prize.paid,25);
  g.run("go('Market')");
  const stock=g.state().market.npcListings;
  assert.equal(stock.length,15);
  for(const x of stock){
    if(x.item.kind==='case')assert.equal(Object.hasOwn(x.item,'wearGrade'),false);
    else assert.equal(x.item.wearGrade,0);
  }
  assert.equal(g.state().wearSchemaVersion,1);
  assert.equal(g.persisted().wearSchemaVersion,1);
});
test('0.5.0 old saves migrate owned, escrow and NPC stock without changing identity or value',()=>{
  const store=new LocalStore(),a=boot(store);
  a.run("go('Market')");
  a.run("s.items.push({id:'retained-weapon',kind:'weapon',weapon:'AK-47',tier:2,base:123,paid:25})");
  a.run("s.items.push({id:'retained-finish',kind:'skin',weapon:'MAC-10',skin:'Red Devil',tier:4,base:1800,paid:25})");
  a.run("window.LootHubMarketTransactions.createListing(s,'retained-weapon',190,Date.now())");
  a.run('save()');
  const legacy=a.persisted();
  const ids=legacy.market.npcListings.map(x=>x.id);
  const bids=legacy.market.npcListings.map(x=>x.ask);
  const beforeWallet=legacy.coins,beforeListings=legacy.listings.map(x=>x.item.id);
  delete legacy.wearSchemaVersion;
  for(const item of legacy.items)delete item.wearGrade;
  for(const x of legacy.listings)delete x.item.wearGrade;
  for(const x of legacy.market.npcListings)delete x.item.wearGrade;
  store.setItem(KEY,JSON.stringify(legacy));
  const b=boot(store),loaded=b.state();
  assert.equal(loaded.wearSchemaVersion,1);
  assert.equal(loaded.coins,beforeWallet);
  assert.deepEqual(loaded.listings.map(x=>x.item.id),beforeListings);
  assert.deepEqual(loaded.market.npcListings.map(x=>x.id),ids);
  assert.deepEqual(loaded.market.npcListings.map(x=>x.ask),bids);
  assert.equal(loaded.listings[0].ask,190);
  assert.equal(loaded.listings[0].item.base,123);
  assert.equal(loaded.listings[0].item.wearGrade,0);
  assert.equal(loaded.items.find(x=>x.id==='retained-finish').wearGrade,0);
  assert.equal(loaded.items.find(x=>x.id==='retained-finish').base,1800);
  for(const x of loaded.market.npcListings){
    assert(x.item.kind==='case'?!Object.hasOwn(x.item,'wearGrade'):x.item.wearGrade===0);
  }
  b.run('save()');
  const reload=boot(store);
  assert.equal(reload.state().listings[0].item.base,123);
  assert.equal(reload.state().items.find(x=>x.id==='retained-finish').base,1800);
  assert.equal(reload.state().listings[0].item.wearGrade,0);
  assert.equal(reload.run('window.LootHubWear.ensureGame(s)'),0,'Repeated migration cannot reroll items');
});
test('0.5.0 wear data survives listing, repricing, cancellation and NPC purchase exactly',()=>{
  const g=boot();
  g.run("s.items.push({id:'scuffed-keep',kind:'weapon',weapon:'AK-47',tier:2,base:85,wearGrade:4})");
  g.run("window.LootHubMarketTransactions.createListing(s,'scuffed-keep',100,Date.now())");
  assert.equal(g.state().listings[0].item.wearGrade,4);
  g.run('window.LootHubMarketTransactions.repriceListing(s,s.listings[0].id,130,Date.now())');
  assert.equal(g.state().listings[0].item.wearGrade,4);
  g.run('window.LootHubMarketTransactions.cancelListing(s,s.listings[0].id)');
  assert.equal(g.state().items.find(x=>x.id==='scuffed-keep').wearGrade,4);
  g.run("go('Market')");
  const npc=g.state().market.npcListings.find(x=>x.item.kind!=='case');
  g.run('s.coins=100000;s.market.npcListings.find(x=>x.id==='+JSON.stringify(npc.id)+').item.wearGrade=3');
  g.run('window.LootHubMarketTransactions.buyNpcListing(s,'+JSON.stringify(npc.id)+')');
  const bought=g.state().items.find(x=>x.id===npc.item.id);
  assert(bought&&bought.wearGrade===3);
  g.run('save()');
  const reopened=boot(g.store);
  assert.equal(reopened.state().items.find(x=>x.id===npc.item.id).wearGrade,3);
  assert.equal(reopened.state().items.find(x=>x.id==='scuffed-keep').wearGrade,4);
});
test('0.5.0 old backups import; invalid grade and case condition are rejected',()=>{
  const g=boot();
  g.run("s.items.push({id:'grade-test',kind:'weapon',weapon:'MP5',tier:1,base:20,wearGrade:3})");
  const current=g.state();
  assert.equal(g.run('safeUpload('+JSON.stringify(current)+')'),true);
  for(const bad of [-1,5,1.5,'3',null]){
    const tampered=JSON.parse(JSON.stringify(current));
    tampered.items.at(-1).wearGrade=bad;
    assert.equal(g.run('safeUpload('+JSON.stringify(tampered)+')'),false);
  }
  const stale=JSON.parse(JSON.stringify(current));
  delete stale.items.at(-1).wearGrade;
  delete stale.wearSchemaVersion;
  assert.equal(g.run('safeUpload('+JSON.stringify(stale)+')'),true);
  const caseWithGrade=JSON.parse(JSON.stringify(current));
  caseWithGrade.items.push({id:'illegal-case',kind:'case',paid:25,wearGrade:0});
  assert.equal(g.run('safeUpload('+JSON.stringify(caseWithGrade)+')'),false);
  const invalidSchema=JSON.parse(JSON.stringify(current));
  invalidSchema.wearSchemaVersion=999;
  assert.equal(g.run('safeUpload('+JSON.stringify(invalidSchema)+')'),false);
  g.run("go('Market')");
  const npcTampered=g.state();
  const target=npcTampered.market.npcListings.find(x=>x.item.kind==='weapon');
  target.item.wearGrade=7;
  assert.equal(g.run('safeUpload('+JSON.stringify(npcTampered)+')'),false);
});


test('0.5.1 wear roll has fixed 8/22/40/22/8 boundaries without touching rarity',()=>{
  const g=boot();
  const pairs=[
    [0,0],[.079999,0],[.08,1],[.299999,1],[.3,2],[.699999,2],
    [.7,3],[.919999,3],[.92,4],[.999999,4],[1,4],[-1,0]
  ];
  for(const [fraction,grade] of pairs){
    assert.equal(g.run('window.LootHubWear.rollGrade(()=>'+fraction+')'),grade,
      'Wear grade at cumulative threshold '+fraction);
  }
  assert.deepEqual(JSON.parse(g.run('JSON.stringify(window.LootHubWear.ROLL_WEIGHTS)')),[8,22,40,22,8]);
  const observed=JSON.parse(g.run('JSON.stringify((()=>{let found=[0,0,0,0,0];for(let i=0;i<10000;i++)found[window.LootHubWear.rollGrade(()=>(i+.5)/10000)]++;return found})())'));
  assert.deepEqual(observed,[800,2200,4000,2200,800],
    'Uniform sampling must produce exactly the published percentages');
  assert.deepEqual(JSON.parse(g.run('JSON.stringify(odds)')),[70,20,7.5,2,.5]);
  assert.equal(g.run('window.LootHubMarketCore.estimated({kind:"skin",base:320,wearGrade:4})'),176);
});
test('0.5.1 case drop grade is rolled separately from rarity and weapon template',()=>{
  const g=boot();
  // Three random draws: existing rarity threshold, catalog pick and independent condition.
  function reward(rarity,pick,wear){
    g.run('Math.random=(()=>{const v=['+[rarity,pick,wear].join(',')+'];let i=0;return ()=>v[i++%v.length]})()');
    return JSON.parse(g.run('JSON.stringify(roll())'));
  }
  const rarePristine=reward(.93,.05,.01);
  const rareScarred=reward(.93,.05,.99);
  assert.equal(rarePristine.tier,2);
  assert.equal(rareScarred.tier,rarePristine.tier);
  assert.equal(rareScarred.weapon,rarePristine.weapon);
  assert.equal(rarePristine.wearGrade,0);
  assert.equal(rareScarred.wearGrade,4);
  const commonScarred=reward(.01,.05,.99);
  assert.equal(commonScarred.tier,0);
  assert.equal(commonScarred.wearGrade,4);
  assert.notEqual(commonScarred.weapon,rareScarred.weapon);
  const legendaryWorn=reward(.999,.99,.75);
  assert.equal(legendaryWorn.tier,4);
  assert.equal(legendaryWorn.wearGrade,3);
  assert(legendaryWorn.kind==='weapon'||legendaryWorn.kind==='skin');
});
test('0.5.1 new NPC listings roll grade once while cases stay grade-free',()=>{
  const g=boot();
  g.run("go('Market')");
  const current=g.state().market.npcListings.map(x=>({id:x.id,ask:x.ask,grade:x.item.wearGrade}));
  // Existing stocked listings remain unchanged even when a refreshed market is checked.
  g.run('window.LootHubNPCMarket.refreshNpcMarket(s,dropCatalog,Date.now(),()=>.99)');
  assert.deepEqual(g.state().market.npcListings.map(x=>({id:x.id,ask:x.ask,grade:x.item.wearGrade})),current);
  const later=Date.now()+5*24*3600000;
  const refresh=JSON.parse(g.run('JSON.stringify(window.LootHubNPCMarket.refreshNpcMarket(s,dropCatalog,'+later+',()=>.99))'));
  assert(refresh.added>0);
  const offers=g.state().market.npcListings;
  assert(offers.length>0);
  assert(offers.some(x=>x.item.kind==='case'&&!Object.hasOwn(x.item,'wearGrade')));
  assert(offers.some(x=>x.item.kind==='weapon'&&x.item.wearGrade===4));
  assert(offers.some(x=>x.item.kind==='skin'&&x.item.wearGrade===4));
  const before=offers.map(x=>({id:x.item.id,wear:x.item.wearGrade}));
  g.run('window.LootHubWear.ensureGame(s)');
  assert.deepEqual(g.state().market.npcListings.map(x=>({id:x.item.id,wear:x.item.wearGrade})),before);
  assert.equal(g.run('safeUpload(JSON.parse(JSON.stringify(s)))'),true);
});
test('0.5.1 condition is not rerolled by transfers, imports, repeated calls or old save migration',()=>{
  const g=boot();
  g.run("const special={id:'one-time-scarred',kind:'skin',weapon:'MAC-10',skin:'Red Devil',base:1800,tier:4};window.LootHubWear.assignRolled(special,()=>.99);s.items.push(special)");
  assert.equal(g.state().items[0].wearGrade,4);
  assert.equal(g.run('window.LootHubWear.assignRolled(s.items[0],()=>0)'),false);
  assert.equal(g.state().items[0].wearGrade,4);
  const base=g.state().items[0].base;
  g.run("window.LootHubMarketTransactions.createListing(s,'one-time-scarred',2000,Date.now());save()");
  assert.equal(g.state().listings[0].item.wearGrade,4);
  assert.equal(g.state().listings[0].item.base,base);
  const restored=boot(g.store);
  assert.equal(restored.state().listings[0].item.wearGrade,4);
  restored.run("window.LootHubMarketTransactions.cancelListing(s,'listing-one-time-scarred');save()");
  assert.equal(restored.state().items[0].wearGrade,4);
  const previous=restored.state();
  delete previous.items[0].wearGrade;
  restored.store.setItem(KEY,JSON.stringify(previous));
  const legacy=boot(restored.store);
  assert.equal(legacy.state().items[0].wearGrade,0,
    'Missing grades from old saves receive stable pristine condition, never a random draw');
  legacy.run('save()');
  const migrated=boot(legacy.store);
  assert.equal(migrated.state().items[0].wearGrade,0);
  assert.equal(migrated.state().items[0].base,base);
});


test('0.5.2 grade multipliers adjust estimates while base values and case odds stay intact',()=>{
  const g=boot();
  const expected=[100,95,85,70,55];
  assert.deepEqual(JSON.parse(g.run('JSON.stringify(window.LootHubWear.VALUE_MULTIPLIERS)')),
    [1,.95,.85,.7,.55]);
  for(let grade=0;grade<5;grade++){
    const item={kind:'weapon',weapon:'AK-47',base:100,tier:2,wearGrade:grade};
    assert.equal(g.run('window.LootHubMarketCore.baseEstimated('+JSON.stringify(item)+')'),100);
    assert.equal(g.run('window.LootHubMarketCore.estimated('+JSON.stringify(item)+')'),expected[grade]);
    const info=JSON.parse(g.run('JSON.stringify(window.LootHubEconomy.priceInfo(s,'+JSON.stringify({...item,id:'test-'+grade})+'))'));
    assert.equal(info.originalBase,100);
    assert.equal(info.base,expected[grade]);
    assert.equal(info.wearMultiplier,g.run('window.LootHubWear.multiplier('+JSON.stringify(item)+')'));
  }
  assert.equal(g.run('window.LootHubMarketCore.estimated({kind:"weapon",base:8,wearGrade:2})'),7);
  assert.equal(g.run('window.LootHubMarketCore.estimated({kind:"weapon",base:1,wearGrade:4})'),1);
  assert.equal(g.run('window.LootHubMarketCore.estimated({kind:"case",base:25})'),25);
  assert.equal(g.run('window.LootHubMarketCore.estimated({kind:"case",base:25,wearGrade:4})'),25);
  assert.deepEqual(JSON.parse(g.run('JSON.stringify(odds)')),[70,20,7.5,2,.5]);
  assert.equal(g.run('approvedSkins.length'),10);
});
test('0.5.2 inventory and inspections display exact grade, modifier, base, condition and market price',()=>{
  const g=boot();
  g.run("s.items.push({id:'mp5-graded',kind:'weapon',weapon:'MP5',tier:0,base:8,wearGrade:2})");
  g.run("s.items.push({id:'pristine-owned',kind:'weapon',weapon:'AK-47',tier:2,base:100,wearGrade:0})");
  g.run("s.items.push({id:'sealed-owned',kind:'case',paid:25})");
  let inventory=g.run('inventory()');
  assert(inventory.includes('Condition: Field-Tested'));
  assert(inventory.includes('Condition: Pristine'));
  assert(inventory.includes('Sealed case · No condition'));
  assert(inventory.includes('data-wear-grade="2"'));
  g.run("inspect('mp5-graded')");
  const dialog=g.byId('overlay').innerHTML;
  for(const label of ['Field-Tested','Base value (Pristine)','8 coins','Wear modifier',
    '0.85×','Condition-adjusted value','7 coins','Estimated market value']){
    assert(dialog.includes(label),'Missing condition breakdown label: '+label);
  }
  g.run("inspect('pristine-owned')");
  assert(g.byId('overlay').innerHTML.includes('1.00×'));
  g.run("inspect('sealed-owned')");
  assert(g.byId('overlay').innerHTML.includes('No wear grade'));
  assert(!g.byId('overlay').innerHTML.includes('0.85×'));
});
test('0.5.2 NPC asking prices depend on wear, while existing asks and transfers remain unchanged',()=>{
  const g=boot();
  g.run("go('Market')");
  const listing=g.state().market.npcListings.find(l=>l.item.kind==='weapon');
  assert(listing);
  const before=g.state().market.npcListings.find(l=>l.id===listing.id).ask;
  g.run("s.market.npcListings.find(l=>l.id==="+JSON.stringify(listing.id)+").item.wearGrade=4");
  const info=JSON.parse(g.run("JSON.stringify(window.LootHubEconomy.priceInfo(s,s.market.npcListings.find(l=>l.id==="+JSON.stringify(listing.id)+").item))"));
  assert.equal(info.base,Math.max(1,Math.round(info.originalBase*.55)));
  assert.equal(g.state().market.npcListings.find(l=>l.id===listing.id).ask,before,
    'Existing NPC asking prices must not be rewritten');
  const screen=g.run('renderNpcMarketResults()');
  assert(screen.includes('Condition: Battle-Scarred'));
  g.run('inspectNpcListing('+JSON.stringify(listing.id)+')');
  assert(g.byId('overlay').innerHTML.includes('0.55×'));
  g.run('s.coins=100000');
  g.run('window.LootHubMarketTransactions.buyNpcListing(s,'+JSON.stringify(listing.id)+')');
  const bought=g.state().items.find(x=>x.id===listing.item.id);
  assert(bought&&bought.wearGrade===4&&bought.paid===before);
  assert.equal(bought.base,listing.item.base);
});
test('0.5.2 condition affects instant sale, listing estimates and counteroffer baselines',()=>{
  const g=boot();
  g.run("s.items.push({id:'wear-pristine',kind:'weapon',weapon:'AK-47',tier:2,base:100,wearGrade:0})");
  g.run("s.items.push({id:'wear-scarred',kind:'weapon',weapon:'AK-47',tier:2,base:100,wearGrade:4})");
  assert.equal(g.run('window.LootHubMarketCore.estimated(s.items[0])'),100);
  assert.equal(g.run('window.LootHubMarketCore.estimated(s.items[1])'),55);
  g.run("inspect('wear-scarred')");
  assert(g.byId('overlay').innerHTML.includes('Instant sell (43)'));
  g.run("sellOffer('wear-scarred')");
  assert(g.byId('overlay').innerHTML.includes('55 coins'));
  g.run("listItem('wear-scarred')");
  assert(g.byId('overlay').innerHTML.includes('Condition-adjusted value'));
  assert(g.byId('overlay').innerHTML.includes('0.55×'));
  g.byId('listPrice').value='64';
  g.run("submitListing('wear-scarred')");
  assert.equal(g.state().listings[0].ask,64);
  assert.equal(g.state().listings[0].item.wearGrade,4);
  assert(g.run('enhancedMarket()').includes('Condition: Battle-Scarred'));
  const beforeAsk=g.state().listings[0].ask;
  g.run('save()');
  const reloaded=boot(g.store);
  assert.equal(reloaded.state().listings[0].ask,beforeAsk);
  assert.equal(reloaded.state().listings[0].item.wearGrade,4);
  assert.equal(reloaded.state().items.find(x=>x.id==='wear-pristine').wearGrade,0);
});
test('0.5.2 case-opening reveal reports its rolled grade and adjusted value',()=>{
  const g=boot();
  g.run("s.items.push({id:'case-for-reveal',kind:'case',paid:25})");
  g.run("openCase('case-for-reveal')");
  const reward=g.state().items[0];
  const condition=JSON.parse(g.run('JSON.stringify(window.LootHubWear.label(s.items[0].wearGrade))'));
  g.run('finishOpening()');
  const html=g.byId('overlay').innerHTML;
  assert(html.includes('Condition: '+condition));
  assert(html.includes('Condition-adjusted value'));
  assert(html.includes('Wear modifier'));
  assert(html.includes('Estimated market value'));
  assert.equal(g.state().items[0].wearGrade,reward.wearGrade);
});

test('0.5.3 procedural wear plans are deterministic, bounded and progressively denser',()=>{
  const g=boot();
  const grade0=JSON.parse(g.run('JSON.stringify(window.LootHubWearRenderer.pattern("mp5-test",0))'));
  assert.deepEqual(grade0,[],'Pristine never receives a visual texture');
  const sizes=[];
  for(let grade=1;grade<=4;grade++){
    const a=JSON.parse(g.run('JSON.stringify(window.LootHubWearRenderer.pattern("mp5-test",'+grade+'))'));
    const b=JSON.parse(g.run('JSON.stringify(window.LootHubWearRenderer.pattern("mp5-test",'+grade+'))'));
    assert.deepEqual(a,b,'Repeated renders must return the same scratches and grime');
    assert(a.every(x=>x.x>=0&&x.x<1&&x.y>=0&&x.y<1));
    assert(a.some(x=>x.kind==='scratch')&&a.some(x=>x.kind==='dirt'));
    assert.equal(a.filter(x=>x.kind==='rust').length,grade===1?0:[0,0,8,19,35][grade]);
    sizes.push(a.length);
  }
  assert(sizes.every((n,i)=>i===0||n>sizes[i-1]),'Higher wear grades need more texture marks');
  const a=JSON.parse(g.run('JSON.stringify(window.LootHubWearRenderer.pattern("mp5-test",4))'));
  const b=JSON.parse(g.run('JSON.stringify(window.LootHubWearRenderer.pattern("different-item",4))'));
  assert.notDeepEqual(a,b,'Each collectible identity gets a different permanent pattern');
  assert.equal(g.run('window.LootHubWearRenderer.MAX_PIXELS'),1100);
});
test('0.5.3 high resolution inspections opt into silhouette masked renderer without modifying originals',()=>{
  const g=boot();
  const item={id:'special-wear-seed',kind:'weapon',weapon:'Glock-18',tier:0,base:8,wearGrade:4};
  const html=g.run('visualArt('+JSON.stringify(item)+',"inspect")');
  assert(html.includes('data-weapon-model="Glock-18"'));
  // The VM unit harness loads only the five standalone masters; the live
  // browser uses MP5's neutral raster from the approved art asset scripts.
  assert(html.includes('data-wear-seed="special-wear-seed"'));
  assert(html.includes('data-wear-grade="4"'));
  assert(html.includes('glock-18-neutral-1600.webp'));
  assert(html.includes('data-resolution="1600"'));
  const pristine=g.run('visualArt('+JSON.stringify({...item,wearGrade:0})+',"inspect")');
  assert(pristine.includes('data-wear-grade="0"'));
  assert.equal(g.run('visualArt('+JSON.stringify(item)+',"inventory")').includes('data-wear-seed="special-wear-seed"'),true,
    'Inventory weapons must carry their saved grade and seed');
  assert.equal(g.run('visualArt('+JSON.stringify(item)+',"reel")').includes('data-wear-seed="special-wear-seed"'),true,
    'Case-opening reels must carry the saved prize grade and seed');
  const skin={id:'original-approved-skin',kind:'skin',weapon:'MAC-10',skin:'Red Devil',tier:4,base:1800,wearGrade:3};
  g.run('window.LootHubSkinArt={"MAC-10|Red Devil":{"1600":"dummy-browser-image"}}');
  const skinHtml=g.run('visualArt('+JSON.stringify(skin)+',"inspect")');
  assert(skinHtml.includes('data-wear-grade="3"')&&skinHtml.includes('data-art-status="approved-skin"'));
  assert.equal(g.run('window.LootHubMarketCore.estimated('+JSON.stringify(item)+')'),4,
    'New visual engine must not change already-applied wear valuations');
  assert.equal(g.run('window.LootHubWearRenderer.attach(null)'),0,
    'Renderer must be safe for nonbrowser test harnesses');
});

test('0.5.4 wear metadata follows every context while catalog templates, cases and Pristine remain safe',()=>{
  const g=boot();
  const item={id:'worn-glock',kind:'weapon',weapon:'Glock-18',tier:0,base:7,wearGrade:4};
  for(const context of ['inventory','inspect','reel','market']){
    const html=g.run('visualArt('+JSON.stringify(item)+','+JSON.stringify(context)+')');
    assert(html.includes('data-wear-grade="4"'));
    assert(html.includes('data-wear-seed="worn-glock"'));
    assert(html.includes('glock-18-neutral-'+(context==='inspect'?1600:context==='reel'?400:800)+'.webp'));
    assert(!html.includes('data-finish='));
  }
  const pristine=g.run('visualArt('+JSON.stringify({...item,wearGrade:0})+',"inventory")');
  assert(pristine.includes('data-wear-grade="0"'));
  assert.equal(g.run('visualArt({kind:"case",id:"sealed-keep"}, "reel")').includes('data-wear-seed='),false);
  assert.equal(g.run('visualArt({kind:"weapon",weapon:"Glock-18",tier:0,base:7},"inventory")').includes('data-wear-grade='),false,
    'Catalog display art is not a persisted collectible and must not have fake wear');
  assert.equal(g.run('window.LootHubWearRenderer.attach(null)'),0);
  assert.equal(g.run('window.LootHubWearRenderer.release(null)'),0);
});
test('0.5.4 main render and dynamic market filters preserve saved wear and never change odds',()=>{
  const g=boot();
  g.run('s.items.push({id:"wear-grade-inv",kind:"weapon",weapon:"Glock-18",tier:0,base:8,wearGrade:3})');
  const before=g.state();
  g.run("go('Inventory')");
  assert(g.byId('main').innerHTML.includes('data-wear-seed="wear-grade-inv"'));
  g.run("document.getElementById('filter').value='Common';filterInv()");
  assert(g.byId('inventoryGrid').innerHTML.includes('data-wear-grade="3"'));
  g.run("go('Market')");
  const market=g.byId('main').innerHTML;
  const npc=g.state().market.npcListings.find(l=>l.item.kind!=='case');
  assert(market.includes('data-wear-seed="'+npc.item.id+'"'));
  const beforeGrades=g.state().market.npcListings.map(x=>x.item.wearGrade);
  g.run('updateNpcMarketFilter("kind","weapon")');
  assert(g.byId('npcMarketResults').innerHTML.includes('data-wear-grade='));
  assert.deepEqual(g.state().market.npcListings.map(x=>x.item.wearGrade),beforeGrades);
  assert.equal(g.state().items[0].id,'wear-grade-inv');
  assert.equal(g.state().items[0].wearGrade,3);
  assert.deepEqual(JSON.parse(g.run('JSON.stringify(odds)')),[70,20,7.5,2,.5]);
});
test('0.5.4 the 48 reel entries have transient cosmetic preview grades but award stays unchanged',()=>{
  const g=boot();
  g.run('s.items.push({id:"case-reel-0.5.4",kind:"case",paid:25})');
  g.run('openCase("case-reel-0.5.4")');
  const reward=g.state().items[0];
  const html=g.byId('overlay').innerHTML;
  assert.equal((html.match(/data-reel-index=/g)||[]).length,48);
  assert.equal((html.match(/data-wear-seed=/g)||[]).length,48);
  assert(html.includes('data-wear-seed="'+reward.id+'"'));
  assert(html.includes('data-wear-grade="'+reward.wearGrade+'"'));
  assert(html.includes('data-wear-seed="reel-preview-0-'));
  assert.equal(g.state().items.length,1,'Preview reel entries cannot enter inventory');
  assert.equal(g.state().items[0].id,reward.id);
  assert(!g.state().items[0].id.startsWith('reel-preview-'));
  g.run('finishOpening()');
  assert(g.byId('overlay').innerHTML.includes('data-wear-seed="'+reward.id+'"'));
  assert.equal(g.state().items[0].wearGrade,reward.wearGrade);
  assert(!JSON.stringify(g.state()).includes('reel-preview-'));
});

test('Material profiles and paint masks exist for all live masters',()=>{
 const p=JSON.parse(fs.readFileSync(path.join(root,'assets/skin-lines/paint-profiles.json'),'utf8'));
 assert.equal(Object.keys(p.weapons).length,MASTER_COUNT);
 const g=boot();
 assert.deepEqual(JSON.parse(g.run('JSON.stringify(window.LootHubPaintProfiles)')),p);
 const names=JSON.parse(g.run('JSON.stringify(window.LootHubSkinLines.modelSlugs)'));
 assert.equal(Object.keys(names).length,MASTER_COUNT);
 for(const [weapon,slug] of Object.entries(names)){
   assert(p.weapons[slug],'Missing profile '+weapon);
   const expected='./assets/skin-lines/masks/'+slug+'--paint-main-1600.png';
   assert.equal(g.run('window.LootHubWearMaterials.maskPath('+JSON.stringify(weapon)+')'),expected);
   const png=fs.readFileSync(path.join(root,expected.slice(2)));
   assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');
   const w=p.weapons[slug].wear;
   assert.equal(typeof w.reviewed,'boolean');
   for(const key of ['metalRects','woodRects','polymerRects','protectedRects'])assert(Array.isArray(w[key]));
 }
 assert.equal(g.run('window.LootHubWearMaterials.maskPath("Invalid Gun")'),null);
});
test('0.5.5a material classifier never infers rust-safe metal merely from paint',()=>{
 const g=boot(),api='window.LootHubWearMaterials';
 const initial=JSON.parse(g.run('JSON.stringify('+api+'.eligibility("AK-47",.95,.95,1))'));
 assert.equal(initial.material,'other');
 assert.equal(initial.rust,false,'Paint may cover wood or polymer');
 assert.equal(initial.finishWear,true);
 assert.equal(g.run(api+'.materialAt("AWP",.4,.25,1)'),'protected',
   'Inherit existing protected scope rectangles from skin-line profile');
 assert.equal(g.run(api+'.eligibility("AWP",.4,.25,1).scratch'),false);
 const profile='window.LootHubPaintProfiles.weapons["ak-47"].wear';
 g.run(profile+'.woodRects.push([.2,.2,.4,.4])');
 g.run(profile+'.polymerRects.push([.7,.75,.9,.9])');
 g.run(profile+'.metalRects.push([.85,.5,.95,.65])');
 g.run(profile+'.protectedRects.push([.1,.1,.2,.2])');
 assert.equal(g.run(api+'.materialAt("AK-47",.3,.3,1)'),'wood');
 assert.equal(g.run(api+'.eligibility("AK-47",.3,.3,1).rust'),false);
 assert.equal(g.run(api+'.eligibility("AK-47",.3,.3,1).finishWear'),false);
 assert.equal(g.run(api+'.materialAt("AK-47",.8,.8,1)'),'other');
 assert.equal(g.run(api+'.eligibility("AK-47",.8,.8,1).rust'),false);
 assert.equal(g.run(api+'.materialAt("AK-47",.9,.6,0)'),'metal');
 assert.equal(g.run(api+'.eligibility("AK-47",.9,.6,0).rust'),true);
 assert.equal(g.run(api+'.materialAt("AK-47",.15,.15,1)'),'protected');
 assert.equal(g.run(api+'.eligibility("AK-47",.15,.15,1).grime'),false);
 assert.equal(g.run(api+'.eligibility("Invalid",.5,.5,1).rust'),false);
});
test('0.5.5a mask sampling reads paint opacity without trusting transparent pixels',()=>{
 const g=boot();
 const vals=JSON.parse(g.run('JSON.stringify((()=>{'+
   'const d=Uint8ClampedArray.from([255,255,255,255,128,128,128,255,255,255,255,0,0,0,0,255]);'+
   'return [window.LootHubWearMaterials.sample(d,2,2,0,0),'+
   'window.LootHubWearMaterials.sample(d,2,2,1,0),'+
   'window.LootHubWearMaterials.sample(d,2,2,0,1),'+
   'window.LootHubWearMaterials.sample(d,2,2,1,1),'+
   'window.LootHubWearMaterials.sample(d,2,2,-1,.5)]})())'));
 assert.equal(vals[0],1);
 assert(Math.abs(vals[1]-128/255)<.001);
 assert.deepEqual(vals.slice(2),[0,0,0]);
 const item={id:'metal-map-id',kind:'weapon',weapon:'AK-47',tier:2,base:100,wearGrade:4};
 for(const ctx of ['inventory','reel','inspect']){
  const art=g.run('visualArt('+JSON.stringify(item)+','+JSON.stringify(ctx)+')');
  assert(art.includes('data-paint-mask="./assets/skin-lines/masks/ak-47--paint-main-1600.png"'));
  assert(art.includes('data-wear-seed="metal-map-id"'));
 }
 assert.equal(g.run('window.LootHubMarketCore.estimated('+JSON.stringify(item)+')'),55);
 assert.equal(g.run('window.LootHubWearMaterials.MAX_DECODED'),6);
});


test('0.5.5a material maps fully cover every weapon silhouette, one surface per pixel',()=>{
  const g=boot(),p=JSON.parse(fs.readFileSync(path.join(root,'assets/skin-lines/paint-profiles.json'),'utf8'));
  assert.equal(Object.keys(p.weapons).length,MASTER_COUNT);
  for(const slug of Object.keys(p.weapons)){
    const base=path.join(root,'assets/skin-lines/materials',slug);
    for(const suffix of ['--silhouette-1600.png','--material-1600.png']){
      const name=base+suffix;
      assert(fs.existsSync(name),'Missing generated full-coverage map '+name);
      assert.equal(fs.readFileSync(name).toString('hex',0,8),'89504e470d0a1a0a');
    }
  }
  for(const weapon of ['AK-47','Glock-18','M1 Garand','Mosin-Nagant','FN FAL','RPG-7']){
    const masks=JSON.parse(g.run('JSON.stringify(({a:window.LootHubWearMaterials.materialPath('+JSON.stringify(weapon)+'),'+
      'b:window.LootHubWearMaterials.silhouettePath('+JSON.stringify(weapon)+')}))'));
    assert(masks.a.includes('--material-1600.png'));
    assert(masks.b.includes('--silhouette-1600.png'));
  }
  const pixels=JSON.parse(g.run('JSON.stringify((()=>{'+
    'const rgba=Uint8ClampedArray.from([255,0,0,255,0,255,0,255,0,0,255,255,0,0,0,0]);'+
    'return [0,.3,.6,1].map(x=>window.LootHubWearMaterials.sampleMaterial(rgba,4,1,x,0))})())'));
  assert.deepEqual(pixels,['metal','wood','other','outside']);
  assert.equal(g.run('window.LootHubWearMaterials.eligibility("wood",.5,.5,1).rust'),false);
  assert.equal(g.run('window.LootHubWearMaterials.eligibility("other",.5,.5,1).rust'),false);
  assert.equal(g.run('window.LootHubWearMaterials.eligibility("metal",.5,.5,1).rust'),true);
  assert.equal(g.run('window.LootHubWearMaterials.eligibility("outside",.5,.5,1).rust'),false);
});


test('0.5.5b material-specific weathering has distinct grade compositions',()=>{
 const g=boot();
 const r='window.LootHubWearRenderer';
 const limits=JSON.parse(g.run('JSON.stringify('+r+'.LIMITS)'));
 assert.equal(limits.length,5);
 assert.deepEqual(limits[0],{scratch:0,dirt:0,rust:0,chip:0,fade:0});
 assert.equal(limits[1].rust,0,'Lightly Worn should have no corrosion whatsoever');
 for(let grade=1;grade<=4;grade++){
   const actual=JSON.parse(g.run('JSON.stringify('+r+'.pattern("ak47-grade-proof",'+grade+'))'));
   const kinds=['scratch','dirt','rust','chip','fade'];
   assert.deepEqual(Object.fromEntries(kinds.map(kind=>[kind,actual.filter(x=>x.kind===kind).length])),limits[grade]);
   const second=JSON.parse(g.run('JSON.stringify('+r+'.pattern("ak47-grade-proof",'+grade+'))'));
   assert.deepEqual(actual,second,'The same item grade must reproduce identical marks');
   if(grade>1){
     for(const kind of kinds)assert(limits[grade][kind]>=limits[grade-1][kind],
       kind+' needs progressively stronger representation');
   }
 }
 assert(!g.run('JSON.stringify('+r+'.pattern("skin-a",4))===JSON.stringify('+r+'.pattern("skin-b",4))'));
});
test('0.5.5b pixel-level rust never reaches wood, other or protected material',()=>{
 const g=boot(),p=JSON.parse(g.run('JSON.stringify((()=>{'+
    'const api=window.LootHubWearRenderer,ma=window.LootHubWearMaterials;'+
    'const mk=()=>{const bytes=new Uint8ClampedArray(16);'+
    'for(let i=0;i<4;i++)bytes[i*4+3]=220;'+
    'return {getImageData:()=>({data:bytes}),putImageData:r=>{},bytes}};'+
    'const mat={width:4,height:1,pixels:Uint8ClampedArray.from(['+
    '255,0,0,255, 0,255,0,255, 0,0,255,255, 255,0,0,255])};'+
    'const finish={width:4,height:1,pixels:Uint8ClampedArray.from(['+
    '255,255,255,255, 255,255,255,255, 255,255,255,255, 255,255,255,255])};'+
    'const fake={getProfile:()=>({protectedRects:[[.75,0,1,1]],wear:{protectedRects:[]}}),inRects:ma.inRects};'+
    'const results={};'+
    'for(const kind of ["rust","chip","scratch","dirt","fade"]){'+
    'const ctx=mk();api.maskLayer(ctx,4,1,kind,{x:0,y:0,w:4,h:1},mat,finish,"AK-47",fake);'+
    'results[kind]=Array.from([ctx.bytes[3],ctx.bytes[7],ctx.bytes[11],ctx.bytes[15]])}'+
    'const noMaterial=mk();api.maskLayer(noMaterial,4,1,"rust",{x:0,y:0,w:4,h:1},null,finish,"AK-47",fake);'+
    'results.missing=Array.from([noMaterial.bytes[3],noMaterial.bytes[7],noMaterial.bytes[11],noMaterial.bytes[15]]);'+
    'return results})())'));
 assert.deepEqual(p.rust,[220,0,0,0],'Metal-only rust must never affect wood/other/protected');
 assert.deepEqual(p.chip,[220,0,0,0],'Metal finish chips must not appear on wood/other');
 assert.deepEqual(p.scratch,[220,110,154,0],'Wood scuffs must be softer than metal; protected absent');
 assert.deepEqual(p.dirt,[220,194,220,0]);
 assert.equal(p.fade[1],Math.round(220*.18),'Wood fade is subtle');
 assert.deepEqual(p.missing,[0,0,0,0],'If material map fails to load, rust is completely disabled');
});
test('0.5.5b source alpha and wear grade remain independent of prices or saved data',()=>{
 const g=boot();
 const item={id:'iron-and-wood',kind:'weapon',weapon:'AK-47',tier:2,base:100,wearGrade:4};
 const state=g.state();
 const art=g.run('visualArt('+JSON.stringify(item)+',"inspect")');
 assert(art.includes('data-material-mask="./assets/skin-lines/materials/ak-47--material-1600.png"'));
 assert(art.includes('data-paint-mask="./assets/skin-lines/masks/ak-47--paint-main-1600.png"'));
 assert.equal(g.run('window.LootHubMarketCore.estimated('+JSON.stringify(item)+')'),55);
 assert.equal(g.run('window.LootHubWearRenderer.paint.length'),4);
 assert.equal(g.run('window.LootHubWearRenderer.attach(null)'),0);
 assert.equal(g.run('window.LootHubWearRenderer.release(null)'),0);
 assert.deepEqual(g.state(),state);
 assert.deepEqual(JSON.parse(g.run('JSON.stringify(odds)')),[70,20,7.5,2,.5]);
});


test('All registered weapons have anchored semantic profiles, preserving legacy drafts',()=>{
 const p=JSON.parse(fs.readFileSync(path.join(root,'assets/skin-lines/paint-profiles.json'),'utf8'));
 const anchors=JSON.parse(fs.readFileSync(path.join(root,'assets/skin-lines/material-landmarks.json'),'utf8'));
 const items=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8')).items;
 const slugs=items.map(x=>x.modelSlug||x.id.replace(/--base$/,''));
 assert.equal(anchors.schemaVersion,1);
 assert.equal(slugs.length,MASTER_COUNT);
 assert.deepEqual(Object.keys(anchors.weapons).sort(),slugs.slice().sort());
 let landmarks=0;
 for(const slug of slugs){
   const profile=p.weapons[slug],points=anchors.weapons[slug];
   assert(profile&&profile.wear,'Missing material profile '+slug);
   assert(['unreviewed-draft','refined-draft','owner-reviewed'].includes(profile.wear.reviewStatus));
   assert.equal(profile.wear.reviewed,profile.wear.reviewStatus==='owner-reviewed');
   assert(points.length>=2,'Need at least two visible source reference landmarks for '+slug);
   for(const [kind,x,y] of points){
     assert(['metal','wood','other'].includes(kind),'Invalid material kind '+slug);
     assert(Number.isFinite(x)&&x>0&&x<1&&Number.isFinite(y)&&y>0&&y<1,
       'Invalid source coordinate in '+slug);
     landmarks++;
   }
 }
 assert(landmarks>=55,'All weapon types must carry meaningful sample points');
 const g=boot();
 assert.deepEqual(JSON.parse(g.run('JSON.stringify(window.LootHubPaintProfiles.weapons.awp.protectedRects)')),
   p.weapons.awp.protectedRects);
 assert.equal(g.run('window.LootHubWearMaterials.materialAt("AWP",.4,.25,1)'),'protected');
 assert.equal(g.run('window.LootHubMarketCore.estimated({kind:"weapon",base:100,wearGrade:4})'),55);
});


test('0.5.8 synthesized feedback is gesture-only, muteable, save-safe and deterministic',()=>{
  const store=new LocalStore();
  const g=boot(store);
  assert.equal(g.run('window.LootHubFX.isMuted()'),false);
  assert(html.includes('id="soundToggle"'),'Accessible sound setting is missing');
  assert(html.includes('aria-label="Toggle interface sounds"'));
  assert.equal(g.run('window.LootHubFX.reelIndex(-120,240,120)'),2);
  assert.equal(g.run('window.LootHubFX.reelIndex(0,240,120)'),1);
  assert.equal(g.run('window.LootHubFX.play("tap")'),false,
    'A browser without Web Audio should degrade without throwing');
  g.run('toggleSound()');
  assert.equal(g.run('window.LootHubFX.isMuted()'),true);
  assert.equal(g.persisted().preferences.fxMuted,true);
  const reload=boot(store);
  assert.equal(reload.run('window.LootHubFX.isMuted()'),true,
    'Reload must restore a muted preference without auto-playing audio');
  reload.run('window.AudioContext=class {constructor(){this.currentTime=1;this.state="running";this.destination={}}'+
    'createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}'+
    'createOscillator(){return {frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},'+
    'connect(){},start(){window.__testSounds=(window.__testSounds||0)+1},stop(){}}}}');
  assert.equal(reload.run('window.LootHubFX.play("navigate")'),false,'Muted audio must never start');
  assert.equal(reload.run('window.__testSounds||0'),0);
  reload.run('toggleSound()');
  assert.equal(reload.run('window.LootHubFX.isMuted()'),false);
  assert(reload.run('window.__testSounds||0')>0,'Unmuting after user gesture should play one cue');
  const before=reload.run('window.__testSounds');
  reload.run('go("Cases")');
  assert(reload.run('window.__testSounds')>before,'Navigation must produce its own cue');
  reload.run('window.LootHubFX.play("reveal",{tier:4})');
  assert(reload.run('window.__testSounds')>before+1,'Legendary reveal should have a richer audio cue');
  assert.equal(reload.persisted().preferences.fxMuted,false);
  assert.deepEqual(JSON.parse(reload.run('JSON.stringify(odds)')),[70,20,7.5,2,.5],
    'Feedback must never touch published rarity odds');
});
test('0.5.8 spin and reward UI never alter existing saved drops or item identities',()=>{
  const g=boot();
  g.run("s.items.push({id:'fx-sealed',kind:'case',paid:25})");
  g.run("openCase('fx-sealed')");
  assert(g.byId('overlay').innerHTML.includes('class="reel-stage"'));
  assert(g.byId('overlay').innerHTML.includes('Skip animation'));
  const winner=g.state().items.find(x=>x.kind==='weapon'||x.kind==='skin');
  assert(winner&&winner.id,'Spin must immediately save the awarded item');
  const before=g.state().openings;
  g.run('finishOpening()');
  assert(g.byId('overlay').innerHTML.includes('class="reward-reveal rarity-'));
  assert(g.byId('overlay').innerHTML.includes('NEW ITEM ACQUIRED'));
  assert.equal(g.state().items.find(x=>x.id===winner.id).id,winner.id);
  assert.equal(g.state().openings,before,'Reveal must never issue an extra roll');
});


test('Cartel Case contains only five owner-supplied finishes and exactly one skin per rarity',()=>{
 const g=boot();
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
 const entries=manifest.approvedSkins.filter(x=>x.skin==='Cartel');
 assert.equal(manifest.items.length,MASTER_COUNT,'All neutral weapons must remain live');
 assert(MASTER_COUNT>=25,'The initial 25 neutral masters must be retained');
 assert.equal(entries.length,5);
 assert.deepEqual(entries.map(x=>[x.weapon,x.tier,x.baseValue]),[
  ['RPG-7',0,40],['12 Gauge Pump Shotgun',1,110],['AK-47',2,350],
  ['Desert Eagle',3,1050],['Tactical Machete',4,4200]]);
 assert.equal(g.run('cartelCase.casePrice'),75);
 assert.equal(g.run('cartelCatalog.length'),5);
 assert.equal(g.run('dropCatalog.length'),MASTER_COUNT+10,'The Arsenal drop pool must not be expanded');
 assert.equal(g.run('allMarketCatalog.length'),MASTER_COUNT+20,'Cartel and Spec Ops skins enter market listings');
 assert(g.run('universalCases()').includes('Cartel Case'));
 assert(g.run('universalCases()').includes('multi-qty-cartel'),'Cartel has working quantity-based purchasing');
 assert(g.run('universalCases()').includes('View five skins'));
 assert(g.run('visualArt({kind:"case",caseId:"cartel"})').includes('cartel-crate'));
 for(const [i,entry] of entries.entries()){
  const item={id:'cartel-check-'+i,kind:'skin',weapon:entry.weapon,
    skin:'Cartel',tier:entry.tier,base:entry.baseValue,wearGrade:3};
  assert.equal(g.run('isApprovedSkin('+JSON.stringify(item)+')'),true);
  assert.equal(g.run('itemName('+JSON.stringify(item)+')'),entry.displayName);
  const source=fs.readFileSync(path.join(root,entry.finishArt),'utf8');
  const w={};vm.runInNewContext(source,{window:w},{timeout:10000});
  const art=w.LootHubSkinArt[entry.weapon+'|Cartel'];
  assert(art,'Skin art missing '+entry.weapon);
  for(const size of ['400','800','1600']){
   const buf=Buffer.from(art[size],'base64');
   assert.equal(buf.toString('ascii',0,4),'RIFF');
   assert.equal(buf.toString('ascii',8,12),'WEBP');
   assert(buf.length>10000,'Cartel skin should have real art '+entry.weapon+' '+size);
  }
 }
 for(const [r,tier] of [[.01,0],[.80,1],[.94,2],[.985,3],[.999,4]]){
  const b=boot(new LocalStore(),()=>r);
  const prize=JSON.parse(b.run('JSON.stringify(roll("cartel"))'));
  assert.equal(prize.tier,tier);
  assert.equal(prize.kind,'skin');
  assert.equal(prize.skin,'Cartel');
  assert.equal(prize.paid,75);
 }
 const b=boot(new LocalStore(),()=>.999);
 b.run('s.coins=150;save();buyCartelCase()');
 const sealed=b.state().items[0];
 assert.equal(sealed.kind,'case');assert.equal(sealed.caseId,'cartel');
 assert.equal(sealed.paid,75);
 assert.equal(b.state().coins,75);
 const preservedId=sealed.id;
 b.run('openCase('+JSON.stringify(preservedId)+');finishOpening()');
 assert.equal(b.state().openings,1);
 assert.equal(b.state().items.length,1);
 assert.equal(b.state().items[0].skin,'Cartel');
 assert.equal(b.state().items[0].weapon,'Tactical Machete');
 const restored=boot(b.store);
 assert.equal(restored.state().items[0].kind,'skin');
 assert.equal(restored.state().items[0].skin,'Cartel');
 assert.equal(restored.run('isApprovedSkin(s.items[0])'),true);
 assert.equal(restored.state().items[0].id,b.state().items[0].id);
 assert.deepEqual(JSON.parse(restored.run('JSON.stringify(odds)')),[70,20,7.5,2,.5]);
});


test('Original closed and opened Arsenal photos replace placeholder crate without changing Cartel',()=>{
 const g=boot();
 const base='assets/cases/arsenal-case-';
 for(const pose of ['closed','open'])for(const pixels of [400,800,1254]){
  const p=path.join(root,base+pose+'-'+pixels+'.webp');
  const image=fs.readFileSync(p);
  assert(image.length>40000,p+' should retain real supplied art');
  assert.equal(image.toString('ascii',0,4),'RIFF',p);
  assert.equal(image.toString('ascii',8,12),'WEBP',p);
 }
 for(const [item,mode,pose,size] of [
  [{kind:'case'},'inventory','closed','800'],
  [{kind:'case',id:'sealed-art-1'},'inspect','closed','1254'],
  [{kind:'case'},'reel','closed','400'],
  [{kind:'case'},'open','open','1254']]){
  const art=g.run('visualArt('+JSON.stringify(item)+','+JSON.stringify(mode)+')');
  assert(art.includes('arsenal-case-'+pose+'-'+size+'.webp'),mode);
  assert(art.includes('data-art-status="owner-supplied-case"'));
  assert(art.includes('data-case-pose="'+pose+'"'));
  assert(!art.includes('<svg'),'Arsenal must use supplied real case assets');
 }
 assert(g.run('home()').includes('arsenal-case-closed-800.webp'));
 assert(g.run('cases()').includes('arsenal-case-closed-800.webp'));
 const css=fs.readFileSync(path.join(root,'design.css'),'utf8');
 assert(css.includes('.hero .case-art:has(.arsenal-case-image)'),
  'Shop must explicitly size the closed-case frame');
 assert(css.includes('height:clamp(235px,72vw,315px)'),
  'Shop should reserve enough mobile height for the entire square case image');
 assert(css.includes('.spin-pulse{animation:none;box-shadow:none}'),
  'Spinning animation must not have reward-specific pulsing glow');
 assert(css.includes('.arsenal-reward-display .arsenal-reward-weapon'),
  'Floating prize effect must be retained for the final reveal');
 const cartel=g.run('visualArt({kind:"case",caseId:"cartel"})');
 assert(cartel.includes('cartel-crate'),'Cartel artwork must stay separate');
 assert(!cartel.includes('arsenal-case-'));
 g.run('s.items.push({id:"case-art-open",kind:"case",paid:25})');
 g.run('openCase("case-art-open")');
 const spin=g.byId('overlay').innerHTML;
 assert(!spin.includes('arsenal-opening-prop'),'Opened case should never overlap the spinning reel');
 assert(!spin.includes('arsenal-case-open-1254.webp'),'Reserve the open crate for the winning reveal');
 assert(!spin.includes('arsenal-reward-display'),'Rarity reward effects must appear only after the spin');
 assert(spin.includes('id="track"'));
 const prizeId=g.state().items.find(x=>x.kind==='weapon'||x.kind==='skin')?.id;
 g.run('finishOpening()');
 const show=g.byId('overlay').innerHTML;
 assert(show.includes('arsenal-reward-display'));
 assert(show.includes('arsenal-reward-weapon'));
 assert(show.includes('arsenal-reward-crate'));
 assert(show.includes('arsenal-case-open-1254.webp'));
 assert.equal(g.state().items.find(x=>x.id===prizeId)?.id,prizeId,'Visual swap cannot reroll a prize');
 assert.equal(g.state().openings,1);
 const cart=boot();
 cart.run('s.items.push({id:"cartel-case-art-open",kind:"case",caseId:"cartel",paid:75})');
 cart.run('openCase("cartel-case-art-open")');
 assert(!cart.byId('overlay').innerHTML.includes('arsenal-opening-prop'));
 cart.run('finishOpening()');
 assert(cart.byId('overlay').innerHTML.includes('cartel-reward-display'));
 assert(cart.byId('overlay').innerHTML.includes('cartel-case-open-1254.webp'));
 assert(cart.state().items.some(x=>x.kind==='skin'&&x.skin==='Cartel'));
});


test('Cartel Case uses exact closed/open chest assets with reveal-only open pose',()=>{
 const g=boot();
 for(const pose of ['closed','open'])for(const size of [400,800,1254]){
  const file=path.join(root,'assets/cases/cartel-case-'+pose+'-'+size+'.webp');
  const bin=fs.readFileSync(file);
  assert(bin.length>40000,'Missing original Cartel chest artwork: '+file);
  assert.equal(bin.toString('ascii',0,4),'RIFF',file);
  assert.equal(bin.toString('ascii',8,12),'WEBP',file);
 }
 for(const [ctx,pose,size] of [['inventory','closed',800],['reel','closed',400],
    ['inspect','closed',1254],['open','open',1254]]){
  const html=g.run('visualArt({kind:"case",caseId:"cartel"},'+JSON.stringify(ctx)+')');
  assert(html.includes('cartel-case-'+pose+'-'+size+'.webp'),ctx);
  assert(html.includes('data-art-status="owner-supplied-cartel-case"'));
  assert(html.includes('data-case-pose="'+pose+'"'));
  assert(html.includes('cartel-crate'),'Existing Cartel selector remains supported');
  assert(!html.includes('<svg'),'The placeholder SVG must no longer render');
 }
 assert(g.run('cartelSection()').includes('cartel-case-closed-800.webp'));
 assert(g.run('cases()').includes('arsenal-case-closed-800.webp'),
  'The Arsenal case must remain visually independent');
 g.run('s.items.push({id:"cartel-image-test",kind:"case",caseId:"cartel",paid:75})');
 g.run('openCase("cartel-image-test")');
 const spinning=g.byId('overlay').innerHTML;
 assert(!spinning.includes('cartel-case-open'),'The chest must not overlap moving reel tiles');
 assert(!spinning.includes('cartel-reward-display'),'The final effect must not play during the spin');
 assert(spinning.includes('id="track"'));
 const winner=g.state().items.find(x=>x.kind==='skin'&&x.skin==='Cartel');
 assert(winner,'Cartel case must retain its own exclusive item pool');
 g.run('finishOpening()');
 const shown=g.byId('overlay').innerHTML;
 assert(shown.includes('cartel-reward-display'));
 assert(shown.includes('arsenal-reward-weapon'));
 assert(shown.includes('cartel-case-open-1254.webp'));
 assert(!shown.includes('arsenal-case-open-'));
 assert.equal(g.state().openings,1,'Changing case art must not re-roll the reward');
 assert(g.state().items.some(x=>x.id===winner.id&&x.skin==='Cartel'));
 const css=fs.readFileSync(path.join(root,'design.css'),'utf8');
 assert(css.includes('.cartel-case-art')&&css.includes('height:clamp(235px,72vw,315px)'),
  'Mobile shop needs an unclipped chest frame');
});


test('0.6.0 multi-open requires unique owned cases and enforces exact 1–5 limit',()=>{
 const g=boot();
 g.run('s.items=Array.from({length:6},(_,i)=>({id:"batch-"+i,kind:"case",...(i%2?{caseId:"cartel"}:{})}));save()');
 const orig=g.state().items.map(x=>x.id);
 for(const ids of [[],['batch-0','batch-0'],[...orig],['batch-0','absent'],['bad']]){
  assert.equal(g.run('startMultiOpenWithIds('+JSON.stringify(ids)+')'),false);
  assert.deepEqual(g.state().items.map(x=>x.id),orig);
  assert.equal(g.state().openings,0);
 }
 g.run('showMultiPicker()');
 assert(g.byId('overlay').innerHTML.includes('5 / 5 selected'));
 assert.equal((g.byId('overlay').innerHTML.match(/class="multi-case-group"/g)||[]).length,2,
  'Picker groups identical cases instead of forcing a tall checkbox scroller');
 assert(!g.byId('overlay').innerHTML.includes('type="checkbox"'));
 g.run('toggleMultiCase("batch-1")');
 assert.equal(g.run('multiSelection.length'),4);
 g.run('toggleMultiCase("batch-5")');
 assert.equal(g.run('multiSelection.length'),5);
 assert.equal(g.state().items.length,6,'Selecting cases must not consume them');
});

test('0.6.0 five mixed sealed cases commit all rewards before five independent reels',()=>{
 const store=new LocalStore(),g=boot(store);
 g.run('s.items=Array.from({length:5},(_,n)=>({id:"sealed-"+n,kind:"case",paid:n%2?75:25,'+
  '...(n%2?{caseId:"cartel"}:{})}));save()');
 const ids=['sealed-0','sealed-1','sealed-2','sealed-3','sealed-4'];
 assert.equal(g.run('startMultiOpenWithIds('+JSON.stringify(ids)+')'),true);
 const state=g.state(),disk=g.persisted();
 assert.equal(state.openings,5);
 assert.equal(state.items.length,5);
 assert.equal(state.items.filter(x=>x.kind==='skin'&&x.skin==='Cartel').length,2);
 assert.equal(state.items.filter(x=>x.kind==='weapon'||x.kind==='skin').length,5);
 assert.deepEqual(state.items.map(x=>x.id),disk.items.map(x=>x.id),'All five drops must be durable before animating');
 assert(state.items.every(x=>Number.isInteger(x.wearGrade)&&x.wearGrade>=0&&x.wearGrade<=4));
 assert.equal(new Set(state.items.map(x=>x.id)).size,5);
 assert(g.run('busy'));
 const reel=g.byId('overlay').innerHTML;
 assert.equal((reel.match(/class="multi-lane"/g)||[]).length,5);
 assert.equal((reel.match(/data-reel-index="10"/g)||[]).length,5);
 assert.equal((reel.match(/data-reel-index="/g)||[]).length,70);
 assert(!reel.includes('arsenal-case-open-'),'Open case art must not obstruct the five reels');
 assert(!reel.includes('cartel-case-open-'));
 assert.equal(g.run('startMultiOpenWithIds(["sealed-0"])'),false,'Prevent double-open while spinning');
 g.run('finishMultiOpening()');
 assert.equal(g.state().openings,5,'Showing winners must not reroll prizes');
 assert(!g.run('busy'));
 assert(g.byId('overlay').innerHTML.includes('5 new items acquired'));
 assert.equal((g.byId('overlay').innerHTML.match(/class="multi-prize rarity-/g)||[]).length,5);
 assert(g.byId('overlay').innerHTML.includes('arsenal-case-open-400.webp'));
 assert(g.byId('overlay').innerHTML.includes('cartel-case-open-400.webp'));
 const reload=boot(store);
 assert.deepEqual(reload.state().items.map(x=>x.id),state.items.map(x=>x.id));
 assert.equal(reload.state().openings,5);
 assert.equal(reload.state().pendingReveal,null);
 assert.equal(reload.run('window.LootHubMultiOpen.eligible(s,["sealed-0"])'),null);
});

test('0.6.2 batch sealed purchase debits once, creates unique cases and opens on demand',()=>{
 const g=boot();
 g.run('s.coins=425;s.spent=0;save();document.getElementById("multi-qty-cartel").value="5"');
 assert(g.run('cartelSection()').includes('Buy sealed'));
 assert(g.run('cases()').includes('Buy &amp; open'));
 assert.equal(g.run('buyCases("cartel",false)'),true);
 const sealed=g.state(),disk=g.persisted();
 assert.equal(sealed.coins,50);
 assert.equal(sealed.spent,375);
 assert.equal(sealed.openings,0);
 assert.equal(sealed.items.length,5);
 assert(sealed.items.every(x=>x.kind==='case'&&x.caseId==='cartel'&&x.paid===75));
 assert.equal(new Set(sealed.items.map(x=>x.id)).size,5);
 assert.deepEqual(sealed.items.map(x=>x.id),disk.items.map(x=>x.id),
  'Sealed batch must persist before opening any');
 assert(g.byId('overlay').innerHTML.includes('Open 5 now'));
 const ids=sealed.items.map(x=>x.id);
 g.run('closeDialog()');
 assert.equal(g.run('startMultiOpenWithIds('+JSON.stringify(ids)+')'),true);
 assert.equal(g.state().coins,50,'Opening already-paid cases never charges again');
 assert.equal(g.state().openings,5);
 assert.equal(g.state().items.length,5);
 assert(g.state().items.every(x=>x.kind==='skin'&&x.skin==='Cartel'));
 g.run('finishMultiOpening()');
 assert(g.byId('overlay').innerHTML.includes('5 new items acquired'));
 const before=JSON.stringify(g.state());
 g.run('document.getElementById("multi-qty-cartel").value="5"');
 assert.equal(g.run('buyCases("cartel",false)'),false);
 assert.equal(JSON.stringify(g.state()),before,'Unaffordable buy must not mutate wallet or items');
 const another=boot();
 another.run('s.coins=125;s.spent=0;save();document.getElementById("multi-qty-arsenal").value="5"');
 assert.equal(another.run('buyCases("arsenal",false)'),true);
 assert.equal(another.state().coins,0);
 assert.equal(another.state().openings,0);
 assert(another.state().items.every(x=>x.kind==='case'&&!x.caseId));
 another.run('showMultiPicker()');
 assert.equal((another.byId('overlay').innerHTML.match(/class="multi-case-group"/g)||[]).length,1);
 another.run('adjustMultiCase("arsenal",-1)');
 assert.equal(another.run('multiSelection.length'),4);
 another.run('adjustMultiCase("arsenal",1)');
 assert.equal(another.run('multiSelection.length'),5);
});
test('0.6.2 sealed purchase rejects invalid quantities, insufficient balance and ID collisions atomically',()=>{
 const g=boot();
 g.run('s.coins=200;s.spent=0;save()');
 const original=JSON.stringify(g.state());
 assert.equal(g.run('window.LootHubMultiOpen.purchaseSealed(s,"arsenal",0,25,caseItem)'),null);
 assert.equal(g.run('window.LootHubMultiOpen.purchaseSealed(s,"arsenal",6,25,caseItem)'),null);
 assert.equal(g.run('window.LootHubMultiOpen.purchaseSealed(s,"arsenal",5,50,caseItem)'),null);
 assert.equal(g.run('window.LootHubMultiOpen.purchaseSealed(s,"arsenal",2,25,()=>({id:"same",kind:"case",paid:25}))'),null);
 assert.equal(JSON.stringify(g.state()),original);
 const css=fs.readFileSync(path.join(root,'design.css'),'utf8');
 assert(css.includes('.modal .dialog')&&css.includes('max-height:none;overflow:visible'),
  'Dialogs must not create an inner scroll region');
 assert(css.includes('.dialog .multi-case-choices')&&css.includes('.dialog .cartel-collection'),
  'Case selection and Cartel preview must not be separate nested scrollers');
});
test('0.6.0 1–5 direct buy-and-open is wallet-atomic for each case',()=>{
 const g=boot();
 g.run('s.coins=400;s.spent=0;save();document.getElementById("multi-qty-cartel").value="5"');
 assert.equal(g.run('buyAndMultiOpen("cartel")'),true);
 assert.equal(g.state().coins,25);
 assert.equal(g.state().spent,375);
 assert.equal(g.state().items.length,5);
 assert(g.state().items.every(x=>x.kind==='skin'&&x.skin==='Cartel'&&x.paid===75));
 assert.equal(g.state().openings,5);
 assert.equal(g.persisted().coins,25);
 g.run('finishMultiOpening()');
 const before=JSON.stringify(g.state());
 g.run('document.getElementById("multi-qty-cartel").value="5"');
 assert.equal(g.run('buyAndMultiOpen("cartel")'),false);
 assert.equal(JSON.stringify(g.state()),before,'An unaffordable bundle may not debit or produce anything');
 assert(g.alerts.some(x=>x.includes('Not enough coins')));
 const another=boot();
 another.run('s.coins=125;s.spent=0;save();document.getElementById("multi-qty-arsenal").value="5"');
 assert.equal(another.run('buyAndMultiOpen("arsenal")'),true);
 assert.equal(another.state().coins,0);
 assert.equal(another.state().spent,125);
 assert.equal(another.state().items.length,5);
 assert(another.state().items.every(x=>x.kind==='weapon'||x.kind==='skin'));
 assert(!another.state().items.some(x=>x.skin==='Cartel'));
 another.run('finishMultiOpening()');
 assert.equal(another.state().openings,5);
 assert.deepEqual(JSON.parse(another.run('JSON.stringify(odds)')),[70,20,7.5,2,.5]);
});

test('0.6.0 existing single-case workflow and controls remain available',()=>{
 const g=boot();
 assert(g.run('universalCases()').includes('Select owned cases'));
 assert(g.run('cases()').includes('multi-qty-arsenal'));
 assert(g.run('cartelSection()').includes('multi-qty-cartel'));
 assert(g.run('inventory()').includes('Open up to 5 cases'));
 g.run('s.items.push({id:"old-single",kind:"case",paid:25})');
 assert(g.run('inventory()').includes('Open up to 5 cases'));
 g.run('inspect("old-single")');
 assert(g.byId('overlay').innerHTML.includes('Multi-open'),
  'Single case inspector should offer the multi-open picker');
 g.run('openCase("old-single");finishOpening()');
 assert.equal(g.state().openings,1);
 assert.equal(g.state().items.length,1);
 assert(!g.state().items.some(x=>x.kind==='case'));
 assert(g.byId('overlay').innerHTML.includes('arsenal-reward-display'));
 const ui=fs.readFileSync(path.join(root,'design.css'),'utf8');
 assert(ui.includes('.multi-lane .reel{height:65px}'));
 assert(ui.includes('.multi-prize-grid'));
 assert(ui.includes('@media(prefers-reduced-motion:reduce)'));
});


test('0.6.3 frozen collection registry includes five Spec Ops designs',()=>{
 const g=boot();
 const definitions=JSON.parse(g.run('JSON.stringify(window.LootHubCollections.definitions)'));
 assert.equal(definitions.length,3);
 const [arsenal,cartel,specOps]=definitions;
 assert.deepEqual([arsenal.id,arsenal.items.length,arsenal.reward],['arsenal-v1',35,25]);
 assert.deepEqual([cartel.id,cartel.items.length,cartel.reward],['cartel-v1',5,25]);
 assert.deepEqual([specOps.id,specOps.items.length,specOps.reward],['spec-ops-v1',5,25]);
 assert(specOps.items.every(x=>x.kind==='skin'&&x.skin==='Spec Ops'));
 assert.equal(arsenal.items.filter(x=>x.kind==='weapon').length,25);
 assert.equal(arsenal.items.filter(x=>x.kind==='skin').length,10);
 assert(cartel.items.every(x=>x.kind==='skin'&&x.skin==='Cartel'));
 for(const c of definitions)for(const item of c.items){
  const m=item.kind==='weapon'?CURRENT_MANIFEST.items:
   CURRENT_MANIFEST.approvedSkins;
  assert(m.some(x=>x.id===item.id&&x.weapon===item.weapon&&
   (item.kind==='weapon'||x.skin===item.skin)),'Catalog entry must be approved: '+item.id);
 }
 assert.equal(g.run('window.LootHubCollections.identity({kind:"skin",weapon:"RPG-7",skin:"Cartel"}).collection'),'cartel-v1');
 assert.equal(g.run('window.LootHubCollections.identity({kind:"weapon",weapon:"RPG-7"}).collection'),'arsenal-v1');
 assert.equal(g.run('window.LootHubCollections.identity({kind:"case",weapon:"RPG-7"})'),null);
 assert.equal(g.run('window.LootHubCollections.identity({kind:"skin",weapon:"RPG-7",skin:"Blackout"})'),null);
 assert.equal(g.run('window.LootHubMarketCore.estimated({kind:"case",caseId:"cartel",paid:0})'),75);
 assert.equal(g.run('window.LootHubMarketCore.estimated({kind:"case",caseId:"spec-ops",paid:0})'),75);
 assert.equal(g.run('window.LootHubMarketCore.estimated({kind:"case",paid:0})'),25);
});
test('0.6.1 discovery survives duplicates, ownership transfer, grading and reload',()=>{
 const store=new LocalStore(),g=boot(store);
 g.run('s.items.push({id:"test-rpg-1",kind:"weapon",weapon:"RPG-7",tier:3,base:450,wearGrade:4},'+
  '{id:"test-rpg-2",kind:"weapon",weapon:"RPG-7",tier:3,base:450,wearGrade:0},'+
  '{id:"test-cartel",kind:"skin",weapon:"RPG-7",skin:"Cartel",tier:0,base:40,wearGrade:3});save()');
 assert.equal(g.run('window.LootHubCollections.progress(s,"arsenal-v1").found'),1);
 assert.equal(g.run('window.LootHubCollections.progress(s,"cartel-v1").found'),1);
 g.run('window.LootHubMarketTransactions.createListing(s,"test-rpg-1",480,Date.now());save()');
 g.run('s.items=s.items.filter(x=>x.id!=="test-rpg-2");save()');
 assert.equal(g.run('window.LootHubCollections.progress(s,"arsenal-v1").found'),1);
 g.run('s.listings=[];s.items=s.items.filter(x=>x.id!=="test-cartel");save()');
 assert.equal(g.run('window.LootHubCollections.progress(s,"arsenal-v1").found'),1);
 assert.equal(g.run('window.LootHubCollections.progress(s,"cartel-v1").found'),1);
 const reload=boot(store);
 assert.equal(reload.run('window.LootHubCollections.progress(s,"arsenal-v1").found'),1);
 assert.equal(reload.run('window.LootHubCollections.progress(s,"cartel-v1").found'),1);
});
test('0.6.1 older backups are backfilled only from owned and player escrow, never NPC stock',()=>{
 const store=new LocalStore(),old={coins:400,items:[
  {id:'legacy-ak',kind:'weapon',weapon:'AK-47',tier:2,base:85}],
  listings:[{id:'legacy-listing',item:{id:'legacy-cartel',kind:'skin',skin:'Cartel',
   weapon:'AK-47',tier:2,base:350},ask:425,createdAt:Date.now(),checkedAt:Date.now()}],
  history:[],earned:3,spent:12,sales:0,rep:0,openings:7,serial:80,
  offers:{},tab:'Inventory'};
 store.setItem(KEY,JSON.stringify(old));
 const g=boot(store);
 assert.equal(g.state().items.length,1);
 assert.equal(g.state().listings[0].item.id,'legacy-cartel');
 assert.equal(g.state().coins,400);
 assert.equal(g.state().openings,7);
 assert.equal(g.run('window.LootHubCollections.progress(s,"arsenal-v1").found'),1);
 assert.equal(g.run('window.LootHubCollections.progress(s,"cartel-v1").found'),1);
 assert(g.run('safeUpload('+JSON.stringify(old)+')'),'Prior save versions must remain importable');
 g.run('save()');
 const reloaded=boot(store);
 assert.equal(reloaded.run('window.LootHubCollections.progress(s,"arsenal-v1").found'),1);
 assert.equal(reloaded.run('window.LootHubCollections.progress(s,"cartel-v1").found'),1);
 const tampered=JSON.parse(JSON.stringify(reloaded.state()));
 tampered.collections.progress['cartel-v1'].seen.push('nonexistent--cartel');
 assert.equal(reloaded.run('safeUpload('+JSON.stringify(tampered)+')'),false);
 const repeat=JSON.parse(JSON.stringify(reloaded.state()));
 repeat.collections.progress['arsenal-v1'].seen.push('ak-47--base');
 assert.equal(reloaded.run('safeUpload('+JSON.stringify(repeat)+')'),false);
 const forged=JSON.parse(JSON.stringify(reloaded.state()));
 forged.collections.progress['arsenal-v1'].claimedAt=Date.now();
 assert.equal(reloaded.run('safeUpload('+JSON.stringify(forged)+')'),false);
});
test('0.6.1 Arsenal 35/35 grants 25 cases once and stays claimed when cases are gone',()=>{
 const store=new LocalStore(),g=boot(store);
 g.run('s.items=window.LootHubCollections.definitions[0].items.map((x,i)=>'+
  '({id:"arsenal-"+i,kind:x.kind,weapon:x.weapon,skin:x.skin,tier:x.tier,base:x.base,wearGrade:2}));save()');
 assert.equal(g.run('window.LootHubCollections.progress(s,"arsenal-v1").found'),35);
 assert.equal(g.run('claimCollection("arsenal-v1")'),true);
 const claimed=g.state(), cases=claimed.items.filter(x=>x.kind==='case');
 assert.equal(cases.length,25);
 assert.equal(claimed.openings,0);
 assert.equal(claimed.coins,0);
 assert(cases.every(x=>!x.caseId&&x.paid===0&&x.collectionId==='arsenal-v1'&&x.wearGrade==null));
 assert.equal(new Set(cases.map(x=>x.id)).size,25);
 assert.equal(g.run('claimCollection("arsenal-v1")'),false);
 const one=cases[0].id;
 g.run('openCase('+JSON.stringify(one)+');finishOpening()');
 assert.equal(g.state().openings,1);
 assert.equal(g.state().items.filter(x=>x.kind==='case').length,24);
 assert.equal(boot(store).run('window.LootHubCollections.progress(s,"arsenal-v1").claimed'),true);
});
test('0.6.1 Cartel 5/5 grants 25 cartel cases valued at 75 each and opens five safely',()=>{
 const g=boot();
 g.run('s.items=window.LootHubCollections.definitions[1].items.map((x,i)=>'+
  '({id:"cartel-"+i,kind:x.kind,weapon:x.weapon,skin:x.skin,tier:x.tier,base:x.base,wearGrade:1}));save()');
 assert.equal(g.run('window.LootHubCollections.progress(s,"cartel-v1").found'),5);
 assert.equal(g.run('claimCollection("cartel-v1")'),true);
 const items=g.state().items.filter(x=>x.kind==='case');
 assert.equal(items.length,25);
 assert(items.every(x=>x.caseId==='cartel'&&x.paid===0&&x.collectionId==='cartel-v1'));
 assert.equal(g.run('window.LootHubMarketCore.estimated(s.items.find(x=>x.kind==="case"))'),75);
 g.run('closeDialog()');
 assert.equal(g.run('startMultiOpenWithIds('+JSON.stringify(items.slice(0,5).map(x=>x.id))+')'),true);
 assert.equal(g.state().openings,5);
 assert.equal(g.state().items.filter(x=>x.kind==='case').length,20);
 g.run('finishMultiOpening()');
 assert.equal(g.run('claimCollection("cartel-v1")'),false);
 assert(g.run('collectionBook()').includes('Collection Book'));
 assert(g.run('inventory()').includes('Collection Book'));
});
test('0.6.1 failed local storage write rolls back entire reward and claim receipt',()=>{
 const store=new LocalStore(),g=boot(store);
 g.run('s.items=window.LootHubCollections.definitions[1].items.map((x,i)=>'+
  '({id:"failed-"+i,kind:x.kind,weapon:x.weapon,skin:x.skin,tier:x.tier,base:x.base,wearGrade:0}));save()');
 const baseline=g.state();
 const saveBefore=store.getItem(KEY);
 const originalSet=store.setItem.bind(store);
 store.setItem=(k,v)=>{if(k===KEY)throw Error('No storage');originalSet(k,v)};
 assert.equal(g.run('claimCollection("cartel-v1")'),false);
 assert.equal(g.state().items.filter(x=>x.kind==='case').length,0);
 assert.equal(g.state().collections.progress['cartel-v1'].claimedAt,null);
 assert.equal(g.state().serial,baseline.serial);
 assert.equal(g.state().history.length,baseline.history.length);
 assert.equal(store.getItem(KEY),saveBefore);
});


test('Spec Ops case has a dedicated contained, centered image frame on iPhone',()=>{
 const g=boot();
 const css=fs.readFileSync(path.join(root,'design.css'),'utf8');
 assert(css.includes('.spec-ops-case-image > img{'));
 assert(css.includes('object-fit:contain'));
 assert(css.includes('.cartel-case-art .spec-ops-case-image{'));
 assert(css.includes('height:100%'));
 const shop=g.run('universalCases()');
 assert(shop.includes('cartel-section spec-ops-section'));
 assert(shop.includes('spec-ops-case-image spec-ops-case-closed'));
});

test('Spec Ops release has original assets, five fixed rarities, trading values and multi-opening',()=>{
 const g=boot();
 const variants=JSON.parse(g.run('JSON.stringify(specOpsCatalog.map(x=>[x.weapon,x.tier,x.base]))'));
 assert.deepEqual(variants,[['Glock-18',0,40],['MP5',1,110],['SPAS-12',2,350],['AWP',3,1050],['Karambit',4,4200]]);
 assert.equal(g.run('specOpsCase.casePrice'),75);
 assert(g.run('universalCases()').includes('Spec Ops Case'));
 assert(g.run('visualArt({kind:"case",caseId:"spec-ops"})').includes('spec-ops-case-closed-800.webp'));
 assert(g.run('visualArt({kind:"case",caseId:"spec-ops"},"open")').includes('spec-ops-case-open-1254.webp'));
 for(const [weapon,tier,base] of variants){
  const item={kind:'skin',weapon,skin:'Spec Ops',tier,base,id:'spec-'+tier,wearGrade:2};
  assert.equal(g.run('isApprovedSkin('+JSON.stringify(item)+')'),true);
  assert(g.run('visualArt('+JSON.stringify(item)+',"inspect")').includes('--spec-ops-1600.webp'));
 }
 for(const pose of ['closed','open'])for(const size of [400,800,1254]){
  const bytes=fs.readFileSync(path.join(root,'assets/cases',`spec-ops-case-${pose}-${size}.webp`));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
 }
 for(const slug of ['glock-18','mp5','spas-12','awp','karambit'])for(const size of [400,800,1600]){
  const bytes=fs.readFileSync(path.join(root,'assets/renders/lines/spec-ops',`${slug}--spec-ops-${size}.webp`));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
 }
 g.run('s.coins=450;save()');g.byId('multi-qty-spec-ops').value='5';
 assert.equal(g.run('buyCases("spec-ops",false)'),true);
 assert.equal(g.state().coins,75);
 const cases=g.state().items.filter(x=>x.kind==='case'&&x.caseId==='spec-ops');
 assert.equal(cases.length,5);
 assert.equal(g.run('startMultiOpenWithIds('+JSON.stringify(cases.map(x=>x.id))+')'),true);
 assert.equal(g.state().openings,5);
 assert.equal(g.state().items.filter(x=>x.kind==='skin'&&x.skin==='Spec Ops').length,5);
 g.run('finishMultiOpening()');
});
test('Legacy collection progress is extended for Spec Ops without losing discoveries',()=>{
 const store=new LocalStore(),g=boot(store);
 g.run('s.items.push({id:"migrate-cartel",kind:"skin",weapon:"RPG-7",skin:"Cartel",tier:0,base:40,wearGrade:1});save()');
 const old=g.state();delete old.collections.progress['spec-ops-v1'];
 store.setItem(KEY,JSON.stringify(old));
 const resumed=boot(store);
 assert.equal(resumed.run('window.LootHubCollections.progress(s,"cartel-v1").found'),1);
 assert.equal(resumed.run('window.LootHubCollections.progress(s,"spec-ops-v1").found'),0);
});


test('0.7 independent buyer valuations do not increase when a player inflates the asking price',()=>{
 const g=boot();
 const item={id:'high-ask-spas',kind:'skin',weapon:'SPAS-12',skin:'Spec Ops',tier:2,base:350,wearGrade:1};
 g.run('s.items.push('+JSON.stringify(item)+');save()');
 const fair=g.run('window.LootHubEconomy.marketValue(s,s.items.find(x=>x.id==="high-ask-spas"))');
 const offers=[];
 for(const ask of [Math.round(fair*1.05),Math.round(fair*1.55),Math.round(fair*25)]){
  g.run('window.LootHubMarketTransactions.createListing(s,"high-ask-spas",'+ask+',Date.now(),"desk")');
  const terms=JSON.parse(g.run('JSON.stringify(window.LootHubTraders.terms(s,"sell",s.listings[0]))'));
  assert(terms&&terms.threshold>0,'There is a buyer with independent funds');
  assert(terms.threshold<=Math.ceil(fair*1.26),'Buyer ceiling must track market not asking');
  assert(terms.npcOffer<=terms.threshold,'Opening bid never exceeds budget');
  offers.push([terms.threshold,terms.npcOffer]);
  g.run('window.LootHubMarketTransactions.cancelListing(s,s.listings[0].id)');
 }
 assert(offers.every(x=>x[0]<=Math.ceil(fair*1.26)));
});
test('0.7 auction bid sequence, escrow, settlement and notifications persist without duplicated coins',()=>{
 const g=boot();
 const item={id:'auction-spas-a',kind:'skin',weapon:'SPAS-12',skin:'Spec Ops',tier:2,base:350,wearGrade:2};
 g.run('s.items.push('+JSON.stringify(item)+');save()');
 const start=Date.now()-24*3600000-1000;
 const a=JSON.parse(g.run('JSON.stringify(window.LootHubAuctions.create(s,"auction-spas-a",200,24,'+start+'))'));
 assert(a&&a.mode==='auction'&&a.bids.length===0);
 assert(!g.state().items.some(x=>x.id===item.id),'Item is held in auction escrow');
 assert.equal(g.run('window.LootHubMarketTransactions.settleListing(s,"listing-auction-spas-a")'),null,
  'Legacy sale API cannot bypass the auction winner');
 assert.equal(g.run('window.LootHubMarketTransactions.cancelListing(s,"listing-auction-spas-a")'),null,
  'Legacy cancellation cannot evade outstanding auction bids');
 const before=g.state().coins;
 const result=JSON.parse(g.run('JSON.stringify(window.LootHubAuctions.advance(s,Date.now()))'));
 assert.equal(result.expired,1);
 assert(result.bids>0,'24-hour auction should attract independent bidders');
 assert.equal(result.sales.length,1);
 assert(result.sales[0].price>=200&&result.sales[0].price<=Math.round(350*1.23*1.35));
 assert.equal(g.state().coins,before+result.sales[0].net);
 assert(!g.state().listings.some(x=>x.id==='listing-auction-spas-a'));
 assert(g.state().market.notifications.some(x=>x.type==='sold'&&!x.read));
 assert.equal(JSON.parse(g.run('JSON.stringify(window.LootHubAuctions.advance(s,Date.now()))')).sales.length,0);
 g.run('save()');
 const resumed=boot(g.store);
 assert.equal(resumed.state().coins,g.state().coins,'No duplicate payout on reload');
 assert(resumed.state().market.notifications.some(x=>x.type==='sold'));
 assert.equal(resumed.run('window.LootHubAuctions.advance(s,Date.now()).sales.length'),0);
});
test('0.7 auctions with unaffordable starting bids return the exact original item',()=>{
 const g=boot();
 const item={id:'auction-unsold',kind:'weapon',weapon:'MP5',tier:1,base:110,wearGrade:1};
 g.run('s.items.push('+JSON.stringify(item)+');save()');
 const start=Date.now()-3600000-1000;
 assert(g.run('window.LootHubAuctions.create(s,"auction-unsold",100000000,1,'+start+')'));
 const result=JSON.parse(g.run('JSON.stringify(window.LootHubAuctions.advance(s,Date.now()))'));
 assert.equal(result.expired,1);
 assert.equal(result.sales.length,0);
 assert.equal(g.state().items.filter(x=>x.id===item.id).length,1);
 assert(!g.state().listings.some(x=>x.item?.id===item.id));
 assert(g.state().market.notifications.some(x=>x.type==='unsold'));
 assert.equal(g.run('window.LootHubAuctions.advance(s,Date.now()).expired'),0);
});
test('0.7 active Trading Desk never passively settles while player is away',()=>{
 const g=boot();
 const item={id:'desk-no-auto',kind:'weapon',weapon:'AWP',tier:3,base:1000,wearGrade:1};
 g.run('s.items.push('+JSON.stringify(item)+');save()');
 const t=Date.now()-3*3600000;
 g.run('window.LootHubMarketTransactions.createListing(s,"desk-no-auto",500,'+t+',"desk")');
 const sales=JSON.parse(g.run('JSON.stringify(window.LootHubMarketSimulation.advanceListings(s,Date.now(),()=>0))'));
 assert.equal(sales.sales.length,0);
 assert.equal(g.state().listings.filter(x=>x.mode==='desk').length,1);
 assert.equal(g.run('window.LootHubMarketTransactions.settleListing(s,"listing-desk-no-auto")'),null,
  'Desk cannot sell without an agreed negotiation');
 const desk=g.run('enhancedMarket()');
 assert(desk.includes('Auction House')&&desk.includes('Trading Desk'));
 assert(desk.includes('Auction')&&desk.includes('market-alerts'));
});
test('0.7 active negotiation offers can reject aggressive player counters and walk away',()=>{
 const g=boot();
 const item={id:'desk-tactics',kind:'skin',weapon:'SPAS-12',skin:'Spec Ops',tier:2,base:350,wearGrade:1};
 g.run('s.items.push('+JSON.stringify(item)+');save()');
 g.run('window.LootHubMarketTransactions.createListing(s,"desk-tactics",519,Date.now(),"desk")');
 const id='listing-desk-tactics';
 const bid=JSON.parse(g.run('JSON.stringify(window.LootHubHaggling.begin(s,"sell",'+JSON.stringify(id)+'))'));
 const reference=g.run('window.LootHubEconomy.marketValue(s,s.listings[0].item)');
 assert(bid.threshold<=Math.round(reference*1.26));
 assert(bid.npcOffer<519);
 assert(g.run('window.LootHubHaggling.tactic(s,"sell",'+JSON.stringify(id)+',"final",543,Date.now())'));
 const record=g.state().market.negotiations.find(x=>x.listingId===id);
 assert.equal(record.status,'walked','Buyer declines final offer above independent budget');
 assert(!record.agreedPrice);
 assert.equal(g.state().listings.length,1,'Item remains in escrow until cancelled');
});

if(process.exitCode)process.exit(process.exitCode);
console.log('All LootHub core regression tests passed.');
