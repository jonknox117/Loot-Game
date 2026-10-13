/* Loot Hub 0.6.0: five simultaneously spinning case reels, no external libraries.
   Global callbacks use the existing game's single-save and drop engines. */
let multiSelection=[];
function multiOpenEntry(){
 const total=s.items.filter(x=>x.kind==='case').length;
 return '<section class="panel multi-entry"><div><div class="section-eyebrow">NEW · MULTI-OPEN</div>'+
 '<h2>Open up to five cases</h2><p class="muted">Five simultaneous spins. Mix Arsenal and Cartel cases. Rewards are saved before animation.</p></div>'+
 '<button class="primary" onclick="showMultiPicker()" '+(total?'':'disabled')+
 '>Select owned cases ('+total+')</button></section>';
}
function showMultiPicker(ids){
 if(busy)return;
 const owned=s.items.filter(x=>x.kind==='case');
 multiSelection=Array.isArray(ids)?
  ids.filter(id=>owned.some(x=>x.id===id)).slice(0,5):
  multiSelection.length?
   multiSelection.filter(id=>owned.some(x=>x.id===id)).slice(0,5):
   owned.slice(0,5).map(x=>x.id);
 renderMultiPicker();
}
function renderMultiPicker(){
 if(busy)return;
 const owned=s.items.filter(x=>x.kind==='case');
 const count=multiSelection.length;
 dialog('<div class="multi-picker"><div class="section-eyebrow">MULTI-OPEN · 1–5</div>'+
  '<h2>Choose your cases</h2><p class="muted">Each case has an independent roll and will be consumed.</p>'+
  '<div class="multi-picker-head"><strong>'+count+' / 5 selected</strong><div class="row">'+
  '<button onclick="pickMultiFive()">Select 5</button><button onclick="clearMultiSelection()">Clear</button></div></div>'+
  '<div class="multi-case-choices">'+(owned.length?owned.map(x=>
   '<label class="multi-case-choice'+(multiSelection.includes(x.id)?' selected':'')+'">'+
   '<input type="checkbox" '+(multiSelection.includes(x.id)?'checked':'')+
   ' '+(count===5&&!multiSelection.includes(x.id)?'disabled':'')+
   ' onchange="toggleMultiCase(\''+x.id+'\')">'+
   '<span class="multi-case-mini">'+visualArt(x,'reel')+'</span>'+
   '<span>'+escapeHTML(itemName(x))+'</span></label>').join(''):
   '<p class="muted">No sealed cases in inventory. Purchase cases first.</p>')+'</div>'+
  '<div class="multi-picker-actions"><button class="primary" onclick="startMultiOpen()" '+
   (count?'':'disabled')+'>Open '+count+' case'+(count===1?'':'s')+'</button>'+
  '<button onclick="closeDialog()">Cancel</button></div></div>');
}
function toggleMultiCase(id){
 if(busy)return;
 if(multiSelection.includes(id))multiSelection=multiSelection.filter(x=>x!==id);
 else if(multiSelection.length<5&&s.items.some(x=>x.kind==='case'&&x.id===id))multiSelection.push(id);
 else{window.LootHubFX.play('error');return}
 renderMultiPicker();
}
function pickMultiFive(){
 if(busy)return;
 multiSelection=s.items.filter(x=>x.kind==='case').slice(0,5).map(x=>x.id);
 renderMultiPicker();
}
function clearMultiSelection(){multiSelection=[];renderMultiPicker()}
function startMultiOpen(){return startMultiOpenWithIds(multiSelection.slice())}
function multiReelRow(reward,owned,index){
 const pool=owned.caseId==='cartel'?cartelCatalog:
  owned.caseId&&lineCatalogs[owned.caseId]?lineCatalogs[owned.caseId]:dropCatalog;
 const colors=['#9ba6b7','#5acc7c','#579bf1','#ad6def','#e7b64e'];
 const sequence=Array.from({length:14},()=>pool[rng(pool.length)]);
 sequence[10]=reward;
 const tiles=sequence.map((entry,n)=>{
  // Reel filler is visual only, not an actual item or a new condition roll.
  const art=n===10?reward:{...entry,id:'multi-preview-'+index+'-'+n,wearGrade:0};
  return '<div class="tile" data-reel-index="'+n+'" style="border-color:'+colors[entry.tier]+';--tile-accent:'+colors[entry.tier]+'">'+
   visualArt(art,'reel')+'<span class="tile-name">'+escapeHTML(entry.weapon)+'</span></div>';
 }).join('');
 return '<div class="multi-lane" data-case-index="'+index+'">'+
  '<div class="multi-lane-header"><b>'+(index+1)+'. '+escapeHTML(itemName(owned))+'</b>'+
  '<span class="muted tiny">SPINNING</span></div>'+
  '<div class="reel" aria-label="Case '+(index+1)+' spinning reel"><div class="pointer"></div>'+
  '<div class="track" id="multi-track-'+index+'">'+tiles+'</div></div></div>';
}
function startMultiOpenWithIds(ids){
 if(busy||!canMutate())return false;
 if(!window.LootHubMultiOpen.eligible(s,ids))return false;
 busy=true;
 const result=window.LootHubMultiOpen.commit(s,ids,roll);
 if(!result){busy=false;window.LootHubFX.play('error');return false}
 multiSelection=[];
 log('Multi-open: '+result.rewards.length+' cases → '+
   result.rewards.map(x=>itemName(x)).join(', '));
 save(); // The five results are in persistent inventory before the first frame.
 window.LootHubFX.play('open');
 dialog('<div class="multi-spin-screen"><div class="reel-header"><span class="spin-eyebrow">MULTI-OPEN · '+
  result.rewards.length+' CASE'+(result.rewards.length===1?'':'S')+
  '</span><span class="spin-pulse">OPENING</span></div>'+
  '<h2 class="spin-title">Simultaneous case opening</h2>'+
  '<div class="multi-lanes">'+result.rewards.map((x,i)=>multiReelRow(x,result.cases[i],i)).join('')+
  '</div><p class="muted tiny spin-note">All '+result.rewards.length+
  ' rewards are already saved. Skipping cannot change the results.</p>'+
  '<button class="spin-skip" onclick="finishMultiOpening()">Reveal all</button></div>');
 const reduced=window.LootHubFX.motionReduced(),duration=reduced?0:5300;
 for(let i=0;i<result.rewards.length;i++){
  const track=document.getElementById('multi-track-'+i);
  const view=track.parentElement;
  const tileWidth=track.children?.[0]?.getBoundingClientRect?.().width||100;
  const target=Math.round((view.clientWidth||390)/2-(10*(tileWidth+6)+tileWidth/2));
  track.style.transition=reduced?'none':
   'transform '+(4.6+i*.13).toFixed(2)+'s cubic-bezier(.10,.77,.12,1)';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   track.style.transform='translateX('+target+'px)';
  }));
  if(i===0&&!reduced)window.LootHubFX.startReel(track,view);
 }
 pending={multi:true,rewards:result.rewards,cases:result.cases,
          timer:setTimeout(finishMultiOpening,duration+220)};
 return true;
}
function finishMultiOpening(){
 if(!pending||pending.multi!==true)return;
 clearTimeout(pending.timer);window.LootHubFX.stopReel();
 const rewards=pending.rewards,cases=pending.cases;
 pending=null;busy=false;s.pendingReveal=null;save();render();
 window.LootHubFX.play('reveal',{tier:Math.max(...rewards.map(x=>x.tier))});
 dialog('<div class="multi-winnings"><div class="section-eyebrow">MULTI-OPEN COMPLETE</div>'+
  '<h2>'+rewards.length+' new items acquired</h2>'+
  '<p class="muted">All rewards have been added to your inventory.</p>'+
  '<div class="multi-prize-grid">'+rewards.map((x,i)=>
   '<div class="multi-prize rarity-'+cls(tiers[x.tier])+'">'+
   '<div class="tag '+cls(tiers[x.tier])+'">'+tiers[x.tier]+'</div>'+
   '<div class="multi-prize-art"><div class="multi-prize-weapon">'+visualArt(x,'inventory')+'</div>'+
   '<div class="multi-prize-chest">'+visualArt({kind:'case',caseId:cases[i].caseId||'arsenal'},'open-small')+'</div></div>'+
   '<strong>'+escapeHTML(itemName(x))+'</strong>'+
   '<div class="muted tiny">'+conditionTag(x)+' · ≈ '+money(marketEstimate(x))+' coins</div>'+
   '<button onclick="inspect(\''+x.id+'\')">Inspect</button></div>').join('')+'</div>'+
  '<div class="row"><button class="primary" onclick="closeDialog();go(\'Inventory\')">View inventory</button>'+
  '<button onclick="closeDialog()">Keep all</button></div></div>');
}
