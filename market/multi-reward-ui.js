/* LootHub 0.7.7 — Review and selectively sell newly opened multi-case rewards.
   All rewards are already permanently owned before this view appears.
   Selection stays in memory and cannot sell any unrelated inventory item. */
let multiRewardReview=null;
let multiRewardSelected=new Set();
let multiRewardHighUnlocked=false;
let multiRewardSaleNotice='';

function showMultiRewardManager(rewards,cases){
 if(Array.isArray(rewards)&&Array.isArray(cases)){
  if(rewards.length!==cases.length||rewards.length<2||rewards.length>5)return false;
  multiRewardReview={rewards:[...rewards],cases:[...cases]};
  multiRewardSelected.clear();multiRewardHighUnlocked=false;multiRewardSaleNotice='';
 }
 return renderMultiRewardManager();
}
function ownedMultiRewards(){
 if(!multiRewardReview)return [];
 return multiRewardReview.rewards
  .map(original=>s.items.find(item=>item.id===original.id&&item.kind===original.kind))
  .filter(item=>item&&['weapon','skin'].includes(item.kind));
}
function multiRewardQuote(){
 const selected=ownedMultiRewards().filter(item=>multiRewardSelected.has(item.id));
 const prices=selected.map(item=>window.LootHubMarketTransactions.instantSellPrice(item));
 if(prices.some(x=>!Number.isSafeInteger(x)||x<1))return null;
 const total=prices.reduce((sum,price)=>sum+price,0);
 if(!Number.isSafeInteger(total))return null;
 return {selected,total,high:selected.some(item=>item.tier>=3)};
}
function multiRewardToolbar(){
 const q=multiRewardQuote();
 const count=q?q.selected.length:0,total=q?q.total:0;
 return '<div class="multi-reward-total" aria-live="polite"><strong>'+count+
  ' selected · '+money(total)+' coins</strong><span class="muted tiny">Instant sale value</span></div>'+
  '<button class="primary" '+(count?'':'disabled')+
  ' onclick="sellSelectedMultiRewards()">Sell selected · '+money(total)+' ◈</button>';
}
function updateMultiRewardToolbar(){
 const el=document.getElementById('multiRewardToolbar');
 if(el)el.innerHTML=multiRewardToolbar();
}
function selectMultiReward(id,checked,node){
 if(busy||!multiRewardReview)return false;
 const item=ownedMultiRewards().find(x=>x.id===id);
 if(!item||item.tier>=3&&!multiRewardHighUnlocked)return false;
 if(checked)multiRewardSelected.add(id);
 else multiRewardSelected.delete(id);
 if(node&&node.closest){
  const card=node.closest('.multi-prize');
  if(card&&card.classList)card.classList.toggle('multi-reward-selected',!!checked);
 }
 updateMultiRewardToolbar();
 return true;
}
function selectCommonMultiRewards(){
 if(busy||!multiRewardReview)return false;
 for(const item of ownedMultiRewards())if(item.tier<=1)multiRewardSelected.add(item.id);
 renderMultiRewardManager();
 return true;
}
function clearMultiRewardSelection(){
 multiRewardSelected.clear();renderMultiRewardManager();return true;
}
function unlockMultiRewardHighRarity(){
 if(busy||!multiRewardReview||multiRewardHighUnlocked)return false;
 if(!confirm('Unlock selection of Super Rare and Legendary rewards? These valuable weapons are protected from bulk selling by default.'))return false;
 multiRewardHighUnlocked=true;
 renderMultiRewardManager();
 return true;
}
function renderMultiRewardManager(){
 if(!multiRewardReview||busy)return false;
 const items=ownedMultiRewards();
 const cases=multiRewardReview.cases;
 const sourceById=new Map(multiRewardReview.rewards.map((item,index)=>[item.id,cases[index]]));
 const uniqueTypes=new Set(cases.map(c=>c.caseId||'arsenal'));
 const caseId=uniqueTypes.size===1?[...uniqueTypes][0]:null;
 const again=caseId?
  '<button class="repeat-case-button" onclick="repeatCaseOpening('+escapeHTML(JSON.stringify(caseId))+','+cases.length+')">Open '+cases.length+' '+
  escapeHTML(curatedCases.displayName(caseId))+' again</button>':
  '<button onclick="closeDialog();go(\'Cases\')">Choose more cases</button>';
 const cards=items.map(x=>{
  const high=x.tier>=3,locked=high&&!multiRewardHighUnlocked;
  const id=escapeHTML(JSON.stringify(String(x.id)));
  const imgCase=sourceById.get(x.id);
  return '<div class="multi-prize rarity-'+cls(tiers[x.tier])+
   (multiRewardSelected.has(x.id)?' multi-reward-selected':'')+'">'+
   '<div class="tag '+cls(tiers[x.tier])+'">'+escapeHTML(tiers[x.tier])+'</div>'+
   '<div class="multi-prize-art"><div class="multi-prize-weapon">'+visualArt(x,'inventory')+'</div>'+
   '<div class="multi-prize-chest">'+visualArt({kind:'case',caseId:imgCase.caseId||'arsenal'},'open-small')+'</div></div>'+
   '<strong>'+escapeHTML(itemName(x))+'</strong>'+
   '<div class="muted tiny">'+conditionTag(x)+' · Instant '+money(window.LootHubMarketTransactions.instantSellPrice(x))+' ◈</div>'+
   '<label class="multi-reward-select'+(high?' multi-reward-protected':'')+'">'+
   '<input class="multi-reward-pick" type="checkbox" data-reward-id="'+escapeHTML(String(x.id))+'" '+
   'aria-label="Select '+escapeHTML(itemName(x))+'" '+(locked?'disabled ':'')+
   (multiRewardSelected.has(x.id)?'checked ':'')+
   'onchange="selectMultiReward('+id+',this.checked,this)">'+
   (locked?'Protected':'Select to sell')+'</label>'+
   '<button onclick="inspect('+id+')">Inspect</button></div>';
 }).join('');
 dialog('<div class="multi-winnings multi-reward-manager">'+
  '<div class="section-eyebrow">MULTI-OPEN COMPLETE</div>'+
  '<h2>'+multiRewardReview.rewards.length+' new items acquired</h2>'+
  '<p class="muted tiny">'+items.length+' rewards remaining</p>'+
  (multiRewardSaleNotice?'<p class="multi-reward-success" role="status">'+escapeHTML(multiRewardSaleNotice)+'</p>':'')+
  '<p class="muted">All rewards are already yours. Select only the ones you want to sell.</p>'+
  (items.length?'<div class="multi-reward-tools">'+
   '<button onclick="selectCommonMultiRewards()" '+(items.some(x=>x.tier<=1)?'':'disabled')+
   '>Select Common &amp; Uncommon</button>'+
   '<button onclick="clearMultiRewardSelection()">Clear selection</button>'+
   (items.some(x=>x.tier>=3)?
     '<button class="multi-reward-unlock" '+(multiRewardHighUnlocked?'disabled ':'')+
     'onclick="unlockMultiRewardHighRarity()">'+
     (multiRewardHighUnlocked?'High rarities unlocked':'Unlock Super Rare / Legendary')+'</button>':'')+
   '</div>':'')+
  '<div class="multi-prize-grid">'+cards+'</div>'+
  (items.length?'<div id="multiRewardToolbar" class="multi-reward-toolbar">'+multiRewardToolbar()+'</div>':'')+
  '<div class="row multi-reward-next">'+again+
   '<button onclick="closeDialog()">Keep '+(items.length?'all':'remaining')+'</button>'+
   '<button onclick="closeDialog();go(\'Inventory\')">Inventory</button></div></div>');
 return true;
}
function sellSelectedMultiRewards(){
 if(busy||!canMutate()||!multiRewardReview)return false;
 const quote=multiRewardQuote();
 if(!quote||!quote.selected.length||quote.total<1||
    quote.high&&!multiRewardHighUnlocked)return false;
 const ids=quote.selected.map(x=>x.id);
 const question='Instant sell '+ids.length+' selected reward'+(ids.length===1?'':'s')+
  ' for '+money(quote.total)+' coins?'+
  (quote.high?' WARNING: Super Rare / Legendary collectibles are included.':'')+
  ' This cannot be undone.';
 if(!confirm(question)||busy||!canMutate())return false;
 const fresh=multiRewardQuote();
 if(!fresh||fresh.total!==quote.total||fresh.selected.length!==ids.length||
    fresh.high&&!multiRewardHighUnlocked||
    fresh.selected.some((item,index)=>item.id!==ids[index]))return false;
 const snapshot=JSON.stringify(s);
 const receipt=window.LootHubMarketTransactions.sellOwnedBatch(s,ids);
 if(!receipt||receipt.count!==ids.length||receipt.total!==quote.total){
  s=JSON.parse(snapshot);return false;
 }
 recordActivity(s,'Instant sold '+receipt.count+' newly opened weapons for '+receipt.total+' coins');
 if(!save()){
  s=JSON.parse(snapshot);
  alert('Your sale could not be saved. Every selected weapon is still yours.');
  return false;
 }
 multiRewardSelected.clear();
 multiRewardSaleNotice='Sold '+receipt.count+' reward'+(receipt.count===1?'':'s')+
  ' for '+money(receipt.total)+' coins.';
 window.LootHubFX.play('coin');render();renderMultiRewardManager();
 return true;
}
