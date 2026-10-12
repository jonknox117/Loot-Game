/* LootHub 0.4.4 — Persistent NPC profiles and finite buyer budgets.
   Preferences and negotiation temperaments are separate from case-drop odds. */
(function(root){
'use strict';
const core=root.LootHubMarketCore;
const PROFILES=Object.freeze([
  {name:'CaseRunner',role:'seller',style:'impatient',focus:['case','smg'],budget:1500},
  {name:'The Quartermaster',role:'seller',style:'dealer',focus:['rifle','heavy'],budget:8000},
  {name:'OldIron',role:'seller',style:'collector',focus:['pistol','rifle'],budget:5000},
  {name:'ClearanceRack',role:'seller',style:'impatient',focus:['case','pistol'],budget:1200},
  {name:'CollectorNox',role:'seller',style:'collector',focus:['skin','knife'],budget:28000},
  {name:'NightShift',role:'seller',style:'impatient',focus:['smg','shotgun'],budget:2000},
  {name:'ArsenalTrader',role:'seller',style:'dealer',focus:['rifle','heavy'],budget:10000},
  {name:'Rust&Steel',role:'seller',style:'opportunist',focus:['knife','heavy'],budget:8000},
  {name:'VaultKeeper',role:'seller',style:'wealthy',focus:['skin','knife'],budget:45000},
  {name:'FieldDealer',role:'seller',style:'bargain',focus:['case','pistol'],budget:3500},
  {name:'BargainBasil',role:'buyer',style:'bargain',focus:['case','pistol'],budget:900},
  {name:'ScopeSeeker',role:'buyer',style:'collector',focus:['sniper','rifle'],budget:9000},
  {name:'QuickFlip',role:'buyer',style:'impatient',focus:['smg','shotgun','case'],budget:1700},
  {name:'IronBroker',role:'buyer',style:'dealer',focus:['heavy','rifle'],budget:12000},
  {name:'VaultPatron',role:'buyer',style:'wealthy',focus:['skin','knife'],budget:65000},
  {name:'MarginHunter',role:'buyer',style:'opportunist',focus:['knife','smg','heavy'],budget:10000}
]);
const STYLES=Object.freeze({
  bargain:{label:'Bargain Hunter',description:'Patient with prices, unforgiving on margins',patience:3,
    sellFloor:.97,buyCeiling:.77,firstOffer:.66,concession:.14},
  collector:{label:'Collector',description:'Pays more for personally preferred collectibles',patience:4,
    sellFloor:.93,buyCeiling:.89,firstOffer:.77,concession:.35},
  impatient:{label:'Impatient Trader',description:'More flexible, but gives up quickly',patience:2,
    sellFloor:.81,buyCeiling:.91,firstOffer:.81,concession:.7},
  dealer:{label:'Veteran Dealer',description:'Calculates value carefully and counters steadily',patience:3,
    sellFloor:.90,buyCeiling:.87,firstOffer:.74,concession:.34},
  wealthy:{label:'Wealthy Enthusiast',description:'Pays premiums for select prized weapons',patience:4,
    sellFloor:.86,buyCeiling:1.07,firstOffer:.87,concession:.42},
  opportunist:{label:'Opportunist',description:'Low opening bids and little patience',patience:2,
    sellFloor:.96,buyCeiling:.82,firstOffer:.7,concession:.18}
});
function hash(s){
  let h=2166136261;
  for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);
  return (h>>>0)/4294967296;
}
function categories(item){
  if(!item)return [];
  if(item.kind==='case')return ['case'];
  const w=String(item.weapon||'').toLowerCase();
  const tags=[item.kind==='skin'?'skin':'weapon'];
  if(/knife|karambit|machete|tomahawk/.test(w))tags.push('knife');
  if(/awp|kar98k/.test(w))tags.push('sniper');
  if(/rpg|m60|minigun/.test(w))tags.push('heavy');
  if(/ak-|m4|scar|fn fal|garand/.test(w))tags.push('rifle');
  if(/mp5|mac-10|tec-9|thompson/.test(w))tags.push('smg');
  if(/shotgun|spas-12/.test(w))tags.push('shotgun');
  if(/glock|revolver|desert eagle|m1911/.test(w))tags.push('pistol');
  return tags;
}
function ensure(game){
  const m=core.ensureMarketState(game);
  if(!m)return [];
  if(!Array.isArray(m.traders))m.traders=[];
  for(const p of PROFILES){
    if(m.traders.some(x=>x&&x.id===p.name))continue;
    m.traders.push({id:p.name,name:p.name,role:p.role,style:p.style,
      focus:[...p.focus],wallet:p.budget,initialBudget:p.budget,bought:0,sold:0});
  }
  return m.traders;
}
function get(game,id){return ensure(game).find(x=>x.id===id)||null}
function style(trader){return STYLES[trader&&trader.style]||STYLES.dealer}
function likes(trader,item){
  return !!(trader&&Array.isArray(trader.focus)&&
    categories(item).some(x=>trader.focus.includes(x)));
}
function buyingPower(game,trader){
  // Existing agreed purchases are commitments, not fresh spending money.
  const pending=(game.market.negotiations||[]).filter(n=>n&&n.kind==='sell'&&
    n.traderId===trader.id&&n.status==='agreed')
    .reduce((sum,n)=>sum+(Number.isSafeInteger(n.agreedPrice)?n.agreedPrice:0),0);
  return Math.max(0,trader.wallet-pending);
}
function chooseBuyer(game,listing){
  if(!listing||!listing.item||!core.validAsk(listing.ask))return null;
  const candidates=ensure(game).filter(x=>x.role==='buyer'&&
    buyingPower(game,x)>=Math.max(1,Math.round(listing.ask*.5)));
  if(!candidates.length)return null;
  candidates.sort((a,b)=>{
    const score=x=>(likes(x,listing.item)?2:0)+hash(x.id+'|'+listing.item.id)*.8+
      (style(x).buyCeiling*.28);
    return score(b)-score(a)||a.id.localeCompare(b.id);
  });
  return candidates[0];
}
function terms(game,kind,listing){
  const trader=kind==='buy'?get(game,listing.seller):chooseBuyer(game,listing);
  if(!trader)return null;
  const traits=style(trader),favor=likes(trader,listing.item);
  const spread=(hash(kind+'|'+trader.id+'|'+listing.id)-.5)*.035;
  if(kind==='buy'){
    const floor=Math.max(1,Math.min(listing.ask,Math.round(
      listing.ask*(traits.sellFloor+(favor?.025:0)+spread))));
    return {traderId:trader.id,seller:trader.name,persona:traits.label,
      description:traits.description,focus:[...trader.focus],maxRounds:traits.patience,
      concession:traits.concession,threshold:floor,npcOffer:listing.ask};
  }
  const ceiling=Math.max(1,Math.min(buyingPower(game,trader),Math.round(
    listing.ask*(traits.buyCeiling+(favor?.11:-.065)+spread))));
  if(!core.validAsk(ceiling))return null;
  const bid=Math.max(1,Math.min(ceiling,Math.round(
    listing.ask*(traits.firstOffer+(favor?.08:-.04)+spread))));
  return {traderId:trader.id,seller:trader.name,persona:traits.label,
    description:traits.description,focus:[...trader.focus],maxRounds:traits.patience,
    concession:traits.concession,threshold:ceiling,npcOffer:bid};
}
function canFund(game,id,price){
  if(!id)return true; // Negotiations from previous versions had no persistent trader.
  const trader=get(game,id);
  return !!(trader&&trader.role==='buyer'&&core.validAsk(price)&&trader.wallet>=price);
}
function finishPurchase(game,seller,price){
  const trader=get(game,seller);
  if(trader&&Number.isSafeInteger(price)&&price>0){
    trader.wallet=Math.min(Number.MAX_SAFE_INTEGER,trader.wallet+price);
    trader.sold=(trader.sold||0)+1;
  }
}
function finishSale(game,id,price){
  if(!id)return true;
  const trader=get(game,id);
  if(!trader||!canFund(game,id,price))return false;
  trader.wallet-=price;
  trader.bought=(trader.bought||0)+1;
  return true;
}
function summary(trader){
  const traits=style(trader);
  return {persona:traits.label,description:traits.description,
    focus:(trader&&trader.focus||[]).join(', '),
    patience:traits.patience,
    wallet:trader?trader.wallet:0};
}
root.LootHubTraders=Object.freeze({PROFILES,STYLES,ensure,get,style,likes,categories,
  buyingPower,chooseBuyer,terms,canFund,finishPurchase,finishSale,summary});
})(window);
