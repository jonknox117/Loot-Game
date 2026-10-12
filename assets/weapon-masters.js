/* LootHub Arsenal Weapon Masters — Patch 0.3.2
   Original, hand-authored vector foundation models.
   Models are stylized game collectibles, not engineering diagrams or photoreal assets.
   Finish surfaces support independent skin art in Patch 0.3.3.
*/
(function(global){
'use strict';
const P=(d,k='metal')=>'<path class="'+k+'" d="'+d+'"/>';
const R=(x,y,w,h,rad=2,k='metal')=>'<rect class="'+k+'" x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+rad+'"/>';
const C=(x,y,r,k='hardware')=>'<circle class="'+k+'" cx="'+x+'" cy="'+y+'" r="'+r+'"/>';
const L=(x1,y1,x2,y2,k='scribe',stroke=2)=>'<path class="'+k+'" stroke-width="'+stroke+'" d="M'+x1+' '+y1+'L'+x2+' '+y2+'"/>';
const A=(x,y,n=5,w=7,k='rail')=>Array.from({length:n},(_,i)=>R(x+i*(w+3),y,w,4,1,k)).join('');
const G=(x,y,n=7,w=4)=>Array.from({length:n},(_,i)=>L(x+i*8,y,x+i*8,y+8,'scribe',1.5)).join('');
const models=Object.create(null);
Object.assign(models,{
"Glock-18": function(){return [P("M145 91H436L448 98v34H150q-9-4-5-14Z","metal"),P("M153 91H435l9 11H151Z","metalLight"),R(149,130,289,19,5,"polymer"),P("M260 146h70l9 10-23 81h-54l-10-89Z","polymer"),P("M256 149h68l4 7-17 69h-42l-10-71Z","grip"),P("M325 145h54q-2 38-37 36h-20Z","frame"),P("M345 153l-7 18","scribe"),R(150,117,36,8,1,"metalDark"),R(406,114,36,15,1,"metalDark"),G(407,96,4,4),P("M171 122h115l22 9H150Z","finish"),L(191,138,385,138,"metalLight",2),C(388,138,4,"hardware"),C(165,140,3,"hardware")].join("");},
"USP-S": function(){return [P("M126 101H441l17 15-5 20H132l-12-20Z","metal"),R(441,109,129,20,9,"metalDark"),R(563,113,9,12,3,"metalLight"),P("M142 126H432v20H139Z","polymer"),P("M242 142h72l-15 94-41 6-31-92Z","grip"),P("M226 147h17l32 88-10 7Z","polymer"),P("M309 143h76q-2 43-50 34h-27Z","frame"),P("M333 150q4 20-7 26","scribe"),R(412,102,10,20,0,"metalDark"),R(123,89,37,8,2,"metalDark"),G(382,106,5,4),C(149,137,4,"hardware"),L(178,142,417,142,"scribe",2),P("M152 126h172l13 13H142Z","finish"),R(494,117,36,4,2,"hardware")].join("");},
"P250": function(){return [P("M154 100L171 91H432l14 18v29H155l-11-17Z","metal"),P("M174 93H424l14 14H166Z","metalLight"),P("M164 139H425l-12 19-64 2-32-10-16 94h-46l-33-88-58-2Z","polymer"),P("M246 158l54 3-11 77h-26Z","grip"),P("M325 157h64q-4 34-50 31h-18Z","frame"),P("M342 162q4 13-3 23","scribe"),R(151,121,30,10,2,"metalDark"),G(397,106,4,4),L(174,146,400,146,"scribe",2),C(178,148,4,"hardware"),P("M203 133h123l8 10H185Z","finish")].join("");},
"Five-SeveN": function(){return [P("M140 107l31-19H455l19 18-8 30H156Z","metal"),P("M175 87h267l23 16H157Z","metalLight"),P("M154 135h313l-20 18-107 5-35 3-19 83h-55l-36-83-38-6Z","polymer"),P("M236 163l56-1-19 76-29-2Z","grip"),P("M306 157h76q-3 46-48 40h-23Z","frame"),P("M341 164q-1 22-12 29","scribe"),R(158,103,25,9,2,"metalDark"),G(421,103,6,4),P("M184 134h143l12 17H175Z","finish"),C(172,143,4,"hardware"),L(387,139,442,137,"scribe",2),R(244,91,35,4,1,"rail")].join("");},
"Desert Eagle": function(){return [P("M142 97l31-24h308l16 23-7 39H140l-9-12Z","metal"),P("M184 74h291l15 18H164Z","metalLight"),P("M140 131h338l-7 19-135 8-21 4-23 89h-65l-17-92-63-2Z","polymer"),P("M230 161l74 5-20 82-52-2Z","grip"),P("M312 157h78q-2 47-54 40h-30Z","frame"),P("M348 169q3 18-9 27","scribe"),R(151,113,46,9,2,"metalDark"),G(434,108,6,4),R(173,64,57,7,2,"metalDark"),P("M211 125h111l19 26H194Z","finish"),C(169,145,5,"hardware"),C(448,143,4,"hardware"),L(203,147,447,145,"metalLight",2)].join("");},
"MP5": function(){return [P("M94 127l-24-17-17 0-12 30 33 3 25-4 74 3 13-14Z","polymer"),R(157,125,38,11,3,"metalDark"),P("M188 118h214l19 13-9 30H192l-15-26Z","metal"),P("M405 123h86l18 15-13 21h-91Z","polymer"),R(486,133,103,10,3,"metalDark"),R(532,119,8,21,2,"hardware"),P("M300 162h44l-16 73h-35l-7-72Z","metalDark"),P("M263 157l-21 63h-27l-12-59Z","grip"),P("M348 158h50q-4 31-37 25h-25Z","frame"),P("M359 164q1 14-6 21","scribe"),R(220,102,75,11,4,"metalDark"),R(298,103,28,7,2,"rail"),R(449,129,23,5,2,"hardware"),A(398,117,8,8,"rail"),G(459,139,4,4),P("M224 123h132v31H218Z","finish"),C(245,152,3,"hardware"),L(234,159,351,159,"scribe",2)].join("");},
"UMP-45": function(){return [P("M69 133l-24 44h53l25-35 67 0 18-27h-89Z","polymer"),P("M125 114h279l29 14-12 36H183l-25-25Z","metal"),P("M414 124l84-3 24 19-11 23h-89Z","polymer"),R(500,130,85,12,2,"metalDark"),R(217,100,108,10,2,"metalDark"),A(342,109,10,5,"rail"),R(541,116,10,15,3,"metalDark"),P("M290 163h55l-10 77h-44l-17-76Z","metalDark"),P("M229 160l-22 64-27-4 14-61Z","grip"),P("M348 160h57l-14 39-39-1Z","frame"),P("M363 167l-4 25","scribe"),P("M216 119h140l22 23-24 14H205Z","finish"),G(448,137,5,4),C(182,143,4,"hardware")].join("");},
"MAC-10": function(){return [P("M128 125l-49 12 0 38h18l21-18h91v-21Z","frame"),R(198,103,229,63,6,"metal"),R(424,119,87,18,4,"metalDark"),R(504,116,26,24,7,"hardware"),R(209,91,191,11,3,"metalDark"),P("M283 166h65l-12 79h-46l-8-78Z","polymer"),P("M342 164h47q-5 41-38 35h-19Z","frame"),P("M355 171l-10 21","scribe"),P("M221 108h160v45H218Z","finish"),R(223,119,23,8,3,"hardware"),R(382,100,30,7,1,"rail"),C(394,146,4,"hardware"),G(277,128,9,4)].join("");},
"FAMAS": function(){return [P("M48 128l23-19 86 0 37 11 41-17h147l30 11 23 10 73-2 16 17-23 23-215 3-58-4-41 53-52-13-13-43H76Z","polymer"),P("M182 110h239l31 30-20 25H176Z","metal"),P("M239 75h131l38 30h-21l-28-14h-97l-19 14h-20Z","frame"),R(286,84,60,8,2,"metalDark"),R(416,129,125,12,3,"metalDark"),R(529,123,62,8,2,"hardware"),R(568,110,10,16,2,"metalDark"),P("M164 151h51l-6 70h-38l-19-64Z","grip"),P("M259 167h57l-18 32h-28Z","frame"),P("M283 175l-3 19","scribe"),P("M323 167h40l-11 58-25-4Z","metalDark"),P("M232 115h152l29 30-20 12H215Z","finish"),G(432,143,7,4),C(169,133,4,"hardware"),L(99,132,186,132,"scribe",2)].join("");},
"M4A4": function(){return [P("M39 124h82v-13h69v52h-68v-13H41l-14-13Z","polymer"),R(115,121,85,24,3,"metalDark"),P("M185 105h165l26 16-20 48H179l-19-30Z","metal"),P("M353 115h156l9 31-22 16H352Z","metal"),R(504,124,104,11,3,"metalDark"),R(598,120,11,19,3,"hardware"),P("M280 165h43l2 74h-37l-15-72Z","metalDark"),P("M240 165l-24 68h-28l-4-55 12-13Z","grip"),P("M330 164h48q-5 34-38 32h-15Z","frame"),P("M348 170l-8 21","scribe"),P("M199 114h132l14 29-29 18H190Z","finish"),P("M369 119h133v33H369Z","finish"),A(369,106,17,5,"rail"),R(207,91,140,12,2,"rail"),R(236,81,82,9,2,"metalDark"),R(479,89,8,22,1,"hardware"),C(222,149,4,"hardware"),G(384,130,12,4),L(139,138,200,138,"scribe",2)].join("");},
"M4A1-S": function(){return [P("M32 129h82v-13h75v50h-76v-13H34l-10-13Z","polymer"),R(119,126,84,20,3,"metalDark"),P("M187 107h166l25 17-20 46H181l-19-34Z","metal"),P("M353 116h156l9 28-20 19H352Z","metal"),R(501,127,20,12,1,"hardware"),R(516,124,110,19,9,"metalDark"),R(618,127,10,13,5,"hardware"),P("M280 166h42v74h-38l-13-72Z","metalDark"),P("M235 166l-20 66-27 1-8-55 12-14Z","grip"),P("M335 164h44l-11 34h-38Z","frame"),P("M347 170l-7 21","scribe"),P("M200 115h130l15 28-22 19H194Z","finish"),P("M370 123h129v30H370Z","finish"),A(370,109,16,5,"rail"),R(210,95,131,11,2,"rail"),R(238,82,40,13,2,"metalDark"),C(220,148,4,"hardware"),G(388,131,10,4),L(148,140,197,140,"scribe",2)].join("");},
"AK-47": function(){return [P("M46 150l89-42 78-5 17 17-12 45-89 7-53 28-28-16Z","wood"),P("M207 117h159l20 16-10 36H208l-15-26Z","metal"),P("M372 119h127l27 10v28l-28 3H368Z","wood"),R(505,130,109,12,3,"metalDark"),R(610,124,14,22,3,"hardware"),P("M289 165h39q12 31 1 65-20 19-42 18l-16-9q29-23 11-74Z","metalDark"),P("M246 167l-22 72-32-3-5-43 15-29Z","wood"),P("M335 165h55q-4 30-43 29h-19Z","frame"),P("M355 172l-5 19","scribe"),P("M226 121h121l16 33-20 6H213Z","finish"),P("M389 128h99v24h-99Z","finish"),R(229,106,65,10,2,"metalDark"),R(458,110,13,12,2,"hardware"),A(392,113,11,5,"rail"),C(232,148,5,"hardware"),C(253,148,4,"hardware"),L(90,159,162,125,"scribe",2),G(414,133,8,4)].join("");},
"AWP": function(){return [P("M58 139l48-25 127-6 38 14-1 48-77 12-40 29H70l-15-15Z","polymer"),P("M235 127h142l9 25-35 23H234l-11-26Z","metal"),P("M355 137h218v9H352Z","metalDark"),R(561,135,58,15,2,"hardware"),R(307,91,139,18,7,"metalDark"),R(323,82,109,10,3,"metal"),R(324,106,9,27,2,"hardware"),R(425,106,9,29,2,"hardware"),C(434,101,15,"scope"),C(434,101,8,"optic"),C(310,100,9,"scope"),P("M257 173h43l-23 61h-31l-9-38Z","grip"),P("M321 172h35l-10 40-28-3Z","metalDark"),P("M295 173h39q-4 24-23 24h-23Z","frame"),P("M305 179l-5 13","scribe"),P("M249 134h108l-8 31H243Z","finish"),R(459,128,28,10,2,"rail"),L(121,159,217,159,"scribe",2),C(239,152,4,"hardware"),C(306,155,4,"hardware")].join("");},
"Nova": function(){return [P("M65 154l103-44 72-2 18 19-16 39-93 11-56 37-36-18Z","wood"),P("M223 114h122l18 20-10 32H219l-12-19Z","metal"),R(341,128,243,10,3,"metalDark"),R(338,145,227,7,3,"hardware"),R(556,123,37,15,3,"metalDark"),R(573,120,10,20,1,"hardware"),P("M369 135h107l8 20-13 9H366Z","wood"),P("M258 163h59q-1 38-38 37h-19Z","frame"),P("M282 171l-9 21","scribe"),P("M229 123h110v33H220Z","finish"),A(369,125,13,6,"rail"),L(94,175,204,126,"scribe",2),G(382,147,10,4),C(232,154,4,"hardware"),C(313,155,4,"hardware")].join("");},
"Karambit": function(){return [C(125,166,39,"ring"),C(125,166,22,"background"),P("M157 143l111-19 63-35 47-13 67 21-38 2-35 22-26 34-40 16-136 16-32-18Z","metal"),P("M332 97q83-84 147-58-13 51-75 76 34-48 39-61-36 4-83 55Z","metalLight"),P("M169 139l146-19 24 37-121 45-64-15Z","polymer"),P("M181 151l116-21 14 26-104 36Z","finish"),C(174,167,5,"hardware"),C(293,148,5,"hardware"),L(210,174,278,153,"scribe",2),G(215,155,9,4)].join("");},
"Butterfly Knife": function(){return [P("M124 140l150-12 103-44 110-33-31 27-57 44-98 34-173 13Z","metal"),P("M123 153l147-15 9 18-139 32-17-7Z","grip"),P("M116 166l162-8 2 20-153 28-15-9Z","polymer"),P("M159 150l84-10-5 11-78 13Z","finish"),R(157,181,83,5,1,"hardware"),C(147,165,7,"hardware"),C(275,157,6,"hardware"),C(120,173,4,"hardware"),L(147,175,249,163,"scribe",2),G(165,166,8,4)].join("");},
"Bayonet": function(){return [P("M87 142h177l38-9 162-54 92-19-53 34-182 85H265l-49-6-129-6Z","metal"),P("M300 133l170-54 59-10-46 26-159 63Z","metalLight"),P("M82 129h175l20 13-15 35H81l-13-26Z","polymer"),P("M100 137h140l19 12-18 15H90Z","finish"),R(264,110,13,76,3,"metalDark"),R(240,119,68,9,3,"hardware"),C(108,151,4,"hardware"),C(231,152,4,"hardware"),G(132,148,11,4),L(84,177,253,177,"scribe",2)].join("");}
});

const palettes={"Slate Grid":["#9ba9bb","#596b7d","#a5aebb"],"Dustline":["#c0a88a","#746657","#8a857b"],"Metro Fade":["#4c8ba2","#35637a","#728e9d"],"Tarmac":["#c9ced6","#666d78","#c1b7ac"],"Ash Veil":["#96899c","#5b516a","#8998a4"],"Signal Green":["#73d49f","#2d785b","#8bd09f"],"Polar Relay":["#c1eaf4","#4c85bb","#9bb6d4"],"Circuit Blue":["#3e8bd9","#1c466a","#70bbf1"],"Copper Web":["#d39867","#795f51","#e4b878"],"Voltage Bloom":["#f5c047","#855ddd","#e7d3a2"],"Ghostline":["#79b6e9","#536d8d","#a9d9f6"],"Night Watch":["#7d91cc","#293b65","#d0d8ec"],"Solar Ash":["#f4bc74","#805962","#ffd39c"],"Crimson Circuit":["#fc6d6b","#7d1d3e","#f7adb1"],"Eclipse":["#aa91ef","#3c2a68","#d5c4ff"],"Prism Burn":["#e490f2","#8053ae","#ecdeff"],"Starfall":["#efd082","#9b6736","#ffebaf"],"Spectrum":["#7fd6e8","#a265d6","#f5afdd"],"Black Ember":["#ef9b5c","#694159","#f8d3b3"]};
let artSerial=0;
const specialFinishes=Object.freeze({
"Slate Grid":"grid","Dustline":"sand","Metro Fade":"fade","Tarmac":"lines",
"Ash Veil":"fog","Signal Green":"pulse","Polar Relay":"lines",
"Circuit Blue":"pulse","Copper Web":"grid","Voltage Bloom":"pulse",
"Ghostline":"lines","Night Watch":"lines","Solar Ash":"sand",
"Crimson Circuit":"pulse","Eclipse":"eclipse","Prism Burn":"fade",
"Starfall":"flares","Spectrum":"fade","Black Ember":"flares"
});
function render(item){
 const model=typeof item.weapon==='string'?item.weapon:'';
 if(!Object.prototype.hasOwnProperty.call(models,model))return null;
 const finish=typeof item.skin==='string'?item.skin:'';
 const palette=palettes[finish]||['#8ca5b7','#556e89','#c9d5de'];
 const tier=Math.max(0,Math.min(4,Number(item.tier)||0));
 const id='lhm'+(++artSerial).toString(36);
 const paint=id+'p',body=id+'m',wood=id+'w',polymer=id+'q',fog=id+'f',bolt=id+'h';
 let graphic='';
 const mode=specialFinishes[finish]||'lines';
 if(mode==='grid')graphic='<path d="M0 0H22M0 12H22M0 24H22M0 0V24M11 0V24M22 0V24" stroke="'+palette[2]+'" stroke-opacity=".34" stroke-width="1"/>';
 else if(mode==='pulse')graphic='<path d="M-3 7H7l4-5h3l4 9h9M-2 20H6l5-8h7l5 10h12" fill="none" stroke="'+palette[2]+'" stroke-opacity=".62" stroke-width="2"/>';
 else if(mode==='sand')graphic='<path d="M-2 2L14 18M7-4L27 16M-8 14L8 30" stroke="'+palette[2]+'" stroke-opacity=".22" stroke-width="5"/>';
 else if(mode==='eclipse')graphic='<circle cx="9" cy="10" r="7" fill="'+palette[1]+'"/><path d="M6 3a7 7 0 0 0 0 14a7 7 0 0 1 0-14" fill="'+palette[2]+'"/>';
 else if(mode==='flares')graphic='<path d="M-3 20L15-3M6 29L25 2" stroke="'+palette[2]+'" stroke-opacity=".53" stroke-width="4"/>';
 else if(mode==='fog')graphic='<circle cx="3" cy="5" r="7" fill="'+palette[2]+'" opacity=".16"/><circle cx="22" cy="17" r="8" fill="'+palette[1]+'" opacity=".2"/>';
 else if(mode==='fade')graphic='<path d="M-10 28L15-6M0 32L27-3" stroke="'+palette[2]+'" stroke-opacity=".45" stroke-width="4"/>';
 else graphic='<path d="M-4 29L29-4M-14 20L19-13" stroke="'+palette[2]+'" stroke-opacity=".28" stroke-width="5"/>';
 const colors=['#adb8c3','#4fca85','#7aaef9','#c694fc','#f0c36f'];
 const rarityColor=colors[tier];
 const label=model+' | '+finish;
 const SVG='<svg id="'+id+'" class="arsenal-master" role="img" aria-label="Stylized '+escape(label)+' collectible" viewBox="0 0 640 270" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">'+
 '<defs>'+
 '<linearGradient id="'+body+'" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#92a4b7"/><stop offset=".29" stop-color="#455569"/><stop offset=".68" stop-color="#202f40"/><stop offset="1" stop-color="#75899b"/></linearGradient>'+
 '<linearGradient id="'+polymer+'" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#35465c"/><stop offset=".5" stop-color="#19293a"/><stop offset="1" stop-color="#111e2d"/></linearGradient>'+
 '<linearGradient id="'+wood+'" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b49b7f"/><stop offset=".48" stop-color="#655343"/><stop offset="1" stop-color="#c4ab82"/></linearGradient>'+
 '<linearGradient id="'+bolt+'" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e6ecf3"/><stop offset="1" stop-color="#7e95aa"/></linearGradient>'+
 '<linearGradient id="'+fog+'" x1="0" y1="0" x2="1" y2="0"><stop stop-color="'+palette[1]+'"/><stop offset=".55" stop-color="'+palette[0]+'"/><stop offset="1" stop-color="'+palette[2]+'"/></linearGradient>'+
 '<pattern id="'+paint+'" patternUnits="userSpaceOnUse" width="28" height="28">'+graphic+'</pattern>'+
 '<filter id="'+id+'shadow" x="-15%" y="-25%" width="130%" height="155%"><feDropShadow dx="0" dy="9" stdDeviation="8" flood-color="#01060d" flood-opacity=".57"/></filter>'+
 '</defs>'+
 '<style>'+
 '#'+id+' .metal{fill:url(#'+body+');stroke:#111b28;stroke-width:3;stroke-linejoin:round}'+
 '#'+id+' .metalLight{fill:url(#'+bolt+');stroke:#263445;stroke-width:2.3;stroke-linejoin:round}'+
 '#'+id+' .metalDark{fill:#1b2837;stroke:#556a7c;stroke-width:2}'+
 '#'+id+' .polymer{fill:url(#'+polymer+');stroke:#526479;stroke-width:2.8;stroke-linejoin:round}'+
 '#'+id+' .wood{fill:url(#'+wood+');stroke:#3e3c38;stroke-width:3;stroke-linejoin:round}'+
 '#'+id+' .grip{fill:#1c293a;stroke:#637187;stroke-width:2;stroke-linejoin:round}'+
 '#'+id+' .frame{fill:#142233;stroke:#72849a;stroke-width:2.5;stroke-linejoin:round}'+
 '#'+id+' .finish{fill:url(#'+fog+');stroke:'+palette[1]+';stroke-width:1.7;stroke-opacity=".75";stroke-linejoin:round}'+
 '#'+id+' .hardware{fill:#9eb3c6;stroke:#2a3949;stroke-width:2}'+
 '#'+id+' .rail{fill:#26384b;stroke:#9bb1c6;stroke-width:1}'+
 '#'+id+' .scribe{fill:none;stroke:#91a1b2;stroke-linecap:round;stroke-linejoin:round;opacity:.75}'+
 '#'+id+' .scope{fill:#172637;stroke:#7a93a9;stroke-width:2.3}'+
 '#'+id+' .optic{fill:#235e77;stroke:#92b2d0;stroke-width:1.5}'+
 '#'+id+' .ring{fill:#3b495b;stroke:#bdc9d7;stroke-width:6}'+
 '#'+id+' .background{fill:#101b2a;stroke:#78899b;stroke-width:2}'+
 '</style>'+
 '<g transform="translate(0 0)" filter="url(#'+id+'shadow)">'+models[model]()+'</g>'+
 '</svg>';
 return '<div class="art weapon-art weapon-master" style="--weapon-rarity:'+rarityColor+';--weapon-finish:'+palette[0]+';" data-weapon-model="'+escape(model)+'" data-finish="'+escape(finish)+'">'+SVG+'</div>';
}
function escape(str){return String(str).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
global.ArsenalMasters={supports:name=>Object.prototype.hasOwnProperty.call(models,name),
  render,modelNames:Object.freeze(Object.keys(models).sort()),paletteFor:finish=>(palettes[finish]||[]).slice()};
})(window);
