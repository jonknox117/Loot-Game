/* 0.6.1 Collection Book UI, deliberately reachable from Cases/Inventory
   with its own primary destination on mobile and desktop. */
let collectionBookOpen=false,selectedCollectionId=null;
function collectionEntry(){
 const data=window.LootHubCollections.ensure(s);
 const totals=window.LootHubCollections.definitions.map(c=>{
  const p=data&&window.LootHubCollections.progress(s,c.id);
  return '<span>'+escapeHTML(c.name)+' '+(p?p.found:0)+'/'+c.items.length+'</span>';
 }).join('');
 return '<section class="panel collection-entry"><div><div class="section-eyebrow">COLLECTOR PROGRESSION</div>'+
  '<h2>Collection Book</h2><p class="muted">Discover every unique item to earn 25 cases from that collection. Selling or trading an item never removes progress.</p>'+
  '<div class="collection-summary">'+totals+'</div></div>'+
  '<button class="primary" onclick="openCollectionBook()">Open Collection Book</button></section>';
}
function openCollectionBook(){
 if(busy)return;
 tab='Collections';utilityView=null;collectionBookOpen=true;selectedCollectionId=null;render();
}
function showCollection(id){
 if(!window.LootHubCollections.definitions.some(x=>x.id===id))return;
 collectionBookOpen=true;selectedCollectionId=id;tab='Collections';utilityView=null;render();
}
function backToCollections(){selectedCollectionId=null;collectionBookOpen=true;render()}
function closeCollectionBook(){collectionBookOpen=false;selectedCollectionId=null;go('Cases')}
function collectionStatus(collection){
 const status=window.LootHubCollections.progress(s,collection.id);
 if(!status)return '';
 return '<article class="collection-panel">'+
   '<div class="collection-cover">'+visualArt({kind:'case',caseId:collection.caseId},'inventory')+'</div>'+
   '<div class="collection-panel-body"><h3>'+escapeHTML(collection.name)+' Collection</h3>'+
   '<div class="collection-stats"><b>'+status.found+' / '+status.total+'</b><span>'+
    Math.round(status.found/status.total*100)+'% discovered</span></div>'+
   '<div class="collection-meter" role="progressbar" aria-label="'+escapeHTML(collection.name)+
    ' discovery progress" aria-valuemin="0" aria-valuemax="'+status.total+
    '" aria-valuenow="'+status.found+'"><div style="width:'+(status.found/status.total*100)+'%"></div></div>'+
   '<p class="muted tiny">'+(status.claimed?'25-case reward claimed':status.complete?'Collection complete — reward ready':'Reward: 25 '+escapeHTML(collection.name)+' Cases')+'</p>'+
   '<button onclick="showCollection(\''+collection.id+'\')">View collection</button></div></article>';
}
function collectionTile(item,found){
 const entry={kind:item.kind,weapon:item.weapon,skin:item.skin,tier:item.tier,base:item.base};
 const title=item.kind==='skin'?item.weapon+' | '+item.skin:item.weapon;
 return '<div class="collection-tile'+(found?' discovered':' undiscovered')+'">'+
  '<div class="tag '+cls(tiers[item.tier])+'">'+escapeHTML(tiers[item.tier])+'</div>'+
  '<div class="collection-tile-art">'+visualArt(entry,'reel')+
  (found?'<span class="collection-check" aria-label="Discovered">✓</span>':
  '<span class="collection-lock" aria-label="Not yet discovered">LOCKED</span>')+'</div>'+
  '<strong>'+escapeHTML(title)+'</strong><small class="muted">'+
  (found?'Discovered':'Not discovered')+'</small></div>';
}
function collectionBook(){
 const collections=window.LootHubCollections.definitions;
 if(!selectedCollectionId)return '<section class="panel collection-book">'+
  '<div class="row space"><div><div class="section-eyebrow">PERMANENT DISCOVERIES</div><h2>Collections</h2></div>'+
   '</div>'+
  '<p class="muted">Keep your discovery credit after selling or trading. Only distinct approved items count. Previously sold items absent from your old save cannot be reconstructed.</p>'+
  '<div class="collection-list">'+collections.map(collectionStatus).join('')+'</div></section>';
 const c=collections.find(x=>x.id===selectedCollectionId);
 if(!c){selectedCollectionId=null;return collectionBook()}
 const p=window.LootHubCollections.progress(s,c.id);
 const seen=new Set(s.collections.progress[c.id].seen);
 return '<section class="panel collection-book"><div class="row space"><div>'+
  '<div class="section-eyebrow">COLLECTION '+escapeHTML(c.id.toUpperCase())+'</div>'+
  '<h2>'+escapeHTML(c.name)+' Collection</h2></div>'+
  '<button onclick="backToCollections()">All collections</button></div>'+
  '<div class="collection-detail-head"><div class="collection-detail-case">'+
   visualArt({kind:'case',caseId:c.caseId},'inventory')+'</div>'+
  '<div class="collection-detail-info"><strong>'+p.found+' / '+p.total+' discovered</strong>'+
  '<div class="collection-meter" role="progressbar" aria-label="Collection completion" aria-valuemin="0" aria-valuemax="'+p.total+
   '" aria-valuenow="'+p.found+'"><div style="width:'+(p.found/p.total*100)+'%"></div></div>'+
  '<p class="muted tiny">Reward: 25 sealed '+escapeHTML(c.name)+' Cases</p>'+
  (p.claimed?'<div class="collection-claimed">✓ Reward claimed</div>':
   p.complete?'<button class="primary collection-claim-button" onclick="claimCollection(\''+c.id+'\')">Claim 25 '+escapeHTML(c.name)+' Cases</button>':
   '<span class="muted tiny">Discover '+(p.total-p.found)+' more unique item'+(p.total-p.found===1?'':'s')+' to claim.</span>')+
  '</div></div><div class="collection-items">'+c.items.map(x=>collectionTile(x,seen.has(x.id))).join('')+
  '</div></section>';
}
function claimCollection(id){
 if(busy||!canMutate())return false;
 const definition=window.LootHubCollections.definitions.find(x=>x.id===id);
 if(!definition)return false;
 const snapshot=JSON.stringify(s);
 busy=true;
 const granted=window.LootHubCollections.claim(s,id,caseItem);
 if(!granted){busy=false;return false}
 recordActivity(s,'Completed '+definition.name+' collection — claimed 25 sealed '+definition.name+' Cases');
 if(!save()){
  // No success state when the save failed. Restore inventory, receipts and log.
  s=JSON.parse(snapshot);busy=false;
  alert('Could not save your collection reward. Nothing was claimed. Restore saving before retrying.');
  return false;
 }
 busy=false;render();
 window.LootHubFX.play('reveal',{tier:4});
 dialog('<div class="collection-grant"><div class="section-eyebrow">COLLECTION COMPLETED</div>'+
  '<h2>25 '+escapeHTML(definition.name)+' Cases awarded!</h2>'+
  '<div class="collection-grant-art">'+visualArt({kind:'case',caseId:definition.caseId},'inventory')+'</div>'+
  '<p>Your 25 sealed cases are saved in Inventory. You can open up to five at once or trade them.</p>'+
  '<div class="row"><button class="primary" onclick="closeDialog();go(\'Inventory\')">View cases</button>'+
  '<button onclick="closeDialog()">Keep collecting</button></div></div>');
 return true;
}
