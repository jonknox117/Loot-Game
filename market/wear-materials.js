/* LootHub 0.5.5a — mask-backed material eligibility data, not a visual effect.
   Paint masks mean "may receive a finish", never "must be metal".
   Rust is forbidden unless a specific reviewed metal region permits it. */
(function(root){
'use strict';
const MASK_EDGE=400,MAX_DECODED=6;
const profiles=root.LootHubPaintProfiles&&root.LootHubPaintProfiles.weapons||{};
const names=root.LootHubSkinLines&&root.LootHubSkinLines.modelSlugs||{};
const cache=new Map();
const surfaceTypes=Object.freeze(['protected','wood','polymer','metal','paintable-unclassified','unclassified']);
function slugFor(weapon){
  return typeof weapon==='string'&&Object.prototype.hasOwnProperty.call(names,weapon)?
    names[weapon]:null;
}
function getProfile(weapon){
  const slug=slugFor(weapon);
  return slug&&Object.prototype.hasOwnProperty.call(profiles,slug)?profiles[slug]:null;
}
function maskPath(weapon){
  const slug=slugFor(weapon);
  if(!slug||!Object.prototype.hasOwnProperty.call(profiles,slug))return null;
  return './assets/skin-lines/masks/'+slug+'--paint-main-1600.png';
}
function inRects(rects,x,y){
  return Array.isArray(rects)&&rects.some(rect=>Array.isArray(rect)&&rect.length===4&&
    rect.every(n=>Number.isFinite(n)&&n>=0&&n<=1)&&
    x>=rect[0]&&x<=rect[2]&&y>=rect[1]&&y<=rect[3]);
}
function materialAt(weapon,x,y,paintAmount=0){
  const p=getProfile(weapon);
  if(!p||!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)
    return 'unclassified';
  const w=p.wear||{};
  if(inRects(p.protectedRects,x,y)||inRects(w.protectedRects,x,y))return 'protected';
  if(inRects(w.woodRects,x,y))return 'wood';
  if(inRects(w.polymerRects,x,y))return 'polymer';
  if(inRects(w.metalRects,x,y))return 'metal';
  // Paintable is not equivalent to metal. The previous engine's generic
  // corrosion must not accidentally run on a wooden stock or synthetic grip.
  return paintAmount>.08?'paintable-unclassified':'unclassified';
}
function eligibility(weapon,x,y,paintAmount=0){
  const material=materialAt(weapon,x,y,paintAmount);
  const isProtected=material==='protected';
  return Object.freeze({
    material,
    scratch:!isProtected,
    grime:!isProtected,
    finishWear:!isProtected&&paintAmount>.08&&material!=='wood'&&material!=='polymer',
    // No implicit rust on paintable-but-unclassified material.
    rust:material==='metal'
  });
}
function sample(data,width,height,x,y){
  if(!data||!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||
     !Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)return 0;
  const xi=Math.min(width-1,Math.floor(x*width));
  const yi=Math.min(height-1,Math.floor(y*height));
  const pos=(yi*width+xi)*4;
  return (data[pos]||0)*(data[pos+3]||0)/(255*255);
}
function decode(weapon){
  const url=maskPath(weapon);
  if(!url||typeof root.Image!=='function')return Promise.resolve(null);
  const slug=slugFor(weapon);
  if(cache.has(slug))return cache.get(slug);
  const pending=new Promise(resolve=>{
    const image=new root.Image();
    image.onload=()=>{
      try{
        const document=root.document;
        if(!document||typeof document.createElement!=='function')return resolve(null);
        const canvas=document.createElement('canvas');
        // Downsample once for inexpensive per-pixel material queries on iPhone.
        canvas.width=MASK_EDGE;canvas.height=MASK_EDGE/2;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        if(!ctx)return resolve(null);
        ctx.drawImage(image,0,0,canvas.width,canvas.height);
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        resolve(Object.freeze({width:canvas.width,height:canvas.height,pixels}));
      }catch(_){
        // file:// browsers can disallow pixel reads; never fabricate paint areas.
        resolve(null);
      }
    };
    image.onerror=()=>resolve(null);
    image.src=url;
  });
  cache.set(slug,pending);
  if(cache.size>MAX_DECODED)cache.delete(cache.keys().next().value);
  return pending;
}
async function inspect(weapon,x,y){
  const mask=await decode(weapon);
  const paintAmount=mask?sample(mask.pixels,mask.width,mask.height,x,y):0;
  return Object.freeze({paintAmount,maskAvailable:!!mask,
    ...eligibility(weapon,x,y,paintAmount)});
}
root.LootHubWearMaterials=Object.freeze({
  MASK_EDGE,MAX_DECODED,surfaceTypes,slugFor,getProfile,maskPath,inRects,
  materialAt,eligibility,sample,decode,inspect
});
})(window);
