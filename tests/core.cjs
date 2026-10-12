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
test('Asset manifest exactly maps all catalog items',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
  const g=boot();
  const catalog=JSON.parse(g.run('JSON.stringify(catalog.map(a=>[a[0],a[1],a[2]]))'));
  assert.equal(manifest.items.length,catalog.length);
  assert.equal(new Set(manifest.items.map(x=>x.id)).size,catalog.length);
  for(const [weapon,finish,tier] of catalog){
    const item=manifest.items.find(x=>x.weapon===weapon&&x.finish===finish);
    assert(item,'Missing '+weapon+' '+finish);
    assert.equal(item.tier,tier);
    assert.equal(item.approved,false);
  }
});
test('All Arsenal models have distinct, accessible vector artwork',()=>{
  const g=boot();
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
  const models=JSON.parse(g.run('JSON.stringify(window.ArsenalMasters.modelNames)'));
  assert.equal(models.length,17);
  assert.equal(manifest.vectorFoundation.modelCount,17);
  const catalog=JSON.parse(g.run('JSON.stringify(catalog.map(a=>[a[0],a[1],a[2]]))'));
  const uniqueShapes=new Set();
  for(const [weapon,skin,tier] of catalog){
    const data={kind:'skin',weapon,skin,tier};
    const html=g.run('window.ArsenalMasters.render('+JSON.stringify(data)+')');
    assert(html.includes('class="arsenal-master"')||html.includes('class="arsenal-master" role='),'Missing SVG master '+weapon);
    assert(html.includes('viewBox="0 0 640 270"'),'Unexpected artwork scale '+weapon);
    assert(html.includes('data-weapon-model="'+weapon+'"'),'Incorrect weapon asset '+weapon);
    assert(html.includes('aria-label='),'Missing accessible weapon title '+weapon);
    const geometricBody=html.match(/<g transform="translate\(0 0\)"[^>]*>([\s\S]*?)<\/g>/);
    assert(geometricBody,'Missing art components for '+weapon);
    uniqueShapes.add(geometricBody[1]);
  }
  assert.equal(uniqueShapes.size,17,'All weapon model silhouettes must be distinct');
  for(const entry of manifest.items) {
    assert.equal(entry.vectorStatus,'implemented');
    assert.equal(entry.vectorSource,'assets/weapon-masters.js');
    assert.equal(entry.approved,false,'Final skin artwork must not be falsely marked complete');
  }
});

test('Reel weapon paints use isolated SVG styles instead of globally shared accents',()=>{
  const g=boot();
  const a=g.run("window.ArsenalMasters.render({kind:'skin',weapon:'AK-47',skin:'Ghostline',tier:2})");
  const b=g.run("window.ArsenalMasters.render({kind:'skin',weapon:'AK-47',skin:'Crimson Circuit',tier:3})");
  const idA=a.match(/<svg id="([^"]+)" class="arsenal-master"/)?.[1];
  const idB=b.match(/<svg id="([^"]+)" class="arsenal-master"/)?.[1];
  assert(idA&&idB&&idA!==idB,'Two cards must never share the same SVG root ID');
  for(const [svg,id] of [[a,idA],[b,idB]]){
    assert(svg.includes('#'+id+' .finish{fill:url(#'+id+'f)'),
      'This item must use its own finish gradient');
    assert(svg.includes('#'+id+' .metal{fill:url(#'+id+'m)'),
      'This item must use its own metallic shader');
    assert(!svg.includes('.arsenal-master .finish{'),
      'Global finish CSS leaks the last rendered skin across all reel cards');
    const styles=svg.match(/<style>([\s\S]+?)<\/style>/)?.[1];
    assert(styles,'SVG style block missing');
    const selectors=[...styles.matchAll(/(?:^|\})\s*([^{}]+)\{/g)].map(m=>m[1].trim());
    assert(selectors.length>=10,'Expected model component CSS');
    assert(selectors.every(selector=>selector.startsWith('#'+id+' ')),
      'All SVG CSS rules must be scoped to their own root, not apply to neighboring items');
  }
  assert.notEqual(
    a.match(/<linearGradient id="[^"]+f"[^>]*><stop stop-color="([^"]+)"/)?.[1],
    b.match(/<linearGradient id="[^"]+f"[^>]*><stop stop-color="([^"]+)"/)?.[1],
    'Different finishes should retain their own palettes');
});
test('Opening winner reel tile uses the identical saved item as final reward',()=>{
  const g=boot();
  g.run('for(let i=0;i<25;i++)clickEarn();buy();openCase(s.items[0].id)');
  const won=g.state().items[0];
  assert.equal(won.kind,'skin');
  const modal=g.byId('overlay').innerHTML;
  const tile42=modal.split('data-reel-index="42"')[1]?.split('data-reel-index="43"')[0];
  assert(tile42,'Winning tile missing from reel');
  assert(tile42.includes('data-weapon-model="'+won.weapon+'"'),'Winning weapon model mismatch');
  assert(tile42.includes('data-finish="'+won.skin+'"'),'Winning skin finish mismatch');
  const pilot=(won.weapon==='Glock-18'&&won.skin==='Slate Grid');
  if(pilot){
    assert(tile42.includes('glock-18--slate-grid-400.webp'),'Winning reel should show actual 400px bitmap');
  }else{
    assert(tile42.includes('viewBox="0 0 640 270"'),'Winning tile must use vector master renderer');
  }
  g.run('finishOpening()');
  const reveal=g.byId('overlay').innerHTML;
  assert(reveal.includes('data-weapon-model="'+won.weapon+'"'),'Final reward changed model');
  assert(reveal.includes('data-finish="'+won.skin+'"'),'Final reward changed finish');
  if(pilot)assert(reveal.includes('glock-18--slate-grid-1600.webp'),'Inspect image should use actual 1600px bitmap');
  assert.equal(g.state().items[0].id,won.id,'Winning item identity must remain unchanged');
});
test('Glock-18 Slate Grid pilot chooses correct 2D image size and retains SVG fallback',()=>{
  const g=boot();
  const model={kind:'skin',weapon:'Glock-18',skin:'Slate Grid',tier:0};
  for(const [context,size] of [['reel',400],['inventory',800],['inspect',1600]]){
    const html=g.run('visualArt('+JSON.stringify(model)+','+JSON.stringify(context)+')');
    assert(html.includes('glock-18--slate-grid-'+size+'.webp'),'Wrong image for '+context);
    assert(html.includes('class="art weapon-art master-raster"'),'Raster wrapper missing');
    assert(html.includes('class="raster-fallback"'),'SVG fallback missing');
    assert(html.includes('class="arsenal-master"'),'Fallback must use accurate existing model');
  }
  const files=['400','800','1600'].map(n=>path.join(root,'assets','renders','finishes','glock-18--slate-grid-'+n+'.webp'));
  for(const name of files){
    const bytes=fs.readFileSync(name);
    assert.equal(bytes.toString('ascii',0,4),'RIFF','Invalid WebP RIFF signature: '+name);
    assert.equal(bytes.toString('ascii',8,12),'WEBP','Invalid WebP format: '+name);
    assert(bytes.length>10000,'Unusually tiny/truncated artwork: '+name);
  }
});
test('Catalog full-size art preview shows raster without granting or consuming inventory',()=>{
  const g=boot();
  const before=g.state();
  g.run("previewCatalogFinish('Glock-18','Slate Grid')");
  const html=g.byId('overlay').innerHTML;
  assert(html.includes('glock-18--slate-grid-1600.webp'),'Catalog preview must use actual master image');
  assert(html.includes('Glock-18 | Slate Grid'),'Preview has wrong finish');
  assert.equal(g.state().coins,before.coins,'Catalog preview must never charge coins');
  assert.deepEqual(g.state().items,before.items,'Catalog preview must not alter inventory');
});
test('AK raster masters share exact geometry and show matching reel-to-inspect finishes',()=>{
  const g=boot();
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
  for(const [skin,slug,tier] of [['Ghostline','ghostline',2],['Crimson Circuit','crimson-circuit',3]]){
    const obj={kind:'skin',weapon:'AK-47',skin,tier};
    const entry=manifest.items.find(x=>x.weapon==='AK-47'&&x.finish===skin);
    assert(entry,'Missing AK pilot manifest entry '+skin);
    assert.equal(entry.renderMode,'static-2d-webp');
    for(const [context,size] of [['reel',400],['inventory',800],['inspect',1600]]){
      const html=g.run('visualArt('+JSON.stringify(obj)+','+JSON.stringify(context)+')');
      assert(html.includes('ak-47--'+slug+'-'+size+'.webp'),'Wrong AK image for '+context);
      assert(html.includes('data-weapon-model="AK-47"'),'Bitmap metadata did not track its actual model');
      assert(html.includes('data-finish="'+skin+'"'),'Bitmap metadata did not track the actual finish');
      assert(html.includes('class="raster-fallback"'),'Fallback SVG absent');
      const file=fs.readFileSync(path.join(root,'assets/renders/finishes','ak-47--'+slug+'-'+size+'.webp'));
      assert.equal(file.toString('ascii',0,4),'RIFF','Invalid asset header');
      assert.equal(file.toString('ascii',8,12),'WEBP','Invalid WebP format');
      assert(file.length>10000,'Bitmap appears truncated');
    }
  }
  for(const size of [400,800,1600]){
    const file=fs.readFileSync(path.join(root,'assets/renders/masters','ak-47-neutral-'+size+'.webp'));
    assert.equal(file.toString('ascii',8,12),'WEBP','Neutral AK master invalid');
  }
});
test('AWP bitmap masters load correct original Night Watch/Eclipse artwork at three sizes',()=>{
  const g=boot();
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
  for(const [skin,slug,tier] of [['Night Watch','night-watch',2],['Eclipse','eclipse',3]]){
    const item={kind:'skin',weapon:'AWP',skin,tier};
    const entry=manifest.items.find(x=>x.weapon==='AWP'&&x.finish===skin);
    assert(entry&&entry.pilot===true,'Missing live AWP bitmap entry '+skin);
    assert.equal(entry.approved,false,'Unreviewed pilot must not be called final-approved');
    assert.equal(entry.renderMode,'static-2d-webp');
    for(const [context,size] of [['reel',400],['inventory',800],['inspect',1600]]){
      const html=g.run('visualArt('+JSON.stringify(item)+','+JSON.stringify(context)+')');
      assert(html.includes('awp--'+slug+'-'+size+'.webp'),'Wrong AWP finish source in '+context);
      assert(html.includes('data-weapon-model="AWP"'),'The rendered AWP weapon metadata is wrong');
      assert(html.includes('data-finish="'+skin+'"'),'AWP finish changes between contexts');
      assert(html.includes('class="raster-fallback"'),'AWP preview missing fallback');
      const bitmap=fs.readFileSync(path.join(root,'assets/renders/finishes','awp--'+slug+'-'+size+'.webp'));
      assert.equal(bitmap.toString('ascii',0,4),'RIFF','Invalid WebP header');
      assert.equal(bitmap.toString('ascii',8,12),'WEBP','Invalid WebP payload');
      assert(bitmap.length>9000,'Suspiciously small WebP render');
    }
  }
  for(const size of [400,800,1600]){
    const src=fs.readFileSync(path.join(root,'assets/renders/masters','awp-neutral-'+size+'.webp'));
    assert.equal(src.toString('ascii',8,12),'WEBP','Neutral AWP master missing');
  }
});
test('M4A4 Voltage Bloom pilot preserves actual model and finish across all image sizes',()=>{
  const g=boot();
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
  const entry=manifest.items.find(x=>x.id==='m4a4--voltage-bloom');
  assert(entry && entry.pilot===true && entry.approved===false,'M4 pilot must be registered without false final approval');
  assert.equal(entry.renderMode,'static-2d-webp');
  assert.equal(entry.master,'assets/renders/masters/m4a4-neutral-1600.webp');
  const item={kind:'skin',weapon:'M4A4',skin:'Voltage Bloom',tier:2};
  for(const [context,size] of [['reel',400],['inventory',800],['inspect',1600]]){
    const html=g.run('visualArt('+JSON.stringify(item)+','+JSON.stringify(context)+')');
    assert(html.includes('m4a4--voltage-bloom-'+size+'.webp'),'Wrong bitmap for '+context);
    assert(html.includes('data-weapon-model="M4A4"'),'Wrong model in bitmap metadata');
    assert(html.includes('data-finish="Voltage Bloom"'),'Wrong skin in bitmap metadata');
    assert(html.includes('class="raster-fallback"'),'Raster art must preserve SVG fallback');
    for(const file of ['m4a4--voltage-bloom','m4a4-neutral']){
      const filename=path.join(root,'assets/renders',file==='m4a4-neutral'?'masters':'finishes',file+'-'+size+'.webp');
      const bytes=fs.readFileSync(filename);
      assert.equal(bytes.toString('ascii',0,4),'RIFF','Invalid bitmap RIFF');
      assert.equal(bytes.toString('ascii',8,12),'WEBP','Invalid bitmap format');
      assert(bytes.length>10000,'Truncated or unusually tiny bitmap '+filename);
    }
  }
  const recipe=JSON.parse(fs.readFileSync(path.join(root,'assets/skin-definitions/m4a4--voltage-bloom.json'),'utf8'));
  assert.equal(recipe.weapon,'M4A4');
  assert.equal(recipe.finish,'Voltage Bloom');
  assert.equal(recipe.approved,false);
});
test("Karambit Raptor's Gaze uses same neutral geometry across contexts",()=>{
  const g=boot();
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
  const entry=catalog.items.find(x=>x.id==='karambit--raptors-gaze');
  assert(entry && entry.weapon==='Karambit' && entry.finish==="Raptor's Gaze");
  assert.equal(entry.rarity,'Legendary');
  assert.equal(entry.tier,4);
  assert.equal(entry.pilot,true);
  assert.equal(entry.approved,false,'Generated-source pilot must not be marked approved');
  assert.equal(entry.renderMode,'static-2d-webp');
  assert.equal(entry.provenance,'assets/source/karambit/provenance.json');
  const item={kind:'skin',weapon:'Karambit',skin:"Raptor's Gaze",tier:4};
  const production=JSON.parse(fs.readFileSync(path.join(root,'assets/skin-definitions/karambit--raptors-gaze.json'),'utf8'));
  assert.equal(production.assetFilesPresent,true);
  assert.equal(production.artworkApproved,false);
  assert.equal(production.orientation,'blade-hook-right, finger-ring-left');
  const prov=JSON.parse(fs.readFileSync(path.join(root,'assets/source/karambit/provenance.json'),'utf8'));
  assert.equal(prov.artworkGuarantees.alphaIdentityAtAllThreeSizes,true);
  assert.equal(prov.native1600SourceDetail,false);
  assert(fs.existsSync(path.join(root,'scripts/build_raptors_gaze_2d.py')),'Production source missing');
  for(const [context,size] of [['reel',400],['inventory',800],['inspect',1600]]){
    const actual=g.run('visualArt('+JSON.stringify(item)+','+JSON.stringify(context)+')');
    assert(actual.includes('karambit--raptors-gaze-'+size+'.webp'),'Incorrect Golden Talon '+context+' image');
    assert(actual.includes('data-weapon-model="Karambit"'),'Incorrect Golden Talon weapon identity');
    assert(actual.includes("data-finish=\"Raptor&#39;s Gaze\""),'Incorrect Golden Talon finish identity');
    assert(actual.includes('class="raster-fallback"'),'Karambit fallback SVG missing');
    for(const [part,filename] of [['masters','karambit-neutral'],['finishes','karambit--raptors-gaze']]){
      const bytes=fs.readFileSync(path.join(root,'assets/renders',part,filename+'-'+size+'.webp'));
      assert.equal(bytes.toString('ascii',0,4),'RIFF','Missing or corrupt WebP data');
      assert.equal(bytes.toString('ascii',8,12),'WEBP','Invalid image format');
      assert(bytes.length>10000,'Truncated or placeholder Golden Talon '+size+' bitmap');
    }
  }
});
test('Golden Talon legacy inventory and marketplace items retain their attributes after rename',()=>{
  const storage=new LocalStore();
  const owned={id:'legacy-owned',kind:'skin',weapon:'Karambit',skin:'Golden Talon',tier:4,base:1900,float:0.121234,pattern:777,stattrak:true,paid:25};
  const listed={...owned,id:'legacy-listed',pattern:44,stattrak:false};
  const old={coins:463,items:[owned],listings:[{id:'listing-legacy',item:listed,price:2575,ask:2575,createdAt:Date.now(),checkedAt:Date.now()}],
    history:[],earned:463,spent:0,sales:0,rep:0,openings:2,serial:8,offers:{},ledger:[],tab:'Inventory',lastMarketCheck:Date.now()};
  storage.setItem(KEY,JSON.stringify(old));
  const g=boot(storage);
  assert.equal(g.run('safeUpload('+JSON.stringify(old)+')'),true,'Old save exports should remain importable');
  const state=g.state();
  assert.equal(state.items[0].skin,"Raptor's Gaze");
  assert.equal(state.listings[0].item.skin,"Raptor's Gaze");
  assert.equal(state.items[0].id,'legacy-owned');
  assert.equal(state.listings[0].item.id,'legacy-listed');
  assert.equal(state.items[0].float,0.121234);
  assert.equal(state.items[0].pattern,777);
  assert.equal(state.coins,463);
  assert.equal(state.listings[0].price,2575);
  assert.equal(g.run('itemName(s.items[0])'),"Karambit | Raptor's Gaze");
  assert(g.run('save()'),'Normal save should preserve valid migrated items');
  const saved=g.persisted();
  assert.equal(saved.items[0].skin,"Raptor's Gaze");
  assert.equal(saved.listings[0].item.skin,"Raptor's Gaze");
  assert.equal(saved.coins,463);
});
test('Raptor catalog preview has apostrophe-safe handler and exact 1600px image',()=>{
  const g=boot();
  const html=g.run('cases()');
  assert(html.includes('previewCatalogFinish(16)'));
  assert(!html.includes("previewCatalogFinish('Karambit','Raptor"),'Do not put names in onclick JS');
  const prior=g.state();
  g.run('previewCatalogFinish(16)');
  const modal=g.byId('overlay').innerHTML;
  assert(modal.includes('karambit--raptors-gaze-1600.webp'));
  assert(modal.includes('Karambit | Raptor&#39;s Gaze'));
  assert.equal(g.state().coins,prior.coins);
  assert.deepEqual(g.state().items,prior.items);
});
test('Brand-new profile starts at zero and persists baseline',()=>{
  const g=boot();
  assert.equal(g.state().coins,0);
  assert.equal(g.persisted().coins,0);
  assert.equal(g.persisted().version,3);
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
  assert.equal(g.persisted().version,3);
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
  assert.equal(opened.items[0].kind,'skin');
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
