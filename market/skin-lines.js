(function(root){'use strict';
const data=root.LootHubSkinLineData;
const lines=Object.freeze((data&&data.lines||[]).filter(x=>x.released===true).map(x=>Object.freeze({...x})));
const byId=new Map(lines.map(x=>[x.id,x]));
const modelSlugs=Object.freeze({...root.LootHubWeaponCatalog.modelSlugs});
function variants(catalog,lineId){
 const line=byId.get(lineId);
 if(!line||!Array.isArray(catalog))return [];
 return catalog.filter(x=>Array.isArray(x)&&Object.hasOwn(modelSlugs,x[0])).map(x=>({
  kind:'skin',weapon:x[0],skin:line.name,skinLine:line.id,tier:x[1],
  base:Math.max(1,Math.round(x[2]*line.multiplier)),emoji:x[3]
 }));
}
function isRegistered(item){
 if(!item||item.kind!=='skin')return false;
 const line=byId.get(item.skinLine);
 return !!(line&&modelSlugs[item.weapon]&&item.skin===line.name);
}
function imagePath(item,size){
 if(!isRegistered(item)||![400,800,1600].includes(Number(size)))return null;
 return './assets/renders/lines/'+item.skinLine+'/'+modelSlugs[item.weapon]+'--'+item.skinLine+'-'+size+'.webp';
}
function getLine(id){return byId.get(id)||null}
root.LootHubSkinLines=Object.freeze({lines,variants,isRegistered,imagePath,getLine,modelSlugs});
})(window);
