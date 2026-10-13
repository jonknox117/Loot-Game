/* LootHub curated case registry — add future cases ONLY in EXTRA_CASES.
   The registry owns case prices, closed/open art, exclusive skins and rarity
   pools. It never mutates save files or generates unapproved artwork.

   To add a case:
   1. Put transparent chest WebPs under assets/cases/<id>-case-{closed,open}-{400,800,1254}.webp
   2. Put transparent skin WebPs under
      assets/renders/lines/<id>/<model-slug>--<id>-{400,800,1600}.webp
   3. Add one definition to EXTRA_CASES with a unique id, price and items.
   4. Run node tests/case-registry.cjs and the repository tests before release.
   Paths can be overridden with "art" on the case or each item.
*/
(function(root){'use strict';
const modelSlugs=root.LootHubWeaponCatalog.modelSlugs;
const knownModels=new Set(Object.keys(modelSlugs));
const EXTRA_CASES=Object.freeze([
  // Keep drafts released:false until all approved images are in place.
  // Example:
  // {id:'lavish',name:'Lavish',casePrice:75,released:false,
  //  description:'Gold engraving, fine woods and pearl accents.',
  //  items:[{kind:'skin',weapon:'Thompson SMG',skin:'Lavish',tier:0,base:40}, ...]}
]);
const DEFAULT_CASE_SIZES=Object.freeze([400,800,1254]);
const DEFAULT_SKIN_SIZES=Object.freeze([400,800,1600]);
const LEGACY_CASES=[
 {id:'arsenal',name:'Arsenal',casePrice:25,released:true,kind:'arsenal',
  description:'Original base weapons and approved Arsenal skins.',
  artStatus:'owner-supplied-case',skinArt:'arsenal',items:[]},
 {...root.LootHubCartelCase,kind:'curated',skinArt:'embedded',
  artStatus:'owner-supplied-cartel-case',collectionId:'cartel-v1',collectionReward:25},
 {...root.LootHubSpecOpsCase,kind:'curated',skinArt:'webp',
  artStatus:'owner-supplied-spec-ops-case',collectionId:'spec-ops-v1',collectionReward:25}
];
const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const safePath=/^assets\/[a-z0-9][a-z0-9/_-]*\.webp$/;
const price=n=>Number.isSafeInteger(n)&&n>=1&&n<=100000000;
const tier=n=>Number.isInteger(n)&&n>=0&&n<5;
function checkImagePaths(art,keys,tag){
 if(art===undefined)return;
 if(!art||typeof art!=='object'||Array.isArray(art))throw Error('Invalid '+tag+' art mapping');
 for(const [key,paths] of Object.entries(art)){
  if(!keys.includes(key)||!paths||typeof paths!=='object'||Array.isArray(paths))
   throw Error('Invalid '+tag+' image size/pose: '+key);
  const sizes=tag==='case'?DEFAULT_CASE_SIZES:DEFAULT_SKIN_SIZES;
  for(const [size,path] of Object.entries(paths)){
   if(!sizes.includes(Number(size))||typeof path!=='string'||!safePath.test(path)||
     path.includes('..'))throw Error('Unsafe '+tag+' image path: '+path);
  }
 }
}
const registry=new Map();
const skinLookup=new Map();
for(const input of [...LEGACY_CASES,...EXTRA_CASES]){
 if(!input||!slug.test(input.id)||registry.has(input.id)||typeof input.name!=='string'||
 !input.name.trim()||!price(input.casePrice)||typeof input.released!=='boolean')
  throw Error('Invalid or duplicate curated case definition: '+(input&&input.id));
 const kind=input.kind||'curated';
 if(!['arsenal','curated'].includes(kind)||(!Array.isArray(input.items))||
  (kind==='curated'&&(!input.items.length||input.items.length>200)))
  throw Error('Invalid curated case pool: '+input.id);
 const skinArt=input.skinArt||'webp';
 if(!['arsenal','webp','embedded'].includes(skinArt))throw Error('Invalid skin art mode');
 if(input.collectionId!==undefined&&
   (!slug.test(input.collectionId)||!Number.isSafeInteger(input.collectionReward||0)||
    input.collectionReward<1||input.collectionReward>100))
  throw Error('Invalid collection settings: '+input.id);
 checkImagePaths(input.art,['closed','open'],'case');
 const normalized=[];
 const itemKeys=new Set();
 for(const entry of input.items){
  if(!entry||entry.kind!=='skin'||!knownModels.has(entry.weapon)||
    typeof entry.skin!=='string'||!entry.skin.trim()||!tier(entry.tier)||
    !price(entry.base)||entry.id!==undefined&&typeof entry.id!=='string')
    throw Error('Invalid exclusive skin in '+input.id);
  checkImagePaths(entry.art,['skin'],'skin');
  const key=entry.weapon+'|'+entry.skin;
  if(itemKeys.has(key)||skinLookup.has(key))throw Error('Duplicate exclusive skin: '+key);
  itemKeys.add(key);
  const item=Object.freeze({...entry,kind:'skin',emoji:entry.emoji||'🔫'});
  normalized.push(item);
  skinLookup.set(key,{caseId:input.id,item});
 }
 const entry=Object.freeze({...input,kind,skinArt,items:Object.freeze(normalized)});
 registry.set(entry.id,entry);
}
function get(id='arsenal'){return registry.get(id||'arsenal')||null}
function isReleased(id='arsenal'){return get(id)?.released===true}
function priceFor(id='arsenal'){const c=get(id);return c&&c.released?c.casePrice:null}
function displayName(id='arsenal'){return get(id)?.name||null}
function pool(id='arsenal',arsenalCatalog=[]){
 const c=get(id);if(!c||!c.released)return null;
 return c.kind==='arsenal'?arsenalCatalog:c.items;
}
function releasedThemed(){return [...registry.values()].filter(x=>x.released&&x.kind==='curated')}
function all(){return [...registry.values()]}
function skinFor(item){
 if(!item||item.kind!=='skin')return null;
 const hit=skinLookup.get(item.weapon+'|'+item.skin);
 return hit?.caseId&&get(hit.caseId)?.released?hit:null;
}
function fileStem(id,pose){
 const c=get(id);if(!c)return null;
 return 'assets/cases/'+c.id+'-case-'+pose+'-';
}
function chestImage(id,pose='closed',size=800){
 const c=get(id);if(!c||!DEFAULT_CASE_SIZES.includes(size)||!['closed','open'].includes(pose))return null;
 return c.art?.[pose]?.[size]||fileStem(id,pose)+size+'.webp';
}
function skinImage(item,size=800){
 const hit=skinFor(item);
 if(!hit||!DEFAULT_SKIN_SIZES.includes(size))return null;
 const c=get(hit.caseId);
 if(c.skinArt!=='webp')return null;
 const slugValue=modelSlugs[item.weapon];
 return hit.item.art?.skin?.[size]||
  'assets/renders/lines/'+c.id+'/'+slugValue+'--'+c.id+'-'+size+'.webp';
}
function collections(){
 return releasedThemed().filter(c=>c.collectionReward>0&&c.collectionId).map(c=>({
  id:c.collectionId,name:c.name,caseId:c.id,reward:c.collectionReward,
  items:c.items.map(x=>({id:x.id||modelSlugs[x.weapon]+'--'+c.id,
    kind:'skin',weapon:x.weapon,skin:x.skin,tier:x.tier,base:x.base}))
 }));
}
root.LootHubCaseRegistry=Object.freeze({
 get,isReleased,priceFor,displayName,pool,releasedThemed,all,skinFor,
 chestImage,skinImage,collections,DEFAULT_CASE_SIZES,DEFAULT_SKIN_SIZES
});
})(window);
