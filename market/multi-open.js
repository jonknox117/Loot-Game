/* Loot Hub 0.6.0 — atomic opening of one to five owned cases.
   Pure inventory transaction; visual reels are presentation only.
   Never reroll when users skip or reload. */
(function(root){'use strict';
const MAX_CASES=5;
function eligible(game,ids){
 if(!game||!Array.isArray(game.items)||!Array.isArray(ids)||ids.length<1||
    ids.length>MAX_CASES||new Set(ids).size!==ids.length||
    !ids.every(x=>typeof x==='string'&&x.length>0))return null;
 const existing=new Map(game.items.map(item=>[item.id,item]));
 const selected=ids.map(id=>existing.get(id));
 if(selected.some(x=>!x||x.kind!=='case'))return null;
 return selected;
}
function commit(game,ids,roll){
 const selected=eligible(game,ids);
 if(!selected||typeof roll!=='function'||!Number.isSafeInteger(game.openings)||
   game.openings>Number.MAX_SAFE_INTEGER-selected.length)return null;
 const serial=game.serial, results=[];
 try{
  for(const item of selected){
   const prize=roll(item.caseId||'arsenal');
   if(!prize||typeof prize.id!=='string'||!['weapon','skin'].includes(prize.kind)||
      !Number.isInteger(prize.tier)||prize.tier<0||prize.tier>4||
      typeof prize.wearGrade!=='number')throw Error('Invalid case prize');
   results.push(prize);
  }
  const idsUsed=new Set(game.items.map(x=>x.id));
  if(new Set(results.map(x=>x.id)).size!==results.length||
    results.some(x=>idsUsed.has(x.id)))throw Error('Non-unique case prize ID');
 }catch(_){game.serial=serial;return null}
 const consumed=new Set(ids);
 game.items=game.items.filter(x=>!consumed.has(x.id)).concat(results);
 game.openings+=selected.length;
 game.pendingReveal=results[0].id;
 return {cases:selected,rewards:results};
}
// Atomic purchase of unopened cases. Keep separate IDs so each can be sold or opened later.
function purchaseSealed(game,caseId,count,price,makeCase){
 if(!game||!Array.isArray(game.items)||!Array.isArray(game.listings)||
    !Number.isInteger(count)||count<1||count>MAX_CASES||
    !Number.isSafeInteger(price)||price<1||
    !Number.isSafeInteger(game.coins)||!Number.isSafeInteger(game.spent)||
    typeof makeCase!=='function')return null;
 const cost=count*price;
 if(!Number.isSafeInteger(cost)||game.coins<cost||
    !Number.isSafeInteger(game.spent+cost))return null;
 const serial=game.serial;
 try{
  const cases=Array.from({length:count},()=>makeCase(caseId,price));
  const existing=new Set(game.items.map(x=>x.id).concat(
   game.listings.filter(x=>x&&x.item).map(x=>x.item.id)));
  const ids=cases.map(x=>x&&x.id);
  if(cases.some(x=>!x||x.kind!=='case'||typeof x.id!=='string'||!x.id||
      x.paid!==price)||
     new Set(ids).size!==count||ids.some(id=>existing.has(id)))
     throw Error('Invalid case purchase');
  game.items=game.items.concat(cases);
  game.coins-=cost;game.spent+=cost;
  return {cases,cost};
 }catch(_){game.serial=serial;return null}
}
function purchaseAndCommit(game,caseId,count,price,makeCase,roll){
 if(!game||!Number.isInteger(count)||count<1||count>MAX_CASES||
    !Number.isSafeInteger(price)||price<1||
    !Number.isSafeInteger(game.coins)||!Number.isSafeInteger(game.spent)||
    game.coins<count*price||game.spent>Number.MAX_SAFE_INTEGER-count*price||
    typeof makeCase!=='function')return null;
 const serial=game.serial;
 try{
  const purchased=Array.from({length:count},()=>makeCase(caseId,price));
  if(purchased.some(x=>!x||x.kind!=='case'||!x.id))throw Error('Invalid case purchase');
  const temporary={...game,items:game.items.concat(purchased)};
  const opened=commit(temporary,purchased.map(x=>x.id),roll);
  if(!opened)throw Error('Could not open purchased cases');
  game.items=temporary.items;
  game.openings=temporary.openings;
  game.pendingReveal=temporary.pendingReveal;
  game.coins-=price*count;game.spent+=price*count;
  return {...opened,cost:price*count};
 }catch(_){game.serial=serial;return null}
}
root.LootHubMultiOpen=Object.freeze({MAX_CASES,eligible,commit,purchaseSealed,purchaseAndCommit});
})(window);
