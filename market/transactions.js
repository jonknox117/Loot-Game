/* LootHub 0.4.4 atomic inventory / wallet transfer functions.
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
function repriceListing(game,listingId,ask,now){
  if(!core.validAsk(ask)||!Number.isFinite(now)||!Array.isArray(game.listings))return null;
  const listing=game.listings.find(x=>x.id===listingId);
  if(!listing||!listing.item||!core.eligible(listing.item)||!core.validAsk(listing.ask))return null;
  if(listing.ask===ask)return {listing,oldAsk:ask,changed:false};
  const oldAsk=listing.ask;
  listing.ask=ask;
  listing.checkedAt=now; // Never apply elapsed time before repricing at the new price.
  listing.updatedAt=now;
  return {listing,oldAsk,changed:true};
}
function permittedPrice(game,kind,listing,requested){
  if(requested===undefined)return listing.ask;
  const deals=game.market&&game.market.negotiations;
  const n=Array.isArray(deals)&&root.LootHubHaggling.get(game,kind,listing.id);
  if(!n||n.kind!==kind||n.listingId!==listing.id||
    n.itemId!==listing.item.id||n.initialAsk!==listing.ask||
    n.status!=='agreed'||n.agreedPrice!==requested||!core.validAsk(requested))return null;
  return requested;
}
function buyNpcListing(game,listingId,negotiatedPrice){
  if(!game||!game.market||!Array.isArray(game.market.npcListings)||
     !Array.isArray(game.items)||!Array.isArray(game.listings)||
     !Number.isSafeInteger(game.coins)||game.coins<0||
     !Number.isSafeInteger(game.spent)||game.spent<0)return null;
  const offers=game.market.npcListings;
  const index=offers.findIndex(x=>x&&x.id===listingId);
  if(index<0)return null;
  const listing=offers[index],item=listing.item,price=permittedPrice(game,'buy',listing,negotiatedPrice);
  if(!core.validAsk(price)||!core.eligible(item)||game.coins<price||
     game.items.some(x=>x.id===item.id)||
     game.listings.some(x=>x.item&&x.item.id===item.id)||
     offers.some((x,i)=>i!==index&&x&&x.item&&x.item.id===item.id))return null;
  offers.splice(index,1);
  game.coins-=price;
  game.spent+=price;
  item.paid=price;
  game.items.push(item);
  root.LootHubTraders.finishPurchase(game,listing.seller,price);
  return {item,price,seller:listing.seller,listingId};
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
function settleListing(game,listingId,negotiatedPrice){
  if(!Array.isArray(game.listings))return null;
  const index=game.listings.findIndex(x=>x.id===listingId);
  if(index<0)return null;
  const listing=game.listings[index];
  if(!listing.item)return null;
  const price=negotiatedPrice===undefined?listing.ask:
    permittedPrice(game,'sell',listing,negotiatedPrice);
  if(!core.validAsk(price))return null;
  const negotiated=negotiatedPrice===undefined?null:
    root.LootHubHaggling.get(game,'sell',listing.id);
  if(negotiated&&negotiated.traderId&&
    !root.LootHubTraders.canFund(game,negotiated.traderId,price))return null;
  const net=core.netProceeds(price);
  game.listings.splice(index,1);
  game.coins+=net;
  game.sales+=net;
  game.rep+=1;
  if(negotiated&&negotiated.traderId)
    root.LootHubTraders.finishSale(game,negotiated.traderId,price);
  return {item:listing.item,ask:price,net,fee:price-net};
}
root.LootHubMarketTransactions=Object.freeze({
  purchaseCase,sellOwned,createListing,repriceListing,cancelListing,settleListing,buyNpcListing
});
})(window);
