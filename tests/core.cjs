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
  const a=g.run("visualArt({kind:'skin',weapon:'AK-47',skin:'Ghostline',tier:2})");
  const b=g.run("visualArt({kind:'skin',weapon:'AK-47',skin:'Crimson Circuit',tier:3})");
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
