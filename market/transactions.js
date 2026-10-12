/* LootHub 0.4.0 atomic inventory / wallet transfer functions.
   The caller checks save authority before mutation and journals after settlement. */
(function(root){
'use strict';
const core=root.LootHubMarketCore;
function purchaseCase(game,price,makeCase){
  if(!core.validAsk(price)||!Array.isArray(game.items)||!Number.isSafeInteger(game.coins)||
    game.coins<price||typeof makeCase!=='function')return null;
  const item=makeCase();
  if(!core.eligible(item)||game.items.some(x=>x.id===item.id)||
    (game.listings||[]).some(x=>x.item&&x.item.id===item.id))return null;
  item.paid=price;
  game.coins-=price;
  game.spent+=price;
  game.items.push(item);
  return {item,price};
}
function sellOwned(game,itemId,price,reputation){
  if(!Number.isSafeInteger(price)||price<1||!Number.isSafeInteger(reputation)||
    reputation<0||!Array.isArray(game.items))return null;
  const index=game.items.findIndex(x=>x.id===itemId);
  if(index<0||!core.eligible(game.items[index]))return null;
  const item=game.items.splice(index,1)[0];
  game.coins+=price;
  game.sales+=price;
  game.rep+=reputation;
  return {item,price};
}
function createListing(game,itemId,ask,now){
  if(!core.validAsk(ask)||!Number.isFinite(now)||!Array.isArray(game.items)||
    !Array.isArray(game.listings))return null;
  const index=game.items.findIndex(x=>x.id===itemId);
  if(index<0||!core.eligible(game.items[index])||
    game.listings.some(x=>x.id==='listing-'+itemId||(x.item&&x.item.id===itemId)))return null;
  const item=game.items.splice(index,1)[0];
  const listing={id:'listing-'+itemId,item,ask,createdAt:now,checkedAt:now};
  game.listings.push(listing);
  return listing;
}
function cancelListing(game,listingId){
  if(!Array.isArray(game.listings)||!Array.isArray(game.items))return null;
  const index=game.listings.findIndex(x=>x.id===listingId);
  if(index<0)return null;
  const listing=game.listings[index];
  if(!listing.item||game.items.some(x=>x.id===listing.item.id))return null;
  game.listings.splice(index,1);
  game.items.push(listing.item);
  return listing;
}
function settleListing(game,listingId){
  if(!Array.isArray(game.listings))return null;
  const index=game.listings.findIndex(x=>x.id===listingId);
  if(index<0)return null;
  const listing=game.listings[index];
  if(!listing.item||!core.validAsk(listing.ask))return null;
  const net=core.netProceeds(listing.ask);
  game.listings.splice(index,1);
  game.coins+=net;
  game.sales+=net;
  game.rep+=1;
  return {item:listing.item,ask:listing.ask,net,fee:listing.ask-net};
}
root.LootHubMarketTransactions=Object.freeze({
  purchaseCase,sellOwned,createListing,cancelListing,settleListing
});
})(window);
