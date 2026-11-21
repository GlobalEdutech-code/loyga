'use strict';
globalThis.LoyMission=(()=>{
 const START={x:120,y:330,angle:0};
 function spawn(random=Math.random){const stars=[];for(let i=0;i<5;i++){
  let p;for(let attempt=0;attempt<100;attempt++){p={x:220+random()*560,y:310+random()*270};if(stars.every(s=>Math.hypot(p.x-s.x,p.y-s.y)>85))break;}
  stars.push(p);
 }return stars;}
 function collect(stars,from,to){
  const dx=to.x-from.x,dy=to.y-from.y,length=dx*dx+dy*dy;
  // A wrap is a teleport, not a sweep across every star in the river.
  if(length>160*160)return {stars,points:0};
  const remaining=stars.filter(s=>{const t=length?Math.max(0,Math.min(1,((s.x-from.x)*dx+(s.y-from.y)*dy)/length)):0;return Math.hypot(s.x-from.x-t*dx,s.y-from.y-t*dy)>32;});
  return {stars:remaining,points:stars.length-remaining.length};
 }
 return {START,spawn,collect};
})();
