/* LootHub 0.4.6 — bounded offline market catch-up.
   Single-player elapsed-time simulation, not a server or a clock-proof economy. */
(function(root){
'use strict';
const core=root.LootHubMarketCore;
const STEP_MS=15*60000,MAX_CATCHUP_MS=8*3600000,MAX_NPC_TRADES=2;
const MAX_REPORTS=10;
function chance(ask,reference){
  const ratio=ask/Math.max(1,reference);
  if(ratio<=.8)return .07;
  if(ratio<=1)return .045;
  if(ratio<=1.18)return .025;
  if(ratio<=1.45)return .008;
  return .002;
}
function advance(game,catalog,now=Date.now(),random=Math.random){
  const report={changed:false,playerSales:[],npcSales:0,expired:0,restocked:0,
    newOffers:0,elapsedMinutes:0,processedMinutes:0};
  if(!game||!game.market||!Array.isArray(game.listings)||
    !Array.isArray(game.items)||!Number.isFinite(now)||
    !Number.isFinite(game.market.lastSimulatedAt))return report;
  const m=game.market;
  // Do not simulate elapsed time after a clock rollback.
  if(now<m.lastSimulatedAt)return report;
  const elapsed=now-m.lastSimulatedAt;
  const bounded=Math.min(elapsed,MAX_CATCHUP_MS);
  report.elapsedMinutes=Math.floor(elapsed/60000);
  report.processedMinutes=Math.floor(bounded/60000);
  root.LootHubTraders.ensure(game);
  // Retain historical per-listing 120-minute sales cap, even for long absences.
  // Move the checked time forward afterward so skipped days cannot replay on refresh.
  const cappedListings=new Set(game.listings.filter(l=>l&&Number.isFinite(l.checkedAt)&&
    now-l.checkedAt>120*60000).map(l=>l.id));
  const player=root.LootHubMarketSimulation.advanceListings(game,now,random);
  report.playerSales=player.sales;
  if(player.changed)report.changed=true;
  for(const listing of game.listings){
    if(listing&&cappedListings.has(listing.id)&&
      Number.isFinite(listing.checkedAt)&&listing.checkedAt<now){
      listing.checkedAt=now;
      report.changed=true;
    }
  }
  // Existing NPC offers (including accepted deals) should not vanish just because
  // the player reopens a page. Agreed offers can only expire by their expiry date.
  const steps=Math.floor(bounded/STEP_MS);
  if(steps>0){
    const windowStart=now-bounded;
    for(let i=0;i<steps&&report.npcSales<MAX_NPC_TRADES;i++){
      const at=windowStart+(i+1)*STEP_MS;
      const available=m.npcListings.filter(l=>l&&l.item&&l.expiresAt>at&&
        !m.negotiations.some(n=>n&&n.kind==='buy'&&n.listingId===l.id&&n.status==='agreed'));
      if(!available.length)break;
      // Choose only one offer per interval, favoring no particular seller.
      const candidate=available[Math.floor(Math.min(.999999,Math.max(0,random()))*available.length)];
      const buyer=root.LootHubTraders.chooseBuyer(game,candidate);
      if(!buyer||buyer.wallet<candidate.ask)continue;
      const quote=root.LootHubEconomy.marketValue(game,candidate.item,at);
      if(Math.max(0,random())>=chance(candidate.ask,quote))continue;
      const sale=root.LootHubMarketTransactions.settleNpcTrade(game,candidate.id,buyer.id,at);
      if(sale){
        report.npcSales++;
        report.changed=true;
        root.LootHubHaggling.closeForListing(game,'buy',candidate.id,at);
      }
    }
    // Consume the elapsed window, including discarded time on huge clock jumps.
    m.lastSimulatedAt=now;
    report.changed=true;
  }
  const countBefore=m.npcListings.length;
  const refill=root.LootHubNPCMarket.refreshNpcMarket(game,catalog,now,random);
  report.expired=refill.expired;
  report.restocked=refill.added;
  if(refill.changed||countBefore!==m.npcListings.length)report.changed=true;
  if(root.LootHubHaggling.resolveUnavailable(game,now))report.changed=true;
  for(const listing of game.listings.slice(0,100)){
    if(!root.LootHubHaggling.get(game,'sell',listing.id)){
      const offer=root.LootHubHaggling.begin(game,'sell',listing.id,now);
      if(offer){report.newOffers++;report.changed=true;}
    }
  }
  const meaningful=report.playerSales.length+report.npcSales+report.expired+
    report.restocked+report.newOffers>0;
  if(meaningful){
    m.lastOfflineReport={at:now,elapsedMinutes:report.elapsedMinutes,
      processedMinutes:report.processedMinutes,playerSales:report.playerSales.length,
      npcSales:report.npcSales,expired:report.expired,restocked:report.restocked,
      newOffers:report.newOffers};
  }
  return report;
}
root.LootHubOffline=Object.freeze({STEP_MS,MAX_CATCHUP_MS,MAX_NPC_TRADES,MAX_REPORTS,chance,advance});
})(window);
