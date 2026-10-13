/* LootHub 0.5.8 — optional, synthesized UI sounds and reel tick tracking.
   No external audio requests; AudioContext starts only after user interaction.
   Fails silently on browsers that do not support Web Audio. */
(function(root){'use strict';
let muted=false,context=null,frameId=0,reelSession=0,lastTick=-Infinity;
function setMuted(value){muted=!!value;if(muted)stopReel();return muted}
function isMuted(){return muted}
function motionReduced(){
 try{return !!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches)}
 catch(_){return false}
}
function audio(){
 if(muted)return null;
 const Impl=root.AudioContext||root.webkitAudioContext;
 if(!Impl)return null;
 try{
  if(!context)context=new Impl();
  if(context.state==='suspended'){
   const resumed=context.resume();
   if(resumed&&typeof resumed.catch==='function')resumed.catch(()=>{});
  }
  return context;
 }catch(_){return null}
}
function tone(ctx,frequency,endFrequency,duration,volume,delay=0,wave='sine'){
 try{
  const now=ctx.currentTime+delay;
  const osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type=wave;
  osc.frequency.setValueAtTime(frequency,now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(45,endFrequency),now+duration);
  gain.gain.setValueAtTime(.0001,now);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),now+.009);
  gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  osc.connect(gain);gain.connect(ctx.destination);
  osc.start(now);osc.stop(now+duration+.02);
  return true;
 }catch(_){return false}
}
function play(name,detail={}){
 if(muted)return false;
 const ctx=audio();
 if(!ctx)return false;
 const grade=Math.max(0,Math.min(4,Number.isInteger(detail.tier)?detail.tier:0));
 if(name==='tick'){
  const now=typeof root.performance?.now==='function'?root.performance.now():Date.now();
  if(now-lastTick<42)return false;
  lastTick=now;
  return tone(ctx,330+Math.min(5,grade)*60,200+.5*grade*60,.055,.016,0,'triangle');
 }
 if(name==='tap')return tone(ctx,480,340,.045,.014,0,'triangle');
 if(name==='navigate'){
  tone(ctx,340,435,.077,.022,0,'sine');
  return tone(ctx,580,620,.055,.010,.035,'sine');
 }
 if(name==='open'){
  tone(ctx,165,75,.28,.048,0,'triangle');
  tone(ctx,355,590,.19,.024,.075,'sine');
  return true;
 }
 if(name==='coin'){
  tone(ctx,660,880,.10,.024,0,'sine');
  return tone(ctx,1000,1200,.13,.019,.080,'sine');
 }
 if(name==='purchase'){
  tone(ctx,520,400,.095,.023,0,'triangle');
  return tone(ctx,310,270,.11,.027,.07,'sine');
 }
 if(name==='confirm'){
  tone(ctx,400,550,.11,.023,0,'sine');
  return tone(ctx,600,800,.14,.020,.075,'sine');
 }
 if(name==='error')return tone(ctx,225,170,.18,.026,0,'triangle');
 if(name==='reveal'){
  // Higher rarity yields a richer but still quiet chord; no forced music.
  const base=[315,350,390,420,470][grade];
  tone(ctx,base,base*1.16,.22,.046,0,'triangle');
  tone(ctx,base*1.5,base*1.72,.34,.034,.055,'sine');
  if(grade>=2)tone(ctx,base*2,base*2.24,.40,.024,.14,'sine');
  if(grade>=4)tone(ctx,base*2.5,base*3,.52,.018,.23,'sine');
  return true;
 }
 return false;
}
function reelIndex(offset,viewportWidth,step=120){
 if(!Number.isFinite(offset)||!Number.isFinite(viewportWidth)||step<=0)return -1;
 return Math.floor((viewportWidth/2-offset)/step);
}
function stopReel(){
 reelSession++;
 if(frameId&&typeof root.cancelAnimationFrame==='function')root.cancelAnimationFrame(frameId);
 frameId=0;
}
function startReel(track,viewport){
 stopReel();
 if(muted||motionReduced()||!track||!viewport||typeof root.requestAnimationFrame!=='function')return false;
 const current=reelSession;
 let previous=-1,start=null;
 function sample(ts){
  if(reelSession!==current)return;
  if(!track.isConnected||!viewport.isConnected){stopReel();return}
  if(start===null)start=ts;
  try{
   const region=viewport.getBoundingClientRect(),left=track.getBoundingClientRect().left-region.left;
   const card=track.children&&track.children[0];
   const step=card&&card.getBoundingClientRect().width
     ?card.getBoundingClientRect().width+8:120;
   const slot=reelIndex(left,region.width,step);
   if(previous>=0&&slot>previous&&slot<=47)play('tick',{tier:Math.min(4,Math.floor(slot/12))});
   previous=slot;
  }catch(_){stopReel();return}
  if(ts-start<7100)frameId=root.requestAnimationFrame(sample);
  else stopReel();
 }
 frameId=root.requestAnimationFrame(sample);
 return true;
}
root.LootHubFX=Object.freeze({play,setMuted,isMuted,motionReduced,startReel,stopReel,reelIndex});
})(window);
