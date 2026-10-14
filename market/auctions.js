/* LootHub 0.7.0 — deterministic, escrowed player auctions.
   One stored 15-minute event per auction slot. No random rerolls on reload. */
(function(root){'use strict';
const core=root.LootHubMarketCore,STEP=15*60000;
const DURATIONS=Object.freeze([1,6,12,24]);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function hash(v){let h=2166136261;for(let i=0;i<v.length;i++)h=Math.imul(h^v.charCodeAt(i),16777619);return(h>>>0)/4294967296}
function notifications(game){const m=core.ensureMarketState(game);if(!Array.isArray(m.notifications))m.notifications=[];return m.notifications}
function notify(game,type,listing,text,at){
 const all=notifications(game);const id='auction:'+listing.id+':'+type+':'+(type==='bid'?listing.bids.length:listing.endsAt);
 if(all.some(n=>n.id===id))return;
 all.unshift({id,type,listingId:listing.id,message:text,at,read:false});
 if(all.length>100)all.length=100;
}
function isAuction(l){return !!(l&&l.mode==='auction'&&l.item&&core.validAsk(l.ask)&&
 Number.isFinite(l.createdAt)&&Number.isFinite(l.endsAt)&&l.endsAt>l.createdAt&&
 Array.isArray(l.bids)&&Number.isSafeInteger(l.nextSlot)&&l.nextSlot>=0)}
function create(game,itemId,start,durationHours,now=Date.now()){
 if(!game||!core.validAsk(start)||!DURATIONS.includes(durationHours)||
 !Number.isFinite(now)||!Array.isArray(game.items)||!Array.isArray(game.listings)||
 game.listings.filter(isAuction).length>=40)return null;
 const item=game.items.find(x=>x.id===itemId);
 if(!item||!core.eligible(item))return null;
 const reference=Math.max(1,root.LootHubEconomy.marketValue(game,item,now));
 const listing=root.LootHubMarketTransactions.createListing(game,itemId,start,now,'auction');
 if(!listing)return null;
 Object.assign(listing,{durationHours,endsAt:now+durationHours*3600000,reference,
  bids:[],highestBid:0,highestBidder:null,nextSlot:0});
 return listing;
}
function increment(price){return Math.max(1,Math.ceil(price*.025))}
function reserved(game,buyerId,excludeId){
 return (game.listings||[]).filter(x=>isAuction(x)&&x.id!==excludeId&&
 x.highestBidder===buyerId&&x.highestBid>0)
 .reduce((sum,x)=>sum+x.highestBid,0);
}
function ceiling(game,listing,buyer){
 const style=root.LootHubTraders.style(buyer),favor=root.LootHubTraders.likes(buyer,listing.item);
 const spread=(hash('value|'+listing.id+'|'+buyer.id)-.5)*.05;
 const factor=clamp(style.buyCeiling+(favor?.11:-.065)+spread,.55,1.23);
 const limit=Math.round(listing.reference*factor);
 // The buyer's budget is finite and its other active bids reserve funds.
 return Math.max(0,Math.min(limit,root.LootHubTraders.buyingPower(game,buyer)-reserved(game,buyer.id,listing.id)));
}
function eligibleBidders(game,listing,slot){
 const buyers=root.LootHubTraders.ensure(game).filter(x=>x.role==='buyer');
 const bids=listing.bids;
 const current=listing.highestBid||0;
 const min=current?current+increment(current):listing.ask;
 return buyers.filter(b=>{
   if(listing.highestBidder===b.id)return false;
   const value=ceiling(game,listing,b);
   if(value<min)return false;
   const favor=root.LootHubTraders.likes(b,listing.item);
   const participation=favor?.52:.22;
   return hash('visit|'+listing.id+'|'+slot+'|'+b.id)<participation;
 }).sort((a,b)=>hash('order|'+listing.id+'|'+slot+'|'+a.id)-
   hash('order|'+listing.id+'|'+slot+'|'+b.id));
}
function processSlot(game,listing,slot,at){
 const bidders=eligibleBidders(game,listing,slot);
 if(!bidders.length)return false;
 const buyer=bidders[0],high=listing.highestBid||0;
 const next=high?high+increment(high):listing.ask;
 if(next>ceiling(game,listing,buyer))return false;
 listing.highestBid=next;listing.highestBidder=buyer.id;
 listing.bids.push({bidder:buyer.id,amount:next,at});
 if(listing.bids.length>96)listing.bids.shift();
 // Keep the inbox useful: retain every bid in history, but summarize notifications.
 if(listing.bids.length===1||listing.bids.length%5===0)
   notify(game,'bid',listing,'New bid of '+next+' coins on '+label(listing.item)+'.',at);
 return true;
}
function label(item){return item.kind==='case'?'Sealed '+(item.caseId||'Arsenal')+' Case':
 (item.weapon||'Collectible')+(item.kind==='skin'&&item.skin?' | '+item.skin:'')}
function settle(game,listing,now){
 const i=game.listings.findIndex(x=>x.id===listing.id);
 if(i<0||!isAuction(listing)||now<listing.endsAt)return null;
 const price=listing.highestBid;
 if(!price){
   if(game.items.some(x=>x.id===listing.item.id))return null;
   game.listings.splice(i,1);game.items.push(listing.item);
   notify(game,'unsold',listing,label(listing.item)+' received no bids and returned to your inventory.',now);
   return {status:'unsold',item:listing.item,price:0};
 }
 const buyer=root.LootHubTraders.get(game,listing.highestBidder);
 const net=core.netProceeds(price);
 if(!buyer||buyer.role!=='buyer'||!root.LootHubTraders.canFund(game,buyer.id,price)||
   !Number.isSafeInteger(game.coins+net)||!Number.isSafeInteger(game.sales+net)||
   !Number.isSafeInteger(game.rep+1)){
   // A buyer can become insolvent after placing a bid due to other trades.
   // Never leave the player's item trapped in an expired auction.
   if(game.items.some(x=>x.id===listing.item.id))return null;
   game.listings.splice(i,1);game.items.push(listing.item);
   notify(game,'unsold',listing,label(listing.item)+' was returned because its winning bidder could not pay.',now);
   return {status:'unsold',item:listing.item,price:0};
 }
 if(!root.LootHubTraders.finishSale(game,buyer.id,price))return null;
 game.listings.splice(i,1);game.coins+=net;game.sales+=net;game.rep++;
 root.LootHubEconomy.recordTrade(game,listing.item,price,'sell',now);
 notify(game,'sold',listing,label(listing.item)+' sold for '+price+' coins. You received '+net+' after fees.',now);
 return {status:'sold',item:listing.item,price,net,fee:price-net,buyer:buyer.id};
}
// Early acceptance is an explicit final sale, never a cancellation or simulation reroll.
// The expected amount and buyer bind the confirmation to the bid the player saw.
function acceptHighestBid(game,id,expectedAmount,expectedBuyer,now=Date.now()){
 if(!game||!Array.isArray(game.listings)||!Array.isArray(game.items)||!Number.isFinite(now))return null;
 const listing=game.listings.find(l=>l.id===id);
 if(!isAuction(listing)||now<listing.createdAt||now>=listing.endsAt||
    !core.validAsk(expectedAmount)||typeof expectedBuyer!=='string'||
    listing.highestBid!==expectedAmount||listing.highestBidder!==expectedBuyer||
    !listing.bids.length||listing.bids[listing.bids.length-1].amount!==expectedAmount||
    listing.bids[listing.bids.length-1].bidder!==expectedBuyer||
    game.items.some(x=>x.id===listing.item.id))return null;
 const price=listing.highestBid,buyer=root.LootHubTraders.get(game,expectedBuyer);
 const net=core.netProceeds(price);
 if(!buyer||buyer.role!=='buyer'||!root.LootHubTraders.canFund(game,buyer.id,price)||
    !Number.isSafeInteger(game.coins+net)||!Number.isSafeInteger(game.sales+net)||
    !Number.isSafeInteger(game.rep+1))return null;
 if(!root.LootHubTraders.finishSale(game,buyer.id,price))return null;
 game.listings.splice(game.listings.indexOf(listing),1);
 game.coins+=net;game.sales+=net;game.rep++;
 root.LootHubEconomy.recordTrade(game,listing.item,price,'sell',now);
 notify(game,'sold',listing,label(listing.item)+' sold early for '+price+
   ' coins. You received '+net+' after fees.',now);
 return {status:'sold',early:true,item:listing.item,price,net,fee:price-net,buyer:buyer.id};
}
function advance(game,now=Date.now()){
 const outcome={changed:false,bids:0,sales:[],expired:0};
 if(!game||!Array.isArray(game.listings)||!Number.isFinite(now))return outcome;
 for(const listing of [...game.listings]){
  if(!isAuction(listing)||now<listing.createdAt)continue;
  const stop=Math.min(now,listing.endsAt);
  const slots=Math.min(96,Math.floor((stop-listing.createdAt)/STEP));
  while(listing.nextSlot<slots){
    const slot=listing.nextSlot++;
    const at=listing.createdAt+(slot+1)*STEP;
    if(processSlot(game,listing,slot,at))outcome.bids++;
    outcome.changed=true;
  }
  if(now>=listing.endsAt){
    const closed=settle(game,listing,listing.endsAt);
    if(closed){outcome.changed=true;outcome.expired++;if(closed.status==='sold')outcome.sales.push(closed);}
  }
 }
 return outcome;
}
function cancel(game,id){
 const listing=Array.isArray(game.listings)&&game.listings.find(x=>x.id===id);
 if(!isAuction(listing)||listing.bids.length||game.items.some(x=>x.id===listing.item.id))return null;
 game.listings.splice(game.listings.indexOf(listing),1);
 game.items.push(listing.item);return listing;
}
function validate(game){
 if(!game||typeof game!=='object'||Array.isArray(game))return false;
 // Legacy saves may omit the listings collection entirely; loadGame adds it.
 if(game.listings!==undefined&&!Array.isArray(game.listings))return false;
 for(const l of game.listings||[]){
  if(l.mode!=='auction')continue;
  if(!isAuction(l)||!DURATIONS.includes(l.durationHours)||!Number.isSafeInteger(l.reference)||
     l.reference<1||l.bids.length>96||l.nextSlot>96||
     l.endsAt!==l.createdAt+l.durationHours*3600000||
     !Number.isSafeInteger(l.highestBid)||l.highestBid<0||
     (l.highestBid===0)!==(l.highestBidder===null))return false;
  for(const b of l.bids){
   if(!b||typeof b.bidder!=='string'||!core.validAsk(b.amount)||!Number.isFinite(b.at)||
      b.at<l.createdAt||b.at>l.endsAt)return false;
  }
  if(l.bids.length&&l.bids[l.bids.length-1].amount!==l.highestBid)return false;
 }
 const notes=game.market?.notifications;
 if(notes!==undefined&&(!Array.isArray(notes)||notes.length>100||
 notes.some(x=>!x||typeof x.id!=='string'||typeof x.message!=='string'||
 !Number.isFinite(x.at)||typeof x.read!=='boolean')))return false;
 return true;
}
root.LootHubAuctions=Object.freeze({DURATIONS,STEP,hash,notifications,isAuction,create,
 ceiling,increment,advance,cancel,validate,settle,acceptHighestBid});
})(window);
