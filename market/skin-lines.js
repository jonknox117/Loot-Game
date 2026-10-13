(function(root){'use strict';
const data=root.LootHubSkinLineData;
const defined=data&&Array.isArray(data.lines)?data.lines:[];
const lines=Object.freeze(defined.filter(x=>x.released===true).map(x=>Object.freeze({...x})));
const previewLines=Object.freeze(defined.filter(x=>x.preview===true&&x.released!==true).map(x=>Object.freeze({...x})));
const byId=new Map([...lines,...previewLines].map(x=>[x.id,x]));
const modelSlugs=Object.freeze({...root.LootHubWeaponCatalog.modelSlugs});
function variants(catalog,lineId){
 const line=byId.get(lineId);
 if(!line||!Array.isArray(catalog))return [];
 return catalog.filter(x=>Array.isArray(x)&&Object.hasOwn(modelSlugs,x[0])&&
   (!Array.isArray(line.weapons)||line.weapons.includes(x[0]))).map(x=>({
  kind:'skin',weapon:x[0],skin:line.name,skinLine:line.id,tier:x[1],
  base:Math.max(1,Math.round(x[2]*line.multiplier)),emoji:x[3]
 }));
}
function matches(item,line){
 return !!(item&&item.kind==='skin'&&line&&modelSlugs[item.weapon]&&
   item.skin===line.name&&(!Array.isArray(line.weapons)||line.weapons.includes(item.weapon)));
}
function isRegistered(item){
 const line=item&&byId.get(item.skinLine);
 return !!(line&&line.released===true&&matches(item,line));
}
function isPreview(item){
 const line=item&&byId.get(item.skinLine);
 return !!(line&&line.preview===true&&line.released!==true&&matches(item,line));
}
function imagePath(item,size){
 if(!(isRegistered(item)||isPreview(item))||![400,800,1600].includes(Number(size)))return null;
 return './assets/renders/lines/'+item.skinLine+'/'+modelSlugs[item.weapon]+'--'+item.skinLine+'-'+size+'.webp';
}
function getLine(id){return byId.get(id)||null}
root.LootHubSkinLines=Object.freeze({lines,previewLines,variants,isRegistered,isPreview,imagePath,getLine,modelSlugs});
})(window);
