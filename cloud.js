'use strict';
// Optional shared gallery. Drawing and Blockly programs stay on this device.
window.createSharedRiver = function ({onRows, onStatus}) {
 const config=window.LOY_CLOUD||{};
 const enabled=Boolean(config.url&&config.publicKey);
 let client, timer, busy=false, stopped=false, authPromise;
 const room=config.room||'loy-main';
 const pending=new Map();
 const removing=new Set(), sent=new Map();
 if(enabled){
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url))throw Error('Supabase URL ไม่ถูกต้อง');
  if(config.publicKey.startsWith('sb_secret_'))throw Error('ใช้ publishable key เท่านั้น ห้ามใช้ secret key');
  if(config.publicKey.startsWith('eyJ')){
   try{const role=JSON.parse(atob(config.publicKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role;if(role!=='anon')throw Error();}
   catch{throw Error('ต้องใช้ Supabase anon key หรือ publishable key');}
  }
  client=supabase.createClient(config.url,config.publicKey,{auth:{storageKey:'loy-auth-'+new URL(config.url).hostname,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 }
 function report(text){onStatus(text);}
 async function identity(){
  if(!enabled)throw Error('ยังไม่ได้ตั้งค่าแม่น้ำออนไลน์');
  if(!authPromise)authPromise=(async()=>{
   const {data,error}=await client.auth.getSession();if(error)throw error;
   if(data.session)return data.session.user;
   const result=await client.auth.signInAnonymously();if(result.error)throw result.error;
   return result.data.user;
  })().finally(()=>{authPromise=null;});
  return authPromise;
 }
 function fields(k){return {name:k.name,image:k.image,x:k.x,y:k.y,angle:k.angle,released:Boolean(k.released)};}
 async function poll(){
  if(busy||stopped||document.hidden||!enabled)return;
  busy=true;
  try{
   // Paged reads avoid silently dropping the river after PostgREST's row limit.
   let rows=[];
   for(let offset=0;offset<2000;offset+=100){
    const {data,error}=await client.from('loy_krathongs').select('id,name,image,x,y,angle,released,updated_at').eq('room',room).order('created_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+99);
    if(error)throw error;rows.push(...data);if(data.length<100)break;
   }
   onRows(rows);report('แม่น้ำร่วมกัน · '+rows.length+' กระทง');
  }catch(error){report('เชื่อมต่อแม่น้ำไม่ได้ · งานในเครื่องยังใช้งานได้');}
  finally{busy=false;}
 }
 async function publish(k){
  const user=await identity();
  const id=k.cloudId||crypto.randomUUID();
  const row={id,owner_id:user.id,room,...fields(k)};
  const {data,error}=await client.from('loy_krathongs').upsert(row).select('id').single();
  if(error)throw error;
  sent.set(id,JSON.stringify(fields(row)));
  poll();return data.id;
 }
 async function update(k){
  if(!enabled||!k.cloudId||pending.has(k.cloudId)||removing.has(k.cloudId))return;
  const id=k.cloudId;
  const snapshot=fields(k), signature=JSON.stringify(snapshot);
  if(sent.get(id)===signature)return;
  const job=(async()=>{
   const {data,error}=await client.from('loy_krathongs').update(snapshot).eq('id',id).eq('room',room).select('id');
   if(error||!data?.length){report('อัปเดตกระทงออนไลน์ไม่ได้ · กด Float เพื่อลองใหม่');return;}
   sent.set(id,signature);
  })().catch(()=>report('ออฟไลน์ · ยังบันทึกในเครื่อง')).finally(()=>pending.delete(id));
  pending.set(id,job);await job;
 }
 async function remove(id){
  removing.add(id);
  try{
  if(pending.has(id))await pending.get(id);
  await identity();
  const {data,error}=await client.from('loy_krathongs').delete().eq('id',id).eq('room',room).select('id');
  if(error)throw error;if(!data.length)throw Error('ลบไม่ได้: ต้องใช้เบราว์เซอร์ที่เป็นเจ้าของกระทง');
  sent.delete(id);
  poll();
  }finally{removing.delete(id);}
 }
 function start(){stopped=false;if(!enabled){report('โหมดในเครื่อง · ยังไม่เชื่อมแม่น้ำร่วมกัน');return;}poll();clearInterval(timer);timer=setInterval(poll,5000);}
 function stop(){stopped=true;clearInterval(timer);}
 return {enabled,start,stop,publish,update,remove,refresh:poll};
};
