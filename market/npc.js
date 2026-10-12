/* LootHub Marketplace 0.4.5: persistent simulated seller inventory.
   All rewards come exclusively from the live, explicitly approved dropCatalog. */
(function(root){
'use strict';
const core=root.LootHubMarketCore;
const TARGET=15,REFRESH_MS=20*60*1000;
const SELLERS=Object.freeze(['CaseRunner','The Quartermaster','OldIron','ClearanceRack',
  'CollectorNox','NightShift','ArsenalTrader','Rust&Steel','VaultKeeper','FieldDealer']);
const TIER_CYCLE=Object.freeze([0,0,1,0,2,1,0,3,1,2,0,1,4,2,0]);
const validRandom=random=>Math.min(.999999999,Math.max(0,Number(random())||0));
function availablePool(dropCatalog){
  return Array.isArray(dropCatalog)?dropCatalog.filter(x=>x&&
    (x.kind==='weapon'||x.kind==='skin')&&
    typeof x.weapon==='string'&&x.weapon.length>0&&
    Number.isInteger(x.tier)&&x.tier>=0&&x.tier<=4&&
    Number.isFinite(x.base)&&x.base>0&&
    (x.kind!=='skin'||(typeof x.skin==='string'&&x.skin.length>0))):[];
}
function pick(pool,random){return pool[Math.floor(validRandom(random)*pool.length)]}
function makeListing(game,m,pool,now,random){
  const ticket=m.nextNpcId++;
  const slot=(ticket-1)%TIER_CYCLE.length;
  let template;
  if(slot===0 || slot===8)template={kind:'case'};
  else if(slot===12){
    const approved=pool.filter(x=>x.kind==='skin');
    template=approved.length?pick(approved,random):null;
  }
  if(!template){
    const tier=TIER_CYCLE[slot];
    const options=pool.filter(x=>x.kind==='weapon'&&x.tier===tier);
    template=pick(options.length?options:pool,random);
  }
  const item={...template,id:'npc-item-'+ticket};
  if(item.kind==='case')item.paid=25;
  const market=root.LootHubEconomy.marketValue(game,item,now);
  const ask=Math.max(1,Math.min(100000000,Math.round(market*(.86+validRandom(random)*.48))));
  return {id:'npc-list-'+ticket,seller:SELLERS[ticket%SELLERS.length],
    item,ask,createdAt:now,expiresAt:now+(24+Math.floor(validRandom(random)*49))*3600000};
}
function refreshNpcMarket(game,dropCatalog,now=Date.now(),random=Math.random){
  if(!game||!Number.isFinite(now))return {changed:false,added:0,expired:0};
  const pool=availablePool(dropCatalog),m=core.ensureMarketState(game,now);
  if(!pool.length)return {changed:false,added:0,expired:0};
  if(!Number.isSafeInteger(m.nextNpcId)||m.nextNpcId<1){
    const ids=m.npcListings.map(x=>Number(String(x&&x.id||'').replace(/^npc-list-/,'')))
      .filter(x=>Number.isSafeInteger(x)&&x>0);
    m.nextNpcId=Math.max(0,...ids)+1;
  }
  let changed=false,added=0,expired=0;
  if(m.npcInitialized!==true){
    m.npcInitialized=true;
    m.lastNpcRefreshAt=now;
    while(m.npcListings.length<TARGET){m.npcListings.push(makeListing(game,m,pool,now,random));added++}
    return {changed:true,added,expired};
  }
  if(!Number.isFinite(m.lastNpcRefreshAt))m.lastNpcRefreshAt=now;
  const oldLength=m.npcListings.length;
  m.npcListings=m.npcListings.filter(x=>x&&Number.isFinite(x.expiresAt)&&x.expiresAt>now);
  expired=oldLength-m.npcListings.length;
  changed=expired>0;
  const elapsed=Math.floor(Math.max(0,now-m.lastNpcRefreshAt)/REFRESH_MS);
  if(elapsed>0){
    m.lastNpcRefreshAt=now; // cap catch-up after lengthy offline time or clock changes
    const count=Math.min(TARGET-m.npcListings.length,Math.min(TARGET,elapsed));
    for(let i=0;i<count;i++){m.npcListings.push(makeListing(game,m,pool,now,random));added++}
    changed=true;
  }
  return {changed,added,expired};
}
function filterNpcListings(listings,options={}){
  if(!Array.isArray(listings))return [];
  const search=String(options.search||'').trim().toLocaleLowerCase();
  const kind=['all','case','weapon','skin'].includes(options.kind)?options.kind:'all';
  const tier=['all','0','1','2','3','4'].includes(String(options.tier))?String(options.tier):'all';
  const sorted=listings.filter(l=>{
    if(!l||!l.item)return false;
    const item=l.item;
    if(kind!=='all'&&item.kind!==kind)return false;
    if(tier!=='all'&&(item.kind==='case'?'2':String(item.tier))!==tier)return false;
    const name=item.kind==='case'?'Sealed Arsenal Case':item.weapon+' '+(item.skin||'');
    return !search||[name,l.seller].some(x=>String(x||'').toLocaleLowerCase().includes(search));
  });
  const mode=String(options.sort||'price-asc');
  const compare={
    'price-asc':(a,b)=>a.ask-b.ask,
    'price-desc':(a,b)=>b.ask-a.ask,
    'value-desc':(a,b)=>core.estimated(b.item)-core.estimated(a.item),
    'newest':(a,b)=>b.createdAt-a.createdAt
  }[mode]||((a,b)=>a.ask-b.ask);
  sorted.sort((a,b)=>compare(a,b)||a.id.localeCompare(b.id));
  return sorted;
}
root.LootHubNPCMarket=Object.freeze({
  TARGET,REFRESH_MS,availablePool,refreshNpcMarket,filterNpcListings
});
})(window);
