'use strict';
(() => {
const $ = id => document.getElementById(id);
const KEY = 'loy-krathong-project-v1', W = 900, H = 800, SW = 110, SH = 75;
const drawing = $('drawing'), pen = drawing.getContext('2d'), river = $('river'), ctx = river.getContext('2d');
let textObjects=[], selectedText=null, textDrag=null;
const textCanvas=$('textLayer'),textPen=textCanvas.getContext('2d');
let project = {version:1,drawing:'',krathongs:[],selectedId:null};
let workspace, loading = false, erasing = false, candleMode = false, textMode = false, drag = null, stroke = null, undo = [], saveTimer, lastTime = 0;
const sprites = new Map(), runners = new Map(), poses = new Map();
let cloud=null; const remoteBoats=new Map();
let mission={enabled:false,boatId:null,stars:LoyMission.spawn(),round:1,score:0,queue:[],busy:false};
const SCORE_KEY='loy-mission-'+(window.LOY_CLOUD?.url||'local');
const sceneBoats=()=>[...remoteBoats.values(),...project.krathongs];
const selected = () => project.krathongs.find(k => k.id === project.selectedId)||remoteBoats.get(project.selectedId);
const ownSelected=()=>selected()&&!selected().remote;
const message = text => { $('status').textContent = text; };
function rememberBlocks(){ if(workspace && ownSelected() && !loading) selected().blocks = Blockly.serialization.workspaces.save(workspace); }
function scheduleSave(){ clearTimeout(saveTimer); $('saveState').textContent = 'กำลังบันทึก…'; saveTimer = setTimeout(save,650); }
function save(){ clearTimeout(saveTimer);if(cloud?.enabled)for(const k of project.krathongs)if(k.cloudId)cloud.update(k); try{ rememberBlocks(); storeDrawing(); localStorage.setItem(KEY,JSON.stringify(project)); $('saveState').textContent = 'บันทึกแล้วในเครื่อง'; }catch(e){$('saveState').textContent = 'บันทึกไม่สำเร็จ'; message('พื้นที่จัดเก็บเต็มหรือถูกปิดกั้น กรุณา Export สำรองงาน');} }
function imageFrom(url){ const img = new Image(); img.src = url; return img; }
function validate(p,restoreCloud=false){
 if(!p || p.version !== 1 || !Array.isArray(p.krathongs) || p.krathongs.length > 100) throw Error('รูปแบบโปรเจกต์ไม่ถูกต้อง (สูงสุด 100 กระทง)');
 const png = s => typeof s === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s) && s.length < 3000000;
 if(p.drawing && !png(p.drawing)) throw Error('ภาพวาดไม่ถูกต้อง');
 const ids = new Set();
 const list = p.krathongs.map(k => {
  if(k?.missionActive&&k.missionReturn&&[k.missionReturn.x,k.missionReturn.y,k.missionReturn.angle].every(Number.isFinite))k={...k,...k.missionReturn,playback:null,released:false};
  if(!k || typeof k.id !== 'string' || ids.has(k.id) || !png(k.image) || ![k.x,k.y,k.angle].every(Number.isFinite) || !k.blocks || typeof k.blocks !== 'object') throw Error('ข้อมูลกระทงไม่ถูกต้อง');
  ids.add(k.id); return {cloudId:restoreCloud&&k.cloudProject===window.LOY_CLOUD?.url&&typeof k.cloudId==='string'?k.cloudId:null,cloudProject:restoreCloud?k.cloudProject:null,id:k.id,name:String(k.name || 'กระทง').slice(0,60),image:k.image,x:k.x,y:k.y,angle:k.angle,speed:Number.isFinite(k.speed)?Math.max(1,Math.min(2000,k.speed)):95,blocks:k.blocks,playback:restoreCloud?LoyMotion.validate(k.playback):null,released:restoreCloud&&k.playback?Boolean(k.released):true};
 });
 if(p.drawingBase&&!png(p.drawingBase))throw Error('ภาพพื้นหลังไม่ถูกต้อง');
 const texts=Array.isArray(p.texts)&&p.drawingBase?p.texts:[];
 if(texts.length>80||texts.some(t=>!t||typeof t.id!=='string'||typeof t.text!=='string'||t.text.length>80||!/^#[0-9a-f]{6}$/i.test(t.color)||![t.x,t.y,t.size].every(Number.isFinite)||t.x<0||t.x>480||t.y<0||t.y>300||t.size<10||t.size>72))throw Error('ข้อมูลข้อความไม่ถูกต้อง');
 return {version:1,drawing:p.drawing || '',drawingBase:p.drawingBase||'',texts,krathongs:list,selectedId:ids.has(p.selectedId)?p.selectedId:(list[0]?.id || null)};
}
function loadDrawing(url,texts=[]){textObjects=JSON.parse(JSON.stringify(texts));selectedText=null;renderTexts();return new Promise((resolve,reject)=>{if(!url){pen.clearRect(0,0,480,300);resolve();return;} const im = new Image();im.onload=()=>{pen.clearRect(0,0,480,300);pen.drawImage(im,0,0,480,300);resolve();};im.onerror=()=>reject(Error('อ่านภาพวาดไม่ได้'));im.src=url;});}
function refreshItems(){
 $('items').replaceChildren();
 for(const k of sceneBoats()){const b=document.createElement('button');b.className=k.id===project.selectedId?'selected':'';b.setAttribute('aria-pressed',String(k.id===project.selectedId));const im=document.createElement('img');im.src=k.image;im.alt='';b.append(im,document.createTextNode(k.name+(k.remote?' · ดูโค้ด':'')));b.onclick=()=>select(k.id);$('items').append(b);}
 $('programName').textContent=(selected()?selected().name+(selected().remote?' · ดูอย่างเดียว':''):'') || 'เลือกกระทงเพื่อเขียนโค้ด';
 for(const id of ['run','stop','reset','float','deleteKrathong']) $(id).disabled=!ownSelected();
}
function select(id){rememberBlocks();project.selectedId=id;loading=true;try{workspace.clear();if(selected())Blockly.serialization.workspaces.load(selected().blocks,workspace);}catch(e){message('โค้ดที่บันทึกไว้ไม่รองรับ กรุณาต่อบล็อกใหม่');}finally{loading=false;}$('blockly').inert=Boolean(selected()?.remote);refreshItems();scheduleSave();}
function point(e){const r=drawing.getBoundingClientRect();return {x:(e.clientX-r.left)*480/r.width,y:(e.clientY-r.top)*300/r.height};}
function drawSegment(a,b){pen.save();pen.globalCompositeOperation=erasing?'destination-out':'source-over';pen.strokeStyle=$('color').value;pen.fillStyle=$('color').value;pen.lineWidth=Number($('brush').value);pen.lineCap='round';pen.lineJoin='round';pen.beginPath();pen.moveTo(a.x,a.y);pen.lineTo(b.x,b.y);pen.stroke();if(a.x===b.x&&a.y===b.y){pen.beginPath();pen.arc(a.x,a.y,pen.lineWidth/2,0,Math.PI*2);pen.fill();}pen.restore();}
function checkpoint(){undo.push({pixels:pen.getImageData(0,0,480,300),texts:JSON.parse(JSON.stringify(textObjects))});if(undo.length>25)undo.shift();}
drawing.onpointerdown=e=>{if(stroke||textDrag)return;e.preventDefault();const p=point(e);const hit=!erasing&&!candleMode&&hitText(p);if(hit){checkpoint();selectText(hit);textDrag={id:e.pointerId,item:hit,dx:p.x-hit.x,dy:p.y-hit.y};drawing.setPointerCapture(e.pointerId);return;}if(textMode){stampText(point(e));return;}checkpoint();if(candleMode){stampCandle(point(e));scheduleSave();return;}drawing.setPointerCapture(e.pointerId);stroke={...point(e),id:e.pointerId};drawSegment(stroke,stroke);};
drawing.onpointermove=e=>{if(textDrag?.id===e.pointerId){const p=point(e);textDrag.item.x=p.x-textDrag.dx;textDrag.item.y=p.y-textDrag.dy;constrainText(textDrag.item);renderTexts();return;}if(!stroke||stroke.id!==e.pointerId)return;const p=point(e);drawSegment(stroke,p);stroke={...p,id:e.pointerId};};
function endStroke(e){if(textDrag?.id===e.pointerId){textDrag=null;scheduleSave();}if(stroke?.id===e.pointerId){stroke=null;scheduleSave();}}
drawing.onpointerup=endStroke;drawing.onpointercancel=endStroke;drawing.onlostpointercapture=endStroke;
$('eraser').onclick=()=>{setTextMode(false);candleMode=false;$('candle').setAttribute('aria-pressed','false');erasing=!erasing;$('eraser').setAttribute('aria-pressed',String(erasing));};
$('draw').onclick=()=>{setTextMode(false);candleMode=false;$('candle').setAttribute('aria-pressed','false');erasing=false;$('eraser').setAttribute('aria-pressed','false');drawing.scrollIntoView({block:'center',behavior:'smooth'});};
$('undo').onclick=()=>{if(undo.length){const prior=undo.pop();pen.putImageData(prior.pixels,0,0);textObjects=prior.texts;selectedText=null;renderTexts();scheduleSave();}};
$('clear').onclick=()=>{checkpoint();pen.clearRect(0,0,480,300);textObjects=[];selectedText=null;renderTexts();scheduleSave();};
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
  checkpoint();pen.clearRect(0,0,480,300);textObjects=[];selectedText=null;renderTexts();
  const scale=Math.min(480/img.naturalWidth,300/img.naturalHeight);
  const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
  pen.drawImage(img,(480-w)/2,(300-h)/2,w,h);
  scheduleSave();message('นำเข้า PNG แล้ว วาดเพิ่มได้ หรือกด Add Krathong เพื่อนำลงแม่น้ำ (Undo เพื่อคืนภาพเดิม)');
 }catch(err){message('นำเข้า PNG ไม่สำเร็จ: '+err.message);}
 finally{if(url)URL.revokeObjectURL(url);e.target.value='';}
};
function textBounds(t){
 textPen.font=t.size+'px Tahoma, "Segoe UI", sans-serif';const m=textPen.measureText(t.text||' ');
 return {width:Math.min(460,m.width),up:m.actualBoundingBoxAscent||t.size,down:Math.max(4,m.actualBoundingBoxDescent||t.size*.2)};
}
function constrainText(t){const b=textBounds(t);t.x=Math.max(6,Math.min(474-b.width,t.x));t.y=Math.max(b.up+6,Math.min(294-b.down,t.y));}
function paintTexts(target){for(const t of textObjects){target.save();target.font=t.size+'px Tahoma, "Segoe UI", sans-serif';target.textBaseline='alphabetic';target.fillStyle=t.color;target.fillText(t.text,t.x,t.y,460);target.restore();}}
function renderTexts(){
 textPen.clearRect(0,0,480,300);paintTexts(textPen);
 const t=textObjects.find(t=>t.id===selectedText);
 if(t){const b=textBounds(t);textPen.save();textPen.strokeStyle='#2785c4';textPen.lineWidth=1;textPen.setLineDash([4,3]);textPen.strokeRect(t.x-4,t.y-b.up-4,b.width+8,b.up+b.down+8);textPen.restore();}
 $('deleteText').disabled=!t;
}
function composedDrawing(){const c=document.createElement('canvas');c.width=480;c.height=300;const g=c.getContext('2d');g.drawImage(drawing,0,0);paintTexts(g);return c;}
function storeDrawing(){project.drawing=composedDrawing().toDataURL();project.drawingBase=drawing.toDataURL();project.texts=JSON.parse(JSON.stringify(textObjects));}
function hitText(p){return [...textObjects].reverse().find(t=>{const b=textBounds(t);return p.x>=t.x-6&&p.x<=t.x+b.width+6&&p.y>=t.y-b.up-6&&p.y<=t.y+b.down+6;});}
function setTextMode(active,focus=true){
 textMode=active;$('addText').setAttribute('aria-pressed',String(active));$('textTools').hidden=!active;
 if(active){candleMode=false;erasing=false;$('candle').setAttribute('aria-pressed','false');$('eraser').setAttribute('aria-pressed','false');if(focus)$('textValue').focus();}
 else{selectedText=null;renderTexts();}
}
function selectText(t){selectedText=t.id;setTextMode(true,false);$('textValue').value=t.text;$('textSize').value=t.size;$('color').value=t.color;renderTexts();$('textHint').textContent='ลากกรอบข้อความเพื่อย้าย หรือแก้ข้อความ ขนาด และสีได้เลย';}
$('addText').onclick=()=>setTextMode(!textMode);
$('newText').onclick=()=>{selectedText=null;$('textValue').value='';renderTexts();$('textValue').focus();$('textHint').textContent='พิมพ์ข้อความใหม่ แล้วแตะพื้นที่ว่างบนภาพเพื่อวาง';};
$('deleteText').onclick=()=>{if(!selectedText)return;checkpoint();textObjects=textObjects.filter(t=>t.id!==selectedText);selectedText=null;renderTexts();scheduleSave();};
for(const id of ['textValue','textSize','color']){
 $(id).addEventListener('focus',()=>{if(selectedText)checkpoint();});
 $(id).addEventListener('input',()=>{const t=textObjects.find(t=>t.id===selectedText);if(!t)return;t.text=$('textValue').value.slice(0,80);t.size=Math.max(10,Math.min(72,Number($('textSize').value)||24));t.color=$('color').value;constrainText(t);renderTexts();scheduleSave();});
}
function stampText(p){
 if(selectedText){selectedText=null;renderTexts();return;}
 const text=$('textValue').value.trim();if(!text){$('textValue').focus();return;}
 if(textObjects.length>=80){message('เพิ่มข้อความได้สูงสุด 80 ชิ้น');return;}
 checkpoint();const t={id:crypto.randomUUID(),text,size:Math.max(10,Math.min(72,Number($('textSize').value)||24)),color:$('color').value,x:p.x,y:p.y};
 t.x-=textBounds(t).width/2;constrainText(t);textObjects.push(t);selectText(t);scheduleSave();
}

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
$('candle').onclick=()=>{setTextMode(false);candleMode=!candleMode;erasing=false;$('eraser').setAttribute('aria-pressed','false');$('candle').setAttribute('aria-pressed',String(candleMode));message(candleMode?'แตะบนภาพตรงฐานเทียนที่ต้องการวาง':'กลับสู่โหมดวาด');};
function croppedSprite(){const composite=composedDrawing();const data=composite.getContext("2d").getImageData(0,0,480,300).data;let minX=480,minY=300,maxX=-1,maxY=-1;for(let y=0;y<300;y++)for(let x=0;x<480;x++)if(data[(y*480+x)*4+3]>0){minX=Math.min(x,minX);minY=Math.min(y,minY);maxX=Math.max(x,maxX);maxY=Math.max(y,maxY);}if(maxX<0)return null;const c=document.createElement('canvas');c.width=220;c.height=150;const g=c.getContext('2d');const w=maxX-minX+1,h=maxY-minY+1,s=Math.min(200/w,130/h);g.drawImage(composite,minX,minY,w,h,(220-w*s)/2,(150-h*s)/2,w*s,h*s);return c.toDataURL();}
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
function selectedCode(){
 const heads=workspace.getTopBlocks(true).filter(b=>b.type==='loy_start'&&b.isEnabled());
 if(!heads.length){if(workspace.getAllBlocks(false).length)throw Error('ต่อคำสั่งใต้ when run ก่อน');return [];}
 if(heads.length!==1)throw Error('ต้องมี when run เพียง 1 บล็อก');
 return compile(heads[0].getNextBlock());
}
function beginProgram(k,code,floatAfter){
 capture(k);rememberBlocks();k.released=false;k.playback=LoyMotion.create(code,floatAfter);
 runners.set(k.id,k.playback);
}
function start(){const k=selected();if(!ownSelected())return;try{const code=selectedCode();if(mission.enabled&&!startMission(k))return;beginProgram(k,code,false);message('กำลังทดลองโค้ดของ '+k.name);scheduleSave();}catch(e){message(e.message);}}
$('run').onclick=start;
$('stop').onclick=()=>{const k=selected();if(ownSelected()){runners.delete(k.id);k.playback=LoyMotion.create([],false);k.playback.done=true;k.released=false;message('หยุด '+k.name+' แล้ว');scheduleSave();}};
$('reset').onclick=()=>{const k=selected();if(ownSelected()){runners.delete(k.id);k.playback=LoyMotion.create([],false);k.playback.done=true;k.released=false;if(mission.enabled)Object.assign(k,LoyMission.START);else if(poses.has(k.id))Object.assign(k,poses.get(k.id));poses.delete(k.id);message('คืนตำแหน่งก่อนเริ่มแล้ว');scheduleSave();}};
$('float').onclick=async()=>{
 if(mission.enabled){start();return;}const k=selected();if(!ownSelected()||k.publishing)return;
 try{beginProgram(k,selectedCode(),true);advance(k,0);scheduleSave();}catch(err){message(err.message);return;}
 if(!cloud?.enabled){message('เริ่มโค้ดแล้ว จบคำสั่งจะลอยต่อ (โหมดในเครื่อง)');return;}
 k.publishing=true;message('กำลังเผยแพร่กระทงไปยังแม่น้ำร่วมกัน…');
 try{
  const id=await cloud.publish(k);
  if(!project.krathongs.includes(k)){await cloud.remove(id);return;}
  k.cloudId=id;k.cloudProject=window.LOY_CLOUD.url;
  remoteBoats.delete('shared-'+id);save();message('เผยแพร่แล้ว เครื่องอื่นจะเห็นภายในประมาณ 5 วินาที');
 }catch(err){message('ยังเผยแพร่ไม่สำเร็จ: '+err.message+' — งานยังอยู่ในเครื่อง กด Float เพื่อลองใหม่');}
 finally{k.publishing=false;}
};
function wrap(k){const a=k.angle*Math.PI/180,hw=(Math.abs(Math.cos(a))*SW+Math.abs(Math.sin(a))*SH)/2,hh=(Math.abs(Math.sin(a))*SW+Math.abs(Math.cos(a))*SH)/2;if(k.x < -hw)k.x=W+hw;else if(k.x>W+hw)k.x=-hw;if(k.y < -hh)k.y=H+hh;else if(k.y>H+hh)k.y=-hh;}
function advance(k,dt){
 const state=runners.get(k.id);if(!state)return dt;
 const remaining=LoyMotion.advance(k,state,dt,wrap);
 if(state.done){runners.delete(k.id);if(!k.remote){scheduleSave();if(k.id===project.selectedId)message(state.floatAfter?'จบโค้ดแล้ว กำลังลอยตามน้ำ':'จบคำสั่งแล้ว');}}
 return remaining;
}
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
 drawMission(time);
 for(const k of sceneBoats()){const bob=k.released?Math.sin(time*1.8+k.x*.01)*3:0;ctx.save();ctx.translate(k.x,k.y+bob);ctx.rotate(k.angle*Math.PI/180);if(k.id===project.selectedId){ctx.strokeStyle='#c7edc998';ctx.setLineDash([4,5]);ctx.beginPath();ctx.ellipse(0,0,SW/2+6,SH/2+6,0,0,Math.PI*2);ctx.stroke();}const im=sprites.get(k.id);if(im?.complete&&im.naturalWidth)ctx.drawImage(im,-SW/2,-SH/2,SW,SH);ctx.restore();}
}

let raf, lastAutosave=0;
function frame(ms){const dt=Math.min((ms-lastTime)/1000||0,.05);lastTime=ms;for(const k of project.krathongs){let driftDt=dt;const previous={x:k.x,y:k.y},collecting=mission.enabled&&mission.boatId===k.id&&runners.has(k.id);try{driftDt=advance(k,dt);}catch(e){runners.delete(k.id);message('คำสั่งหยุด: '+e.message);}if(k.released){k.x+=driftDt*17;}wrap(k);if(collecting)collectMission(k,previous);}updateRemotePoses(dt);render(ms/1000);if(ms-lastAutosave>4000&&(runners.size||project.krathongs.some(k=>k.released))){save();lastAutosave=ms;}raf=requestAnimationFrame(frame);}
function riverPoint(e){const r=river.getBoundingClientRect();return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
function hitKrathong(p){return [...sceneBoats()].reverse().find(k=>{const a=-k.angle*Math.PI/180,dx=p.x-k.x,dy=p.y-k.y;return Math.abs(dx*Math.cos(a)-dy*Math.sin(a))<SW/2+8&&Math.abs(dx*Math.sin(a)+dy*Math.cos(a))<SH/2+8;});}
river.onpointerdown=e=>{
 if(drag || (e.pointerType==='mouse'&&e.button!==0))return;
 const p=riverPoint(e),k=hitKrathong(p);if(!k)return;
 e.preventDefault();select(k.id);if(k.remote){message('โค้ดของ '+k.name+' · ดูอย่างเดียว');return;}runners.delete(k.id);k.playback=LoyMotion.create([],false);k.playback.done=true;k.released=false;
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
$('deleteKrathong').onclick=async()=>{
 const k=selected();if(!ownSelected())return;
 if(k.publishing){message('กำลังเผยแพร่ กรุณารอให้เสร็จก่อนลบ');return;}
 if(k.cloudId){if(!cloud?.enabled){message('ต้องเชื่อมแม่น้ำร่วมกันก่อนลบกระทงที่เผยแพร่');return;}try{await cloud.remove(k.cloudId);remoteBoats.delete('shared-'+k.cloudId);}catch(err){message('ลบออนไลน์ไม่สำเร็จ: '+err.message);return;}}
 const index=project.krathongs.findIndex(item=>item.id===k.id);if(index<0)return;
 if(drag?.k.id===k.id){const pointerId=drag.id;drag=null;if(river.hasPointerCapture(pointerId))river.releasePointerCapture(pointerId);river.style.cursor='default';}
 runners.delete(k.id);poses.delete(k.id);sprites.delete(k.id);
 project.krathongs.splice(index,1);
 project.selectedId=null;
 select(project.krathongs[Math.min(index,project.krathongs.length-1)]?.id||null);
 save();message('ลบ '+k.name+' แล้ว');
};
$('save').onclick=()=>{save();};
$('export').onclick=()=>{rememberBlocks();storeDrawing();const url=URL.createObjectURL(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='loy-krathong.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('ส่งออกโปรเจกต์แล้ว');};
$('import').onclick=()=>$('file').click();
$('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>25000000)throw Error('ไฟล์ใหญ่เกิน 25 MB');const next=validate(JSON.parse(await file.text()));const test=new Blockly.Workspace();try{for(const k of next.krathongs){test.clear();Blockly.serialization.workspaces.load(k.blocks,test);}}finally{test.dispose();}await loadDrawing(next.drawingBase||next.drawing,next.texts);runners.clear();poses.clear();sprites.clear();project=next;const importedId=next.selectedId;undo=[];for(const k of project.krathongs){sprites.set(k.id,imageFrom(k.image));capture(k);if(k.playback&&!k.playback.done)runners.set(k.id,k.playback);}loading=true;workspace.clear();loading=false;project.selectedId=null;select(importedId);save();message('นำเข้าแล้ว — กระทงเริ่มลอยอัตโนมัติ กด Stop เพื่อหยุด');}catch(err){message('นำเข้าไม่สำเร็จ: '+err.message);}e.target.value='';};
window.addEventListener('pagehide',()=>{save();cancelAnimationFrame(raf);cloud?.stop();});
window.addEventListener('pageshow',e=>{if(e.persisted){cloud?.start();lastTime=0;raf=requestAnimationFrame(frame);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();else lastTime=0;});
function saveMission(){try{localStorage.setItem(SCORE_KEY,JSON.stringify({name:$('playerName').value,score:mission.score,queue:mission.queue,stars:mission.stars,round:mission.round}));}catch{$('scoreStatus').textContent='บันทึกคะแนนในเครื่องไม่ได้ อย่าปิดหน้าจนส่งสำเร็จ';}}
function missionScore(){ $('starScore').textContent=mission.score+mission.queue.reduce((sum,e)=>sum+e.points,0);$('starRound').textContent=mission.round;}
async function syncScores(){
 if(!mission.enabled||mission.busy||!cloud?.enabled)return;mission.busy=true;
 try{
  while(mission.queue.length){const event=mission.queue[0];mission.score=await cloud.scoreEvent(event);mission.queue.shift();saveMission();missionScore();}
  const rows=await cloud.scores();$('leaderboard').replaceChildren();
  for(const row of rows){const li=document.createElement('li');li.textContent=row.player_name+' — ★ '+row.score;$('leaderboard').append(li);}
  $('scoreStatus').textContent=rows.length?'อันดับอัปเดตแล้ว · Run เริ่มที่ START':'ยังไม่มีคะแนน · เป็นคนแรกได้เลย';
 }catch{ $('scoreStatus').textContent='ยังส่งคะแนนไม่ได้ ตรวจเน็ตและรัน SQL ภารกิจ คะแนนรอส่งอยู่ในเครื่อง';}
 finally{mission.busy=false;}
}
function setupMission(){
 try{const saved=JSON.parse(localStorage.getItem(SCORE_KEY)||'null');if(saved){$('playerName').value=String(saved.name||'').slice(0,30);mission.score=Number.isSafeInteger(saved.score)&&saved.score>=0?saved.score:0;mission.queue=Array.isArray(saved.queue)?saved.queue.filter(e=>typeof e.id==='string'&&typeof e.name==='string'&&Number.isInteger(e.points)&&e.points>=0&&e.points<=5):[];if(Array.isArray(saved.stars)&&saved.stars.length>0&&saved.stars.length<=5&&saved.stars.every(s=>Number.isFinite(s.x)&&Number.isFinite(s.y)&&s.x>=200&&s.x<=800&&s.y>=300&&s.y<=600))mission.stars=saved.stars;mission.round=Number.isSafeInteger(saved.round)&&saved.round>0?saved.round:1;}}catch{}
 if(window.matchMedia('(max-width:600px)').matches)$('missionBoard').querySelector('details').open=false;missionScore();setInterval(()=>{if(!document.hidden)syncScores();},5000);
}
function stopMissionBoat(){
 const k=project.krathongs.find(k=>k.id===mission.boatId);if(!k)return;runners.delete(k.id);k.playback=null;k.released=false;k.missionActive=false;
 if(mission.original)Object.assign(k,mission.original);k.missionReturn=null;mission.boatId=null;mission.original=null;
}
$('missionToggle').onclick=()=>{
 mission.enabled=!mission.enabled;$('missionToggle').setAttribute('aria-pressed',String(mission.enabled));$('missionBoard').hidden=!mission.enabled;
 document.querySelector('.river-panel').classList.toggle('mission-on',mission.enabled);
 if(mission.enabled){message('ใส่ชื่อ เลือกกระทง แล้วกด Run เพื่อเริ่มเก็บดาว');syncScores();}else{stopMissionBoat();scheduleSave();message('กลับสู่แม่น้ำปกติแล้ว');}
};
$('playerName').onchange=saveMission;
function startMission(k){
 const name=$('playerName').value.trim();if(!name){$('playerName').focus();message('ใส่ชื่อผู้เล่นก่อนกด Run');return false;}
 if(k.publishing){message('รอแชร์กระทงเสร็จก่อนเริ่มภารกิจ');return false;}
 if(mission.boatId!==k.id){stopMissionBoat();mission.original={x:k.x,y:k.y,angle:k.angle,speed:k.speed};k.missionReturn={...mission.original};mission.boatId=k.id;}
 runners.delete(k.id);k.missionActive=true;k.released=false;Object.assign(k,LoyMission.START);k.speed=95;poses.set(k.id,{...LoyMission.START,speed:95});
 if(!mission.queue.some(e=>e.points===0))mission.queue.push({id:crypto.randomUUID(),name,points:0});saveMission();syncScores();return true;
}
function collectMission(k,previous){
 const result=LoyMission.collect(mission.stars,previous,k);if(!result.points)return;mission.stars=result.stars;
 mission.queue.push({id:crypto.randomUUID(),name:$('playerName').value.trim()||'ผู้เล่น',points:result.points});
 if(!mission.stars.length){mission.round++;mission.stars=LoyMission.spawn();message('เก็บครบแล้ว! เริ่มดาวชุดที่ '+mission.round);}
 missionScore();saveMission();syncScores();
}
function drawMission(time){
 if(!mission.enabled)return;
 ctx.save();ctx.strokeStyle='#a7e7bd';ctx.lineWidth=2;ctx.setLineDash([7,5]);ctx.beginPath();ctx.ellipse(LoyMission.START.x,LoyMission.START.y,64,45,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#c1f5d3';ctx.font='bold 17px Tahoma';ctx.textAlign='center';ctx.fillText('START',LoyMission.START.x,LoyMission.START.y-55);
 for(const s of mission.stars){ctx.save();ctx.translate(s.x,s.y);ctx.rotate(Math.sin(time*1.5+s.x)*.12);ctx.shadowColor='#ffcc55';ctx.shadowBlur=16;ctx.fillStyle='#ffe18a';ctx.strokeStyle='#fff4c6';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?8:18;i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}ctx.restore();
}

function setupSharedRiver(){
 try{
  cloud=window.createSharedRiver({onStatus:text=>{$('cloudState').textContent=text;},onRows:rows=>{
   const keep=new Set();
   for(const row of rows){
    if(project.krathongs.some(k=>k.cloudId===row.id))continue;
    if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(row.image)||row.image.length>300000||![row.x,row.y,row.angle].every(Number.isFinite))continue;
    const id='shared-'+row.id;keep.add(id);
    const previous=remoteBoats.get(id);if(previous?.revision===row.updated_at&&sprites.has(id))continue;
    let playback;try{playback=LoyMotion.validate(row.playback);}catch{continue;}
    const remote={id,remote:true,name:row.name,image:row.image,x:row.x,y:row.y,angle:row.angle,speed:Math.max(1,Math.min(2000,Number(row.speed)||95)),released:Boolean(row.released),blocks:row.blocks||{},playback,revision:row.updated_at,catchup:Math.min(60,Math.max(0,(Date.now()-Date.parse(row.updated_at))/1000))||0};
    remoteBoats.set(id,remote);runners.delete(id);if(playback&&!playback.done)runners.set(id,playback);
    if(project.selectedId===id){loading=true;try{workspace.clear();Blockly.serialization.workspaces.load(remote.blocks,workspace);}catch{workspace.clear();}finally{loading=false;}}
    if(previous?.image!==row.image||!sprites.has(id))sprites.set(id,imageFrom(row.image));
   }
   for(const id of remoteBoats.keys())if(!keep.has(id)){remoteBoats.delete(id);sprites.delete(id);runners.delete(id);}
   if(project.selectedId?.startsWith('shared-')&&!remoteBoats.has(project.selectedId))select(null);
   refreshItems();
  }});
  if(cloud.enabled){$('float').textContent='Float · แชร์ลงแม่น้ำ';$('float').title='รันโค้ดจนจบแล้วลอยต่อ พร้อมแชร์โค้ดให้ทุกคนดู';}cloud.start();
 }catch(err){$('cloudState').textContent='ตั้งค่าออนไลน์ไม่สำเร็จ';message(err.message);}
}
function updateRemotePoses(dt){
 for(const k of remoteBoats.values()){
  // Bounded catch-up from the server checkpoint, without replaying the whole program.
  let elapsed=dt+Math.min(k.catchup,2);k.catchup=Math.max(0,k.catchup-2);
  for(let i=0;i<45&&elapsed>0;i++){
   const step=Math.min(.05,elapsed);elapsed-=step;
   try{const drift=advance(k,step);if(k.released)k.x+=17*drift;wrap(k);}catch{runners.delete(k.id);k.released=false;break;}
  }
 }
}
async function init(){try{setupBlockly();let raw;try{raw=localStorage.getItem(KEY);if(raw)project=validate(JSON.parse(raw),true);}catch(e){message('อ่านข้อมูลเดิมไม่ได้ เริ่มโปรเจกต์ใหม่ได้ หรือ Import ไฟล์สำรอง');}await loadDrawing(project.drawingBase||project.drawing,project.texts);for(const k of project.krathongs){sprites.set(k.id,imageFrom(k.image));capture(k);if(k.playback&&!k.playback.done)runners.set(k.id,k.playback);}const id=project.selectedId;project.selectedId=null;select(id);setupSharedRiver();setupMission();raf=requestAnimationFrame(frame);}catch(e){message(e.message);}}
init();
})();
