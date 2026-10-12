/* LootHub 0.4.5 — bounded single-player market discovery.
   Base estimates never change. Only completed marketplace trades affect momentum.
   Quotes are deterministic from saved events + current listings; no rerolls on render. */
(function(root){
'use strict';
const core=root.LootHubMarketCore;
const DAY=86400000,MAX_KEYS=120,MAX_TRADES_PER_DAY=6,MAX_SAMPLES=12;
const MIN_FACTOR=.7,MAX_FACTOR=1.35;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function key(item){
  if(!item||!core.eligible({...item,id:item.id||'market-reference'}))return null;
  if(item.kind==='case')return 'case';
  const weapon=String(item.weapon||'').trim().toLowerCase();
  if(!weapon||weapon.length>120)return null;
  const skin=item.kind==='skin'?String(item.skin||'').trim().toLowerCase():'';
  if(item.kind==='skin'&&(!skin||skin.length>120))return null;
  return item.kind+':'+encodeURIComponent(weapon)+(skin?':'+encodeURIComponent(skin):'');
}
function history(game){
  const m=core.ensureMarketState(game);
  return m&&m.priceHistory;
}
function state(game,item){
  const h=history(game),id=key(item);
  return id&&h&&Object.prototype.hasOwnProperty.call(h,id)?h[id]:null;
}
function available(game,item){
  const id=key(item);
  if(!id||!game)return 0;
  const mine=Array.isArray(game.listings)?game.listings:[];
  const theirs=game.market&&Array.isArray(game.market.npcListings)?game.market.npcListings:[];
  return mine.concat(theirs).reduce((count,x)=>count+(x&&key(x.item)===id?1:0),0);
}
function priceInfo(game,item,now=Date.now()){
  const base=core.estimated(item),record=state(game,item);
  const supply=available(game,item);
  const elapsed=record&&Number.isFinite(record.updatedAt)?
    Math.max(0,now-record.updatedAt)/DAY:0;
  const momentum=record&&Number.isFinite(record.momentum)?
    clamp(record.momentum,-.25,.25)*Math.pow(.84,Math.min(365,elapsed)):0;
  // A small, bounded scarcity factor; a user cannot drive prices by relisting.
  const scarcity=clamp((2-supply)*.02,-.08,.04);
  const multiplier=clamp(1+momentum+scarcity,MIN_FACTOR,MAX_FACTOR);
  const value=Math.max(1,Math.round(base*multiplier));
  return {key:key(item),base,value,multiplier,momentum,scarcity,supply,
    volume:record&&Number.isSafeInteger(record.volume)?record.volume:0,
    recent:record&&Array.isArray(record.recent)?record.recent:[]};
}
function marketValue(game,item,now=Date.now()){
  return priceInfo(game,item,now).value;
}
function recordTrade(game,item,price,side,now=Date.now()){
  if(!game||!core.validAsk(price)||!Number.isFinite(now)||
    (side!=='buy'&&side!=='sell'))return false;
  const id=key(item),h=history(game);
  if(!id||!h)return false;
  const day=Math.floor(now/DAY);
  let record=state(game,item);
  if(!record){
    if(Object.keys(h).length>=MAX_KEYS)return false;
    record={momentum:0,volume:0,updatedAt:now,lastDay:day,eventsToday:0,recent:[]};
    Object.defineProperty(h,id,{value:record,writable:true,enumerable:true,configurable:true});
  }
  if(!Number.isSafeInteger(record.lastDay)||!Number.isSafeInteger(record.eventsToday)||
    !Number.isFinite(record.updatedAt)||!Array.isArray(record.recent))return false;
  // Backdated clock changes cannot create fresh daily quotas.
  if(now<record.updatedAt||day<record.lastDay)return false;
  if(day>record.lastDay){record.lastDay=day;record.eventsToday=0}
  if(record.eventsToday>=MAX_TRADES_PER_DAY)return false;
  const base=Math.max(1,core.estimated(item));
  const previous=clamp(Number(record.momentum)||0,-.25,.25)*
    Math.pow(.84,Math.min(365,(now-record.updatedAt)/DAY));
  const deviation=clamp(price/base-1,-.5,.5);
  const impulse=(side==='buy'?.02:-.02)+deviation*.018;
  record.momentum=clamp(previous+impulse,-.25,.25);
  record.updatedAt=now;
  record.eventsToday++;
  record.volume=Math.min(1000000,(Number.isSafeInteger(record.volume)?record.volume:0)+1);
  record.recent.push({at:now,price,side});
  if(record.recent.length>MAX_SAMPLES)record.recent=record.recent.slice(-MAX_SAMPLES);
  return true;
}
function validHistory(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const keys=Object.keys(value);
  if(keys.length>MAX_KEYS)return false;
  for(const id of keys){
    const x=value[id];
    if(id.length>300||!x||typeof x!=='object'||Array.isArray(x)||
       !Number.isFinite(x.momentum)||x.momentum<-.25||x.momentum>.25||
       !Number.isSafeInteger(x.volume)||x.volume<0||x.volume>1000000||
       !Number.isFinite(x.updatedAt)||!Number.isSafeInteger(x.lastDay)||
       !Number.isSafeInteger(x.eventsToday)||x.eventsToday<0||
       x.eventsToday>MAX_TRADES_PER_DAY||
       !Array.isArray(x.recent)||x.recent.length>MAX_SAMPLES)return false;
    for(const sale of x.recent){
      if(!sale||!Number.isFinite(sale.at)||!core.validAsk(sale.price)||
         !['buy','sell'].includes(sale.side))return false;
    }
  }
  return true;
}
root.LootHubEconomy=Object.freeze({DAY,MAX_TRADES_PER_DAY,MAX_SAMPLES,
  MIN_FACTOR,MAX_FACTOR,key,state,available,priceInfo,marketValue,recordTrade,validHistory});
})(window);
