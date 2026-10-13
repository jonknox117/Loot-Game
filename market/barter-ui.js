/* Loot Hub 0.6.2 — mobile NPC barter basket and clear consent summary.
   All offers are to simulated traders; no real player accounts exist. */
let barterDraft={seller:'',targets:[],items:[],coins:0,filter:'all'};
function barterEntry(){
 const available=s.market?.npcListings?.filter(l=>l&&l.expiresAt>Date.now()).length||0;
 return '<section class="panel barter-entry"><div><div class="section-eyebrow">NEW · NPC ITEM TRADES</div>'+
  '<h2>Trade skins for skins</h2><p class="muted">Offer up to five of your items and coins for up to five items from one simulated trader. Exact skins and wear transfer intact.</p></div>'+
  '<button class="primary" onclick="openBarter()" '+(available?'':'disabled')+'>Build a trade offer</button></section>';
}
function openBarter(id){
 if(busy)return;
 const listings=(s.market?.npcListings||[]).filter(l=>l&&l.expiresAt>Date.now());
 const first=id?listings.find(x=>x.id===id):listings[0];
 if(!first)return;
 barterDraft={seller:first.seller,targets:[first.id],items:[],coins:0,filter:'all'};
 renderBarter();
}
function barterChangeSeller(seller){
 if(busy)return;
 const found=(s.market.npcListings||[]).find(x=>x&&x.seller===seller&&x.expiresAt>Date.now());
 if(!found)return;
 barterDraft={seller,targets:[found.id],items:[],coins:0,filter:barterDraft.filter};
 renderBarter();
}
function barterToggle(kind,id){
 if(busy||!['targets','items'].includes(kind))return;
 const options=kind==='targets'?
  (s.market?.npcListings||[]).filter(x=>x&&x.seller===barterDraft.seller&&x.expiresAt>Date.now()).map(x=>x.id):
  s.items.map(x=>x.id);
 if(!options.includes(id))return;
 const list=barterDraft[kind];
 if(list.includes(id))barterDraft[kind]=list.filter(x=>x!==id);
 else if(list.length<5)barterDraft[kind]=list.concat(id);
 renderBarter();
}
function barterSetCoins(amount){
 if(busy)return;
 const n=Number(amount);
 if(!Number.isSafeInteger(n)||n<0||n>s.coins)return;
 barterDraft.coins=n;renderBarter();
}
function barterFilter(kind){
 if(!['all','skin','weapon','case'].includes(kind))return;
 barterDraft.filter=kind;renderBarter();
}
function renderBarter(){
 if(busy)return;
 const x=barterDraft,market=(s.market?.npcListings||[]);
 const seller=window.LootHubTraders.get(s,x.seller);
 if(!seller)return;
 x.targets=x.targets.filter(id=>market.some(l=>l.id===id&&l.seller===x.seller&&l.expiresAt>Date.now())).slice(0,5);
 x.items=x.items.filter(id=>s.items.some(item=>item.id===id)).slice(0,5);
 const quote=window.LootHubBarter.quote(s,x.seller,x.targets,x.items,x.coins);
 const candidateSellers=[...new Set(market.filter(l=>l&&l.expiresAt>Date.now()).map(l=>l.seller))];
 const candidates=market.filter(l=>l&&l.seller===x.seller&&l.expiresAt>Date.now());
 const owned=s.items.filter(item=>x.filter==='all'||item.kind===x.filter);
 const choice=(item,kind,id,chosen)=>{
  const full=kind==='targets'?x.targets:x.items,disabled=full.length===5&&!chosen;
  return '<label class="barter-choice'+(chosen?' selected':'')+'"><input type="checkbox" '+
   (chosen?'checked ':'')+(disabled?'disabled ':'')+
   'onchange="barterToggle(\''+kind+'\','+JSON.stringify(id).replace(/"/g,'&quot;')+')">'+
   '<div class="barter-item-art">'+visualArt(item,'reel')+'</div>'+
   '<div class="barter-item-copy"><strong>'+escapeHTML(itemName(item))+'</strong>'+
   '<small class="muted">'+escapeHTML(rarity(item))+' · '+conditionLabel(item)+
   '</small></div></label>';
 };
 // Native mobile checkboxes are stable even when a trader offers many items.
 dialog('<div class="barter-dialog"><div class="section-eyebrow">NPC TRADE DESK</div>'+
  '<h2>Build a skin trade</h2><p class="muted tiny">One NPC seller per trade. This is a simulated offer, not multiplayer.</p>'+
  '<label class="barter-field">Trader<select id="barterSeller" class="field" onchange="barterChangeSeller(this.value)">'+
  candidateSellers.map(name=>'<option value="'+escapeHTML(name)+'"'+(name===x.seller?' selected':'')+'>'+
   escapeHTML(name)+'</option>').join('')+'</select></label>'+
  '<p class="muted tiny">'+escapeHTML(window.LootHubTraders.summary(seller).persona)+
  ' · Values your preferred collectibles more generously</p>'+
  '<div class="barter-sides"><section class="barter-side"><h3>You receive ('+x.targets.length+'/5)</h3>'+
   '<div class="barter-choice-list">'+candidates.map(l=>choice(l.item,'targets',l.id,x.targets.includes(l.id))).join('')+
   '</div></section><section class="barter-side"><h3>You offer ('+x.items.length+'/5)</h3>'+
   '<label class="barter-field">Show <select class="field" onchange="barterFilter(this.value)">'+
   ['all','skin','weapon','case'].map(v=>'<option value="'+v+'"'+(x.filter===v?' selected':'')+'>'+
   (v==='all'?'All items':v==='skin'?'Skins only':v==='weapon'?'Weapons only':'Cases only')+'</option>').join('')+
   '</select></label><div class="barter-choice-list">'+(owned.length?owned.slice(0,150).map(item=>
    choice(item,'items',item.id,x.items.includes(item.id))).join(''):'<p class="muted">No items of this type.</p>')+
   '</div></section></div>'+
  '<div class="barter-total"><label class="barter-field">Coins you add <input id="barterCoins" class="field" type="number" min="0" step="1" max="'+s.coins+
   '" value="'+x.coins+'" onchange="barterSetCoins(this.value)"></label>'+
   '<div class="stat"><span>NPC requires</span><b>'+money(quote?.minimum||
    candidates.filter(v=>x.targets.includes(v.id)).reduce((a,v)=>a+v.ask,0))+' value</b></div>'+
   '<div class="stat"><span>Your trade-in credit</span><b>'+money(quote?.offeredValue||0)+'</b></div>'+
   '<div class="stat"><span>Coins added</span><b>'+money(x.coins)+'</b></div>'+
   '<div class="stat"><span>Offer result</span><b class="'+(quote?.accepted?'trade-accepted':'trade-insufficient')+'">'+
   (quote?.accepted?'ACCEPTED':quote?'Need '+money(quote.missing)+' more':'Choose an offer')+'</b></div></div>'+
  '<div class="barter-actions"><button class="primary" onclick="confirmBarter()" '+(quote?.accepted?'':'disabled')+
   '>Complete trade</button><button onclick="closeDialog()">Cancel</button></div></div>');
}
function confirmBarter(){
 if(busy||!canMutate())return false;
 const x=barterDraft,q=window.LootHubBarter.quote(s,x.seller,x.targets,x.items,x.coins);
 if(!q?.accepted){renderBarter();return false}
 const snapshot=JSON.stringify(s);
 busy=true;
 // Credit items already owned before they leave the player's inventory.
 window.LootHubCollections.reconcile(s);
 const result=window.LootHubBarter.settle(s,x.seller,x.targets,x.items,x.coins);
 if(!result){s=JSON.parse(snapshot);busy=false;return false}
 recordActivity(s,'Traded '+result.offeredItems.length+' items + '+result.coins+
  ' coins to '+result.seller+' for '+result.listingItems.map(itemName).join(', '));
 if(!save()){
  s=JSON.parse(snapshot);busy=false;
  alert('The trade could not be saved. Your items and coins have been restored.');
  return false;
 }
 busy=false;tab='Inventory';render();
 window.LootHubFX.play('confirm');
 dialog('<div class="barter-complete"><div class="section-eyebrow">NPC TRADE COMPLETED</div><h2>Trade accepted</h2>'+
  '<p class="muted">You gave '+result.offeredItems.length+' item'+(result.offeredItems.length===1?'':'s')+
  ' and '+money(result.coins)+' coins to '+escapeHTML(result.seller)+'.</p>'+
  '<p class="muted">You received '+result.listingItems.length+' exact item'+(result.listingItems.length===1?'':'s')+'.</p>'+
  '<div class="barter-win-grid">'+result.listingItems.map(item=>
  '<div class="barter-win-item">'+visualArt(item,'inventory')+'<strong>'+escapeHTML(itemName(item))+'</strong>'+
  '<small class="muted">'+conditionLabel(item)+'</small></div>').join('')+'</div>'+
  '<button class="primary" onclick="closeDialog()">Go to Inventory</button></div>');
 return true;
}
