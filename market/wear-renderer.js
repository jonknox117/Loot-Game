/* LootHub 0.5.3 — reusable procedural wear textures.
   No extra gun images or manually traced silhouettes. The unchanged source
   image alpha is the mask. For now previews run on inspect-sized raster art;
   full inventory/reel integration belongs to the next patch. */
(function(root){
'use strict';
const LIMITS=Object.freeze([
  Object.freeze({scratch:0,dirt:0,rust:0}),
  Object.freeze({scratch:22,dirt:12,rust:0}),
  Object.freeze({scratch:42,dirt:21,rust:8}),
  Object.freeze({scratch:75,dirt:36,rust:19}),
  Object.freeze({scratch:118,dirt:56,rust:35})
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
  for(let i=0;i<count.scratch;i++){
    result.push(Object.freeze({kind:'scratch',x:rand(),y:rand(),
      length:r(.022,.19),angle:r(-1.1,1.1),width:r(.0012,.004),
      alpha:r(.10,.26)+grade*.024,bright:rand()>.52}));
  }
  for(let i=0;i<count.dirt;i++){
    result.push(Object.freeze({kind:'dirt',x:rand(),y:rand(),
      radius:r(.025,.15),squash:r(.27,.78),alpha:r(.07,.14)+grade*.025,
      brown:rand()>.47}));
  }
  for(let i=0;i<count.rust;i++){
    result.push(Object.freeze({kind:'rust',x:rand(),y:rand(),
      radius:r(.005,.027),squash:r(.4,1),alpha:r(.17,.34)+grade*.055,
      brown:rand()>.4}));
  }
  const frozen=Object.freeze(result);
  if(plans.size>=MAX_PLANS)plans.delete(plans.keys().next().value);
  plans.set(key,frozen);
  return frozen;
}
function texture(ctx,width,height,seed,grade){
  const short=Math.min(width,height);
  for(const mark of pattern(seed,grade)){
    const x=mark.x*width,y=mark.y*height;
    if(mark.kind==='scratch'){
      const len=mark.length*short;
      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.lineTo(x+Math.cos(mark.angle)*len,y+Math.sin(mark.angle)*len);
      ctx.lineWidth=Math.max(.55,mark.width*short);
      ctx.lineCap='round';
      ctx.strokeStyle=mark.bright?'rgba(214,206,184,'+mark.alpha+')':
        'rgba(33,29,25,'+mark.alpha+')';
      ctx.stroke();
      // A narrow highlight makes scratches read as abrasion, not painted stripes.
      if(mark.bright){
        ctx.beginPath();
        ctx.moveTo(x,y+.85);
        ctx.lineTo(x+Math.cos(mark.angle)*len,y+Math.sin(mark.angle)*len+.85);
        ctx.lineWidth=Math.max(.4,mark.width*short*.36);
        ctx.strokeStyle='rgba(18,21,24,'+(mark.alpha*.55)+')';
        ctx.stroke();
      }
    }else if(mark.kind==='dirt'){
      const radius=mark.radius*short;
      ctx.save();
      ctx.translate(x,y);
      ctx.scale(1,mark.squash);
      const grad=ctx.createRadialGradient(0,0,0,0,0,radius);
      grad.addColorStop(0,mark.brown?'rgba(91,61,38,'+mark.alpha+')':
        'rgba(16,20,19,'+mark.alpha+')');
      grad.addColorStop(.6,mark.brown?'rgba(81,61,39,'+(mark.alpha*.48)+')':
        'rgba(20,22,19,'+(mark.alpha*.35)+')');
      grad.addColorStop(1,'rgba(20,20,20,0)');
      ctx.fillStyle=grad;
      ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }else{
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
function paint(element,img,grade,seed){
  if(!element.isConnected||element.dataset.wearReady==='true')return false;
  const width=img.clientWidth,height=img.clientHeight;
  if(width<10||height<10||!img.naturalWidth||!img.naturalHeight)return false;
  const browserDpr=Number(root.devicePixelRatio)||1;
  const ratio=Math.min(MAX_DPR,Math.max(1,browserDpr),
    MAX_PIXELS/Math.max(width,height));
  const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
  const owner=img.ownerDocument;
  const canvas=owner.createElement('canvas');
  canvas.width=w;canvas.height=h;
  canvas.className='wear-overlay';
  canvas.setAttribute('aria-hidden','true');
  try{
    const ctx=canvas.getContext('2d',{alpha:true});
    if(!ctx)return false;
    texture(ctx,w,h,seed,grade);
    const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight);
    const dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
    ctx.globalCompositeOperation='destination-in';
    ctx.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);
    ctx.globalCompositeOperation='source-over';
    element.appendChild(canvas);
    element.dataset.wearReady='true';
    return true;
  }catch(_){
    // CORS/graphics failures must never damage the original art or trade flow.
    element.dataset.wearError='true';
    return false;
  }
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
    const draw=()=>{
      if(!element.isConnected)return;
      if(!paint(element,img,grade,seed)&&element.dataset.wearError!=='true'){
        if(typeof root.requestAnimationFrame==='function')
          root.requestAnimationFrame(()=>paint(element,img,grade,seed));
      }
    };
    if(img.complete&&img.naturalWidth)draw();
    else img.addEventListener('load',draw,{once:true});
    count++;
  }
  return count;
}
root.LootHubWearRenderer=Object.freeze({LIMITS,MAX_PIXELS,hash,pattern,texture,attach});
})(window);
