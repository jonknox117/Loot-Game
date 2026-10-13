/* LootHub 0.4.8 marketplace sale simulation, extracted without rebalancing. */
(function(root){
'use strict';
const core=root.LootHubMarketCore,tx=root.LootHubMarketTransactions;
function listingChance(ratio){
  if(ratio<=.85)return .65;
  if(ratio<=1)return .38;
  if(ratio<=1.12)return .2;
  if(ratio<=1.3)return .08;
  if(ratio<=1.6)return .015;
  return 0;
}
function advanceListings(game,now,random=Math.random){
  const sales=[];
  let changed=false;
  if(!game||!Array.isArray(game.listings)||!Number.isFinite(now))return {changed,sales};
  for(const listing of [...game.listings]){
    if(!listing||!listing.item||listing.mode==='auction'||listing.mode==='desk')continue;
    // An accepted buyer offer reserves this exact escrow item for its negotiated deal.
    // Consume the elapsed listing clock, so a later voided deal cannot backfill sales.
    const offer=root.LootHubHaggling.get(game,'sell',listing.id);
    if(offer&&offer.status==='agreed'&&root.LootHubHaggling.stillAvailable(game,offer)){
      if(!Number.isFinite(listing.checkedAt)||listing.checkedAt<now){
        listing.checkedAt=now;
        changed=true;
      }
      continue;
    }
    const start=Number.isFinite(listing.checkedAt)?listing.checkedAt:(listing.createdAt||now);
    const intervals=Math.min(120,Math.floor(Math.max(0,now-start)/60000));
    if(!intervals)continue;
    listing.checkedAt=start+intervals*60000;
    changed=true;
    const ratio=listing.ask/Math.max(1,root.LootHubEconomy.marketValue(game,listing.item,now));
    const chance=listingChance(ratio);
    let sold=false;
    for(let n=0;n<intervals;n++)if(random()<chance){sold=true;break}
    if(sold){
      const sale=tx.settleListing(game,listing.id);
      if(sale)sales.push(sale);
    }
  }
  return {changed,sales};
}
root.LootHubMarketSimulation=Object.freeze({listingChance,advanceListings});
})(window);
