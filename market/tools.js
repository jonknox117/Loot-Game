/* LootHub 0.4.7 — read-only market discovery and trading-workspace selectors.
   UI filters never mutate inventory, negotiations, listings, wallets, or saves. */
(function(root){
'use strict';
function includes(text,query){return String(text||'').toLocaleLowerCase().includes(query)}
function filterNpc(game,options={}){
  if(!game||!game.market)return [];
  const filtered=root.LootHubNPCMarket.filterNpcListings(game.market.npcListings,options);
  const affordability=String(options.affordability||'all');
  if(affordability==='affordable')return filtered.filter(x=>x.ask<=game.coins);
  if(affordability==='under-market')return filtered.filter(x=>
    x.ask<=root.LootHubEconomy.marketValue(game,x.item));
  return filtered;
}
function filterOwned(game,options={}){
  if(!game||!Array.isArray(game.items))return [];
  const search=String(options.search||'').trim().toLocaleLowerCase();
  const kind=String(options.kind||'all');
  const result=game.items.map((item,index)=>({item,index}))
    .filter(({item})=>root.LootHubMarketCore.eligible(item)&&
      (kind==='all'||item.kind===kind)&&
      (!search||includes(item.kind==='case'?'Sealed Arsenal Case':
        item.weapon+' '+(item.skin||''),search)));
  const sort=String(options.sort||'newest');
  if(sort==='value-desc'||sort==='value-asc'){
    result.sort((a,b)=>(root.LootHubEconomy.marketValue(game,a.item)-
      root.LootHubEconomy.marketValue(game,b.item))*(sort==='value-desc'?-1:1)||b.index-a.index);
  }else if(sort==='name'){
    result.sort((a,b)=>String(a.item.weapon||'Arsenal Case').localeCompare(
      String(b.item.weapon||'Arsenal Case'))||b.index-a.index);
  }else result.sort((a,b)=>b.index-a.index);
  return result.map(x=>x.item);
}
function filterNegotiations(game,options={}){
  const negotiations=game&&game.market&&game.market.negotiations;
  if(!Array.isArray(negotiations))return [];
  const status=String(options.status||'all'),kind=String(options.kind||'all');
  return negotiations.filter(x=>x&&
    (kind==='all'||x.kind===kind)&&
    (status==='all'||(status==='active'?['open','agreed'].includes(x.status):
     status==='complete'?x.status==='completed':
     status==='closed'?['walked','declined','unavailable'].includes(x.status):
      x.status===status))).sort((a,b)=>(b.updatedAt||b.createdAt||0)-
        (a.updatedAt||a.createdAt||0)||String(a.id).localeCompare(String(b.id)));
}
function marketJournal(game,limit=30){
  if(!game||!Array.isArray(game.ledger))return [];
  const keyword=/marketplace|listing|listed|bought .+ from |negotiated purchase|negotiated sale/i;
  return game.ledger.filter(x=>x&&typeof x.message==='string'&&keyword.test(x.message))
    .slice(-Math.max(0,Math.min(100,limit))).reverse();
}
root.LootHubTradingTools=Object.freeze({filterNpc,filterOwned,filterNegotiations,marketJournal});
})(window);
