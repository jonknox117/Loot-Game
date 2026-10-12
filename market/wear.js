/* LootHub 0.5.2 — independent, persistent collectible condition metadata.
   No drop odds or cosmetic art change; condition now affects prices. */
(function(root){
'use strict';
const SCHEMA_VERSION=1;
const GRADES=Object.freeze([
  Object.freeze({grade:0,name:'Pristine'}),
  Object.freeze({grade:1,name:'Lightly Worn'}),
  Object.freeze({grade:2,name:'Field-Tested'}),
  Object.freeze({grade:3,name:'Heavily Worn'}),
  Object.freeze({grade:4,name:'Battle-Scarred'})
]);
// Condition rolls are independent of rarity: 8 / 22 / 40 / 22 / 8 percent.
// Only newly created weapon/skin instances roll; migrated items remain unchanged.
const ROLL_WEIGHTS=Object.freeze([8,22,40,22,8]);
// Pristine is the existing base-value benchmark. Only newly graded wear reduces value.
const VALUE_MULTIPLIERS=Object.freeze([1,.95,.85,.70,.55]);
function multiplier(item){return wearable(item)&&validGrade(item.wearGrade)?VALUE_MULTIPLIERS[item.wearGrade]:1}
function conditionValue(item,base){return Math.max(1,Math.round(base*multiplier(item)))}
function rollGrade(random=Math.random){
  const sampled=Number(random());
  const unit=Number.isFinite(sampled)?Math.min(.999999999999,Math.max(0,sampled)):0;
  const point=unit*100;
  let cumulative=0;
  for(let i=0;i<ROLL_WEIGHTS.length;i++){
    cumulative+=ROLL_WEIGHTS[i];
    if(point<cumulative)return i;
  }
  return ROLL_WEIGHTS.length-1;
}
function wearable(item){return !!(item&&(item.kind==='weapon'||item.kind==='skin'))}
function assignRolled(item,random=Math.random){
  if(!wearable(item)||Object.prototype.hasOwnProperty.call(item,'wearGrade'))return false;
  item.wearGrade=rollGrade(random);
  return true;
}
function validGrade(grade){return Number.isInteger(grade)&&grade>=0&&grade<GRADES.length}
function label(grade){return validGrade(grade)?GRADES[grade].name:null}
function validItem(item,allowLegacyMissing=true){
  if(!item||typeof item!=='object')return false;
  if(item.kind==='case')return !Object.prototype.hasOwnProperty.call(item,'wearGrade');
  if(!wearable(item))return false;
  if(!Object.prototype.hasOwnProperty.call(item,'wearGrade'))
    return allowLegacyMissing;
  return validGrade(item.wearGrade);
}
function ensureItem(item){
  if(!wearable(item)||Object.prototype.hasOwnProperty.call(item,'wearGrade'))return false;
  item.wearGrade=0; // All pre-0.5.1 items become Pristine; never reroll existing stock.
  return true;
}
function ensureGame(game){
  if(!game||typeof game!=='object')return 0;
  let changed=0;
  const all=[...(Array.isArray(game.items)?game.items:[]),
    ...(Array.isArray(game.listings)?game.listings.map(x=>x&&x.item):[]),
    ...(game.market&&Array.isArray(game.market.npcListings)?
      game.market.npcListings.map(x=>x&&x.item):[])];
  for(const item of all)if(ensureItem(item))changed++;
  if(game.wearSchemaVersion==null)game.wearSchemaVersion=SCHEMA_VERSION;
  return changed;
}
function validGame(game,allowLegacyMissing=true){
  if(!game||typeof game!=='object')return false;
  if(game.wearSchemaVersion!=null&&game.wearSchemaVersion!==SCHEMA_VERSION)return false;
  const all=[...(Array.isArray(game.items)?game.items:[]),
    ...(Array.isArray(game.listings)?game.listings.map(x=>x&&x.item):[]),
    ...(game.market&&Array.isArray(game.market.npcListings)?
      game.market.npcListings.map(x=>x&&x.item):[])];
  return all.every(item=>validItem(item,allowLegacyMissing));
}
root.LootHubWear=Object.freeze({
  SCHEMA_VERSION,GRADES,ROLL_WEIGHTS,VALUE_MULTIPLIERS,rollGrade,wearable,assignRolled,validGrade,label,multiplier,conditionValue,validItem,ensureItem,ensureGame,validGame
});
})(window);
