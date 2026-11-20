'use strict';
(() => {
const $ = id => document.getElementById(id);
const KEY = 'loy-krathong-project-v1', W = 900, H = 800, SW = 110, SH = 75;
const drawing = $('drawing'), pen = drawing.getContext('2d'), river = $('river'), ctx = river.getContext('2d');
let project = {version:1,drawing:'',krathongs:[],selectedId:null};
let workspace, loading = false, erasing = false, candleMode = false, drag = null, stroke = null, undo = [], saveTimer, lastTime = 0;
const sprites = new Map(), runners = new Map(), poses = new Map();
const selected = () => project.krathongs.find(k => k.id === project.selectedId);
const message = text => { $('status').textContent = text; };
function rememberBlocks(){ if(workspace && selected() && !loading) selected().blocks = Blockly.serialization.workspaces.save(workspace); }
function scheduleSave(){ clearTimeout(saveTimer); $('saveState').textContent = 'กำลังบันทึก…'; saveTimer = setTimeout(save,650); }
function save(){ clearTimeout(saveTimer); try{ rememberBlocks(); project.drawing = drawing.toDataURL(); localStorage.setItem(KEY,JSON.stringify(project)); $('saveState').textContent = 'บันทึกแล้วในเครื่อง'; }catch(e){$('saveState').textContent = 'บันทึกไม่สำเร็จ'; message('พื้นที่จัดเก็บเต็มหรือถูกปิดกั้น กรุณา Export สำรองงาน');} }
function imageFrom(url){ const img = new Image(); img.src = url; return img; }
function validate(p){
 if(!p || p.version !== 1 || !Array.isArray(p.krathongs) || p.krathongs.length > 100) throw Error('รูปแบบโปรเจกต์ไม่ถูกต้อง (สูงสุด 100 กระทง)');
 const png = s => typeof s === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s) && s.length < 3000000;
 if(p.drawing && !png(p.drawing)) throw Error('ภาพวาดไม่ถูกต้อง');
 const ids = new Set();
 const list = p.krathongs.map(k => {
  if(!k || typeof k.id !== 'string' || ids.has(k.id) || !png(k.image) || ![k.x,k.y,k.angle].every(Number.isFinite) || !k.blocks || typeof k.blocks !== 'object') throw Error('ข้อมูลกระทงไม่ถูกต้อง');
  ids.add(k.id); return {id:k.id,name:String(k.name || 'กระทง').slice(0,60),image:k.image,x:k.x,y:k.y,angle:k.angle,speed:Number.isFinite(k.speed)?Math.max(1,Math.min(2000,k.speed)):95,blocks:k.blocks,released:false};
 });
 return {version:1,drawing:p.drawing || '',krathongs:list,selectedId:ids.has(p.selectedId)?p.selectedId:(list[0]?.id || null)};
}
function loadDrawing(url){return new Promise((resolve,reject)=>{if(!url){pen.clearRect(0,0,480,300);resolve();return;} const im = new Image();im.onload=()=>{pen.clearRect(0,0,480,300);pen.drawImage(im,0,0,480,300);resolve();};im.onerror=()=>reject(Error('อ่านภาพวาดไม่ได้'));im.src=url;});}
function refreshItems(){
 $('items').replaceChildren();
 for(const k of project.krathongs){const b=document.createElement('button');b.className=k.id===project.selectedId?'selected':'';b.setAttribute('aria-pressed',String(k.id===project.selectedId));const im=document.createElement('img');im.src=k.image;im.alt='';b.append(im,document.createTextNode(k.name));b.onclick=()=>select(k.id);$('items').append(b);}
 $('programName').textContent=selected()?.name || 'เลือกกระทงเพื่อเขียนโค้ด';
 for(const id of ['run','stop','reset','float','deleteKrathong']) $(id).disabled=!selected();
}
function select(id){rememberBlocks();project.selectedId=id;loading=true;try{workspace.clear();if(selected())Blockly.serialization.workspaces.load(selected().blocks,workspace);}catch(e){message('โค้ดที่บันทึกไว้ไม่รองรับ กรุณาต่อบล็อกใหม่');}finally{loading=false;}refreshItems();scheduleSave();}
function point(e){const r=drawing.getBoundingClientRect();return {x:(e.clientX-r.left)*480/r.width,y:(e.clientY-r.top)*300/r.height};}
function drawSegment(a,b){pen.save();pen.globalCompositeOperation=erasing?'destination-out':'source-over';pen.strokeStyle=$('color').value;pen.fillStyle=$('color').value;pen.lineWidth=Number($('brush').value);pen.lineCap='round';pen.lineJoin='round';pen.beginPath();pen.moveTo(a.x,a.y);pen.lineTo(b.x,b.y);pen.stroke();if(a.x===b.x&&a.y===b.y){pen.beginPath();pen.arc(a.x,a.y,pen.lineWidth/2,0,Math.PI*2);pen.fill();}pen.restore();}
function checkpoint(){undo.push(pen.getImageData(0,0,480,300));if(undo.length>25)undo.shift();}
drawing.onpointerdown=e=>{if(stroke)return;e.preventDefault();checkpoint();if(candleMode){stampCandle(point(e));scheduleSave();return;}drawing.setPointerCapture(e.pointerId);stroke={...point(e),id:e.pointerId};drawSegment(stroke,stroke);};
drawing.onpointermove=e=>{if(!stroke||stroke.id!==e.pointerId)return;const p=point(e);drawSegment(stroke,p);stroke={...p,id:e.pointerId};};
function endStroke(e){if(stroke?.id===e.pointerId){stroke=null;scheduleSave();}}
drawing.onpointerup=endStroke;drawing.onpointercancel=endStroke;drawing.onlostpointercapture=endStroke;
$('eraser').onclick=()=>{candleMode=false;$('candle').setAttribute('aria-pressed','false');erasing=!erasing;$('eraser').setAttribute('aria-pressed',String(erasing));};
$('draw').onclick=()=>{candleMode=false;$('candle').setAttribute('aria-pressed','false');erasing=false;$('eraser').setAttribute('aria-pressed','false');drawing.scrollIntoView({block:'center',behavior:'smooth'});};
$('undo').onclick=()=>{if(undo.length){pen.putImageData(undo.pop(),0,0);scheduleSave();}};
$('clear').onclick=()=>{checkpoint();pen.clearRect(0,0,480,300);scheduleSave();};
$('importPng').onclick=()=>$('pngFile').click();
$('pngFile').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 let url;
 try{
  if(file.size>10000000)throw Error('PNG ต้องมีขนาดไม่เกิน 10 MB');
  const signature=new Uint8Array(await file.slice(0,8).arrayBuffer());
  if(![137,80,78,71,13,10,26,10].every((n,i)=>signature[i]===n))throw Error('กรุณาเลือกไฟล์ PNG');
  url=URL.createObjectURL(file);
  const img=new Image();
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('อ่านภาพ PNG ไม่ได้'));img.src=url;});
  if(img.naturalWidth*img.naturalHeight>40000000)throw Error('ภาพมีความละเอียดสูงเกินไป (สูงสุด 40 ล้านพิกเซล)');
  checkpoint();pen.clearRect(0,0,480,300);
  const scale=Math.min(480/img.naturalWidth,300/img.naturalHeight);
  const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
  pen.drawImage(img,(480-w)/2,(300-h)/2,w,h);
  scheduleSave();message('นำเข้า PNG แล้ว วาดเพิ่มได้ หรือกด Add Krathong เพื่อนำลงแม่น้ำ (Undo เพื่อคืนภาพเดิม)');
 }catch(err){message('นำเข้า PNG ไม่สำเร็จ: '+err.message);}
 finally{if(url)URL.revokeObjectURL(url);e.target.value='';}
};
function stampCandle(p){
 // Stamp directly into the transparent drawing: undo, export and sprites retain the light.
 const x=Math.max(25,Math.min(455,p.x)),y=Math.max(70,Math.min(290,p.y));
 pen.save();pen.globalCompositeOperation='source-over';
 const glow=pen.createRadialGradient(x,y-52,1,x,y-52,30);
 glow.addColorStop(0,'rgba(255,222,115,.8)');glow.addColorStop(.35,'rgba(255,181,50,.3)');glow.addColorStop(1,'rgba(255,160,30,0)');
 pen.fillStyle=glow;pen.fillRect(x-30,y-82,60,60);
 const wax=pen.createLinearGradient(x-5,0,x+5,0);wax.addColorStop(0,'#c68d35');wax.addColorStop(.45,'#fff0b5');wax.addColorStop(1,'#e0b653');
 pen.fillStyle=wax;pen.fillRect(x-5,y-40,10,40);
 pen.strokeStyle='#624328';pen.lineWidth=1.5;pen.beginPath();pen.moveTo(x,y-40);pen.lineTo(x,y-46);pen.stroke();
 pen.shadowColor='#ffba45';pen.shadowBlur=12;pen.fillStyle='#ffc44b';pen.beginPath();pen.moveTo(x,y-65);pen.bezierCurveTo(x-12,y-49,x-5,y-43,x,y-43);pen.bezierCurveTo(x+9,y-44,x+5,y-55,x,y-65);pen.fill();
 pen.shadowBlur=0;pen.fillStyle='#fff6cb';pen.beginPath();pen.ellipse(x,y-48,2.5,5,0,0,Math.PI*2);pen.fill();pen.restore();
 message('วางเทียนแล้ว แตะเพื่อเพิ่มอีก หรือกด Draw เพื่อวาดต่อ');
}
$('candle').onclick=()=>{candleMode=!candleMode;erasing=false;$('eraser').setAttribute('aria-pressed','false');$('candle').setAttribute('aria-pressed',String(candleMode));message(candleMode?'แตะบนภาพตรงฐานเทียนที่ต้องการวาง':'กลับสู่โหมดวาด');};
function croppedSprite(){const data=pen.getImageData(0,0,480,300).data;let minX=480,minY=300,maxX=-1,maxY=-1;for(let y=0;y<300;y++)for(let x=0;x<480;x++)if(data[(y*480+x)*4+3]>0){minX=Math.min(x,minX);minY=Math.min(y,minY);maxX=Math.max(x,maxX);maxY=Math.max(y,maxY);}if(maxX<0)return null;const c=document.createElement('canvas');c.width=220;c.height=150;const g=c.getContext('2d');const w=maxX-minX+1,h=maxY-minY+1,s=Math.min(200/w,130/h);g.drawImage(drawing,minX,minY,w,h,(220-w*s)/2,(150-h*s)/2,w*s,h*s);return c.toDataURL();}
const initialBlocks=()=>({blocks:{languageVersion:0,blocks:[{type:'loy_start',x:35,y:35,next:{block:{type:'loy_move',fields:{VALUE:120}}}}]}});
$('add').onclick=()=>{const image=croppedSprite();if(!image){message('วาดกระทงก่อนเพิ่มลงแม่น้ำนะ');return;}if(project.krathongs.length>=100){message('เพิ่มได้สูงสุด 100 กระทง');return;}rememberBlocks();const k={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name:'กระทง '+(project.krathongs.length+1),image,x:180+Math.random()*530,y:245+Math.random()*100,angle:0,speed:95,blocks:initialBlocks(),released:false};project.krathongs.push(k);sprites.set(k.id,imageFrom(image));select(k.id);message('เพิ่มกระทงแล้ว ลอง Run หรือเริ่มต่อบล็อกได้เลย');};
function setupBlockly(){
 if(!window.Blockly)throw Error('โหลด Blockly ไม่สำเร็จ ตรวจสอบโฟลเดอร์ vendor');
 Blockly.defineBlocksWithJsonArray([
 {type:'loy_speed',message0:'set speed %1 steps / second',args0:[{type:'field_number',name:'VALUE',value:95,min:1,max:2000}],previousStatement:null,nextStatement:null,colour:170},
 {type:'loy_start',message0:'when run • เมื่อเริ่ม',nextStatement:null,colour:42},
 ...[['move_up','move up %1 steps',170,100],['move_left','move left %1 steps',170,100],['move_right','move right %1 steps',170,100],['move_down','move down %1 steps',170,100],['move','move %1 steps',170,120],['left','turn left %1 degrees',210,90],['right','turn right %1 degrees',210,90],['wait','wait %1 seconds',42,1]].map(([type,label,colour,value])=>({type:'loy_'+type,message0:label,args0:[{type:'field_number',name:'VALUE',value,min:0,max:type==='wait'?3600:10000}],previousStatement:null,nextStatement:null,colour})),
 {type:'loy_forever',message0:'forever %1 %2',args0:[{type:'input_dummy'},{type:'input_statement',name:'DO'}],previousStatement:null,nextStatement:null,colour:285}
 ]);
 workspace=Blockly.inject('blockly',{sounds:false,renderer:'geras',trashcan:false,scrollbars:true,zoom:{controls:true,wheel:false,startScale:.85},toolbox:{kind:'categoryToolbox',contents:[{kind:'category',name:'เริ่มต้น',colour:42,contents:[{kind:'block',type:'loy_start'},{kind:'block',type:'loy_wait'}]},{kind:'category',name:'เคลื่อนที่',colour:170,contents:['speed','move_up','move_left','move_right','move_down','move','left','right'].map(t=>({kind:'block',type:'loy_'+t}))},{kind:'category',name:'วนซ้ำ',colour:285,contents:[{kind:'block',type:'controls_repeat_ext',inputs:{TIMES:{shadow:{type:'math_number',fields:{NUM:5}}}}},{kind:'block',type:'loy_forever'}]}]}});
 workspace.addChangeListener(e=>{if(!loading&&!e.isUiEvent){rememberBlocks();scheduleSave();}});
 new ResizeObserver(()=>Blockly.svgResize(workspace)).observe($('blockly'));
}
function number(b,name,max){const n=Number(b.getFieldValue(name));if(!Number.isFinite(n)||n<0||n>max)throw Error('ค่าตัวเลขไม่อยู่ในช่วงที่รองรับ');return n;}
function compile(first,depth=0,seen={count:0}){if(depth>30)throw Error('บล็อกซ้อนกันมากเกินไป');const commands=[];for(let b=first;b;b=b.getNextBlock()){if(++seen.count>2000)throw Error('มีบล็อกมากเกินไป');if(!b.isEnabled())continue;const t=b.type;if(t==='loy_speed'){const speed=number(b,'VALUE',2000);if(speed<1)throw Error('ความเร็วต้องอยู่ระหว่าง 1 ถึง 2000');commands.push({type:'speed',value:speed});}else if(['loy_move_up','loy_move_left','loy_move_right','loy_move_down','loy_move','loy_left','loy_right','loy_wait'].includes(t))commands.push({type:t.slice(4),value:number(b,'VALUE',t==='loy_wait'?3600:10000)});else if(t==='controls_repeat_ext'){const n=b.getInputTargetBlock('TIMES');if(!n||n.type!=='math_number')throw Error('repeat ต้องใช้จำนวนครั้งแบบตัวเลข');commands.push({type:'repeat',count:Math.floor(number(n,'NUM',10000)),body:compile(b.getInputTargetBlock('DO'),depth+1,seen)});}else if(t==='loy_forever')commands.push({type:'repeat',count:Infinity,body:compile(b.getInputTargetBlock('DO'),depth+1,seen)});else throw Error('ไม่รองรับบล็อก '+t);}return commands;}
function* execute(commands){for(const c of commands){if(c.type==='repeat'){for(let i=0;i<c.count;i++){yield {type:'tick'};yield* execute(c.body);}}else yield c;}}
function capture(k){if(!poses.has(k.id))poses.set(k.id,{x:k.x,y:k.y,angle:k.angle,speed:k.speed??95});}
function start(){const k=selected();if(!k)return;try{const heads=workspace.getTopBlocks(true).filter(b=>b.type==='loy_start'&&b.isEnabled());if(heads.length!==1)throw Error('ต้องมี when run ที่เปิดใช้งานเพียง 1 บล็อก');const code=compile(heads[0].getNextBlock());capture(k);runners.set(k.id,{iterator:execute(code),action:null});message('กำลังทดลองเส้นทางของ '+k.name);scheduleSave();}catch(e){message(e.message);}}
$('run').onclick=start;
$('stop').onclick=()=>{const k=selected();if(k){runners.delete(k.id);k.released=false;message('หยุด '+k.name+' แล้ว');scheduleSave();}};
$('reset').onclick=()=>{const k=selected();if(k){runners.delete(k.id);k.released=false;if(poses.has(k.id))Object.assign(k,poses.get(k.id));poses.delete(k.id);message('คืนตำแหน่งก่อนเริ่มแล้ว');scheduleSave();}};
$('float').onclick=()=>{const k=selected();if(k){capture(k);k.released=true;message('ปล่อย '+k.name+' ลอยไปกับสายน้ำแล้ว');scheduleSave();}};
function wrap(k){const a=k.angle*Math.PI/180,hw=(Math.abs(Math.cos(a))*SW+Math.abs(Math.sin(a))*SH)/2,hh=(Math.abs(Math.sin(a))*SW+Math.abs(Math.cos(a))*SH)/2;if(k.x < -hw)k.x=W+hw;else if(k.x>W+hw)k.x=-hw;if(k.y < -hh)k.y=H+hh;else if(k.y>H+hh)k.y=-hh;}
function advance(k,dt){const r=runners.get(k.id);if(!r)return;let remaining=dt;for(let budget=0;budget<100;budget++){if(!r.action){const next=r.iterator.next();if(next.done){runners.delete(k.id);scheduleSave();if(k.id===project.selectedId)message('จบคำสั่งแล้ว');break;}const c=next.value;if(c.type==='tick')continue;if(c.type==='speed'){k.speed=c.value;continue;}r.action={...c,left:c.value};}const a=r.action,speed=a.type==='wait'?1:a.type.startsWith('move')?(k.speed??95):150;const amount=Math.min(a.left,remaining*speed);if(a.type==='move'){k.x+=Math.cos(k.angle*Math.PI/180)*amount;k.y+=Math.sin(k.angle*Math.PI/180)*amount;}else if(a.type==='move_up')k.y-=amount;else if(a.type==='move_down')k.y+=amount;else if(a.type==='move_left')k.x-=amount;else if(a.type==='move_right')k.x+=amount;else if(a.type==='left')k.angle=(k.angle-amount)%360;else if(a.type==='right')k.angle=(k.angle+amount)%360;a.left-=amount;remaining-=amount/speed;wrap(k);if(a.left<.000001)r.action=null;else break;if(remaining<=0)break;}}
function render(time){
 ctx.clearRect(0,0,W,H);
 const sky=ctx.createLinearGradient(0,0,0,H);
 sky.addColorStop(0,'#0a132a');sky.addColorStop(198/H,'#172a43');sky.addColorStop(1,'#172a43');
 ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 // Different phases and speeds keep the stars gently twinkling independently.
 for(let i=0;i<65;i++){
  const x=(i*167+33)%W,y=(i*31+9)%178;
  const glow=.5+.5*Math.sin(time*(.65+(i%5)*.18)+i*2.4);
  ctx.fillStyle=`rgba(219,235,255,${.2+glow*.75})`;
  ctx.beginPath();ctx.arc(x,y,(i%3===0?1.4:.8)+glow*.35,0,Math.PI*2);ctx.fill();
  if(i%7===0){ctx.strokeStyle=`rgba(219,235,255,${glow*.5})`;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(x+3,y);ctx.moveTo(x,y-3);ctx.lineTo(x,y+3);ctx.stroke();}
 }
 const halo=ctx.createRadialGradient(705,82,15,705,82,75);
 halo.addColorStop(0,'#f6dda739');halo.addColorStop(1,'#f6dda700');ctx.fillStyle=halo;ctx.fillRect(620,0,170,170);
 ctx.fillStyle='#f1dfb6';ctx.beginPath();ctx.arc(705,82,29,0,Math.PI*2);ctx.fill();
 // Share the wave profile and phase between the surface edge and river lines.
 const waterScale=(H-198)/242;
 const waveOffset=x=>Math.sin(x/85-time*.85)*2.4+Math.sin(x/170-time*.4)*1.2;
 ctx.beginPath();
 for(let x=0;x<=W;x+=5){
  const y=198+waveOffset(x)*waterScale;
  if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
 }
 ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();
 const water=ctx.createLinearGradient(0,180,0,H);
 water.addColorStop(0,'#1b445b');water.addColorStop(1,'#102c45');
 ctx.fillStyle=water;ctx.fill();
 // Clip details to the curved water edge rather than a horizontal rectangle.
 ctx.save();ctx.clip();ctx.translate(0,198);ctx.scale(1,(H-198)/242);ctx.translate(0,-198);
 for(let i=0;i<25;i++){
  const depth=i/24,y=198+4*i+.25*i*i;
  ctx.lineWidth=.7+depth*1.8;ctx.strokeStyle=`rgba(100,186,205,${.09+depth*.18})`;ctx.beginPath();
  for(let x=0;x<=W;x+=8){const yy=y+waveOffset(x)*(1+depth*1.2)+Math.sin(x/(65+depth*50)-time*.55+i*.35)*depth*2;if(!x)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);}ctx.stroke();
 }
 for(let i=0;i<30;i++){
  const y=202+i*8+Math.sin(time*1.4+i)*2,x=705+Math.sin(i*1.8+time*1.1)*(10+i*.7),half=9+i*1.8;
  ctx.lineWidth=1.5+i/25;ctx.strokeStyle=`rgba(239,214,157,${(.22-i*.005)*(.75+.25*Math.sin(time*1.6+i))})`;ctx.beginPath();ctx.moveTo(x-half,y);ctx.quadraticCurveTo(x,y+2,x+half,y);ctx.stroke();
 }
 for(let i=0;i<38;i++){
  const x=((i*137+time*(12+i%5*4))%(W+60))-30,y=212+(i*47)%220;
  ctx.lineWidth=1.2;ctx.strokeStyle=`rgba(157,219,224,${.12+.12*(.5+.5*Math.sin(time*1.2+i))})`;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+9,y-2,x+20+i%12,y);ctx.stroke();
 }
 ctx.restore();
 // A fixed population of lanterns rises and fades back in near the horizon.
 for(let i=0;i<11;i++){
  const progress=((time*(5+i%4)+i*23)%240)/240;
  const y=205-progress*240,x=55+(i*137)%800+Math.sin(time*.35+i*2)*15;
  const size=.55+(i%4)*.19,fade=Math.min(1,progress*10,(1-progress)*8);
  const flicker=.85+.15*Math.sin(time*3+i*1.7);
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(time*.6+i)*.07);ctx.scale(size,size);ctx.globalAlpha=fade;
  const light=ctx.createRadialGradient(0,4,2,0,4,36);
  light.addColorStop(0,`rgba(255,176,64,${.3*flicker})`);light.addColorStop(1,'rgba(255,151,44,0)');
  ctx.fillStyle=light;ctx.fillRect(-36,-32,72,72);
  const paper=ctx.createLinearGradient(0,-15,0,14);paper.addColorStop(0,'#d88b42');paper.addColorStop(.6,'#f4bd66');paper.addColorStop(1,'#ffdf91');
  ctx.fillStyle=paper;ctx.beginPath();ctx.moveTo(-10,-13);ctx.quadraticCurveTo(0,-18,10,-13);ctx.lineTo(8,12);ctx.quadraticCurveTo(0,16,-8,12);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#9f562b80';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-4,-14);ctx.lineTo(-3,12);ctx.moveTo(4,-14);ctx.lineTo(3,12);ctx.stroke();
  ctx.fillStyle='#ab602e';ctx.beginPath();ctx.ellipse(0,12,8,2.5,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff2b6';ctx.beginPath();ctx.ellipse(0,9,2,4*flicker,0,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 for(const k of project.krathongs){const bob=k.released?Math.sin(time*1.8+k.x*.01)*3:0;ctx.save();ctx.translate(k.x,k.y+bob);ctx.rotate(k.angle*Math.PI/180);if(k.id===project.selectedId){ctx.strokeStyle='#c7edc998';ctx.setLineDash([4,5]);ctx.beginPath();ctx.ellipse(0,0,SW/2+6,SH/2+6,0,0,Math.PI*2);ctx.stroke();}const im=sprites.get(k.id);if(im?.complete&&im.naturalWidth)ctx.drawImage(im,-SW/2,-SH/2,SW,SH);ctx.restore();}
}

let raf, lastAutosave=0;
function frame(ms){const dt=Math.min((ms-lastTime)/1000||0,.05);lastTime=ms;for(const k of project.krathongs){try{advance(k,dt);}catch(e){runners.delete(k.id);message('คำสั่งหยุด: '+e.message);}if(k.released){k.x+=dt*17;k.y+=Math.sin(ms/2500+k.x/100)*dt*2;}wrap(k);}render(ms/1000);if(ms-lastAutosave>4000&&(runners.size||project.krathongs.some(k=>k.released))){save();lastAutosave=ms;}raf=requestAnimationFrame(frame);}
function riverPoint(e){const r=river.getBoundingClientRect();return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
function hitKrathong(p){return [...project.krathongs].reverse().find(k=>{const a=-k.angle*Math.PI/180,dx=p.x-k.x,dy=p.y-k.y;return Math.abs(dx*Math.cos(a)-dy*Math.sin(a))<SW/2+8&&Math.abs(dx*Math.sin(a)+dy*Math.cos(a))<SH/2+8;});}
river.onpointerdown=e=>{
 if(drag || (e.pointerType==='mouse'&&e.button!==0))return;
 const p=riverPoint(e),k=hitKrathong(p);if(!k)return;
 e.preventDefault();select(k.id);runners.delete(k.id);k.released=false;
 drag={id:e.pointerId,k,dx:p.x-k.x,dy:p.y-k.y};river.setPointerCapture(e.pointerId);river.style.cursor='grabbing';
 message('ลากกระทงไปวางได้เลย — กด Run หรือ Float เพื่อเริ่มอีกครั้ง');
};
river.onpointermove=e=>{
 const p=riverPoint(e);
 if(!drag){river.style.cursor=hitKrathong(p)?'grab':'default';return;}
 if(drag.id!==e.pointerId)return;
 drag.k.x=Math.max(0,Math.min(W,p.x-drag.dx));drag.k.y=Math.max(0,Math.min(H,p.y-drag.dy));
};
function endDrag(e){if(!drag||drag.id!==e.pointerId)return;const k=drag.k;drag=null;poses.delete(k.id);river.style.cursor='grab';if(river.hasPointerCapture(e.pointerId))river.releasePointerCapture(e.pointerId);scheduleSave();}
river.onpointerup=endDrag;river.onpointercancel=endDrag;river.onlostpointercapture=endDrag;
$('deleteKrathong').onclick=()=>{
 const k=selected();if(!k)return;
 const index=project.krathongs.findIndex(item=>item.id===k.id);
 if(drag?.k.id===k.id){const pointerId=drag.id;drag=null;if(river.hasPointerCapture(pointerId))river.releasePointerCapture(pointerId);river.style.cursor='default';}
 runners.delete(k.id);poses.delete(k.id);sprites.delete(k.id);
 project.krathongs.splice(index,1);
 project.selectedId=null;
 select(project.krathongs[Math.min(index,project.krathongs.length-1)]?.id||null);
 save();message('ลบ '+k.name+' แล้ว');
};
$('save').onclick=()=>{save();};
$('export').onclick=()=>{rememberBlocks();project.drawing=drawing.toDataURL();const url=URL.createObjectURL(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='loy-krathong.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('ส่งออกโปรเจกต์แล้ว');};
$('import').onclick=()=>$('file').click();
$('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>25000000)throw Error('ไฟล์ใหญ่เกิน 25 MB');const next=validate(JSON.parse(await file.text()));const test=new Blockly.Workspace();try{for(const k of next.krathongs){test.clear();Blockly.serialization.workspaces.load(k.blocks,test);}}finally{test.dispose();}await loadDrawing(next.drawing);runners.clear();poses.clear();sprites.clear();project=next;const importedId=next.selectedId;undo=[];for(const k of project.krathongs)sprites.set(k.id,imageFrom(k.image));loading=true;workspace.clear();loading=false;project.selectedId=null;select(importedId);save();message('นำเข้าแล้ว — กด Run หรือ Float เพื่อเริ่ม');}catch(err){message('นำเข้าไม่สำเร็จ: '+err.message);}e.target.value='';};
window.addEventListener('pagehide',()=>{save();cancelAnimationFrame(raf);});
window.addEventListener('pageshow',e=>{if(e.persisted){lastTime=0;raf=requestAnimationFrame(frame);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();else lastTime=0;});
async function init(){try{setupBlockly();let raw;try{raw=localStorage.getItem(KEY);if(raw)project=validate(JSON.parse(raw));}catch(e){message('อ่านข้อมูลเดิมไม่ได้ เริ่มโปรเจกต์ใหม่ได้ หรือ Import ไฟล์สำรอง');}await loadDrawing(project.drawing);for(const k of project.krathongs)sprites.set(k.id,imageFrom(k.image));const id=project.selectedId;project.selectedId=null;select(id);raf=requestAnimationFrame(frame);}catch(e){message(e.message);}}
init();
})();
