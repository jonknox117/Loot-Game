/* LootHub 0.4.3: persistent two-way NPC negotiations.
   One fixed budget per listing, three offers maximum, no reroll on reload. */
(function(root){
'use strict';
const core=root.LootHubMarketCore;
const MAX_ROUNDS=3;
function hash(text){
  let n=2166136261;
  for(let i=0;i<text.length;i++){n=Math.imul(n^text.charCodeAt(i),16777619)}
  return (n>>>0)/4294967296;
}
function locate(game,kind,listingId){
  const arr=kind==='buy'?game.market.npcListings:kind==='sell'?game.listings:null;
  return Array.isArray(arr)?arr.find(x=>x&&x.id===listingId):null;
}
function get(game,kind,listingId){
  const listing=locate(game,kind,listingId);
  const id=kind+':'+listingId+(kind==='sell'&&listing?':'+listing.createdAt:'');
  return game.market.negotiations.find(x=>x&&x.id===id)||null;
}
function begin(game,kind,listingId,now=Date.now()){
  if(!game||!game.market||!Array.isArray(game.market.negotiations)||!Number.isFinite(now))return null;
  const existing=get(game,kind,listingId);
  if(existing)return existing;
  const listing=locate(game,kind,listingId);
  if(!listing||!listing.item||!core.validAsk(listing.ask))return null;
  const ratio=hash(kind+'|'+listing.id+'|'+(listing.seller||''));
  const buyer=kind==='sell';
  const threshold=buyer?
    Math.max(1,Math.round(listing.ask*(.85+ratio*.20))):
    Math.max(1,Math.min(listing.ask,Math.round(listing.ask*(.79+ratio*.14))));
  const npcOffer=buyer?Math.max(1,Math.min(threshold,Math.round(listing.ask*(.69+ratio*.15)))):listing.ask;
  const deal={id:kind+':'+listing.id+(kind==='sell'?':'+listing.createdAt:''),kind,listingId:listing.id,itemId:listing.item.id,
    listingCreatedAt:listing.createdAt,
    initialAsk:listing.ask,threshold,npcOffer,rounds:0,status:'open',agreedPrice:null,
    seller:buyer?'Interested Collector':listing.seller,createdAt:now,updatedAt:now,
    history:[{by:'npc',amount:npcOffer,at:now}]};
  game.market.negotiations.push(deal);
  return deal;
}
function stillAvailable(game,deal){
  const listing=locate(game,deal.kind,deal.listingId);
  return listing&&listing.item&&listing.item.id===deal.itemId&&
    listing.ask===deal.initialAsk&&listing.createdAt===deal.listingCreatedAt;
}
function submit(game,kind,listingId,amount,now=Date.now()){
  const n=get(game,kind,listingId);
  if(!n||n.status!=='open'||!core.validAsk(amount)||!Number.isFinite(now)||
    (n.kind==='buy'&&amount>n.initialAsk))return null;
  if(!stillAvailable(game,n)){n.status='unavailable';n.updatedAt=now;return n}
  if(n.rounds>=MAX_ROUNDS)return null;
  n.rounds++;
  n.updatedAt=now;
  n.history.push({by:'player',amount,at:now});
  const accepted=n.kind==='buy'?amount>=n.threshold:amount<=n.threshold;
  if(accepted){
    n.agreedPrice=amount;n.status='agreed';
    n.history.push({by:'npc',amount,at:now,message:'Deal agreed'});
  }else if(n.rounds>=MAX_ROUNDS){
    n.status='walked';
    n.history.push({by:'npc',at:now,message:'Trader walked away'});
  }else{
    if(n.kind==='buy'){
      n.npcOffer=Math.max(n.threshold,Math.min(n.npcOffer,
        Math.round((n.npcOffer+amount)/2)));
    }else{
      n.npcOffer=Math.min(n.threshold,Math.max(n.npcOffer,
        Math.round((n.npcOffer+amount)/2)));
    }
    n.history.push({by:'npc',amount:n.npcOffer,at:now,message:'Counteroffer'});
  }
  return n;
}
function acceptCounter(game,kind,listingId,now=Date.now()){
  const n=get(game,kind,listingId);
  if(!n||n.status!=='open'||!core.validAsk(n.npcOffer)||!Number.isFinite(now))return null;
  if(!stillAvailable(game,n)){n.status='unavailable';n.updatedAt=now;return n}
  n.status='agreed';n.agreedPrice=n.npcOffer;n.updatedAt=now;
  n.history.push({by:'player',amount:n.agreedPrice,at:now,message:'Accepted counteroffer'});
  return n;
}
function walkAway(game,kind,listingId,now=Date.now()){
  const n=get(game,kind,listingId);
  if(!n||n.status!=='open'||!Number.isFinite(now))return null;
  n.status='declined';n.updatedAt=now;
  n.history.push({by:'player',at:now,message:'Walked away'});
  return n;
}
function resolveUnavailable(game,now=Date.now()){
  if(!game||!game.market||!Array.isArray(game.market.negotiations))return 0;
  let count=0;
  for(const n of game.market.negotiations){
    if(n&&(n.status==='open'||n.status==='agreed')&&!stillAvailable(game,n)){
      n.status='unavailable';n.updatedAt=now;count++;
    }
  }
  return count;
}
function closeForListing(game,kind,listingId,now=Date.now()){
  if(!game||!game.market||!Array.isArray(game.market.negotiations))return;
  for(const n of game.market.negotiations){
    if(n&&n.kind===kind&&n.listingId===listingId&&
      (n.status==='open'||n.status==='agreed')){
      n.status='unavailable';n.updatedAt=now;
    }
  }
}
root.LootHubHaggling=Object.freeze({
  MAX_ROUNDS,hash,get,begin,submit,acceptCounter,walkAway,stillAvailable,
  resolveUnavailable,closeForListing
});
})(window);
