/* LootHub 0.6.1: immutable catalog progress and one-time 25-case rewards.
   Discovery is based on inventory ownership, never a displayed market preview. */
(function(root){'use strict';
const definitions=root.LootHubCollectionCatalog;
const SCHEMA_VERSION=1,MAX_ITEM_COUNT=50000;
const byCollection=new Map(definitions.map(c=>[c.id,c]));
const lookup=new Map();
for(const collection of definitions)for(const entry of collection.items){
 const key=entry.kind+'|'+entry.weapon+'|'+(entry.kind==='skin'?entry.skin:'');
 if(lookup.has(key))throw Error('Duplicate collection identity: '+key);
 lookup.set(key,{collection:collection.id,id:entry.id});
}
function identity(item){
 if(!item||!['weapon','skin'].includes(item.kind)||typeof item.weapon!=='string')return null;
 const key=item.kind+'|'+item.weapon+'|'+(item.kind==='skin'?item.skin:'');
 return lookup.get(key)||null;
}
function fresh(){
 const progress={};
 for(const c of definitions)progress[c.id]={seen:[],claimedAt:null};
 return {schemaVersion:SCHEMA_VERSION,progress};
}
function valid(data){
 if(data==null)return true; // Older exports have no collection data.
 if(typeof data!=='object'||Array.isArray(data)||data.schemaVersion!==1||
    !data.progress||typeof data.progress!=='object'||Array.isArray(data.progress))return false;
 const keys=Object.keys(data.progress);
 // Future case collections may be absent from older saves. Never erase known
 // progress; ensure() initializes only genuinely missing collections.
 if(keys.some(k=>!byCollection.has(k)))return false;
 if(!data.progress['arsenal-v1']||!data.progress['cartel-v1'])return false;
 for(const c of definitions){
  const p=data.progress[c.id];
  if(p===undefined)continue;
  if(!p||typeof p!=='object'||Array.isArray(p)||
     !Array.isArray(p.seen)||p.seen.length>c.items.length||
     !(p.claimedAt===null||(Number.isSafeInteger(p.claimedAt)&&p.claimedAt>0)))return false;
  const known=new Set(c.items.map(x=>x.id)),found=new Set();
  for(const id of p.seen){
   if(typeof id!=='string'||!known.has(id)||found.has(id))return false;
   found.add(id);
  }
  if(p.claimedAt!==null&&found.size!==c.items.length)return false;
 }
 return true;
}
function ensure(game){
 if(!game||typeof game!=='object')return null;
 if(game.collections==null)game.collections=fresh();
 if(!valid(game.collections))return null;
 for(const c of definitions){
  if(!Object.hasOwn(game.collections.progress,c.id))
    game.collections.progress[c.id]={seen:[],claimedAt:null};
 }
 return game.collections;
}
function reconcile(game){
 const data=ensure(game);
 if(!data)return false;
 let changed=false;
 const eligible=(Array.isArray(game.items)?game.items:[])
  .concat(Array.isArray(game.listings)?game.listings.map(x=>x&&x.item):[]);
 for(const item of eligible){
  const ref=identity(item);
  if(!ref)continue;
  const seen=data.progress[ref.collection].seen;
  if(!seen.includes(ref.id)){seen.push(ref.id);changed=true}
 }
 return changed;
}
function progress(game,collectionId){
 const c=byCollection.get(collectionId),data=game&&game.collections;
 if(!c||!valid(data)||!data)return null;
 const p=data.progress[collectionId]||{seen:[],claimedAt:null};
 return {id:c.id,name:c.name,caseId:c.caseId,total:c.items.length,
  found:p.seen.length,missing:c.items.filter(x=>!p.seen.includes(x.id)),
  complete:p.seen.length===c.items.length,claimed:p.claimedAt!==null,
  claimedAt:p.claimedAt};
}
function claim(game,collectionId,createCase,now=Date.now()){
 const c=byCollection.get(collectionId);
 if(!c||!game||typeof createCase!=='function'||
    !Number.isSafeInteger(now)||now<1||!Array.isArray(game.items)||
    !Array.isArray(game.listings)||!Number.isSafeInteger(game.serial)||
    game.serial<0||game.serial>Number.MAX_SAFE_INTEGER-c.reward||
    game.items.length>MAX_ITEM_COUNT-c.reward)return null;
 const data=ensure(game);
 if(!data)return null;
 // Reconcile only the player's owned inventory and personal escrow.
 reconcile(game);
 const p=data.progress[c.id];
 if(p.claimedAt!==null||p.seen.length!==c.items.length)return null;
 const priorSerial=game.serial,created=[];
 const used=new Set(game.items.concat(game.listings.map(x=>x&&x.item),
   game.market?.npcListings?.map(x=>x&&x.item)||[]).filter(Boolean).map(x=>x.id));
 try{
  for(let i=0;i<c.reward;i++){
   const caseItem=createCase(c.caseId,0);
   if(!caseItem||caseItem.kind!=='case'||typeof caseItem.id!=='string'||
     !caseItem.id||used.has(caseItem.id)||caseItem.wearGrade!=null||
     (c.caseId==='arsenal'?caseItem.caseId!=null:caseItem.caseId!==c.caseId))
     throw Error('Invalid collection reward case');
   used.add(caseItem.id);
   caseItem.paid=0;
   caseItem.rewardSource='collection';
   caseItem.collectionId=c.id;
   created.push(caseItem);
  }
 }catch(_){game.serial=priorSerial;return null}
 game.items.push(...created);
 p.claimedAt=now;
 return {collection:c.id,caseId:c.caseId,items:created};
}
root.LootHubCollections=Object.freeze({
 definitions,SCHEMA_VERSION,MAX_ITEM_COUNT,identity,fresh,valid,ensure,reconcile,progress,claim
});
})(window);
