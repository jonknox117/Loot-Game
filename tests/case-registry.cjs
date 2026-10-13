/* Run directly with: node tests/case-registry.cjs
   This asset audit also runs as part of tests/core.cjs in CI. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/case-registry.js'),'utf8');
const catalog=fs.readFileSync(path.join(root,'assets/weapon-catalog.js'),'utf8');
const cartel=fs.readFileSync(path.join(root,'assets/cartel-case.js'),'utf8');
const specOps=fs.readFileSync(path.join(root,'assets/spec-ops-case.js'),'utf8');
const collections=fs.readFileSync(path.join(root,'assets/collections.js'),'utf8');
const injection='const EXTRA_CASES=Object.freeze([';
assert.equal(source.split(injection).length,2,'Registry has one extension point');

function boot(extra=''){
 const window={};
 const ctx=vm.createContext({window});
 vm.runInContext(catalog+'\n'+cartel+'\n'+specOps+'\n'+source.replace(injection,injection+extra),ctx,
  {filename:'curated-registry.js',timeout:10000});
 vm.runInContext(collections,ctx,{filename:'collections.js',timeout:10000});
 return window;
}
const app=boot(),registry=app.LootHubCaseRegistry;
assert.deepEqual(Array.from(registry.all(),x=>x.id),['arsenal','cartel','spec-ops','lavish']);
assert.deepEqual(Array.from(registry.releasedThemed(),x=>x.id),['cartel','spec-ops','lavish']);
assert.equal(registry.priceFor('arsenal'),25);
assert.equal(registry.priceFor('cartel'),75);
assert.equal(registry.priceFor('spec-ops'),75);
assert.equal(registry.priceFor('lavish'),75);
assert.deepEqual(Array.from(registry.pool('lavish'),x=>[x.weapon,x.tier,x.base]),[
  ['M1911',0,40],['Thompson SMG',1,110],['Double-Barrel Shotgun',2,350],
  ['Mosin-Nagant',3,1050],['Tactical Tomahawk',4,4200]
]);
assert.equal(registry.priceFor('unreleased-unknown'),null);
assert.equal(registry.displayName('unknown'),null);
assert.equal(registry.pool('cartel').length,5);
assert.equal(registry.pool('spec-ops').length,5);
assert.equal(registry.skinImage({kind:'skin',weapon:'AK-47',skin:'Cartel'},800),null);
assert(registry.skinImage({kind:'skin',weapon:'SPAS-12',skin:'Spec Ops'},800).endsWith('spas-12--spec-ops-800.webp'));
assert.equal(registry.skinImage({kind:'skin',weapon:'SPAS-12',skin:'Not Approved'},800),null);
assert.equal(app.LootHubCollectionCatalog.length,4);
assert.equal(app.LootHubCollectionCatalog[3].id,'lavish-v1');
assert.equal(app.LootHubCollectionCatalog[3].items.length,5);
assert.equal(app.LootHubCollectionCatalog[1].items.length,5);
assert.equal(app.LootHubCollectionCatalog[2].items.length,5);

function webp(file){
 const full=path.join(root,file);
 assert(full.startsWith(root+path.sep),'Asset path must stay inside repository');
 assert(fs.existsSync(full),'Missing case or skin image: '+file);
 const bytes=fs.readFileSync(full);
 assert(bytes.length>100,'Empty WebP: '+file);
 assert.equal(bytes.toString('ascii',0,4),'RIFF',file+' is not a WebP');
 assert.equal(bytes.toString('ascii',8,12),'WEBP',file+' is not a WebP');
}
for(const def of registry.all()){
 if(!def.released)continue;
 for(const pose of ['closed','open']){
  for(const px of registry.DEFAULT_CASE_SIZES){
   const img=registry.chestImage(def.id,pose,px);
   assert(img&&img.endsWith('.webp'));
   webp(img);
  }
 }
 if(def.kind==='curated'){
  const pair=new Set();
  for(const item of def.items){
   const id=item.weapon+'|'+item.skin;
   assert(!pair.has(id),'Duplicate case skin: '+id);
   pair.add(id);
   assert(registry.skinFor(item),'Exclusive skin must be approved by registry');
   if(def.skinArt==='webp')for(const px of registry.DEFAULT_SKIN_SIZES){
    const img=registry.skinImage(item,px);
    assert(img&&img.endsWith('.webp'));
    webp(img);
   }
  }
 }
}
const fixture={
 id:'gallery-test',name:'Gallery Test',casePrice:92,released:true,
 description:'Fixture demonstrates adding an entire collection without new UI code.',
 collectionId:'gallery-test-v1',collectionReward:25,
 items:[
  {kind:'skin',weapon:'Thompson SMG',skin:'Gallery',tier:0,base:35},
  {kind:'skin',weapon:'M1911',skin:'Gallery',tier:1,base:100},
  {kind:'skin',weapon:'Mosin-Nagant',skin:'Gallery',tier:2,base:300},
  {kind:'skin',weapon:'Tactical Tomahawk',skin:'Gallery',tier:3,base:900},
  {kind:'skin',weapon:'Double-Barrel Shotgun',skin:'Gallery',tier:4,base:4000}
 ]
};
const future=boot(JSON.stringify(fixture)+',');
assert.equal(future.LootHubCaseRegistry.releasedThemed().length,4);
assert.equal(future.LootHubCaseRegistry.priceFor('gallery-test'),92);
assert.equal(future.LootHubCaseRegistry.pool('gallery-test').length,5);
assert(future.LootHubCaseRegistry.chestImage('gallery-test','open',1254)
 .endsWith('gallery-test-case-open-1254.webp'));
assert(future.LootHubCaseRegistry.skinImage({kind:'skin',weapon:'Mosin-Nagant',skin:'Gallery'},1600)
 .endsWith('kar98k--gallery-test-1600.webp'));
assert.equal(future.LootHubCollectionCatalog.length,5);
const gallery=future.LootHubCollectionCatalog.find(c=>c.id==='gallery-test-v1');
assert(gallery,'A future registered collection appears automatically');
assert.equal(gallery.items.length,5);
const draft=boot(JSON.stringify({...fixture,id:'gallery-draft',released:false,collectionId:'gallery-draft-v1'})+',');
assert.equal(draft.LootHubCaseRegistry.pool('gallery-draft'),null);
assert.equal(draft.LootHubCaseRegistry.priceFor('gallery-draft'),null);
assert.equal(draft.LootHubCollectionCatalog.length,4,'Unreleased cases stay out of the live collection book');
const traversal={...fixture,art:{open:{800:'../credentials.webp'}}};
assert.throws(()=>boot(JSON.stringify(traversal)+','),/Unsafe case image path/);
assert.throws(()=>boot(JSON.stringify({...fixture,id:'cartel'})+','),/Invalid or duplicate curated case/);
console.log('PASS: Declarative case registry, owner-approved assets, future-case fixture, draft hiding and collection migration.');
