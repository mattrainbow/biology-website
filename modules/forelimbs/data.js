/* Forelimb data: edit an animal here. Loaded before interactive.js. */
window.FORELIMBS = (function () {
'use strict';
// bone type: [name, color]
const TYPE={hum:['Humerus','#ee2b2b'],rad:['Radius','#3d8bff'],uln:['Ulna','#22b35a'],carp:['Carpals','#f5d02a'],mc:['Metacarpals','#a66ef0'],ph:['Phalanges','#ff8a1f']};
// colors used when coloring by finger
const DIG=[['Arm and wrist','#b9ad95'],['I, thumb','#e4572e'],['II','#f3a712'],['III','#1fae96'],['IV','#3a86ff'],['V','#9b8be0']];
// what each limb is for; the colors are --fl-<key> in interactive.css
const GROUPS={gen:'General Purpose Hands and Arms',fly:'Flying',swim:'Swimming',wt:'Bearing Heavy Weight'};
// Simple original silhouettes, all facing right, drawn in a 200 x 140 box with the ground at y = 132.
const SIL={
 human:`<circle cx="100" cy="17" r="11"/><rect x="95" y="24" width="10" height="12" rx="3"/><path d="M83 33 Q100 27 117 33 L114 80 L86 80 Z"/>
  <rect x="73" y="34" width="9" height="46" rx="4.5" transform="rotate(14 77 36)"/><rect x="118" y="34" width="9" height="46" rx="4.5" transform="rotate(-14 123 36)"/>
  <rect x="87" y="74" width="12" height="58" rx="5"/><rect x="101" y="74" width="12" height="58" rx="5"/>`,
 gorilla:`<ellipse cx="88" cy="74" rx="46" ry="28" transform="rotate(-22 88 74)"/><circle cx="126" cy="52" r="25"/><circle cx="155" cy="64" r="14"/>
  <ellipse cx="150" cy="52" rx="10" ry="7"/><ellipse cx="166" cy="70" rx="8" ry="7"/><rect x="134" y="58" width="20" height="72" rx="9"/><rect x="114" y="64" width="18" height="66" rx="8"/>
  <ellipse cx="146" cy="129" rx="13" ry="5"/><rect x="48" y="88" width="20" height="44" rx="9"/><rect x="66" y="92" width="18" height="40" rx="8"/>`,
 mouse:`<ellipse cx="94" cy="104" rx="42" ry="22"/><path d="M124 88 Q152 84 176 104 Q152 116 126 114 Z"/><circle cx="131" cy="82" r="12"/>
  <rect x="68" y="114" width="8" height="18" rx="3"/><rect x="118" y="112" width="8" height="20" rx="3"/>
  <path d="M54 108 Q22 112 12 132" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`,
 kangaroo:`<ellipse cx="100" cy="80" rx="23" ry="36" transform="rotate(-25 100 80)"/><ellipse cx="128" cy="32" rx="17" ry="10" transform="rotate(-12 128 32)"/>
  <ellipse cx="117" cy="18" rx="4" ry="11" transform="rotate(-15 117 18)"/><ellipse cx="117" cy="44" rx="9" ry="15" transform="rotate(25 117 44)"/><rect x="118" y="58" width="6" height="24" rx="3" transform="rotate(-35 121 60)"/>
  <ellipse cx="92" cy="106" rx="21" ry="16"/><rect x="86" y="124" width="48" height="8" rx="4"/>
  <path d="M80 100 Q50 118 18 132 L28 134 Q60 124 90 112 Z"/>`,
 bat:`<ellipse cx="100" cy="72" rx="9" ry="22"/><circle cx="100" cy="46" r="9"/><polygon points="92,42 94,28 99,40"/><polygon points="101,40 106,28 108,42"/>
  <path d="M93 60 L42 40 L16 64 Q30 66 36 80 Q47 75 55 86 Q64 79 72 90 Q81 81 95 86 Z"/>
  <path d="M107 60 L158 40 L184 64 Q170 66 164 80 Q153 75 145 86 Q136 79 128 90 Q119 81 105 86 Z"/>`,
 seal:`<path d="M30 104 Q60 80 120 84 Q155 86 168 96 Q174 106 166 112 Q140 122 90 120 Q50 118 30 104 Z"/><circle cx="160" cy="96" r="15"/>
  <ellipse cx="124" cy="119" rx="15" ry="5" transform="rotate(25 124 119)"/><polygon points="34,104 8,90 16,104 8,118"/>`,
 whale:`<path d="M22 80 Q60 58 120 62 Q166 66 186 82 Q170 96 120 98 Q60 98 22 80 Z"/><polygon points="24,80 4,64 11,80 4,96"/>
  <path d="M122 90 Q112 112 96 126 Q120 116 134 94 Z"/><polygon points="70,65 80,54 86,64"/>`,
 elephant:`<ellipse cx="92" cy="66" rx="48" ry="30"/><rect x="52" y="78" width="18" height="54" rx="6"/><rect x="74" y="82" width="17" height="50" rx="6"/>
  <rect x="104" y="78" width="18" height="54" rx="6"/><rect x="122" y="82" width="17" height="50" rx="6"/><circle cx="146" cy="52" r="22"/>
  <ellipse cx="133" cy="57" rx="16" ry="23"/><path d="M160 60 Q174 92 168 122 L159 122 Q162 92 149 70 Z"/>
  <path d="M157 72 Q170 82 178 76" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
  <path d="M45 60 Q38 78 40 92" fill="none" stroke="currentColor" stroke-width="2.5"/>`,
 horse:`<ellipse cx="92" cy="62" rx="42" ry="18"/><polygon points="116,56 130,24 146,22 138,64"/><ellipse cx="152" cy="36" rx="21" ry="9" transform="rotate(32 152 36)"/>
  <polygon points="133,22 136,10 141,21"/><rect x="58" y="70" width="7" height="62" rx="3"/><rect x="71" y="70" width="7" height="62" rx="3"/>
  <rect x="110" y="70" width="7" height="62" rx="3"/><rect x="123" y="70" width="7" height="62" rx="3"/><path d="M52 56 Q32 72 38 104 Q44 82 58 64 Z"/>`,
};
// Each animal: arm bones [length, angle°], hand digits as lists of [length, angle° relative to forearm].
// Same bones in the same order for every animal; a bone an animal lacks has length 0.
const ANIMALS=[
 {id:'human',grp:'gen',name:'Human arm',short:'Human',use:'Grasping and handling things',diff:'Long, mobile thumb; the two forearm bones cross so the palm can turn over',
  cap:'A human arm: one upper-arm bone, two forearm bones, eight wrist bones and five fingers, with a long thumb for gripping.',
  hum:[3,0],fa:[2.5,0],radOff:.12,ulnOff:.12,ulnFrac:1,carp:.42,cs:1,w:{hum:.17,rad:.1,uln:.1,mc:.075,ph:.06},dw:[1,1,1,1,1],
  off:[.32,.17,.04,-.1,-.24],
  d:[[[.7,38],[.5,30],[.38,24]],[[1.05,9],[.6,7],[.38,6],[.28,5]],[[1,1],[.66,0],[.42,0],[.3,0]],[[.93,-9],[.6,-10],[.4,-11],[.29,-11]],[[.85,-19],[.45,-21],[.3,-22],[.24,-22]]],
  sk:{arm:[.42,.34,.24],fa:[0,.35,.35,.35,.35],ft:[1,1,1,1,1],fb:[.3,.35,.35,.35,0],fw:.15}},
 {id:'gorilla',grp:'gen',name:'Gorilla arm',short:'Gorilla',use:'Climbing and knuckle-walking',diff:'Sturdier bones, longer fingers and a shorter thumb than ours',
  cap:'A gorilla arm: the same bones, built heavier, with long fingers and a shorter thumb. Gorillas walk on their knuckles as well as climbing.',
  hum:[3,-30],fa:[2.6,-38],radOff:.14,ulnOff:.14,ulnFrac:1.02,carp:.5,cs:1.15,w:{hum:.24,rad:.14,uln:.14,mc:.1,ph:.085},dw:[1,1,1,1,1],
  off:[.36,.19,.04,-.13,-.3],
  d:[[[.6,42],[.38,36],[.28,30]],[[1.15,10],[.75,8],[.48,7],[.3,6]],[[1.2,1],[.82,0],[.52,0],[.32,0]],[[1.12,-10],[.75,-11],[.48,-12],[.3,-12]],[[1,-21],[.55,-23],[.36,-24],[.26,-24]]],
  sk:{arm:[.55,.45,.32],fa:[0,.33,.33,.33,.33],ft:[1,1,1,1,1],fb:[.28,.33,.33,.33,0],fw:.17}},
 {id:'mouse',grp:'gen',name:'Mouse forelimb',short:'Mouse',use:'Running, climbing and holding food',diff:'A small, all-purpose limb with four working fingers and a tiny thumb',
  cap:'A mouse forelimb: a small, all-purpose limb. Four fingers do the work, and the thumb is reduced to a tiny stub.',
  hum:[2.6,-120],fa:[2.7,-80],radOff:.1,ulnOff:.1,ulnFrac:1.08,carp:.35,cs:.8,w:{hum:.15,rad:.08,uln:.09,mc:.06,ph:.05},dw:[1,1,1,1,1],
  off:[.26,.13,.02,-.09,-.2],
  d:[[[.25,30],[.15,25]],[[.6,10],[.4,8],[.28,6],[.2,6]],[[.65,0],[.45,0],[.3,0],[.22,0]],[[.62,-9],[.42,-10],[.28,-11],[.2,-11]],[[.5,-19],[.32,-20],[.22,-21],[.16,-21]]],
  sk:{arm:[.56,.42,.3],fa:[0,.3,.3,.3,.3],ft:[1,1,1,1,1],fb:[0,.3,.3,.3,0],fw:.1,dw:[.45,1,1,1,1]}},
 {id:'kangaroo',grp:'gen',name:'Kangaroo forelimb',short:'Kangaroo',use:'Feeding, grooming and slow walking',diff:'A short forelimb with five clawed fingers',
  cap:'A kangaroo forelimb: short, with five clawed fingers. Kangaroos use their arms for feeding and grooming, and lean on them with the tail when moving slowly.',
  hum:[2.4,-75],fa:[2.6,-30],radOff:.1,ulnOff:.1,ulnFrac:1.05,carp:.35,cs:.85,w:{hum:.15,rad:.085,uln:.09,mc:.065,ph:.055},dw:[1,1,1,1,1],
  off:[.28,.14,.02,-.1,-.22],
  d:[[[.55,32],[.35,28],[.28,24]],[[.7,9],[.42,8],[.3,7],[.26,6]],[[.75,0],[.45,0],[.32,0],[.27,0]],[[.7,-9],[.42,-10],[.3,-11],[.25,-11]],[[.6,-18],[.36,-20],[.26,-21],[.22,-21]]],
  sk:{arm:[.52,.4,.3],fa:[0,.3,.3,.3,.3],ft:[1,1,1,1,1],fb:[.25,.3,.3,.3,0],fw:.12}},
 {id:'bat',grp:'fly',name:'Bat wing',short:'Bat',use:'Flying',diff:'Fingers II to V hugely lengthened to hold a skin wing; the ulna is reduced and fused to the radius',
  cap:'A bat wing: the same bones in the same order. Fingers III to V hold the membrane open, and the short thumb stays free as a climbing claw.',
  hum:[1.6,-20],fa:[2.8,12],radOff:0,ulnOff:.05,ulnFrac:.42,carp:.18,cs:.55,w:{hum:.12,rad:.075,uln:.03,mc:.045,ph:.034},dw:[1,1,1,1,1],
  off:[.13,.07,0,-.06,-.12],
  d:[[[.24,62],[.22,55],[.16,35]],[[2.25,3],[.32,1]],[[2.5,-8],[1.25,-14],[1,-18],[.4,-20]],[[2.35,-38],[.95,-47],[.75,-54]],[[2.15,-62],[.8,-74],[.6,-82]]],
  sk:{fr:[['S',.15,-.1],['M',.42,0],['W',.2,0]],bk:[['A',1.1,-4],['A',-.25,-2.6],['A',-.25,-.35]],
      fa:[0,0,.95,.95,.95],ft:[0,1,1,1,1],fb:[0,.9,.95,.95,.93],fw:.018,dw:[0,1,1,1,1],sc:.16}},
 {id:'seal',grp:'swim',name:'Seal flipper',short:'Seal',use:'Swimming',diff:'Short, stout arm bones; all five fingers wrapped in one flipper, each still tipped with a claw',
  cap:'A seal’s front flipper: short, stout arm bones, and all five fingers bound together in a single paddle of skin. True seals still have a claw on each finger.',
  hum:[1.7,-55],fa:[1.8,-25],radOff:.13,ulnOff:.13,ulnFrac:1.08,carp:.35,cs:.9,w:{hum:.28,rad:.14,uln:.15,mc:.09,ph:.075},dw:[1,1,1,1,1],
  off:[.34,.18,.03,-.12,-.27],
  d:[[[1.15,14],[.8,12],[.55,10]],[[1.15,7],[.7,6],[.5,5],[.32,5]],[[1.1,1],[.66,0],[.46,0],[.3,0]],[[1.05,-5],[.62,-6],[.43,-6],[.28,-6]],[[1,-11],[.58,-12],[.4,-12],[.26,-12]]],
  sk:{arm:[.75,.6,.4],fa:[0,.97,.97,.97,.97],ft:[1,1,1,1,1],fb:[.97,.97,.97,.97,0],fw:.2,sc:.05}},
 {id:'whale',grp:'swim',name:'Whale flipper',short:'Whale',use:'Steering through water',diff:'Arm bones short and flattened, elbow nearly fixed; extra finger bones lengthen the flipper',
  cap:'A whale flipper: the arm bones are short and flat, and the elbow and wrist barely move. Fingers II and III grow extra bones, a feature called hyperphalangy.',
  hum:[1.1,-60],fa:[1.5,-45],radOff:.16,ulnOff:.16,ulnFrac:1,carp:.35,cs:.9,w:{hum:.3,rad:.17,uln:.17,mc:.1,ph:.09},dw:[1,1,1,1,1],
  off:[.36,.18,.02,-.14,-.3],
  d:[[[.35,20],[.2,18]],[[.75,9],[.55,8],[.5,8],[.45,8],[.4,9],[.35,10],[.3,11],[.25,12]],[[.7,2],[.5,2],[.45,3],[.4,3],[.35,4],[.3,5],[.25,6]],[[.6,-6],[.45,-6],[.38,-5],[.3,-5]],[[.5,-14],[.35,-13],[.25,-12]]],
  sk:{arm:[.5,.6,.5],fa:[0,.98,.98,.98,.98],ft:[1,1,1,1,1],fb:[.98,.98,.98,.98,0],fw:.22,dw:[.6,1,1,1,1]}},
 {id:'elephant',grp:'wt',name:'Elephant foreleg',short:'Elephant',use:'Carrying enormous weight',diff:'Bones stacked into an upright pillar; the ulna is the larger forearm bone; short fingers rest on a thick pad',
  cap:'An elephant foreleg: the bones stack into an upright pillar, and the ulna carries more of the load than the radius. The short fingers stand on tiptoe on a thick pad of fat and tough tissue.',
  hum:[3.2,-100],fa:[2.9,-90],radOff:.14,ulnOff:.16,ulnFrac:1.08,carp:.55,cs:1.25,w:{hum:.32,rad:.16,uln:.24,mc:.13,ph:.11},dw:[1,1,1,1,1],
  off:[.42,.22,.02,-.18,-.38],
  d:[[[.4,30],[.18,26]],[[.75,12],[.32,10],[.18,9]],[[.8,0],[.35,0],[.2,0]],[[.75,-12],[.32,-12],[.18,-12]],[[.5,-28],[.2,-28],[.12,-28]]],
  sk:{arm:[.85,.72,.62],fa:[0,.99,.99,.99,.99],ft:[1,1,1,1,1],fb:[.99,.99,.99,.99,0],fw:.2}},
 {id:'horse',grp:'wt',name:'Horse foreleg',short:'Horse',use:'Running fast on firm ground',diff:'All weight on finger III, which forms the cannon bone and hoof; II and IV survive as splint bones; I and V are gone',
  cap:'A horse foreleg: the animal stands on a single finger. Digit III forms the long cannon bone and ends in the hoof. Digits II and IV survive only as thin splint bones, and I and V are gone.',
  via:'Fossil horses took this path. Early horses such as Eohippus had four toes on each front foot, later ones such as Mesohippus had three, and modern horses have one. Here fingers I and V go first, then II and IV shrink to splints while III lengthens.',
  st:[-.2,0,.15,0,-.2],
  hum:[2,-125],fa:[3,-90],radOff:.05,ulnOff:.12,ulnFrac:.38,carp:.45,cs:1.1,w:{hum:.3,rad:.2,uln:.09,mc:.18,ph:.17},dw:[0,.32,1,.32,0],
  off:[.2,.13,0,-.13,-.2],
  d:[[],[[1.5,-2]],[[2.3,0],[.85,28],[.45,36],[.4,46]],[[1.5,2]],[]],
  sk:{arm:[.85,.6,.5],fa:[0,0,0,0,0],ft:[0,0,1,0,0],fb:[0,0,0,0,0],fw:.4,dw:[0,0,1,0,0],tw:.001}},
];
const SLOTS=8;
ANIMALS.forEach(a=>{a.d=a.d.map(s=>{s=s.slice();const last=s.length?s[s.length-1][1]:0;while(s.length<SLOTS)s.push([0,last]);return s});
  a.sk.dw=a.sk.dw||[1,1,1,1,1];a.sk.sc=a.sk.sc||0;a.sk.tw=a.sk.tw||.18;
  if(!a.sk.fr){const [s0,s1,s2]=a.sk.arm;a.sk.fr=[['S',s0,-.15],['E',s1,0],['W',s2,0]];a.sk.bk=[['W',-s2,0],['E',-s1,0],['S',-s0,-.15]]}});
return {TYPE,DIG,GROUPS,SIL,ANIMALS};
})();
