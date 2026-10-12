/* LootHub local save & marketplace upgrade. No external services required. */
const BACKUP_KEY='loothub-arsenal-alpha-v1-backup';
function ensureMarketData(data){return window.LootHubMarketCore.ensureMarketState(data)}
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
// Convert every retired skin to its unskinned base weapon without losing the
// original unique item, asking price, or pre-migration market estimate.
// Only the previous one-time conversion applies wear/pattern/StatTrak multipliers.
function migrateLegacyFinishData(data){
  if(!data||typeof data!=='object')return data;
  const migrate=item=>{
    if(!item||typeof item!=='object'||item.kind==='case')return;
    // Keep user-selected approved finish intact; retire only older unapproved skins.
    if(item.kind==='skin'&&item.weapon==='MAC-10'&&item.skin==='Red Devil')return;
    if(item.kind==='skin'){
      const base=Number(item.base);
      if(Number.isFinite(base)&&base>=0){
        const f=Number(item.float);
        const wear=Number.isFinite(f)&&f>=0&&f<=1?(f<.07?1.4:f<.15?1.18:f>.45?.75:1):1;
        const bonus=(item.stattrak?1.65:1)*wear*(item.pattern===777?1.25:1);
        item.base=Math.max(1,Math.round(base*bonus));
      }
      item.kind='weapon';
    }
    if(item.kind==='weapon'){
      delete item.skin;
      delete item.finish;
      delete item.float;
      delete item.pattern;
      delete item.stattrak;
    }
  };
  if(Array.isArray(data.items))data.items.forEach(migrate);
  if(Array.isArray(data.listings))data.listings.forEach(l=>migrate(l&&l.item));
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
  const migrated=migrateLegacyFinishData(data);
  ensureMarketData(migrated);
  return migrated;
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
    data.version=4;
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
     !Number.isFinite(data.sales) || data.sales<0)return false;
  const all=data.items.concat((data.listings||[]).map(v=>v&&v.item));
  const ids=new Set();
  for(const item of all){
    if(!item||typeof item.id!=='string'||item.id.length>150||ids.has(item.id)||
       !['case','weapon','skin'].includes(item.kind))return false;
    ids.add(item.id);
    // Pre-update saves are valid imports even when their former skin was retired.
    if(item.kind!=='case' && (!Number.isInteger(item.tier)||item.tier<0||item.tier>4||
       !Number.isFinite(item.base)||item.base<0||
       typeof item.weapon!=='string'||item.weapon.length<1||item.weapon.length>120))return false;
    if(item.kind==='skin'){
      if(typeof item.skin!=='string'||item.skin.length>120)return false;
      const approved=item.weapon==='MAC-10'&&item.skin==='Red Devil';
      const legacyWear=Number.isFinite(item.float)&&item.float>=0&&item.float<=1&&
        Number.isFinite(item.pattern)&&item.pattern>=0;
      if(!approved&&!legacyWear)return false;
    }
  }
  if(data.market!=null){
    if(!window.LootHubMarketCore.validMarketState(data.market))return false;
    if(data.market.npcListings.length>100||data.market.negotiations.length>1000||
       data.market.traders.length>100)return false;
    const traderIds=new Set();
    for(const trader of data.market.traders){
      if(!trader||typeof trader.id!=='string'||trader.id.length>90||traderIds.has(trader.id)||
         !['buyer','seller'].includes(trader.role)||typeof trader.name!=='string'||
         !Array.isArray(trader.focus)||trader.focus.length>12||
         !Number.isSafeInteger(trader.wallet)||trader.wallet<0||
         !Number.isSafeInteger(trader.initialBudget)||trader.initialBudget<0||
         !Number.isSafeInteger(trader.bought)||trader.bought<0||
         !Number.isSafeInteger(trader.sold)||trader.sold<0)return false;
      traderIds.add(trader.id);
    }
    for(const n of data.market.negotiations){
      if(!n||!['buy','sell'].includes(n.kind)||
        typeof n.id!=='string'||n.id!==(n.kind+':'+n.listingId+(n.kind==='sell'?':'+n.listingCreatedAt:''))||
        !Number.isFinite(n.listingCreatedAt)||
        typeof n.listingId!=='string'||n.listingId.length>160||
        typeof n.itemId!=='string'||n.itemId.length>150||
        !window.LootHubMarketCore.validAsk(n.initialAsk)||
        !window.LootHubMarketCore.validAsk(n.threshold)||
        !window.LootHubMarketCore.validAsk(n.npcOffer)||
        !Number.isSafeInteger(n.rounds)||n.rounds<0||n.rounds>3||
        !['open','agreed','completed','walked','declined','unavailable'].includes(n.status)||
        !Array.isArray(n.history)||n.history.length>30||
        !Number.isFinite(n.createdAt)||!Number.isFinite(n.updatedAt)||
        (n.status==='agreed'||n.status==='completed')&&
          !window.LootHubMarketCore.validAsk(n.agreedPrice))return false;
    }
    const listingIds=new Set();
    for(const l of data.market.npcListings){
      if(!l||typeof l.id!=='string'||l.id.length>150||listingIds.has(l.id)||
         typeof l.seller!=='string'||l.seller.length>80||
         !window.LootHubMarketCore.validAsk(l.ask)||
         !Number.isFinite(l.createdAt)||!Number.isFinite(l.expiresAt)||
         !window.LootHubMarketCore.eligible(l.item)||l.item.id.length>150||
         ids.has(l.item.id)||listingIds.has(l.item.id))return false;
      if(l.item.kind!=='case'&&(!Number.isInteger(l.item.tier)||l.item.tier<0||
         l.item.tier>4||!Number.isFinite(l.item.base)||l.item.base<=0||
         typeof l.item.weapon!=='string'||l.item.weapon.length>120))return false;
      if(l.item.kind==='skin'&&!(l.item.weapon==='MAC-10'&&l.item.skin==='Red Devil'))return false;
      listingIds.add(l.id);
      ids.add(l.item.id);
    }
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
  '<div class="notice"><b>Autosave active on this device.</b><p class="muted tiny">Wallet, base weapons, listings, transactions, negotiations, reputation, and settings save automatically. Your existing save is retained when the game updates.</p></div>'+
  '<div class="stat"><span class="muted">Last saved</span><b>'+new Date(s.savedAt||Date.now()).toLocaleString()+'</b></div>'+
  '<div class="stat"><span class="muted">Items carried</span><b>'+count+'</b></div>'+
  '<div class="stat"><span class="muted">Market listings</span><b>'+listed+'</b></div>'+
  '<div class="stat"><span class="muted">Logged economy events</span><b>'+ledger+'</b></div>'+
  '<div class="row" style="margin-top:18px"><button class="primary" onclick="exportProgress()">↓ Download save backup</button><button onclick="restoreLocalBackup()">Restore previous snapshot</button></div>'+
  '<label class="file-picker">Import saved progress (JSON)<input type="file" id="saveUpload" accept=".json,application/json" onchange="importProgress(this)"></label>'+
  '<p class="muted tiny">Important: this is local browser storage, not account/cloud synchronization. Clearing site data or switching phones can remove this save unless you exported and imported it. Do not use Private Browsing for long-term progress.</p></section>';
}
function listingChance(ratio){return window.LootHubMarketSimulation.listingChance(ratio)}
function marketTick(){
  if(!isSaveCurrent()||!s||!Array.isArray(s.listings))return;
  const result=window.LootHubMarketSimulation.advanceListings(s,Date.now(),Math.random);
  for(const sale of result.sales){
    recordActivity(s,'Marketplace sale: '+itemName(sale.item)+' for '+sale.net+
      ' coins ('+sale.fee+' fee)');
  }
  if(window.LootHubHaggling.resolveUnavailable(s,Date.now()))save();
  else if(result.changed)save();
}
function marketAction(name,id){return name+'('+escapeHTML(JSON.stringify(String(id)))+')'}
function listingItemName(item){
  return item&&item.kind==='skin'&&item.skin
    ?String(item.weapon)+' | '+String(item.skin):itemName(item);
}
function previewListingPrice(){
  const input=document.getElementById('listPrice');
  const reference=document.getElementById('listingPriceRef');
  const fee=document.getElementById('listingFee');
  const net=document.getElementById('listingNet');
  const hint=document.getElementById('listingHint');
  if(!input||!reference||!fee||!net||!hint)return;
  const quote=window.LootHubMarketCore.listingQuote(Number(input.value),Number(reference.value));
  if(!quote){
    fee.textContent='—';
    net.textContent='—';
    hint.textContent='Enter a whole-coin price between 1 and 100,000,000.';
    return;
  }
  fee.textContent=money(quote.fee)+' coins';
  net.textContent=money(quote.net)+' coins';
  hint.textContent=quote.ratio===null?'A listing price is not a guaranteed sale.':
    quote.ratio>1.3?'Well above estimated value; buyers may take longer.':
    quote.ratio<.8?'Below estimated value; buyers may be more interested.':
    'Near the estimated value; sales still depend on buyer activity.';
}
function suggestListingPrice(price){
  const field=document.getElementById('listPrice');
  if(!field)return;
  field.value=String(price);
  previewListingPrice();
}
function listingEditor(item,ask,mode,listingId){
  const reference=estimated(item);
  const safeAsk=window.LootHubMarketCore.validAsk(ask)?ask:reference;
  const quote=window.LootHubMarketCore.listingQuote(safeAsk,reference);
  const suggested=window.LootHubMarketCore.suggestedPrices(reference);
  const label=mode==='edit'?'EDIT LISTING PRICE':'CREATE A LISTING';
  const action=mode==='edit'?marketAction('submitPriceEdit',listingId):marketAction('submitListing',item.id);
  const back=mode==='edit'?'closeDialog()':marketAction('inspect',item.id);
  dialog('<div class="section-eyebrow">'+label+'</div>'+
    '<h2>'+escapeHTML(listingItemName(item))+'</h2>'+
    '<div class="listing-editor-art">'+visualArt(item,'inspect')+'</div>'+
    '<p class="muted tiny">The exact owned item stays in escrow until it sells or you cancel. Changing the price costs nothing. A 5% fee applies only when it sells.</p>'+
    '<div class="stat"><span>Estimated value</span><b>'+money(reference)+' coins</b></div>'+
    '<label class="listing-price-label" for="listPrice">Your asking price</label>'+
    '<input id="listingPriceRef" type="hidden" value="'+reference+'">'+
    '<input id="listPrice" class="field" aria-label="Your asking price" type="number" inputmode="numeric" min="1" max="100000000" step="1" value="'+safeAsk+'" oninput="previewListingPrice()">'+
    '<div class="listing-quick-prices">'+suggested.map(v=>
      '<button type="button" onclick="suggestListingPrice('+v+')">'+money(v)+' ◈</button>').join('')+'</div>'+
    '<div class="listing-quote" aria-live="polite">'+
      '<div class="stat"><span>Marketplace fee (5%)</span><b id="listingFee">'+money(quote.fee)+' coins</b></div>'+
      '<div class="stat"><span>Proceeds if sold</span><b id="listingNet">'+money(quote.net)+' coins</b></div>'+
      '<p id="listingHint" class="muted tiny">The estimate is not a guaranteed offer.</p></div>'+
    '<div class="row listing-editor-actions"><button class="primary" onclick="'+action+'">'+(mode==='edit'?'Save price':'List for sale')+'</button>'+
    '<button onclick="'+back+'">Back</button></div>');
  previewListingPrice();
}
function listingInputAsk(){
  const input=document.getElementById('listPrice');
  if(!input)return null;
  const ask=Number(input.value);
  if(!window.LootHubMarketCore.validAsk(ask)){
    alert('Enter a whole-coin asking price between 1 and 100,000,000.');
    return null;
  }
  return ask;
}
function submitListing(k){
  if(!canMutate())return;
  const item=s.items.find(v=>v.id===k);
  if(!item)return;
  const ask=listingInputAsk();
  if(ask===null)return;
  const listing=window.LootHubMarketTransactions.createListing(s,k,ask,Date.now());
  if(!listing)return;
  recordActivity(s,'Listed '+listingItemName(item)+' for '+ask+' coins');
  save();
  closeDialog();
  tab='Market';render();
}
function listItem(k){
  const item=s.items.find(v=>v.id===k&&window.LootHubMarketCore.eligible(v));
  if(!item)return;
  listingEditor(item,estimated(item),'create',null);
}
function editListing(k){
  const listing=(s.listings||[]).find(v=>v.id===k);
  if(!listing||!listing.item)return;
  listingEditor(listing.item,listing.ask,'edit',listing.id);
}
function submitPriceEdit(k){
  if(!canMutate())return;
  const ask=listingInputAsk();
  if(ask===null)return;
  const changed=window.LootHubMarketTransactions.repriceListing(s,k,ask,Date.now());
  if(!changed)return;
  if(changed.changed){
    window.LootHubHaggling.closeForListing(s,'sell',k);
    recordActivity(s,'Updated '+listingItemName(changed.listing.item)+' listing from '+
      changed.oldAsk+' to '+ask+' coins');
    save();
  }
  closeDialog();render();
}
function cancelListing(k){
  if(!canMutate())return;
  const listing=window.LootHubMarketTransactions.cancelListing(s,k);
  if(!listing)return;
  window.LootHubHaggling.closeForListing(s,'sell',k);
  recordActivity(s,'Cancelled listing: '+listingItemName(listing.item));
  save();render();
}
// Market filters are transient UI state; actual NPC listings are durable save data.
let npcMarketView={search:'',kind:'all',tier:'all',sort:'price-asc'};
function updateNpcMarketFilter(field,value){
  if(!Object.prototype.hasOwnProperty.call(npcMarketView,field))return;
  npcMarketView[field]=String(value||'').slice(0,120);
  const results=document.getElementById('npcMarketResults');
  if(results)results.innerHTML=renderNpcMarketResults();
  const count=document.getElementById('npcMarketCount');
  if(count)count.textContent=window.LootHubNPCMarket.filterNpcListings(s.market.npcListings,npcMarketView).length+
    ' listings';
}
function npcPriceLabel(listing){
  const estimate=estimated(listing.item),ratio=listing.ask/Math.max(1,estimate);
  return ratio<.92?'Below estimate':ratio>1.12?'Above estimate':'Near estimate';
}
function renderNpcMarketResults(){
  const listings=window.LootHubNPCMarket.filterNpcListings(s.market.npcListings,npcMarketView);
  return listings.map(l=>{
    const persona=window.LootHubTraders.summary(window.LootHubTraders.get(s,l.seller));
    const item=l.item,estimate=estimated(item);
    return '<article class="npc-listing">'+
      '<div class="npc-listing-art">'+visualArt(item)+'</div>'+
      '<div class="npc-listing-body">'+
      '<span class="tag '+cls(rarity(item))+'">'+escapeHTML(rarity(item))+'</span>'+
      '<h4>'+escapeHTML(listingItemName(item))+'</h4>'+
      '<div class="muted tiny">Seller: '+escapeHTML(l.seller)+' · '+escapeHTML(persona.persona)+'</div>'+
      '<div class="npc-listing-cost"><b>'+money(l.ask)+' ◈</b>'+
      '<span class="muted tiny">Est. '+money(estimate)+' ◈ · '+npcPriceLabel(l)+'</span></div>'+
      '<div class="npc-listing-buttons">'+
      '<button onclick="'+marketAction('inspectNpcListing',l.id)+'">Inspect</button>'+ 
      '<button onclick="'+marketAction('negotiateNpcListing',l.id)+'">Make offer</button>'+
      '<button class="primary" onclick="'+marketAction('buyNpcListing',l.id)+'">Buy now</button></div>'+
      '</div></article>';
  }).join('')||'<p class="muted">No listings match those filters. Try another weapon, price order, or rarity.</p>';
}
function inspectNpcListing(k){
  const listing=s.market.npcListings.find(x=>x.id===k);
  if(!listing)return;
  const item=listing.item;
  const trader=window.LootHubTraders.get(s,listing.seller);
  const personality=window.LootHubTraders.summary(trader);
  const attributes=[];
  if(Number.isFinite(item.float))attributes.push('Wear float: '+item.float);
  if(Number.isFinite(item.pattern))attributes.push('Pattern: '+item.pattern);
  if(item.stattrak)attributes.push('StatTrak');
  const name=listingItemName(item);
  dialog('<div class="section-eyebrow">SIMULATED SELLER LISTING</div>'+
    '<div class="tag '+cls(rarity(item))+'">'+escapeHTML(rarity(item))+'</div>'+
    '<div class="big reveal-art">'+visualArt(item,'inspect')+'</div>'+
    '<h2>'+escapeHTML(name)+'</h2>'+
    '<div class="stat"><span>Seller</span><b>'+escapeHTML(listing.seller)+'</b></div>'+ 
    '<div class="stat"><span>Trading style</span><b>'+escapeHTML(personality.persona)+'</b></div>'+ 
    '<p class="muted tiny">'+escapeHTML(personality.description)+' · Prefers '+escapeHTML(personality.focus)+'</p>'+
    '<div class="stat"><span>Asking price</span><b>'+money(listing.ask)+' coins</b></div>'+
    '<div class="stat"><span>Reference estimate</span><b>'+money(estimated(item))+' coins</b></div>'+
    '<div class="stat"><span>Price assessment</span><b>'+npcPriceLabel(listing)+'</b></div>'+
    '<p class="muted tiny">'+escapeHTML(attributes.join(' · ')||
      (item.kind==='skin'?'Approved cosmetic · exact listed item':item.kind==='case'?
       'Sealed Arsenal Case':'Base weapon · unskinned'))+'</p>'+
    '<p class="muted tiny">This is a persistent NPC offer. Purchasing transfers this exact item to your inventory. Negotiate a better price or buy at the asking price.</p>'+
    '<div class="row"><button onclick="'+marketAction('negotiateNpcListing',listing.id)+'">Make offer</button>'+ 
    '<button class="primary" onclick="'+marketAction('buyNpcListing',listing.id)+'">Buy for '+
      money(listing.ask)+' coins</button><button onclick="closeDialog()">Back to market</button></div>');
}
function buyNpcListing(k){
  if(!canMutate())return;
  const listing=s.market.npcListings.find(x=>x.id===k);
  if(!listing)return;
  if(s.coins<listing.ask){
    alert('Not enough coins. Earn more or sell a collectible before purchasing.');
    return;
  }
  const sale=window.LootHubMarketTransactions.buyNpcListing(s,k);
  if(!sale)return;
  window.LootHubHaggling.closeForListing(s,'buy',k);
  recordActivity(s,'Bought '+listingItemName(sale.item)+' from '+sale.seller+
    ' for '+sale.price+' coins');
  save();
  closeDialog();
  tab='Inventory';
  render();
}
function negotiateNpcListing(k){openMarketNegotiation('buy',k)}
function reviewBuyerOffer(k){openMarketNegotiation('sell',k)}
function openMarketNegotiation(kind,k){
  if(!canMutate())return;
  const negotiation=window.LootHubHaggling.begin(s,kind,k,Date.now());
  if(!negotiation)return;
  save();
  renderMarketNegotiation(kind,k);
}
function renderMarketNegotiation(kind,k){
  const n=window.LootHubHaggling.get(s,kind,k);
  if(!n)return;
  if((n.status==='open'||n.status==='agreed')&&!window.LootHubHaggling.stillAvailable(s,n)){
    n.status='unavailable';n.updatedAt=Date.now();save();
  }
  const buy=kind==='buy',listing=(buy?s.market.npcListings:s.listings).find(x=>x.id===k);
  const item=listing?.item || (s.items.find(x=>x.id===n.itemId));
  const itemLabel=item?listingItemName(item):'Listing no longer available';
  const status=n.status,initial=buy?n.initialAsk:n.npcOffer;
  const history=n.history.slice(-9).map(e=>
    '<div class="offer-message '+(e.by==='player'?'offer-player':'offer-trader')+'">'+
      '<span class="muted tiny">'+(e.by==='player'?'You':escapeHTML(n.seller))+'</span>'+
      '<span>'+(e.amount!=null?money(e.amount)+' coins':'')+
      (e.message?' · '+escapeHTML(e.message):'')+'</span></div>').join('');
  const stateCopy=status==='agreed'?
    '<p class="notice">Deal agreed at <b>'+money(n.agreedPrice)+' coins</b>. Complete the trade to transfer the item and coins.</p>':
    status==='walked'?'<p class="notice">This trader walked away. The same listing cannot be renegotiated.</p>':
    status==='declined'?'<p class="notice">You ended this negotiation. Its history is saved.</p>':
    status==='completed'?'<p class="notice">Trade completed. The item and coins have already transferred.</p>':
    status==='unavailable'?'<p class="notice">This listing is no longer available at its negotiated price.</p>':'';
  const roundLeft=Math.max(0,(n.maxRounds||window.LootHubHaggling.MAX_ROUNDS)-n.rounds);
  const suggest=buy?Math.max(1,Math.round(n.npcOffer*.9)):Math.min(100000000,Math.round(n.npcOffer*1.1));
  const controls=status==='open'?
    '<label for="negotiationAmount">'+(buy?'Your purchase offer':'Your counter asking price')+
    '</label><input id="negotiationAmount" aria-label="Your offer" class="field" type="number" min="1" max="'+
      (buy?n.initialAsk:100000000)+'" step="1" inputmode="numeric" value="'+suggest+'">'+
    '<div class="row offer-actions"><button class="primary" onclick="'+marketActionWithKind('sendNegotiationOffer',kind,k)+'">Send offer</button>'+
    '<button onclick="'+marketActionWithKind('acceptMarketCounter',kind,k)+'">Accept '+
      money(n.npcOffer)+' ◈</button>'+
    '<button onclick="'+marketActionWithKind('leaveMarketNegotiation',kind,k)+'">Walk away</button></div>':
    status==='agreed'?
    '<button class="primary" onclick="'+marketActionWithKind('completeMarketNegotiation',kind,k)+'">'+
      (buy?'Complete purchase':'Complete sale')+' · '+money(n.agreedPrice)+' ◈</button>':'';
  dialog('<div class="section-eyebrow">'+(buy?'NEGOTIATE WITH SELLER':'REVIEW BUYER OFFER')+'</div>'+
    '<h2>'+escapeHTML(itemLabel)+'</h2>'+
    '<p class="muted tiny">Trader: '+escapeHTML(n.seller)+(n.persona?' · '+escapeHTML(n.persona):'')+' · Original asking price: '+
      money(n.initialAsk)+' coins · '+roundLeft+' offer'+(roundLeft===1?'':'s')+' remaining</p>'+
    (n.description?'<p class="muted tiny">'+escapeHTML(n.description)+' · Collects '+escapeHTML((n.focus||[]).join(', '))+'</p>':'')+
    '<div class="offer-history">'+history+'</div>'+
    stateCopy+controls+'<div class="row"><button onclick="closeDialog()">Close negotiation</button></div>');
}
function marketActionWithKind(fn,kind,k){
  return fn+'('+escapeHTML(JSON.stringify(kind))+','+escapeHTML(JSON.stringify(k))+')';
}
function sendNegotiationOffer(kind,k){
  if(!canMutate())return;
  const input=document.getElementById('negotiationAmount');
  if(!input)return;
  const value=Number(input.value);
  if(!window.LootHubMarketCore.validAsk(value)){
    alert('Enter a whole-coin offer between 1 and 100,000,000.');return;
  }
  const outcome=window.LootHubHaggling.submit(s,kind,k,value,Date.now());
  if(!outcome){alert('The offer is not valid for this negotiation.');return}
  save();
  renderMarketNegotiation(kind,k);
}
function acceptMarketCounter(kind,k){
  if(!canMutate())return;
  const outcome=window.LootHubHaggling.acceptCounter(s,kind,k,Date.now());
  if(!outcome)return;
  save();renderMarketNegotiation(kind,k);
}
function leaveMarketNegotiation(kind,k){
  if(!canMutate())return;
  const outcome=window.LootHubHaggling.walkAway(s,kind,k,Date.now());
  if(!outcome)return;
  save();renderMarketNegotiation(kind,k);
}
function completeMarketNegotiation(kind,k){
  if(!canMutate())return;
  const n=window.LootHubHaggling.get(s,kind,k);
  if(!n||n.status!=='agreed')return;
  if(!window.LootHubHaggling.stillAvailable(s,n)){
    n.status='unavailable';n.updatedAt=Date.now();
    save();renderMarketNegotiation(kind,k);return;
  }
  if(kind==='buy'&&s.coins<n.agreedPrice){
    alert('Not enough coins to complete this deal. Earn coins or sell another item.');return;
  }
  const result=kind==='buy'?
    window.LootHubMarketTransactions.buyNpcListing(s,k,n.agreedPrice):
    window.LootHubMarketTransactions.settleListing(s,k,n.agreedPrice);
  if(!result){alert('Trade could not be completed. Review your wallet and saved listings.');return}
  n.status='completed';
  n.updatedAt=Date.now();
  n.history.push({by:'system',amount:n.agreedPrice,at:n.updatedAt,message:'Trade completed'});
  recordActivity(s,kind==='buy'?
    'Negotiated purchase of '+listingItemName(result.item)+' from '+result.seller+
      ' for '+n.agreedPrice+' coins':
    'Negotiated marketplace sale of '+listingItemName(result.item)+' for '+
      result.net+' coins ('+result.fee+' fee)');
  save();closeDialog();
  tab=kind==='buy'?'Inventory':'Market';
  render();
}
function enhancedMarket(){
  if(isSaveCurrent()){
    window.LootHubTraders.ensure(s);
    window.LootHubNPCMarket.refreshNpcMarket(s,dropCatalog,Date.now(),Math.random);
    for(const l of s.listings.slice(0,100))window.LootHubHaggling.begin(s,'sell',l.id);
    window.LootHubHaggling.resolveUnavailable(s,Date.now());
  }
  const listingItems=(s.listings||[]).map(l=>{
    const offer=window.LootHubHaggling.get(s,'sell',l.id);
    const quote=window.LootHubMarketCore.listingQuote(l.ask,estimated(l.item));
    return '<div class="listing-line market-listing-row">'+
      '<div class="listing-identity">'+visualArt(l.item)+
      '<div class="listing-identity-copy"><b>'+escapeHTML(listingItemName(l.item))+'</b>'+
      '<span class="muted tiny">Estimated '+money(estimated(l.item))+' ◈ · Listed '+new Date(l.createdAt).toLocaleString()+'</span>'+
      (l.updatedAt?'<span class="muted tiny">Price updated '+new Date(l.updatedAt).toLocaleString()+'</span>':'')+
      '</div></div>'+
      '<div class="market-listing-controls"><b>'+money(l.ask)+' ◈ asking</b>'+
      '<span class="muted tiny">Receive '+(quote?money(quote.net):'—')+' ◈ after fee</span>'+
      '<div class="row">'+(offer?'<button onclick="'+marketAction('reviewBuyerOffer',l.id)+'">Review offer</button>':
        '<span class="muted tiny">No affordable buyer yet</span>')+ 
      '<button onclick="'+marketAction('editListing',l.id)+'">Edit price</button>'+
      '<button onclick="'+marketAction('cancelListing',l.id)+'">Cancel</button></div></div>'+
      '</div>';
  }).join('');
  const ownable=s.items.filter(v=>window.LootHubMarketCore.eligible(v));
  const sellShelf=ownable.slice(0,6).map(item=>
    '<div class="item">'+visualArt(item)+
    '<h4>'+escapeHTML(listingItemName(item))+'</h4>'+
    '<p class="muted">Est. '+money(estimated(item))+' coins</p>'+
    '<button onclick="'+marketAction('listItem',item.id)+'">List item</button></div>').join('');
  const traderDirectory=s.market.traders.filter(x=>x.role==='buyer').map(t=>{
    const traits=window.LootHubTraders.summary(t);
    return '<div class="market-trader-profile"><b>'+escapeHTML(t.name)+'</b>'+
      '<span class="muted tiny">'+escapeHTML(traits.persona)+'</span>'+
      '<span class="muted tiny">Collects '+escapeHTML(traits.focus)+'</span>'+
      '<span class="muted tiny">Available budget: '+money(t.wallet)+' ◈ · '+
        traits.patience+' offer rounds</span></div>';
  }).join('');
  const view=npcMarketView;
  const select=(a,b)=>a===b?' selected':'';
  const count=window.LootHubNPCMarket.filterNpcListings(s.market.npcListings,view).length;
  return '<section class="panel npc-market-section">'+
    '<div class="section-eyebrow">LOOTBAY · SIMULATED TRADERS</div>'+
    '<div class="row space"><h2>Live Weapon Market</h2><span id="npcMarketCount" class="muted tiny">'+
      count+' listings</span></div>'+
    '<p class="muted">Inspect and buy actual listed collectibles from NPC sellers. These listings persist between visits; prices and item IDs are fixed until purchased or expired.</p>'+
    '<div class="npc-market-filters">'+
      '<label>Search weapons & sellers<input id="npcSearch" class="field" type="search" placeholder="Weapon, finish, seller..." value="'+escapeHTML(view.search)+'" oninput="updateNpcMarketFilter(\'search\',this.value)"></label>'+
      '<label>Item type<select id="npcKindFilter" class="field" onchange="updateNpcMarketFilter(\'kind\',this.value)">'+
      [['all','All items'],['weapon','Base weapons'],['skin','Approved skins'],['case','Cases']].map(x=>
        '<option value="'+x[0]+'"'+select(x[0],view.kind)+'>'+x[1]+'</option>').join('')+'</select></label>'+
      '<label>Rarity<select id="npcTierFilter" class="field" onchange="updateNpcMarketFilter(\'tier\',this.value)">'+
      '<option value="all"'+select('all',view.tier)+'>All rarities</option>'+
      tiers.map((x,i)=>'<option value="'+i+'"'+select(String(i),view.tier)+'>'+x+'</option>').join('')+
      '</select></label>'+
      '<label>Sort by<select id="npcSortFilter" class="field" onchange="updateNpcMarketFilter(\'sort\',this.value)">'+
      [['price-asc','Price: Low → High'],['price-desc','Price: High → Low'],['value-desc','Highest estimated value'],['newest','Newest first']].map(x=>
        '<option value="'+x[0]+'"'+select(x[0],view.sort)+'>'+x[1]+'</option>').join('')+
      '</select></label></div>'+
    '<div class="npc-market-grid" id="npcMarketResults">'+renderNpcMarketResults()+'</div>'+
    '<p class="muted tiny">NPC stock refreshes gradually. Each listing supports a saved negotiation with up to three offers. No real players are connected.</p>'+
    '</section>'+
    '<section class="panel"><div class="row space"><h2>My Market Listings <span class="muted">('+
      (s.listings||[]).length+')</span></h2><button onclick="go(\'Inventory\')">Full inventory</button></div>'+
    (listingItems||'<p class="muted">No active listings. Choose an owned item below to set your price.</p>')+
    '<p class="muted tiny">Your listings stay in escrow. Simulated buyers have finite budgets. Successful sales deduct the 5% fee.</p></section>'+ 
    '<section class="panel"><div class="section-eyebrow">TRADER PROFILES</div><h2>Meet the Buyers</h2>'+ 
    '<p class="muted tiny">Different collectors value different item types and negotiate with varying patience. Budgets are saved and decrease after purchases.</p>'+ 
    '<div class="market-trader-directory">'+traderDirectory+'</div></section>'+
    '<section class="panel"><div class="row space"><h3>List from Inventory</h3>'+
    '<span class="muted tiny">'+ownable.length+' available</span></div>'+
    (sellShelf?'<div class="cards">'+sellShelf+'</div>':
      '<p class="muted">Nothing available to list. Existing listings are held separately.</p>')+
    (ownable.length>6?'<p class="muted tiny">Showing 6 items. Use Full inventory to choose from the rest.</p>':'')+
    '</section>';
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
// Exactly one neutral master per model. Retired finishes are never displayed.
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
  'SPAS-12':'spas-12',
  'M60':'m60',
  'RPG-7':'rpg-7',
  'M1911':'m1911',
  'M1 Garand':'m1-garand',
  'Kar98k':'kar98k',
  'Thompson SMG':'thompson-smg',
  'FN SCAR-L':'fn-scar-l',
  'FN FAL':'fn-fal',
  'M134 Minigun':'m134-minigun'
});
const lootHubOriginalBaseMasters=Object.freeze({
  'Glock-18':'assets/renders/masters/glock-18-neutral-1600.webp',
  'AK-47':'assets/renders/masters/ak-47-neutral-1600.webp',
  'AWP':'assets/renders/masters/awp-neutral-1600.webp',
  'M4A4':'assets/renders/masters/m4a4-neutral-1600.webp',
  'Karambit':'assets/renders/masters/karambit-neutral-1600.webp'
});
function visualArt(item,context='inventory') {
  // Only the explicitly user-approved skin may replace a neutral master.
  if(item&&item.kind==='skin'&&item.weapon==='MAC-10'&&item.skin==='Red Devil'){
    const skin=typeof window!=='undefined'&&window.LootHubSkinArt&&window.LootHubSkinArt['MAC-10|Red Devil'];
    const size=context==='inspect'?'1600':context==='reel'?'400':'800';
    if(skin&&skin[size]){
      return '<div class="art weapon-art master-raster approved-skin" data-weapon-model="MAC-10" data-finish="Red Devil" data-art-status="approved-skin" data-resolution="'+size+'">'+
        '<img src="data:image/webp;base64,'+skin[size]+'" alt="MAC-10 | Red Devil user-approved skin" decoding="async" loading="'+(context==='inventory'?'lazy':'eager')+'"></div>';
    }
  }
  if(item&&item.kind!=='case'){
    const safeAttr=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const size=context==='inspect'?'1600':context==='reel'?'400':'800';
    const modelSlug=lootHubNeutralModels[item.weapon];
    const art=typeof window!=='undefined'&&window.LootHubNeutralArt&&window.LootHubNeutralArt[modelSlug];
    if(art&&art[size]){
      return '<div class="art weapon-art master-raster neutral-master" data-weapon-model="'+safeAttr(item.weapon)+'" data-resolution="'+size+'" data-art-status="base">'+
        '<img src="data:image/webp;base64,'+art[size]+'" alt="'+safeAttr(item.weapon)+' base weapon" decoding="async" loading="'+(context==='inventory'?'lazy':'eager')+'"></div>';
    }
    const master=lootHubOriginalBaseMasters[item.weapon];
    if(master){
      return '<div class="art weapon-art master-raster neutral-master" data-weapon-model="'+safeAttr(item.weapon)+'" data-resolution="1600" data-art-status="base">'+
        '<img src="./'+master+'" alt="'+safeAttr(item.weapon)+' base weapon" decoding="async" loading="'+(context==='inventory'?'lazy':'eager')+'"></div>';
    }
    // Legacy retired weapon models from old saves remain accessible, never skinned.
    if(typeof window!=='undefined'&&window.ArsenalMasters&&window.ArsenalMasters.supports(item.weapon)){
      try{return window.ArsenalMasters.render({...item,skin:''});}catch(_){}
    }
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
