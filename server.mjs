
import { AppError,apply,dayOf,requestedPeriod } from './public/domain.mjs';
import { workspaceState,memberships,selectWorkspace,workspaceView,assertWorkspaceProjectType } from './public/workspaces.mjs';
export const protectedHeaders={
 'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com",
 'referrer-policy':'no-referrer','x-content-type-options':'nosniff','permissions-policy':'camera=(), microphone=(), geolocation=()','cache-control':'no-store'
};
const json=(value,status=200)=>Response.json(value,{status,headers:protectedHeaders});
async function getState(db){
 const result=await db.prepare('select s.version, c.data from studio_state s join studio_chunk c on c.version=s.version where s.id=1 order by c.part').all();
 if(!result.results.length)return null;
 return {version:result.results[0].version,state:JSON.parse(result.results.map(r=>r.data).join(''))};
}
async function commit(db,previous,state){
 const version=crypto.randomUUID(), raw=JSON.stringify(state);
 if(raw.length>3000000)throw new AppError('Kapasitas pilot tercapai. Hubungi owner untuk migrasi data.',507);
 const head=previous?db.prepare('update studio_state set version=? where id=1 and version=?').bind(version,previous):db.prepare('insert or ignore into studio_state(id,version) values(1,?)').bind(version);
 const commands=[head];
 for(let i=0;i<raw.length;i+=120000){
  commands.push(db.prepare('insert into studio_chunk(version,part,data) select ?,?,? where exists (select 1 from studio_state where id=1 and version=?)').bind(version,i/120000,raw.slice(i,i+120000),version));
 }
 commands.push(db.prepare('delete from studio_chunk where version != ? and exists (select 1 from studio_state where id=1 and version=?)').bind(version,version));
 const result=await db.batch(commands);
 return result[0].meta.changes===1;
}
async function boundedJson(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError('Format permintaan tidak didukung.',415);
 const reader=request.body?.getReader();
 if(!reader)throw new AppError('Data permintaan kosong.');
 let count=0, body='';const decoder=new TextDecoder();
 for(;;){const {value,done}=await reader.read();if(done)break;count+=value.byteLength;
  if(count>16000){await reader.cancel();throw new AppError('Ukuran permintaan terlalu besar.',413);}
  body+=decoder.decode(value,{stream:true});}
 try{return JSON.parse(body+decoder.decode());}catch{throw new AppError('Data permintaan tidak valid.');}
}
export async function endpoint(request,env){
 const url=new URL(request.url);
 try{
  if(!['/api/config','/api/state','/api/action'].includes(url.pathname))return json({error:'Halaman tidak ditemukan.'},404);
  if(url.pathname==='/api/config'&&request.method==='GET')return json({mode:env.OWNER_EMAIL?'workspace':'demo'});
  if(!env.OWNER_EMAIL)return json({error:'Preview menggunakan data contoh.'},403);
  if(!env.DB)return json({error:'Penyimpanan belum tersedia.'},503);
  const identity=request.headers.get('oai-authenticated-user-id');
  const email=request.headers.get('oai-authenticated-user-email')?.toLowerCase().trim();
  if(!identity||!email)return json({error:'Masuk untuk membuka ruang kerja.'},401);
  const now=new Date(), today=dayOf(now), period=requestedPeriod(url.searchParams.get('period'),today);
  let command=null;
  if(url.pathname==='/api/action'&&request.method==='POST'){
   if(request.headers.get('origin')!==url.origin)return json({error:'Asal permintaan tidak valid.'},403);
   command=await boundedJson(request);
   if(!command||typeof command.action!=='string'||!command.data||typeof command.data!=='object'||Array.isArray(command.data))throw new AppError('Format aksi tidak valid.');
  }else if(url.pathname!=='/api/state'||request.method!=='GET')return json({error:'Metode tidak diizinkan.'},405);
  for(let attempt=0;attempt<4;attempt++){
   const snapshot=await getState(env.DB);
   const state=workspaceState(snapshot?.state,'workspace-owner',env.OWNER_EMAIL.toLowerCase().trim());
   const access=memberships(state,people=>people.find(p=>p.active&&p.boundIdentity===identity)??people.find(p=>p.active&&!p.boundIdentity&&p.email===email));
   const current=selectWorkspace(access,url.searchParams.get('workspace'));
   const member=current.member, bind=!member.boundIdentity;
   if(bind)member.boundIdentity=identity;
   if(command){
    assertWorkspaceProjectType(current,command.action,command.data);
    apply(current.store,member.id,command.action,command.data,now);
   }
   if(command||bind){if(!await commit(env.DB,snapshot?.version,state))continue;}
   return json(workspaceView(access,current,period,today));
  }
  return json({error:'Data sedang berubah. Coba lagi.'},409);
 }catch(error){
  if(error instanceof AppError)return json({error:error.message},error.status);
  console.error('Bstudio request failed',error?.name??'Error');
  return json({error:'Terjadi gangguan saat memuat data. Coba lagi.'},503);
 }
}
