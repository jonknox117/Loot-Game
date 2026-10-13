/* Loot Hub 0.6.2 — simulated NPC barter. Exact persisted item-for-item ownership
   transfers, optional coins, no invented skins and no real-player promises. */
(function(root){'use strict';
const MAX_SIDE=5,MAX_HISTORY=80;
const validMoney=n=>Number.isSafeInteger(n)&&n>=0;
const distinct=a=>Array.isArray(a)&&a.length<=MAX_SIDE&&a.every(x=>typeof x==='string'&&x.length>0)&&new Set(a).size===a.length;
function quote(game,seller,listingIds,ownedIds,coins){
 if(!game||typeof seller!=='string'||seller.length>90||!distinct(listingIds)||
   !distinct(ownedIds)||listingIds.length<1||!validMoney(coins)||
   ownedIds.length+coins===0||!Array.isArray(game.items)||
   !Array.isArray(game.listings)||!Array.isArray(game.market?.npcListings)||
   !validMoney(game.coins)||!validMoney(game.spent)||coins>game.coins)
   return null;
 const trader=root.LootHubTraders.get(game,seller);
 if(!trader||trader.role!=='seller')return null;
 const listings=listingIds.map(id=>game.market.npcListings.find(x=>x&&x.id===id));
 const outgoing=ownedIds.map(id=>game.items.find(x=>x&&x.id===id));
 if(listings.some(x=>!x||x.seller!==seller||!x.item||
       !root.LootHubMarketCore.eligible(x.item)||!root.LootHubMarketCore.validAsk(x.ask)||
       !(x.expiresAt>Date.now()))||
    outgoing.some(x=>!x||!root.LootHubMarketCore.eligible(x)))return null;
 const allIds=game.items.concat(game.listings.map(x=>x&&x.item),
  game.market.npcListings.map(x=>x&&x.item)).filter(Boolean).map(x=>x.id);
 if(new Set(allIds).size!==allIds.length)return null;
 const target=listings.reduce((sum,x)=>sum+x.ask,0);
 if(!Number.isSafeInteger(target))return null;
 const style=root.LootHubTraders.style(trader);
 const minimum=Math.max(1,Math.ceil(target*style.sellFloor));
 let offeredValue=0;
 const credits=outgoing.map(item=>{
  const value=root.LootHubEconomy.marketValue(game,item);
  const rate=root.LootHubTraders.likes(trader,item)?.94:.76;
  const credit=Math.max(1,Math.floor(value*rate));
  offeredValue+=credit;
  return {id:item.id,value,credit};
 });
 if(!Number.isSafeInteger(offeredValue)||!Number.isSafeInteger(offeredValue+coins)||
    !Number.isSafeInteger(game.spent+coins)||!Number.isSafeInteger(trader.wallet+coins)||
    !Number.isSafeInteger(trader.sold+listings.length))return null;
 return {seller,listingIds:listings.map(x=>x.id),ownedIds:outgoing.map(x=>x.id),
  coins,listingItems:listings.map(x=>x.item),offeredItems:outgoing,
  credits,target,minimum,offeredValue,offerTotal:offeredValue+coins,
  missing:Math.max(0,minimum-(offeredValue+coins)),
  accepted:offeredValue+coins>=minimum,persona:style.label,focus:[...trader.focus]};
}
function settle(game,seller,listingIds,ownedIds,coins,now=Date.now()){
 const q=quote(game,seller,listingIds,ownedIds,coins);
 if(!q||!q.accepted||!Number.isSafeInteger(now)||now<=0)return null;
 const out=new Set(q.ownedIds),taken=new Set(q.listingIds);
 // Every precondition has already passed. Apply the complete swap together.
 game.items=game.items.filter(x=>!out.has(x.id)).concat(q.listingItems);
 game.market.npcListings=game.market.npcListings.filter(x=>!taken.has(x.id));
 game.coins-=coins;game.spent+=coins;
 const trader=root.LootHubTraders.get(game,seller);
 trader.wallet+=coins;trader.sold+=q.listingItems.length;
 const history=game.market.barterHistory||[];
 history.push({at:now,seller,offered:q.ownedIds,received:q.listingIds,
  offeredCredits:q.offeredValue,receivedAsk:q.target,coins});
 game.market.barterHistory=history.slice(-MAX_HISTORY);
 // Price history tracks completed trades only, not previews or rejected offers.
 for(const item of q.listingItems)root.LootHubEconomy.recordTrade(game,item,
  Math.max(1,Math.round(root.LootHubMarketCore.estimated(item))),'buy',now);
 for(const item of q.offeredItems)root.LootHubEconomy.recordTrade(game,item,
  Math.max(1,Math.round(root.LootHubMarketCore.estimated(item))),'sell',now);
 return q;
}
root.LootHubBarter=Object.freeze({MAX_SIDE,quote,settle});
})(window);
