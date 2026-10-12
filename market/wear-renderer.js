/* LootHub 0.5.5b — source-alpha, paint-mask AND material-aware surface weathering.
   Permanent item-ID patterns. Metal alone can oxidize, wood never rusts.
   No weapon-specific filter images; original neutral/skin art stays untouched. */
(function(root){
'use strict';
// Counts are intentionally different blends, not just the same opacity ramp.
// Pristine = none; Light = fine scuffs; Field = coating wear;
// Heavy = edge chips and grime; Battle = broken coating and corrosion.
const LIMITS=Object.freeze([
  Object.freeze({scratch:0,dirt:0,rust:0,chip:0,fade:0}),
  Object.freeze({scratch:22,dirt:12,rust:0,chip:2,fade:2}),
  Object.freeze({scratch:42,dirt:21,rust:8,chip:10,fade:7}),
  Object.freeze({scratch:75,dirt:36,rust:19,chip:28,fade:15}),
  Object.freeze({scratch:118,dirt:56,rust:35,chip:52,fade:29})
]);
const MAX_PIXELS=1100,MAX_DPR=2;
const plans=new Map(),MAX_PLANS=64;
function hash(seed){
  let h=2166136261;
  for(const c of String(seed)){h=Math.imul(h^c.charCodeAt(0),16777619)}
  return h>>>0;
}
function prng(seed){
  let state=hash(seed);
  return function(){
    state=(state+0x6D2B79F5)|0;
    let t=Math.imul(state^(state>>>15),1|state);
    t^=t+Math.imul(t^(t>>>7),61|t);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
function pattern(seed,grade){
  if(!Number.isInteger(grade)||grade<1||grade>4)return [];
  const key=String(seed)+'/'+grade;
  if(plans.has(key))return plans.get(key);
  const rand=prng('loot-wear-v1:'+seed),count=LIMITS[grade];
  const result=[],r=(a,b)=>a+(b-a)*rand();
  for(let i=0;i<count.scratch;i++)
    result.push(Object.freeze({kind:'scratch',x:rand(),y:rand(),
      length:r(.018,.17),angle:r(-1.1,1.1),width:r(.001,.0035),
      alpha:r(.12,.27)+grade*.025,bright:rand()>.52}));
  for(let i=0;i<count.dirt;i++)
    result.push(Object.freeze({kind:'dirt',x:rand(),y:rand(),
      radius:r(.025,.16),squash:r(.25,.85),alpha:r(.08,.14)+grade*.028,
      brown:rand()>.47}));
  for(let i=0;i<count.rust;i++)
    result.push(Object.freeze({kind:'rust',x:rand(),y:rand(),
      radius:r(.006,.032),squash:r(.4,1),alpha:r(.2,.38)+grade*.04,
      brown:rand()>.4}));
  for(let i=0;i<count.chip;i++)
    result.push(Object.freeze({kind:'chip',x:rand(),y:rand(),
      length:r(.009,.06)*(1+grade*.14),angle:r(-1.5,1.5),
      width:r(.003,.012),alpha:r(.14,.3)+grade*.065}));
  for(let i=0;i<count.fade;i++)
    result.push(Object.freeze({kind:'fade',x:rand(),y:rand(),
      radius:r(.02,.11)*(1+grade*.15),squash:r(.35,.9),
      alpha:r(.065,.11)+grade*.025}));
  const frozen=Object.freeze(result);
  if(plans.size>=MAX_PLANS)plans.delete(plans.keys().next().value);
  plans.set(key,frozen);
  return frozen;
}
// Works on individual effect channels so each can receive a distinct material mask.
function texture(ctx,width,height,seed,grade,channel){
  const short=Math.min(width,height);
  for(const mark of pattern(seed,grade)){
    if(channel&&mark.kind!==channel)continue;
    const x=mark.x*width,y=mark.y*height;
    if(mark.kind==='scratch'||mark.kind==='chip'){
      const len=mark.length*short;
      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.lineTo(x+Math.cos(mark.angle)*len,y+Math.sin(mark.angle)*len);
      ctx.lineWidth=Math.max(.55,mark.width*short);
      ctx.lineCap='round';
      ctx.strokeStyle=mark.kind==='chip'?'rgba(158,149,139,'+mark.alpha+')':
        (mark.bright?'rgba(214,206,184,'+mark.alpha+')':
          'rgba(33,29,25,'+mark.alpha+')');
      ctx.stroke();
      if(mark.kind==='scratch'&&mark.bright){
        ctx.beginPath();
        ctx.moveTo(x,y+.85);
        ctx.lineTo(x+Math.cos(mark.angle)*len,y+Math.sin(mark.angle)*len+.85);
        ctx.lineWidth=Math.max(.4,mark.width*short*.36);
        ctx.strokeStyle='rgba(18,21,24,'+(mark.alpha*.55)+')';
        ctx.stroke();
      }
    }else if(mark.kind==='dirt'||mark.kind==='fade'){
      const radius=mark.radius*short;
      ctx.save();ctx.translate(x,y);ctx.scale(1,mark.squash);
      const grad=ctx.createRadialGradient(0,0,0,0,0,radius);
      const fade=mark.kind==='fade';
      grad.addColorStop(0,fade?'rgba(171,165,153,'+mark.alpha+')':
        (mark.brown?'rgba(91,61,38,'+mark.alpha+')':
          'rgba(16,20,19,'+mark.alpha+')'));
      grad.addColorStop(.6,fade?'rgba(166,160,150,'+(mark.alpha*.52)+')':
        (mark.brown?'rgba(81,61,39,'+(mark.alpha*.48)+')':
          'rgba(20,22,19,'+(mark.alpha*.35)+')'));
      grad.addColorStop(1,'rgba(20,20,20,0)');
      ctx.fillStyle=grad;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }else if(mark.kind==='rust'){
      const radius=mark.radius*short;
      ctx.beginPath();
      ctx.ellipse(x,y,radius,radius*mark.squash,mark.x*4,0,Math.PI*2);
      ctx.fillStyle=mark.brown?'rgba(152,79,43,'+mark.alpha+')':
        'rgba(87,46,30,'+mark.alpha+')';
      ctx.fill();
      ctx.beginPath();ctx.arc(x+radius*.2,y-radius*.22,radius*.22,0,Math.PI*2);
      ctx.fillStyle='rgba(45,37,29,'+(mark.alpha*.6)+')';ctx.fill();
    }
  }
}
// These are full-coverage, red/green/blue material maps from 0.5.5a.
// RGB 255,0,0 is METAL, 0,255,0 WOOD, and everything else OTHER.
// Re-sampled borders are deliberately treated as OTHER to avoid rust bleed.
// Normalized map coordinates track the same centered contain rectangle as source art.
function maskLayer(ctx,w,h,kind,geometry,material,paint,weapon,api){
  const pixels=ctx.getImageData(0,0,w,h);
  const data=pixels.data;
  const metalData=material&&material.pixels;
  const paintData=paint&&paint.pixels;
  const profile=api&&api.getProfile&&api.getProfile(weapon);
  const pRects=profile&&profile.protectedRects;
  const wearRects=profile&&profile.wear&&profile.wear.protectedRects;
  const canSample=!!(metalData&&material.width&&material.height);
  const canPaint=!!(paintData&&paint.width&&paint.height);
  let kept=0;
  for(let y=0;y<h;y++){
    const v=(y+.5-geometry.y)/geometry.h;
    const insideY=v>=0&&v<1;
    const my=canSample?Math.max(0,Math.min(material.height-1,Math.floor(v*material.height))):0;
    const py=canPaint?Math.max(0,Math.min(paint.height-1,Math.floor(v*paint.height))):0;
    for(let x=0;x<w;x++){
      const i=(y*w+x)*4;
      if(!data[i+3])continue;
      const u=(x+.5-geometry.x)/geometry.w;
      if(!insideY||u<0||u>=1){data[i+3]=0;continue}
      const mx=canSample?Math.max(0,Math.min(material.width-1,Math.floor(u*material.width))):0;
      const px=canPaint?Math.max(0,Math.min(paint.width-1,Math.floor(u*paint.width))):0;
      const mi=(my*material?.width+mx)*4;
      const pi=(py*paint?.width+px)*4;
      const alpha=canSample?metalData[mi+3]:0;
      // An unclassified map failure must never create extra rust.
      const isMetal=canSample&&alpha>=248&&metalData[mi]===255&&metalData[mi+1]===0&&metalData[mi+2]===0;
      const isWood=canSample&&alpha>=32&&metalData[mi]===0&&metalData[mi+1]===255&&metalData[mi+2]===0;
      const cover=canPaint?paintData[pi]*paintData[pi+3]/(255*255):0;
      const protectedArea=api&&api.inRects&&
        (api.inRects(pRects,u,v)||api.inRects(wearRects,u,v));
      let strength=0;
      if(!protectedArea){
        if(kind==='rust')strength=isMetal?1:0;
        else if(kind==='chip')strength=isMetal?Math.max(0,(cover-.15)/.85):0;
        else if(kind==='fade')strength=cover>.06?(isWood?.18:isMetal?.80:.55)*cover:0;
        else if(kind==='scratch')strength=isWood?.5:isMetal?1:.7;
        else if(kind==='dirt')strength=isWood?.88:1;
      }
      if(strength<=0){data[i+3]=0;continue}
      data[i+3]=Math.round(data[i+3]*strength);
      if(data[i+3])kept++;
    }
  }
  ctx.putImageData(pixels,0,0);
  return kept;
}
function renderLayer(owner,w,h,seed,grade,kind,geometry,material,paint,weapon,api){
  const canvas=owner.createElement('canvas');
  canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{alpha:true,willReadFrequently:true});
  if(!ctx)return null;
  texture(ctx,w,h,seed,grade,kind);
  const kept=maskLayer(ctx,w,h,kind,geometry,material,paint,weapon,api);
  return kept?canvas:null;
}
async function paint(element,img,grade,seed){
  if(!element.isConnected||element.dataset.wearReady==='true')return false;
  const width=img.clientWidth,height=img.clientHeight;
  if(width<10||height<10||!img.naturalWidth||!img.naturalHeight)return false;
  const api=root.LootHubWearMaterials;
  const weapon=element.dataset.weaponModel;
  let material=null,paintMap=null;
  try{
    // The cached 400x200 maps refer to the same 1600x800 master silhouette.
    // Paint protection uses the same surface map regardless of skin line.
    [material,paintMap]=await Promise.all([
      api&&api.decodeMaterial?api.decodeMaterial(weapon):Promise.resolve(null),
      api&&api.decode?api.decode(weapon):Promise.resolve(null)
    ]);
    if(!element.isConnected)return false;
    const browserDpr=Number(root.devicePixelRatio)||1;
    const ratio=Math.min(MAX_DPR,Math.max(1,browserDpr),
      MAX_PIXELS/Math.max(width,height));
    const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
    const owner=img.ownerDocument;
    const canvas=owner.createElement('canvas');
    canvas.width=w;canvas.height=h;
    canvas.className='wear-overlay';
    canvas.setAttribute('aria-hidden','true');
    const ctx=canvas.getContext('2d',{alpha:true});
    if(!ctx)return false;
    const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight);
    const dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
    const geometry={x:(w-dw)/2,y:(h-dh)/2,w:dw,h:dh};
    let channels=0;
    for(const kind of ['fade','dirt','scratch','chip','rust']){
      if(kind==='rust'&&!material)continue; // fail closed on missing maps
      if((kind==='chip'||kind==='fade')&&!paintMap)continue;
      const layer=renderLayer(owner,w,h,seed,grade,kind,geometry,material,paintMap,weapon,api);
      if(!layer)continue;
      ctx.drawImage(layer,0,0);
      channels++;
    }
    // Clip against the EXACT alpha of the displayed source, not a guessed outline.
    ctx.globalCompositeOperation='destination-in';
    ctx.drawImage(img,geometry.x,geometry.y,dw,dh);
    ctx.globalCompositeOperation='source-over';
    if(!element.isConnected)return false;
    element.appendChild(canvas);
    element.dataset.wearReady='true';
    element.dataset.wearMaterial='three-channel';
    element.dataset.wearChannels=String(channels);
    return true;
  }catch(_){
    // No texture is better than wood corrosion, corrupted art or a blocked save.
    element.dataset.wearError='true';
    return false;
  }
}

// A single intersection observer renders only cards near the viewport.
// This prevents large inventories and the 48-slot reel from allocating
// dozens of canvases while they're invisible on a phone.
const handlers=new WeakMap();
let observer=null;
function getObserver(){
  if(observer||typeof root.IntersectionObserver!=='function')return observer;
  observer=new root.IntersectionObserver(entries=>{
    for(const entry of entries){
      const el=entry.target;
      if(!el.isConnected){
        observer.unobserve(el);
        handlers.delete(el);
      }else if(entry.isIntersecting){
        const start=handlers.get(el);
        if(start)start();
      }
    }
  },{rootMargin:'180px 0px',threshold:0});
  return observer;
}
function attach(parent){
  if(!parent||typeof parent.querySelectorAll!=='function')return 0;
  const list=parent.querySelectorAll('.master-raster[data-wear-grade][data-wear-seed]');
  let count=0;
  for(const element of list){
    const grade=Number(element.dataset.wearGrade),seed=element.dataset.wearSeed;
    if(!seed||grade<1||grade>4||element.dataset.wearBound==='true')continue;
    const img=element.querySelector('img');
    if(!img)continue;
    element.dataset.wearBound='true';
    const viewport=getObserver();
    let visible=!viewport;
    const done=()=>{
      if(viewport)viewport.unobserve(element);
      handlers.delete(element);
    };
    let drawing=false;
    const draw=()=>{
      if(!element.isConnected){done();return}
      if(!visible||drawing||!img.complete||!img.naturalWidth)return;
      drawing=true;
      paint(element,img,grade,seed).then(didPaint=>{
        drawing=false;
        if(didPaint||element.dataset.wearError==='true'){done();return}
        if(element.isConnected&&typeof root.requestAnimationFrame==='function'){
          // One layout retry, never a rapid asynchronous busy loop.
          root.requestAnimationFrame(()=>draw());
        }
      }).catch(()=>{
        drawing=false;
        element.dataset.wearError='true';
        done();
      });
    };
    if(viewport){
      handlers.set(element,()=>{
        visible=true;
        draw();
      });
      viewport.observe(element);
    }
    if(img.complete&&img.naturalWidth)draw();
    else img.addEventListener('load',draw,{once:true});
    count++;
  }
  return count;
}
function release(parent){
  if(!parent||typeof parent.querySelectorAll!=='function'||!observer)return 0;
  const list=parent.querySelectorAll('.master-raster[data-wear-bound="true"]');
  for(const element of list){
    observer.unobserve(element);
    handlers.delete(element);
  }
  return list.length;
}
root.LootHubWearRenderer=Object.freeze({LIMITS,MAX_PIXELS,hash,pattern,texture,renderLayer,maskLayer,paint,attach,release});
})(window);
