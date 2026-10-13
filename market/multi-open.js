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
root.LootHubMultiOpen=Object.freeze({MAX_CASES,eligible,commit});
})(window);
