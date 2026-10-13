/* LootHub 0.6.3 — five owner-supplied, curated Special Operations skins.
   This is a released case with an independent drop pool, not a procedural skin line. */
(function(root){'use strict';
const items=[
 {kind:'skin',weapon:'Glock-18',skin:'Spec Ops',tier:0,base:40,emoji:'🔫'},
 {kind:'skin',weapon:'MP5',skin:'Spec Ops',tier:1,base:110,emoji:'🔫'},
 {kind:'skin',weapon:'SPAS-12',skin:'Spec Ops',tier:2,base:350,emoji:'🔫'},
 {kind:'skin',weapon:'AWP',skin:'Spec Ops',tier:3,base:1050,emoji:'🎯'},
 {kind:'skin',weapon:'Karambit',skin:'Spec Ops',tier:4,base:4200,emoji:'🗡️'}
];
items.forEach(Object.freeze);
root.LootHubSpecOpsCase=Object.freeze({
 id:'spec-ops',name:'Spec Ops',casePrice:75,released:true,
 description:'Five owner-approved black Special Operations finishes with white spade insignias, one skin per rarity.',
 items:Object.freeze(items)
});
})(window);
