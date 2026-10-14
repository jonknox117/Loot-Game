/* LootHub 0.7.0 — Auction House screen and persisted notification inbox. */
(function(root){'use strict';
const api=root.LootHubAuctions;
function action(fn,id){return 'window.LootHubAuctionUI.'+fn+'('+escapeHTML(JSON.stringify(String(id)))+')'}
function openEditor(k){
 const item=s.items.find(v=>v.id===k&&root.LootHubMarketCore.eligible(v));
 if(!item)return;
 const ref=marketEstimate(item);
 dialog('<div class="section-eyebrow">AUCTION HOUSE · NEW AUCTION</div><h2>'+
 escapeHTML(listingItemName(item))+'</h2>'+
 '<div class="listing-editor-art">'+visualArt(item,'inspect')+'</div>'+
 '<p class="muted tiny">Let NPC collectors compete while you play or while you are away. A high starting price may attract no bids. Buyers have independent spending limits.</p>'+
 '<div class="stat"><span>Market value</span><b>'+money(ref)+' coins</b></div>'+
 conditionPriceRows(item)+
 '<label for="auctionStartingBid">Starting bid (coins)</label>'+
 '<input id="auctionStartingBid" aria-label="Starting bid" class="field" type="number" inputmode="numeric" min="1" max="100000000" step="1" value="'+Math.max(1,Math.round(ref*.8))+'">'+
 '<label for="auctionDuration">Auction duration</label>'+
 '<select id="auctionDuration" class="field">'+api.DURATIONS.map(h=>
 '<option value="'+h+'"'+(h===12?' selected':'')+'>'+h+' hour'+(h===1?'':'s')+'</option>').join('')+'</select>'+
 '<p class="muted tiny">Your item is held in escrow. Cancel before the first bid, or accept the current highest funded bid at any time to end early. Otherwise, the auction settles when it expires. A 5% fee applies to successful sales.</p>'+
 '<div class="row"><button class="primary" onclick="'+action('start',k)+'">Start auction</button>'+
 '<button onclick="'+marketAction('inspect',k)+'">Back</button></div>');
}
function quickStart(k){
 if(busy||!canMutate())return false;
 const item=s.items.find(x=>x.id===k);
 if(!item||!['weapon','skin'].includes(item.kind)||
    !root.LootHubMarketCore.eligible(item))return false;
 const price=Math.max(1,Math.round(marketEstimate(item)*.8)),hours=12;
 if(!root.LootHubMarketCore.validAsk(price))return false;
 if(!confirm('Start a 12-hour auction for '+listingItemName(item)+' with a '+money(price)+
   '-coin starting bid? Your item moves into auction escrow. You can accept a funded bid early.'))return false;
 if(!canMutate())return false;
 const stillOwned=s.items.find(x=>x.id===k);
 if(!stillOwned||!root.LootHubMarketCore.eligible(stillOwned))return false;
 const snapshot=JSON.stringify(s);
 const listing=api.create(s,k,price,hours,Date.now());
 if(!listing)return false;
 recordActivity(s,'Quick-listed '+listingItemName(listing.item)+' for 12h auction, opening '+price+' coins');
 if(!save()){
  s=JSON.parse(snapshot);alert('Auction could not be saved. Your weapon remains owned.');return false;
 }
 closeDialog();utilityView=null;tab='Market';render();return true;
}
function start(k){
 if(!canMutate())return false;
 const bid=document.getElementById('auctionStartingBid'),duration=document.getElementById('auctionDuration');
 if(!bid||!duration)return false;
 const ask=Number(bid.value),hours=Number(duration.value);
 if(!root.LootHubMarketCore.validAsk(ask)||!api.DURATIONS.includes(hours)){
  alert('Choose a valid whole-coin opening bid and auction duration.');return false;
 }
 const before=JSON.stringify(s);
 const listing=api.create(s,k,ask,hours,Date.now());
 if(!listing)return false;
 recordActivity(s,'Listed '+listingItemName(listing.item)+' for auction at '+ask+' coins ('+hours+'h)');
 if(!save()){s=JSON.parse(before);alert('Auction could not be saved. Your item was retained.');return false}
 closeDialog();tab='Market';render();return true;
}
function remaining(l){
 const min=Math.ceil(Math.max(0,l.endsAt-Date.now())/60000);
 return min===0?'Awaiting settlement':min<60?min+'m left':Math.floor(min/60)+'h '+min%60+'m left';
}
function details(k){
 const l=s.listings.find(x=>x.id===k&&api.isAuction(x));if(!l)return;
 dialog('<div class="section-eyebrow">AUCTION HOUSE · BID HISTORY</div><h2>'+
 escapeHTML(listingItemName(l.item))+'</h2>'+
 '<div class="listing-editor-art">'+visualArt(l.item,'inspect')+'</div>'+
 '<div class="stat"><span>Starting bid</span><b>'+money(l.ask)+' coins</b></div>'+
 '<div class="stat"><span>Highest bid</span><b>'+(l.highestBid?money(l.highestBid)+' coins':'No bids')+'</b></div>'+
 '<div class="stat"><span>Time left</span><b>'+remaining(l)+'</b></div>'+
 '<div class="auction-bid-history">'+(l.bids.length?l.bids.slice(-18).map(x=>
  '<div class="stat"><span>'+escapeHTML(x.bidder)+' · '+new Date(x.at).toLocaleString()+'</span><b>'+money(x.amount)+' coins</b></div>').join(''):
  '<p class="muted">No bids yet. Buyers may arrive before the auction ends.</p>')+'</div>'+
 '<div class="row">'+(!l.bids.length?'<button onclick="'+action('cancel',k)+'">Cancel auction</button>':
 '<button class="primary" onclick="window.LootHubAuctionUI.accept('+escapeHTML(JSON.stringify(String(k)))+','+l.highestBid+','+escapeHTML(JSON.stringify(l.highestBidder))+')">Accept highest bid · '+money(root.LootHubMarketCore.netProceeds(l.highestBid))+' ◈ net</button>')+
 '<button onclick="closeDialog()">Close</button></div>');
}
function accept(k,expectedAmount,expectedBuyer){
 if(!canMutate())return false;
 const listing=s.listings.find(x=>x.id===k&&api.isAuction(x));
 if(!listing||!listing.highestBid||listing.highestBid!==expectedAmount||
   listing.highestBidder!==expectedBuyer)return false;
 const net=root.LootHubMarketCore.netProceeds(expectedAmount);
 if(!confirm('End this auction now? Sell for '+money(expectedAmount)+
   ' coins and receive '+money(net)+' coins after the 5% fee? This cannot be undone.'))return false;
 // Advance any elapsed bid slots before settling so a newly-arrived bid
 // cannot be silently sold at the price shown in an older dialog.
 marketTick();
 const current=s.listings.find(x=>x.id===k);
 if(!current||current.highestBid!==expectedAmount||current.highestBidder!==expectedBuyer){
   alert('The auction or leading bid changed. Review current bids before accepting.');
   closeDialog();render();return false;
 }
 if(!canMutate())return false;
 const before=JSON.stringify(s);
 const receipt=api.acceptHighestBid(s,k,expectedAmount,expectedBuyer,Date.now());
 if(!receipt){alert('The current bid could not be settled. Your auction remains active.');return false}
 recordActivity(s,'Accepted auction bid: '+listingItemName(receipt.item)+' for '+
   receipt.price+' coins ('+receipt.net+' after fees)');
 if(!save()){
   s=JSON.parse(before);alert('The auction sale could not be saved. No sale was committed.');
   return false;
 }
 closeDialog();render();
 return true;
}
function cancel(k){
 if(!canMutate())return false;
 const before=JSON.stringify(s);
 const l=api.cancel(s,k);
 if(!l){alert('Auctions with bids cannot be cancelled.');return false}
 recordActivity(s,'Cancelled unbid auction: '+listingItemName(l.item));
 if(!save()){s=JSON.parse(before);alert('Could not save the cancellation.');return false}
 closeDialog();render();return true;
}
function alerts(){
 const notes=api.notifications(s),unread=notes.filter(n=>!n.read).length;
 return '<section class="panel market-alerts" id="market-alerts"><div class="row space">'+
 '<h2>Market notifications'+(unread?' ('+unread+')':'')+'</h2>'+
 (unread?'<button onclick="window.LootHubAuctionUI.markRead()">Mark all read</button>':'')+
 '</div>'+(notes.length?notes.slice(0,12).map(n=>
 '<div class="market-notice'+(n.read?'':' market-notice-unread')+'"><span>'+
 escapeHTML(n.message)+'</span><small>'+new Date(n.at).toLocaleString()+'</small></div>').join(''):
 '<p class="muted tiny">New bids, auction sales, and unsold returns will be reported here.</p>')+
 '<p class="muted tiny">This browser game processes auctions and notifications when reopened; external push alerts require a server and notification permission.</p></section>';
}
function markRead(){
 if(!canMutate())return;
 const old=JSON.stringify(s);
 api.notifications(s).forEach(n=>{n.read=true});
 if(!save()){s=JSON.parse(old);return}
 render();
}
// Bid selection is transient UI state. Quotes include the exact bidder and
// amount the player selected, so a subsequent higher bid cannot be sold silently.
const selectedBids=new Map();
function bidQuotes(){
 return [...selectedBids.values()];
}
function batchBidPreview(){
 const quotes=bidQuotes();
 if(!quotes.length)return null;
 for(const q of quotes){
  const l=s.listings.find(x=>x.id===q.id&&api.isAuction(x));
  if(!l||l.highestBid!==q.amount||l.highestBidder!==q.buyer)return null;
 }
 const copy=JSON.parse(JSON.stringify(s));
 return api.batchAcceptHighestBids(copy,quotes,Date.now());
}
function bidToolbar(){
 const quotes=bidQuotes(),preview=batchBidPreview();
 const amount=preview?preview.total:0;
 return '<div class="batch-bid-status"><strong>'+quotes.length+' bid'+(quotes.length===1?'':'s')+
  ' selected</strong><span class="muted tiny">'+(quotes.length&&!preview?
   'A bid changed or a buyer cannot fund all selected bids. Review selections.':
   money(amount)+' ◈ combined net payout')+'</span></div>'+
  '<button class="primary" '+(preview?'':'disabled')+' onclick="window.LootHubAuctionUI.acceptSelectedBids()">'+
   'Accept selected · '+money(amount)+' ◈</button>';
}
function refreshBidToolbar(){
 const bar=document.getElementById('batchBidToolbar');
 if(bar)bar.innerHTML=bidToolbar();
}
function selectBid(id,checked){
 const l=s.listings.find(x=>x.id===id&&api.isAuction(x));
 if(checked){
  if(!l||!l.highestBid||!l.highestBidder)return false;
  selectedBids.set(id,{id,amount:l.highestBid,buyer:l.highestBidder});
 }else selectedBids.delete(id);
 refreshBidToolbar();return true;
}
function selectAllBids(){
 selectedBids.clear();
 for(const l of s.listings.filter(api.isAuction)){
  if(l.highestBid&&l.highestBidder)
   selectedBids.set(l.id,{id:l.id,amount:l.highestBid,buyer:l.highestBidder});
 }
 render();return true;
}
function clearSelectedBids(){
 selectedBids.clear();render();return true;
}
function acceptSelectedBids(){
 if(!canMutate())return false;
 const quotes=bidQuotes(),preview=batchBidPreview();
 if(!preview||!quotes.length)return false;
 if(!confirm('Accept '+quotes.length+' winning bid'+(quotes.length===1?'':'s')+
   ' early for '+money(preview.total)+' coins combined AFTER the 5% auction fee? This cannot be undone.'))return false;
 marketTick();
 const rechecked=batchBidPreview();
 if(!canMutate()||!rechecked||rechecked.total!==preview.total||
    rechecked.count!==quotes.length){
  selectedBids.clear();render();
  alert('One or more bids changed or cannot be funded. Review active auctions.');
  return false;
 }
 const snapshot=JSON.stringify(s);
 const receipt=api.batchAcceptHighestBids(s,quotes,Date.now());
 if(!receipt||receipt.count!==quotes.length||receipt.total!==preview.total)return false;
 recordActivity(s,'Accepted '+receipt.count+' auction bids for '+
   receipt.total+' coins net after fees');
 if(!save()){
  s=JSON.parse(snapshot);
  alert('Auction settlement could not be saved. Your listings remain active.');
  return false;
 }
 selectedBids.clear();closeDialog();render();return true;
}
function auctionPriority(listing,now=Date.now()){
 if(listing.highestBid&&listing.highestBidder)return 0;
 if(listing.endsAt-now<=60*60*1000)return 1;
 return 2;
}
function house(){
 const now=Date.now();
 const listings=s.listings.filter(api.isAuction).sort((a,b)=>
  auctionPriority(a,now)-auctionPriority(b,now)||
  a.endsAt-b.endsAt||String(a.id).localeCompare(String(b.id)));
 const ready=listings.filter(l=>auctionPriority(l,now)===0).length;
 const ending=listings.filter(l=>auctionPriority(l,now)===1).length;
 return '<section class="panel auction-house" id="market-auctions">'+
 '<div class="section-eyebrow">PASSIVE SALES · BIDDING OVER TIME</div>'+
 '<div class="row space"><h2>Auction House</h2><span class="muted tiny">'+listings.length+' active</span></div>'+
 (listings.length?'<div class="auction-attention" aria-label="Auction priorities"><strong>'+
  ready+' ready to accept</strong><span>'+ending+' ending soon</span><span>'+
  Math.max(0,listings.length-ready-ending)+' waiting for bids</span></div>':'')+
 '<p class="muted">Set a starting price and let independent NPC buyers compete. Your item sells automatically when the auction ends, or returns unsold.</p>'+
 (listings.some(l=>l.highestBid)?'<div class="batch-bid-tools"><div class="row"><button onclick="window.LootHubAuctionUI.selectAllBids()">Select all active bids</button>'+
 '<button onclick="window.LootHubAuctionUI.clearSelectedBids()">Clear</button></div>'+
 '<div id="batchBidToolbar" class="batch-bid-toolbar">'+bidToolbar()+'</div></div>':'')+
 (listings.length?listings.map(l=>
 '<div class="listing-line auction-listing" data-auction-priority="'+auctionPriority(l,now)+'">'+
 '<div class="listing-identity">'+visualArt(l.item)+
 '<div class="listing-identity-copy">'+
 '<span class="auction-status'+(auctionPriority(l,now)===0?' auction-ready':'')+'">'+
 (auctionPriority(l,now)===0?'Bid ready to accept':auctionPriority(l,now)===1?'Ending soon':'Waiting for bids')+'</span>'+
 '<b>'+escapeHTML(listingItemName(l.item))+'</b>'+
 '<span class="muted tiny">Market '+money(marketEstimate(l.item))+' ◈ · Opening '+money(l.ask)+' ◈</span>'+
 '<span class="muted tiny">'+remaining(l)+' · '+l.bids.length+' bids</span></div></div>'+
 '<div class="market-listing-controls">'+(l.highestBid?
  '<label class="auction-bid-select"><input type="checkbox" aria-label="Select bid for '+
   escapeHTML(listingItemName(l.item))+'" '+(selectedBids.has(l.id)?'checked ':'')+
   'onchange="window.LootHubAuctionUI.selectBid('+escapeHTML(JSON.stringify(String(l.id)))+
   ',this.checked)"> Select bid</label>':'')+
  '<b>'+(l.highestBid?money(l.highestBid)+' ◈ highest':'Awaiting first bid')+'</b>'+
 '<span class="muted tiny">Potential proceeds '+(l.highestBid?money(root.LootHubMarketCore.netProceeds(l.highestBid))+' ◈':'—')+'</span>'+
 '<div class="row"><button onclick="'+action('details',l.id)+'">View bids</button>'+
 (l.highestBid?'<button class="primary" onclick="window.LootHubAuctionUI.accept('+
 escapeHTML(JSON.stringify(String(l.id)))+','+l.highestBid+','+
 escapeHTML(JSON.stringify(String(l.highestBidder)))+
 ')">Accept bid · '+money(root.LootHubMarketCore.netProceeds(l.highestBid))+' ◈ net</button>':'')+
 (!l.bids.length?'<button onclick="'+action('cancel',l.id)+'">Cancel</button>':'')+'</div></div></div>').join(''):
 '<p class="muted tiny">No auctions yet. Select a weapon below and choose Auction.</p>')+
 '<p class="muted tiny">Duration: 1, 6, 12 or 24 hours · Accept any highest funded bid early · 5% success fee · No bids means no sale.</p></section>';
}
root.LootHubAuctionUI=Object.freeze({openEditor,quickStart,start,remaining,details,accept,cancel,alerts,markRead,house,selectBid,selectAllBids,clearSelectedBids,acceptSelectedBids});
})(window);
