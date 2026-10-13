/* LootHub 0.5.2 marketplace rules and versioned market state.
   Pure calculations only; current case odds and economic multipliers stay unchanged. */
(function(root){
'use strict';
const SCHEMA_VERSION=1;
function ensureMarketState(game,now=Date.now()){
  if(!game||typeof game!=='object')return null;
  if(!game.market||typeof game.market!=='object'||Array.isArray(game.market)){
    game.market={schemaVersion:SCHEMA_VERSION,npcListings:[],negotiations:[],
      traders:[],notifications:[],priceHistory:{},lastSimulatedAt:Number.isFinite(game.lastMarketCheck)?game.lastMarketCheck:now};
  }
  const m=game.market;
  if(!Number.isSafeInteger(m.schemaVersion)||m.schemaVersion<1)m.schemaVersion=SCHEMA_VERSION;
  if(!Array.isArray(m.npcListings))m.npcListings=[];
  if(!Array.isArray(m.negotiations))m.negotiations=[];
  if(!Array.isArray(m.traders))m.traders=[];
  if(!Array.isArray(m.notifications))m.notifications=[];
  if(!m.priceHistory||typeof m.priceHistory!=='object'||Array.isArray(m.priceHistory))m.priceHistory={};
  if(!Number.isFinite(m.lastSimulatedAt))m.lastSimulatedAt=now;
  return m;
}
function validMarketState(m){
  return !!(m&&typeof m==='object'&&!Array.isArray(m)&&
    Number.isSafeInteger(m.schemaVersion)&&m.schemaVersion>=1&&
    Array.isArray(m.npcListings)&&Array.isArray(m.negotiations)&&
    Array.isArray(m.traders)&&!!m.priceHistory&&typeof m.priceHistory==='object'&&
    !Array.isArray(m.priceHistory)&&Number.isFinite(m.lastSimulatedAt));
}
function baseEstimated(item){
  // A rewarded case is still worth its approved case-type price, not paid:0.
  if(item.kind==='case')return item.caseId==='cartel'?75:item.caseId==='spec-ops'?75:25;
  return Math.max(1,Math.round(Number(item.base)||1));
}
function estimated(item){
  return item.kind==='case'?baseEstimated(item):root.LootHubWear.conditionValue(item,baseEstimated(item));
}
function validAsk(ask){return Number.isSafeInteger(ask)&&ask>=1&&ask<=100000000}
function eligible(item){return !!(item&&typeof item.id==='string'&&item.id.length>0&&
  ['case','weapon','skin'].includes(item.kind))}
function netProceeds(ask){return Math.max(1,Math.floor(ask*.95))}
function listingQuote(ask,reference){
  if(!validAsk(ask))return null;
  const net=netProceeds(ask);
  const estimate=Number.isFinite(reference)&&reference>0?reference:null;
  return {ask,fee:ask-net,net,reference:estimate,ratio:estimate?ask/estimate:null};
}
function suggestedPrices(reference){
  const base=Math.max(1,Math.round(Number(reference)||1));
  return [...new Set([.8,1,1.2,1.5].map(multiplier=>
    Math.max(1,Math.min(100000000,Math.round(base*multiplier)))))]
}
root.LootHubMarketCore=Object.freeze({
  SCHEMA_VERSION,ensureMarketState,validMarketState,baseEstimated,estimated,validAsk,eligible,netProceeds,listingQuote,suggestedPrices
});
})(window);
