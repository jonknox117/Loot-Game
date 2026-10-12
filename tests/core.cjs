// Node-only deterministic economy + save compatibility regression suite.
// Run: node tests/core.cjs
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const upgrade=fs.readFileSync(path.join(root,'upgrade.js'),'utf8');
const masters=fs.readFileSync(path.join(root,'assets/weapon-masters.js'),'utf8');
assert(html.includes('<script src="./assets/weapon-masters.js"></script>'),'Art masters missing from page');
const scriptMatch=html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/i);
assert(scriptMatch,'Game script missing');
const script=masters+'\n'+upgrade+'\n'+scriptMatch[1];
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

test('Arsenal Case contains exactly seventeen base weapons, no skins',()=>{
  const g=boot();
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
  const cat=JSON.parse(g.run('JSON.stringify(catalog)'));
  assert.equal(cat.length,17);
  assert.equal(manifest.items.length,17);
  assert.deepEqual(manifest.approvedSkins,[]);
  assert.equal(manifest.catalogMode,'base-weapons-only');
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
});
test('All active weapon masters resolve to neutral WebP art only',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
  assert.equal(manifest.neutralMasterPipeline.baseModelCount,17);
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
test('Old raster finish paths never render in the base-only collection',()=>{
  const g=boot();
  const obj={kind:'weapon',weapon:'Glock-18',tier:0,base:6};
  const img=g.run('visualArt('+JSON.stringify(obj)+',"inspect")');
  assert(img.includes('glock-18-neutral-1600.webp'));
  assert(!img.includes('--slate-grid'));
  assert(!img.includes('data-finish'));
  const menu=g.run('cases()');
  assert.equal((menu.match(/View weapon/g)||[]).length,17);
  assert(menu.includes('Available base weapons'));
  for(const finish of ['Starfall','Slate Grid','Voltage Bloom','Crimson Circuit','Metro Fade']){
    assert(!menu.includes(finish),'Retired finish visible: '+finish);
  }
});
test('Every rarity tier gives a genuine unskinned base weapon',()=>{
  for(const [random,tier] of [[.01,0],[.75,1],[.94,2],[.98,3],[.999,4]]){
    const g=boot(new LocalStore(),()=>random);
    const x=JSON.parse(g.run('JSON.stringify(roll())'));
    assert.equal(x.kind,'weapon');
    assert.equal(x.tier,tier);
    assert.equal(typeof x.weapon,'string');
    assert(!('skin' in x));
    assert(!('float' in x));
    assert(!('pattern' in x));
    assert(!('stattrak' in x));
    assert.equal(g.run('itemName('+JSON.stringify(x)+')'),x.weapon);
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
if(process.exitCode)process.exit(process.exitCode);
console.log('All LootHub core regression tests passed.');
