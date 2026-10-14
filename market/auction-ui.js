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
function house(){
 const listings=s.listings.filter(api.isAuction);
 return '<section class="panel auction-house" id="market-auctions">'+
 '<div class="section-eyebrow">PASSIVE SALES · BIDDING OVER TIME</div>'+
 '<div class="row space"><h2>Auction House</h2><span class="muted tiny">'+listings.length+' active</span></div>'+
 '<p class="muted">Set a starting price and let independent NPC buyers compete. Your item sells automatically when the auction ends, or returns unsold.</p>'+
 (listings.length?listings.map(l=>
 '<div class="listing-line auction-listing"><div class="listing-identity">'+visualArt(l.item)+
 '<div class="listing-identity-copy"><b>'+escapeHTML(listingItemName(l.item))+'</b>'+
 '<span class="muted tiny">Market '+money(marketEstimate(l.item))+' ◈ · Opening '+money(l.ask)+' ◈</span>'+
 '<span class="muted tiny">'+remaining(l)+' · '+l.bids.length+' bids</span></div></div>'+
 '<div class="market-listing-controls"><b>'+(l.highestBid?money(l.highestBid)+' ◈ highest':'Awaiting first bid')+'</b>'+
 '<span class="muted tiny">Potential proceeds '+(l.highestBid?money(root.LootHubMarketCore.netProceeds(l.highestBid))+' ◈':'—')+'</span>'+
 '<div class="row"><button onclick="'+action('details',l.id)+'">View bids</button>'+
 (l.highestBid?'<button class="primary" onclick="'+action('details',l.id)+'">Review &amp; accept bid</button>':'')+
 (!l.bids.length?'<button onclick="'+action('cancel',l.id)+'">Cancel</button>':'')+'</div></div></div>').join(''):
 '<p class="muted tiny">No auctions yet. Select a weapon below and choose Auction.</p>')+
 '<p class="muted tiny">Duration: 1, 6, 12 or 24 hours · Accept any highest funded bid early · 5% success fee · No bids means no sale.</p></section>';
}
root.LootHubAuctionUI=Object.freeze({openEditor,start,remaining,details,accept,cancel,alerts,markRead,house});
})(window);
