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
function purchaseBundle(game,caseId,count,price,makeCase){
 if(!game||!Number.isInteger(count)||count<1||count>MAX_CASES||
    !Number.isSafeInteger(price)||price<1||typeof makeCase!=='function'||
    !Number.isSafeInteger(game.coins)||!Number.isSafeInteger(game.spent)||
    !Array.isArray(game.items)||!Array.isArray(game.listings)||
    game.items.length>50000-count||
    game.coins<count*price||game.spent>Number.MAX_SAFE_INTEGER-count*price)return null;
 const serial=game.serial,cases=[],used=new Set(game.items.concat(
  game.listings.map(x=>x&&x.item),game.market?.npcListings?.map(x=>x&&x.item)||[]
 ).filter(Boolean).map(x=>x.id));
 try{
  for(let i=0;i<count;i++){
   const item=makeCase(caseId,price);
   if(!item||item.kind!=='case'||typeof item.id!=='string'||!item.id||
     used.has(item.id)||(caseId==='arsenal'?item.caseId!=null:item.caseId!==caseId))
    throw Error('Invalid case pack item');
   used.add(item.id);item.paid=price;cases.push(item);
  }
 }catch(_){game.serial=serial;return null}
 game.items.push(...cases);game.coins-=count*price;game.spent+=count*price;
 return {items:cases,cost:count*price};
}
root.LootHubMultiOpen=Object.freeze({MAX_CASES,eligible,commit,purchaseAndCommit,purchaseBundle});
})(window);
