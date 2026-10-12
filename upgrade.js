/* LootHub local save & marketplace upgrade. No external services required. */
const BACKUP_KEY='loothub-arsenal-alpha-v1-backup';
let saveFailure=false, saveConflict=false, recoveryRequired=false, lastPersistedRevision=null, lastPersistedSnapshot=null, saveRevisionSequence=0;
function isSaveCurrent(){
  if(saveConflict||recoveryRequired||saveFailure)return false;
  try{
    const raw=localStorage.getItem('loothub-arsenal-alpha-v1');
    if(raw===null){
      if(lastPersistedSnapshot===null)return true;
      saveConflict=true;
    }else{
      const disk=JSON.parse(raw);
      if(!isValidSave(disk))recoveryRequired=true;
      else if(raw!==lastPersistedSnapshot)saveConflict=true;
    }
  }catch(_){recoveryRequired=true}
  if(saveConflict||recoveryRequired)updateSaveIndicator();
  return !saveConflict&&!recoveryRequired;
}
function canMutate(){
  if(isSaveCurrent())return true;
  alert(saveConflict?'Another tab has newer progress. Reload LootHub before making changes.':
    recoveryRequired?'Saved data needs recovery. Open Saves and restore or import a backup before playing.':
    'Saving is unavailable. Export your progress from Saves and reload before further transactions.');
  return false;
}
function reloadLatestProgress(){location.reload();}
function isValidSave(data) {
  return !!(data && typeof data==='object' && !Array.isArray(data) &&
    Number.isSafeInteger(data.coins) && data.coins>=0 &&
    Array.isArray(data.items) && Array.isArray(data.history));
}
// Keep existing items and market listings after the Golden Talon rename.
function canonicalSkin(weapon,skin){
  return weapon==='Karambit'&&(skin==='Golden Talon'||skin==="Raptor's Gaze")?'Starfall':skin;
}
function migrateLegacyFinishData(data){
  if(!data||typeof data!=='object')return data;
  const migrate=item=>{if(item&&item.kind==='skin'&&item.weapon==='Karambit'&&(item.skin==='Golden Talon'||item.skin==="Raptor's Gaze"))item.skin='Starfall';};
  if(Array.isArray(data.items))data.items.forEach(migrate);
  if(Array.isArray(data.listings))data.listings.forEach(listing=>migrate(listing&&listing.item));
  return data;
}
function loadGame(key) {
  let primary=null,backup=null,raw=null;
  try { raw=localStorage.getItem(key); if(raw!==null)primary=JSON.parse(raw); }catch(_){}
  try { const b=localStorage.getItem(BACKUP_KEY); if(b!==null)backup=JSON.parse(b); }catch(_){}
  const isPrimary=isValidSave(primary),isBackup=isValidSave(backup);
  const data=isPrimary?primary:isBackup?backup:null;
  if(!data){
    if(raw!==null)recoveryRequired=true;
    return null;
  }
  // A corrupt primary is restored only from a validated previous save.
  if(!isPrimary && isBackup){
    try{raw=JSON.stringify(data);localStorage.setItem(key,raw);}catch(_){saveFailure=true}
  }
  if(!Array.isArray(data.listings))data.listings=[];
  if(!Array.isArray(data.ledger))data.ledger=[];
  if(!data.offers||typeof data.offers!=='object'||Array.isArray(data.offers))data.offers={};
  if(!Number.isSafeInteger(data.serial))data.serial=0;
  if(!Number.isFinite(data.lastMarketCheck))data.lastMarketCheck=Date.now();
  if(!data.preferences||typeof data.preferences!=='object')data.preferences={fastOpen:false};
  lastPersistedRevision=typeof data.revision==='string'?data.revision:null;
  lastPersistedSnapshot=raw;
  // Do not write automatically; the next valid save handles migration and backup.
  return migrateLegacyFinishData(data);
}
function updateSaveIndicator(){
  const node=document.getElementById('saveStatus');
  if(!node)return;
  node.textContent=recoveryRequired?'Recovery required — open Saves':
    saveConflict?'Newer progress in another tab — reload':
    saveFailure?'Save unavailable — export now':'● Saved on this device';
  node.className='save-status'+(saveFailure||recoveryRequired||saveConflict?' save-error':'');
}
function persistGame(data,activeTab){
  if(recoveryRequired||saveConflict){saveFailure=true;updateSaveIndicator();return false}
  try{
    const raw=localStorage.getItem('loothub-arsenal-alpha-v1');
    let previous=null;
    if(raw!==null){
      try{previous=JSON.parse(raw)}catch(_){recoveryRequired=true;throw Error('Primary save became unreadable')}
      if(!isValidSave(previous)){recoveryRequired=true;throw Error('Primary save became invalid')}
      if(raw!==lastPersistedSnapshot){
        saveConflict=true;throw Error('A second tab changed this save')
      }
    }else if(lastPersistedSnapshot!==null){
      saveConflict=true;throw Error('This save was removed outside the active tab')
    }
    data.tab=activeTab;
    data.savedAt=Date.now();
    data.version=3;
    const nextRevision=(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+(++saveRevisionSequence).toString(36);
    data.revision=nextRevision;
    // A failed backup write must not prevent the current save from succeeding.
    if(raw!==null&&isValidSave(previous)){
      try{localStorage.setItem(BACKUP_KEY,raw)}catch(_){}
    }
    const encoded=JSON.stringify(data);
    localStorage.setItem('loothub-arsenal-alpha-v1',encoded);
    lastPersistedSnapshot=encoded;
    lastPersistedRevision=nextRevision;
    saveFailure=false;
  }catch(_){saveFailure=true}
  updateSaveIndicator();
  return !saveFailure;
}

function recordActivity(data,text) {
  if(!Array.isArray(data.ledger))data.ledger=[];
  const now=Date.now();
  data.history.unshift(new Date(now).toLocaleString()+' · '+text);
  data.ledger.push({at:now,message:text,wallet:data.coins,itemCount:data.items.length,listingCount:(data.listings||[]).length});
}
function safeUpload(data) {
  if(!isValidSave(data) || data.items.length>50000 ||
     !Array.isArray(data.listings||[]) || (data.listings||[]).length>50000 ||
     !Number.isFinite(data.earned) || data.earned<0 ||
     !Number.isFinite(data.spent) || data.spent<0 ||
     !Number.isFinite(data.sales) || data.sales<0) return false;
  const all=data.items.concat((data.listings||[]).map(v=>v.item));
  const ids=new Set();
  for(const item of all) {
    if(!item || typeof item.id!=='string' || item.id.length>150 || ids.has(item.id) ||
       !['case','skin'].includes(item.kind))return false;
    ids.add(item.id);
    if(item.kind==='skin' && (!Number.isInteger(item.tier) || item.tier<0 || item.tier>4 ||
      !Number.isFinite(item.float) || item.float<0 || item.float>1 ||
      !Number.isFinite(item.base) || item.base<0 ||
      !Number.isFinite(item.pattern) || item.pattern<0 ||
      typeof item.weapon!=='string' || typeof item.skin!=='string' ||
      !Array.isArray(catalog) || !catalog.some(a=>a[0]===item.weapon&&a[1]===canonicalSkin(item.weapon,item.skin)&&a[2]===item.tier)))return false;
  }
  return true;
}
function exportProgress() {
  save();
  const output=JSON.stringify({format:'LootHubSave',exportedAt:new Date().toISOString(),state:s},null,2);
  const url=URL.createObjectURL(new Blob([output],{type:'application/json'}));
  const a=document.createElement('a');
  a.href=url;
  a.download='loothub-save-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),15000);
}
function importProgress(input) {
  const file=input && input.files && input.files[0];
  if(!file)return;
  if(file.size>5_000_000){alert('That backup is too large.');return}
  const reader=new FileReader();
  reader.onload=()=>{
    try {
      const parsed=JSON.parse(String(reader.result));
      if(parsed.format!=='LootHubSave'||!safeUpload(parsed.state))throw Error('Unsupported or invalid LootHub save file.');
      if(!confirm('Replace progress on this device with the imported save? Export your current progress first if you want to keep it.'))return;
      const existing=localStorage.getItem(KEY);
      if(existing)localStorage.setItem(BACKUP_KEY,existing);
      localStorage.setItem(KEY,JSON.stringify(parsed.state));
      location.reload();
    }catch(e){alert('Could not import backup: '+e.message)}
  };
  reader.readAsText(file);
}
function restoreLocalBackup() {
  let prior;try{prior=JSON.parse(localStorage.getItem(BACKUP_KEY))}catch(_){}
  if(!isValidSave(prior)){alert('No valid local backup is available.');return}
  if(!confirm('Restore the previous local snapshot? This will replace current progress.'))return;
  localStorage.setItem(KEY,JSON.stringify(prior));location.reload();
}
function saveHub(){
  const count=s.items.length;
  const listed=(s.listings||[]).length;
  const ledger=(s.ledger||[]).length;
  return '<section class="panel"><div class="section-eyebrow">PROGRESS PROTECTION</div><h2>My Save</h2>'+ (recoveryRequired?'<div class="notice"><b>Save recovery required.</b><p>Your existing save was unreadable. It has not been overwritten. Restore a previous snapshot or import your exported save before continuing.</p></div>':saveConflict?'<div class="notice"><b>Another tab updated this game.</b><p>This tab is not allowed to overwrite newer progress.</p><button onclick="reloadLatestProgress()">Reload latest save</button></div>':'')+
  '<div class="notice"><b>Autosave active on this device.</b><p class="muted tiny">Wallet, inventory, opened items, floats, listings, transactions, negotiations, reputation, and settings save automatically. Your existing save is retained when the game updates.</p></div>'+
  '<div class="stat"><span class="muted">Last saved</span><b>'+new Date(s.savedAt||Date.now()).toLocaleString()+'</b></div>'+
  '<div class="stat"><span class="muted">Items carried</span><b>'+count+'</b></div>'+
  '<div class="stat"><span class="muted">Market listings</span><b>'+listed+'</b></div>'+
  '<div class="stat"><span class="muted">Logged economy events</span><b>'+ledger+'</b></div>'+
  '<div class="row" style="margin-top:18px"><button class="primary" onclick="exportProgress()">↓ Download save backup</button><button onclick="restoreLocalBackup()">Restore previous snapshot</button></div>'+
  '<label class="file-picker">Import saved progress (JSON)<input type="file" id="saveUpload" accept=".json,application/json" onchange="importProgress(this)"></label>'+
  '<p class="muted tiny">Important: this is local browser storage, not account/cloud synchronization. Clearing site data or switching phones can remove this save unless you exported and imported it. Do not use Private Browsing for long-term progress.</p></section>';
}
function listingChance(ratio) {
  if(ratio<=.85)return .65;
  if(ratio<=1)return .38;
  if(ratio<=1.12)return .2;
  if(ratio<=1.3)return .08;
  if(ratio<=1.6)return .015;
  return 0;
}
function marketTick() {
  if(!isSaveCurrent()||!s || !Array.isArray(s.listings))return;
  const now=Date.now();
  let changed=false;
  for(const listing of [...s.listings]) {
    if(!listing||!listing.item)continue;
    const start=Number.isFinite(listing.checkedAt)?listing.checkedAt:(listing.createdAt||now);
    const intervals=Math.min(120,Math.floor(Math.max(0,now-start)/60000));
    if(!intervals)continue;
    listing.checkedAt=start+intervals*60000;
    changed=true;
    const ratio=listing.ask/Math.max(1,estimated(listing.item));
    const chance=listingChance(ratio);
    let sold=false;
    for(let n=0;n<intervals;n++)if(Math.random()<chance){sold=true;break}
    if(sold){
      const net=Math.max(1,Math.floor(listing.ask*.95));
      s.listings=s.listings.filter(v=>v.id!==listing.id);
      s.coins+=net;
      s.sales+=net;
      s.rep+=1;
      recordActivity(s,'Marketplace sale: '+itemName(listing.item)+' for '+net+' coins ('+(listing.ask-net)+' fee)');
    }
  }
  if(changed)save();
}
function submitListing(k) {
  if(!canMutate())return;
  const item=s.items.find(v=>v.id===k),input=document.getElementById('listPrice');
  if(!item||!input)return;
  const ask=Number(input.value);
  if(!Number.isSafeInteger(ask)||ask<1||ask>100000000){
    alert('Enter a whole-coin asking price between 1 and 100,000,000.');return;
  }
  if(!Array.isArray(s.listings))s.listings=[];
  s.items=s.items.filter(v=>v.id!==k);
  s.listings.push({id:'listing-'+k,item,ask,createdAt:Date.now(),checkedAt:Date.now()});
  recordActivity(s,'Listed '+itemName(item)+' for '+ask+' coins');
  save();
  closeDialog();
  tab='Market';render();
}
function listItem(k) {
  const item=s.items.find(v=>v.id===k);
  if(!item)return;
  const v=estimated(item);
  dialog('<div class="section-eyebrow">CREATE A LISTING</div><h2>'+escapeHTML(itemName(item))+'</h2>'+
  '<p class="muted">A buyer may purchase this listing while you are away. Market sales have a 5% fee. Your item is held in escrow until sold or cancelled.</p>'+
  '<div class="stat"><span>Estimated value</span><b>'+money(v)+' coins</b></div>'+
  '<label>Asking price<input id="listPrice" class="field" type="number" min="1" max="100000000" step="1" value="'+v+'"></label>'+
  '<p class="muted tiny">Higher asking prices usually take longer and may never sell.</p>'+
  '<div class="row"><button class="primary" onclick="submitListing(\''+escapeHTML(k)+'\')">List for sale</button><button onclick="inspect(\''+escapeHTML(k)+'\')">Back</button></div>');
}
function cancelListing(k) {
  if(!canMutate())return;
  const listing=(s.listings||[]).find(v=>v.id===k);
  if(!listing)return;
  s.listings=s.listings.filter(v=>v.id!==k);
  s.items.push(listing.item);
  recordActivity(s,'Cancelled listing: '+itemName(listing.item));
  save();render();
}
function enhancedMarket(){
  const offers=[{name:'Sealed Arsenal Case',price:29},{name:'Discount Arsenal Case',price:23},{name:'Collector Arsenal Case',price:32}];
  const yours=(s.listings||[]).map(l=>'<div class="listing-line">'+
    '<div class="row" style="min-width:0">'+visualArt(l.item)+
    '<div><b>'+escapeHTML(itemName(l.item))+'</b><div class="muted tiny">Listed '+new Date(l.createdAt).toLocaleString()+'</div></div></div>'+
    '<div class="row"><b>'+money(l.ask)+' ◈</b><button onclick="cancelListing(\''+escapeHTML(l.id)+'\')">Cancel</button></div></div>').join('');
  return '<section class="panel"><div class="section-eyebrow">LOOTBAY MARKETPLACE</div><h2>Live Listings</h2>'+
    '<p class="muted">Buy sealed cases from simulated sellers. Market prices are not guaranteed resale prices.</p>'+
    '<div class="cards">'+offers.map((x,i)=>'<div class="item">'+visualArt({kind:'case'})+'<h4>'+x.name+'</h4>'+
      '<p class="muted">Seller #'+(i+1)+'</p><b>'+x.price+' coins</b>'+
      '<button onclick="marketBuy('+x.price+')">Buy now</button><button onclick="negotiate('+x.price+')">Make offer</button></div>').join('')+
    '</div></section>'+
    '<section class="panel"><div class="row space"><h3>My Market Listings <span class="muted">('+(s.listings||[]).length+')</span></h3><button onclick="go(\'Inventory\')">List an item →</button></div>'+
    (yours||'<p class="muted">No active listings. Open an owned item in Inventory and choose List for sale.</p>')+
    '<p class="muted tiny">Simulated buyers evaluate prices at intervals. While the game is closed, elapsed time is processed when you return. A listing can remain unsold.</p></section>';
}
function enhancedPortfolio(){
  const value=s.items.reduce((total,x)=>total+estimated(x),0);
  const escrow=(s.listings||[]).reduce((total,x)=>total+estimated(x.item),0);
  return '<section class="panel"><div class="section-eyebrow">WEALTH TRACKER</div><h2>My Portfolio</h2>'+
  '<div class="wealth"><span class="muted">Estimated net worth</span><div class="price">'+money(s.coins+value+escrow)+' ◈</div></div>'+
  [['Available coins',s.coins],['Inventory value',value],['Listed item value',escrow],
  ['Total clicked earnings',s.earned],['Lifetime purchase costs',s.spent],['Lifetime sales proceeds',s.sales],
  ['Cases opened',s.openings],['Reputation',s.rep]].map(x=>'<div class="stat"><span>'+x[0]+'</span><b>'+money(x[1])+'</b></div>').join('')+
  '<div class="row" style="margin-top:18px"><button onclick="go(\'Saves\')">Manage save backups</button><button onclick="go(\'Market\')">Open marketplace</button></div></section>'+
  '<section class="panel"><h3>Transaction Journal</h3><div class="journal">'+(s.ledger||[]).slice(-50).reverse().map(x=>'<div class="stat"><span class="muted">'+new Date(x.at).toLocaleString()+' · '+escapeHTML(x.message)+'</span><b>'+money(x.wallet)+' ◈</b></div>').join('')+
  (s.ledger&&s.ledger.length?'':'<p class="muted">Your first transaction will appear here.</p>')+
  '</div><p class="muted tiny">All recorded events remain in the local save and exported backup; the journal displays the most recent 50.</p></section>';
}
/* Pilot: approved render files only. Future skins remain on individually rendered SVG masters. */
const lootHubBitmapArt=Object.freeze({
  'Glock-18|Slate Grid':Object.freeze({
    reel:'assets/renders/finishes/glock-18--slate-grid-400.webp',
    inventory:'assets/renders/finishes/glock-18--slate-grid-800.webp',
    inspect:'assets/renders/finishes/glock-18--slate-grid-1600.webp'
  }),
  'AK-47|Ghostline':Object.freeze({
    reel:'assets/renders/finishes/ak-47--ghostline-400.webp',
    inventory:'assets/renders/finishes/ak-47--ghostline-800.webp',
    inspect:'assets/renders/finishes/ak-47--ghostline-1600.webp'
  }),
  'AK-47|Crimson Circuit':Object.freeze({
    reel:'assets/renders/finishes/ak-47--crimson-circuit-400.webp',
    inventory:'assets/renders/finishes/ak-47--crimson-circuit-800.webp',
    inspect:'assets/renders/finishes/ak-47--crimson-circuit-1600.webp'
  }),
  'AWP|Night Watch':Object.freeze({
    reel:'assets/renders/finishes/awp--night-watch-400.webp',
    inventory:'assets/renders/finishes/awp--night-watch-800.webp',
    inspect:'assets/renders/finishes/awp--night-watch-1600.webp'
  }),
  'AWP|Eclipse':Object.freeze({
    reel:'assets/renders/finishes/awp--eclipse-400.webp',
    inventory:'assets/renders/finishes/awp--eclipse-800.webp',
    inspect:'assets/renders/finishes/awp--eclipse-1600.webp'
  }),
  'M4A4|Voltage Bloom':Object.freeze({
    reel:'assets/renders/finishes/m4a4--voltage-bloom-400.webp',
    inventory:'assets/renders/finishes/m4a4--voltage-bloom-800.webp',
    inspect:'assets/renders/finishes/m4a4--voltage-bloom-1600.webp'
  }),
  'Karambit|Starfall':Object.freeze({
    reel:'assets/renders/finishes/karambit--starfall-400.webp',
    inventory:'assets/renders/finishes/karambit--starfall-800.webp',
    inspect:'assets/renders/finishes/karambit--starfall-1600.webp'
  })
});
const lootHubNeutralModels=Object.freeze({
  'Butterfly Knife':'butterfly-knife',
  '12 Gauge Pump Shotgun':'pump-shotgun',
  'Desert Eagle':'desert-eagle',
  'Tactical Machete':'machete',
  'Colt .45 Revolver':'colt-45-revolver',
  'MP5':'mp5',
  'MAC-10':'mac-10',
  'Tec-9':'tec-9',
  'Tactical Tomahawk':'tactical-tomahawk',
  'SPAS-12':'spas-12'
});
function visualArt(item,context='inventory') {
  if(item&&item.kind==='skin'){
    const displaySkin=canonicalSkin(item.weapon,item.skin);
    const entry=lootHubBitmapArt[item.weapon+'|'+displaySkin];
    if(entry){
      const src=entry[context==='reel'?'reel':context==='inspect'?'inspect':'inventory'];
      const fallback=window.ArsenalMasters&&window.ArsenalMasters.supports(item.weapon)
        ?window.ArsenalMasters.render(displaySkin===item.skin?item:{...item,skin:displaySkin}):'';
      const safeAttr=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
      return '<div class="art weapon-art master-raster" data-weapon-model="'+safeAttr(item.weapon)+'" data-finish="'+safeAttr(displaySkin)+'" data-resolution="'+(context==='inspect'?'1600':context==='reel'?'400':'800')+'">'+
        '<img src="./'+src+'" alt="'+safeAttr(item.weapon+' | '+displaySkin)+'" decoding="async" loading="'+(context==='inventory'?'lazy':'eager')+'" onerror="this.hidden=true;if(this.nextElementSibling)this.nextElementSibling.hidden=false">'+
        '<div class="raster-fallback" hidden>'+fallback+'</div></div>';
    }
  }

  // Real WebP neutral masters; completed finish art above always wins.
  if(item&&item.kind==='skin'&&typeof window!=='undefined'){
    const modelSlug=lootHubNeutralModels[item.weapon];
    const art=window.LootHubNeutralArt&&window.LootHubNeutralArt[modelSlug];
    if(art){
      const size=context==='inspect'?'1600':context==='reel'?'400':'800';
      const safeAttr=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
      return '<div class="art weapon-art master-raster neutral-master" data-weapon-model="'+safeAttr(item.weapon)+'" data-finish="'+safeAttr(canonicalSkin(item.weapon,item.skin))+'" data-resolution="'+size+'" data-art-status="neutral-master">'+
        '<img src="data:image/webp;base64,'+art[size]+'" alt="'+safeAttr(item.weapon+' neutral weapon master')+'" decoding="async" loading="'+(context==='inventory'?'lazy':'eager')+'"></div>';
    }
  }

  // Arsenal vector master: per-model silhouette and consistent aspect ratio.
  // Sealed cases and any unmapped/imported legacy items retain the existing SVG fallback.
  if(item&&item.kind==='skin'&&typeof window!=='undefined'&&window.ArsenalMasters&&window.ArsenalMasters.supports(item.weapon)){
    try { return window.ArsenalMasters.render(item); } catch(_) { /* intentionally fall back */ }
  }
  const rarityIdx=item.kind==='case'?2:(item.tier||0);
  const color=['#9ca6b6','#55c983','#63a9ff','#c28bf9','#eac46d'][rarityIdx];
  const seed=String(item.id||item.kind+'-'+(item.weapon||'')+'-'+(item.skin||'')+'-'+(item.tier||0));
  const artHash=Array.from(seed).reduce((h,ch)=>Math.imul(h,33)^ch.charCodeAt(0),5381)>>>0;
  const metalId='m'+artHash.toString(36),bladeId='b'+artHash.toString(36);
  const w=String(item.weapon||'');
  const knife=/Knife|Karambit|Bayonet/.test(w);
  const sniper=/AWP/.test(w);
  const pistol=/Glock|USP|P250|Five-SeveN|Eagle/.test(w);
  let shape='';
  if(item.kind==='case') {
    shape='<rect x="70" y="50" width="220" height="108" rx="12" fill="#1d2938" stroke="'+color+'" stroke-width="4"/>'+
      '<rect x="83" y="60" width="194" height="86" rx="8" fill="#334356"/>'+
      '<path d="M148 50v-18q0-10 12-10h40q12 0 12 10v18" fill="none" stroke="#73849a" stroke-width="8"/>'+
      '<path d="M94 93h172" stroke="#111b27" stroke-width="7"/>'+
      '<rect x="158" y="83" width="45" height="23" rx="4" fill="'+color+'"/>'+
      '<rect x="95" y="61" width="16" height="83" rx="4" fill="#1c2836"/><rect x="250" y="61" width="16" height="83" rx="4" fill="#1c2836"/>';
  } else if(knife) {
    shape='<path d="M76 121L220 50 285 30 265 68 142 135Z" fill="url(#'+bladeId+')" stroke="'+color+'" stroke-width="3"/>'+
      '<path d="M87 122l-34 20-12-16 35-28" fill="#26354b" stroke="'+color+'" stroke-width="4"/>'+
      '<circle cx="82" cy="117" r="7" fill="#f7cd7d"/>';
  } else if(pistol) {
    shape='<path d="M72 73h192l15 22-16 15h-88l-14 67h-49l-4-70H72z" fill="url(#'+metalId+')" stroke="'+color+'" stroke-width="3"/>'+
      '<path d="M80 70h171v18H80z" fill="#475a71"/>'+
      '<path d="M168 110l-14 37h-16l-1-37" fill="#101b2a" stroke="#586c80" stroke-width="3"/>'+
      '<path d="M115 143l12 29h30" stroke="#344b63" stroke-width="5"/>';
  } else {
    shape='<path d="M31 92h48l21-26h129l18 14 70 4v17l-70 10h-64l-27 16-13 43h-33l-8-43-34 10-10-21H31z" fill="url(#'+metalId+')" stroke="'+color+'" stroke-width="3"/>'+
      '<path d="M30 94l-10-20H9v44h22" fill="#26364d" stroke="#60758b" stroke-width="3"/>'+
      '<path d="M228 85h112v10H228z" fill="#61758d"/>'+
      '<path d="M100 67h128v7H100z" fill="'+color+'" opacity=".7"/>'+
      '<path d="M150 126l12 29 23-36" fill="#1a2736" stroke="#536b81" stroke-width="3"/>'+
      '<path d="M112 89h72v19h-72z" fill="#314763" opacity=".9"/>'+
      (sniper?'<path d="M126 61h90v-11h-90zM140 49h63" fill="#182533" stroke="'+color+'" stroke-width="3"/>':
      '<path d="M103 53h26v12h-26z" fill="#1b2938" stroke="'+color+'" stroke-width="2"/>');
  }
  return '<div class="art weapon-art"><svg viewBox="0 0 360 190" role="img" aria-label="Stylized collectible '+(item.kind==='case'?'case':'weapon')+' artwork">'+
    '<defs><linearGradient id="'+metalId+'" x2="1" y2="1"><stop stop-color="'+color+'"/><stop offset=".28" stop-color="#3b516b"/><stop offset=".75" stop-color="#18273a"/><stop offset="1" stop-color="'+color+'"/></linearGradient>'+
    '<linearGradient id="'+bladeId+'" x2="1" y2="1"><stop stop-color="#ecf0f7"/><stop offset=".55" stop-color="'+color+'"/><stop offset="1" stop-color="#253d56"/></linearGradient></defs>'+
    '<ellipse cx="180" cy="160" rx="150" ry="13" fill="'+color+'" opacity=".07"/>'+shape+
    '</svg></div>';
}
