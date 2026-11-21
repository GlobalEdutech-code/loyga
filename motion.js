'use strict';
// JSON-only, bounded interpreter. The execution checkpoint can travel between devices.
globalThis.LoyMotion=(()=>{
 const allowed=new Set(['move','move_up','move_down','move_left','move_right','left','right','wait','speed']);
 function create(commands,floatAfter=true){
  const instructions=[];
  function emit(list,depth=0){if(depth>30)throw Error('โปรแกรมซ้อนมากเกินไป');for(const c of list){
   if(instructions.length>4000)throw Error('โปรแกรมยาวเกินไป');
   if(c.type==='repeat'){const start=instructions.length;instructions.push({type:'loop',count:c.count===Infinity?null:c.count,end:0});emit(c.body,depth+1);instructions.push({type:'end',start});instructions[start].end=instructions.length-1;}
   else instructions.push({type:c.type,value:c.value});
  }}
  emit(commands);return {version:1,instructions,pc:0,loops:[],action:null,done:false,floatAfter};
 }
 function validate(value){
  if(value==null)return null;
  if(JSON.stringify(value).length>250000)throw Error('โปรแกรมออนไลน์ใหญ่เกินไป');
  const s=JSON.parse(JSON.stringify(value)),code=s.instructions;
  if(s.version!==1||!Array.isArray(code)||code.length>4000||!Number.isInteger(s.pc)||s.pc<0||s.pc>code.length||!Array.isArray(s.loops)||s.loops.length>30||typeof s.done!=='boolean'||typeof s.floatAfter!=='boolean')throw Error('สถานะโปรแกรมไม่ถูกต้อง');
  const nested=[];
  const validAction=c=>c&&allowed.has(c.type)&&Number.isFinite(c.value)&&c.value>=0&&c.value<=(c.type==='speed'?2000:c.type==='wait'?3600:10000)&&(c.type!=='speed'||c.value>=1);
  code.forEach((c,i)=>{
   if(c.type==='loop'){if(!(c.count===null||Number.isInteger(c.count)&&c.count>=0&&c.count<=10000)||!Number.isInteger(c.end)||c.end<=i||c.end>=code.length)throw Error('repeat ไม่ถูกต้อง');nested.push(i);if(nested.length>30)throw Error('repeat ซ้อนมากเกินไป');}
   else if(c.type==='end'){if(nested.pop()!==c.start||code[c.start]?.end!==i)throw Error('ขอบเขต repeat ไม่ถูกต้อง');}
   else if(!validAction(c))throw Error('คำสั่งไม่รองรับ');
  });
  if(nested.length)throw Error('repeat ไม่ครบ');
  for(const loop of s.loops)if(!Number.isInteger(loop.start)||code[loop.start]?.type!=='loop'||!(loop.left===null||Number.isInteger(loop.left)&&loop.left>=1&&loop.left<=10000))throw Error('สถานะ repeat ไม่ถูกต้อง');
  if(s.action&&(!validAction(s.action)||!Number.isFinite(s.action.left)||s.action.left<0||s.action.left>s.action.value))throw Error('สถานะคำสั่งไม่ถูกต้อง');
  return s;
 }
 function advance(k,s,dt,wrap,budget=200){
  let remaining=dt;
  for(let n=0;n<budget&&!s.done;n++){
   if(!s.action){
    if(s.pc>=s.instructions.length){s.done=true;k.released=s.floatAfter;break;}
    const c=s.instructions[s.pc];
    if(c.type==='loop'){
     if(c.count===0){s.pc=c.end+1;continue;}
     if(s.loops.length>=30)throw Error('repeat ซ้อนมากเกินไป');
     s.loops.push({start:s.pc,left:c.count});s.pc++;continue;
    }
    if(c.type==='end'){
     const loop=s.loops[s.loops.length-1];if(!loop||loop.start!==c.start)throw Error('สถานะ repeat ไม่ตรงกัน');
     if(loop.left===null||--loop.left>0)s.pc=c.start+1;else{s.loops.pop();s.pc++;}continue;
    }
    s.pc++;if(c.type==='speed'){k.speed=c.value;continue;}
    s.action={...c,left:c.value};
   }
   const a=s.action,speed=a.type==='wait'?1:a.type.startsWith('move')?(k.speed??95):150;
   const amount=Math.min(a.left,remaining*speed);
   if(a.type==='move'){k.x+=Math.cos(k.angle*Math.PI/180)*amount;k.y+=Math.sin(k.angle*Math.PI/180)*amount;}
   else if(a.type==='move_up')k.y-=amount;else if(a.type==='move_down')k.y+=amount;
   else if(a.type==='move_left')k.x-=amount;else if(a.type==='move_right')k.x+=amount;
   else if(a.type==='left')k.angle=(k.angle-amount)%360;else if(a.type==='right')k.angle=(k.angle+amount)%360;
   a.left-=amount;remaining-=amount/speed;wrap(k);
   if(a.left<1e-8)s.action=null;else break;
   if(remaining<=0)break;
  }
  return remaining;
 }
 return {create,validate,advance};
})();
