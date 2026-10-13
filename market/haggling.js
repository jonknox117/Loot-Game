/* LootHub 0.4.7: persistent two-way NPC negotiations.
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
  const deal=game.market.negotiations.find(x=>x&&x.id===id)||null;
  // Existing open saves from the old asking-price-based economy must not
  // retain exploitable buyer ceilings or bids after the rules are upgraded.
  if(deal&&deal.kind==='sell'&&deal.status==='open'&&listing){
    const trader=root.LootHubTraders.get(game,deal.traderId);
    if(trader){
      const limit=root.LootHubTraders.buyerValue(game,trader,listing.item,listing.id);
      deal.threshold=Math.min(deal.threshold,limit);
      deal.npcOffer=Math.min(deal.npcOffer,deal.threshold);
    }
  }
  return deal;
}
function begin(game,kind,listingId,now=Date.now()){
  if(!game||!game.market||!Array.isArray(game.market.negotiations)||!Number.isFinite(now))return null;
  const existing=get(game,kind,listingId);
  if(existing)return existing;
  const listing=locate(game,kind,listingId);
  if(!listing||listing.mode==='auction'||!listing.item||!core.validAsk(listing.ask))return null;
  const terms=root.LootHubTraders.terms(game,kind,listing);
  if(!terms)return null;
  const {threshold,npcOffer,traderId,persona,description,focus,maxRounds,concession}=terms;
  const item=listing.item;
  const itemName=item.kind==='case'?'Sealed Arsenal Case':
    String(item.weapon||'Collectible')+(item.kind==='skin'&&item.skin?' | '+item.skin:'');
  const deal={id:kind+':'+listing.id+(kind==='sell'?':'+listing.createdAt:''),kind,listingId:listing.id,itemId:listing.item.id,itemName,
    listingCreatedAt:listing.createdAt,
    initialAsk:listing.ask,threshold,npcOffer,rounds:0,status:'open',agreedPrice:null,
    traderId,persona,description,focus,maxRounds,concession,
    seller:terms.seller,createdAt:now,updatedAt:now,
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
  const limit=Number.isSafeInteger(n.maxRounds)?n.maxRounds:MAX_ROUNDS;
  if(n.rounds>=limit)return null;
  n.rounds++;
  n.updatedAt=now;
  n.history.push({by:'player',amount,at:now});
  const accepted=n.kind==='buy'?amount>=n.threshold:amount<=n.threshold;
  if(accepted){
    n.agreedPrice=amount;n.status='agreed';
    n.history.push({by:'npc',amount,at:now,message:'Deal agreed'});
  }else if(n.rounds>=limit){
    n.status='walked';
    n.history.push({by:'npc',at:now,message:'Trader walked away'});
  }else{
    const step=Number.isFinite(n.concession)?n.concession:.5;
    if(n.kind==='buy'){
      const target=Math.max(n.threshold,amount);
      n.npcOffer=Math.max(n.threshold,Math.min(n.npcOffer,
        Math.round(n.npcOffer-(n.npcOffer-target)*step)));
    }else{
      const target=Math.min(n.threshold,amount);
      n.npcOffer=Math.min(n.threshold,Math.max(n.npcOffer,
        Math.round(n.npcOffer+(target-n.npcOffer)*step)));
    }
    n.history.push({by:'npc',amount:n.npcOffer,at:now,message:'Counteroffer'});
  }
  return n;
}
function tactic(game,kind,listingId,action,amount,now=Date.now()){
  const n=get(game,kind,listingId);
  if(!n||n.status!=='open'||!['counter','hold','concede','final'].includes(action)||
     !core.validAsk(amount))return null;
  // Firm demands cost patience, concessions actually lower the player's price,
  // and a rejected final offer ends this discussion rather than rerolling.
  if(action==='hold'&&n.rounds>0)n.rounds=Math.min(n.maxRounds||MAX_ROUNDS,n.rounds+1);
  const proposed=action==='concede'?
    (kind==='sell'?Math.max(1,Math.floor(amount*.95)):
     Math.max(1,Math.ceil(amount*1.05))):amount;
  const outcome=submit(game,kind,listingId,proposed,now);
  if(!outcome)return null;
  if(action==='final'&&outcome.status==='open'){
    outcome.status='walked';outcome.updatedAt=now;
    outcome.history.push({by:'npc',at:now,message:'Final offer declined; trader left'});
  }
  if(action!=='counter')outcome.history.push({by:'system',at:now,message:{hold:'You held firm',concede:'You made a concession',final:'Final offer'}[action]});
  return outcome;
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
  MAX_ROUNDS,hash,get,begin,submit,tactic,acceptCounter,walkAway,stillAvailable,
  resolveUnavailable,closeForListing
});
})(window);
