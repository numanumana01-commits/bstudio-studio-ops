
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {apply, scope, payroll, tier, safeLink, dayOf} from '../public/domain.mjs';
import {sample} from '../public/seed.mjs';
import {endpoint} from '../server.mjs';
const now=new Date('2026-11-19T05:00:00Z'), period='2026-11', today='2026-11-19';
const studio=()=>sample(now);
const serial=(state,id,action,data,when=now)=>apply(state,id,action,data,when);
function memoryDb(){
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync(new URL('../drizzle/0001_initial.sql',import.meta.url),'utf8'));
 return {prepare(sql){
  const stmt=db.prepare(sql);
  return {all:async()=>({results:stmt.all()}),bind:(...args)=>()=>({meta:stmt.run(...args)})};
 },async batch(actions){db.exec('BEGIN');try{const ret=actions.map(fn=>fn());db.exec('COMMIT');return ret;}catch(e){db.exec('ROLLBACK');throw e;}}};
}
function api(env,path,id,email,payload,origin='https://bstudio.example'){
 const h=new Headers();
 if(id)h.set('oai-authenticated-user-id',id);
 if(email)h.set('oai-authenticated-user-email',email);
 if(payload){h.set('content-type','application/json');h.set('origin',origin);}
 return endpoint(new Request('https://bstudio.example/api/'+path,{headers:h,method:payload?'POST':'GET',body:payload?JSON.stringify(payload):undefined}),env);
}
test('Data B hanya terlihat oleh B dan pihak yang berizin',()=>{
 const s=studio(), a=scope(s,'ari',period,today), b=scope(s,'dita',period,today);
 assert.ok(a.tasks.every(t=>t.pic==='ari'));assert.ok(b.tasks.every(t=>t.pic==='dita'));
 assert.deepEqual(a.payroll.map(p=>p.employeeId),['ari']);assert.equal(a.cash.length,0);
 assert.ok(!Object.hasOwn(a.projects[0],'notes'));
 assert.throws(()=>serial(s,'ari','task.issue',{id:'wg20',note:'Kendala'}),{status:403});
});
test('Viewer terbatas ke proyek yang diizinkan dan kolom tracker',()=>{
 const s=studio(), v=scope(s,'viewer',period,today);
 assert.deepEqual(v.projects.map(p=>p.id),['wantugo']);
 assert.ok(v.tasks.every(t=>t.projectId==='wantugo'));
 assert.deepEqual(Object.keys(v.tasks[0]),['id','projectId','title','status','deadline']);
 assert.deepEqual([v.rules,v.cash,v.payroll,v.people,v.attendance],[[],[],[],[],[]]);
 assert.throws(()=>serial(s,'viewer','task.issue',{id:'wg10',note:'Kendala'}),{status:403});
});
test('Akses produksi, payroll dan keuangan terpisah',()=>{
 const s=studio(), prod=scope(s,'sari',period,today), pay=scope(s,'rini',period,today), fin=scope(s,'adit',period,today);
 assert.ok(prod.tasks.length>0);assert.equal(prod.payroll.length,0);assert.equal(prod.cash.length,0);
 assert.ok(pay.payroll.length>0);assert.equal(pay.tasks.length,0);assert.equal(pay.cash.length,0);
 assert.ok(fin.cash.length>0);assert.equal(fin.payroll.length,0);assert.equal(fin.tasks.length,0);
 assert.throws(()=>serial(s,'sari','rule.save',{}),{status:403});
 assert.throws(()=>serial(s,'rini','cash.save',{}),{status:403});
 assert.throws(()=>serial(s,'adit','member.save',{}),{status:403});
});
test('Preview revisi, QC, dan submit ganda dicegah',()=>{
 const s=studio(), before=payroll(s,'ari',period,today).points;
 serial(s,'ari','task.submit',{id:'wg10',link:'https://frame.io/',note:'v002'});
 assert.throws(()=>serial(s,'ari','task.submit',{id:'wg10',link:'https://frame.io/'}));
 const t=s.tasks.find(t=>t.id==='wg10'), first=t.submissions.at(-1).id;
 serial(s,'sari','task.review',{id:t.id,submission:first,result:'revise',note:'Edge'});
 serial(s,'ari','task.submit',{id:t.id,link:'https://frame.io/',note:'v003'});
 assert.throws(()=>serial(s,'sari','task.review',{id:t.id,submission:first,result:'approve'}));
 const latest=t.submissions.at(-1).id;
 serial(s,'sari','task.review',{id:t.id,submission:latest,result:'approve'});
 assert.equal(payroll(s,'ari',period,today).points,before+1);
 assert.throws(()=>serial(s,'sari','task.review',{id:t.id,submission:latest,result:'approve'}));
});
test('Konten dan wedding tidak menambah poin VFX',()=>{
 const s=studio(), before=payroll(s,'raka',period,today).points;
 serial(s,'sari','task.review',{id:'recap',submission:'prev-001',result:'approve'});
 assert.equal(payroll(s,'raka',period,today).points,before);
});
test('Ambang KPI tepat pada 49, 50, 99, dan 100',()=>{
 const [rule]=studio().rules;
 assert.deepEqual([0,49,50,99,100,101].map(v=>tier(v,rule)),[0,0,500000,500000,1000000,1000000]);
 assert.deepEqual([59,60,119,120].map(v=>tier(v,{...rule,target:120})),[0,500000,500000,1000000]);
});
test('Aturan baru berlaku per bulan dan slip yang final tetap utuh',()=>{
 const s=studio(), old=structuredClone(payroll(s,'ari','2026-10',today));
 serial(s,'rini','rule.save',{key:'vfx',name:'KPI produksi',metric:'vfx',target:120,threshold:50,partial:500000,full:1000000,from:'2026-12'});
 assert.equal(payroll(s,'ari','2026-11',today).bonuses[0].target,100);
 assert.equal(payroll(s,'ari','2026-12',today).bonuses[0].target,120);
 assert.deepEqual(payroll(s,'ari','2026-10',today),old);
 assert.throws(()=>serial(s,'rini','payroll.finalize',{employeeId:'ari',period:'2026-11'}));
});
test('Absensi pakai WIB, clock ganda ditolak, lintas tengah malam ditutup',()=>{
 const s=studio(), a=new Date('2026-11-19T16:54:00Z'),b=new Date('2026-11-19T17:05:00Z');
 serial(s,'ari','attendance.clock',{mode:'in'},a);
 assert.equal(dayOf(a),today);assert.equal(dayOf(b),'2026-11-20');
 assert.throws(()=>serial(s,'ari','attendance.clock',{mode:'in'},a));
 serial(s,'ari','attendance.clock',{mode:'out'},b);assert.equal(s.attendance[0].outAt,b.toISOString());
 assert.equal(s.attendance[0].day,today);
 assert.throws(()=>serial(s,'ari','attendance.clock',{mode:'out'},b));
});
test('Koreksi tertunda mengunci finalisasi; satu hari sakit menggugurkan bonus hadir',()=>{
 const s=studio(), date='2026-10-05';
 serial(s,'dita','attendance.request',{day:date,note:'Sakit'});
 assert.throws(()=>serial(s,'rini','payroll.finalize',{employeeId:'dita',period:'2026-10'}));
 serial(s,'rini','attendance.resolve',{requestId:s.corrections[0].id,status:'Sakit',note:'Dikonfirmasi'});
 serial(s,'rini','payroll.finalize',{employeeId:'dita',period:'2026-10'});
 assert.equal(payroll(s,'dita','2026-10',today).attendance,0);
 assert.equal(payroll(s,'dita','2026-10',today).final,true);
 assert.throws(()=>serial(s,'rini','attendance.resolve',{employeeId:'dita',day:date,status:'Izin',note:'Ulang'}));
});
test('Bonus penuh hadir dan salat hanya ketika semua hari kerja memenuhi syarat',()=>{
 const s=studio(), person=s.people.find(p=>p.id==='dita');
 person.workdays=[1];
 for(const day of ['2026-10-05','2026-10-12','2026-10-19','2026-10-26']){
  s.attendance.push({person:person.id,day,status:'Hadir',inAt:day+'T02:00:00Z',outAt:day+'T10:00:00Z'});
  s.prayers.push({person:person.id,day,mode:'Sendiri (halangan)'});
 }
 assert.deepEqual([payroll(s,person.id,'2026-10',today).attendance,payroll(s,person.id,'2026-10',today).prayer],[250000,250000]);
 s.attendance[0].status='Cuti';
 assert.equal(payroll(s,person.id,'2026-10',today).attendance,0);
});
test('Input aman: link berbahaya, tanggal mustahil dan nominal pecahan ditolak',()=>{
 const s=studio();
 assert.equal(safeLink('javascript:alert(1)'),'');assert.equal(safeLink('https://name:secret@example.com/'),'');
 const txn={title:'Bayar',type:'in',status:'open',date:'2026-11-19',category:'Pembayaran klien',amount:10};
 assert.throws(()=>serial(s,'adit','cash.save',{...txn,amount:5.5}));
 assert.throws(()=>serial(s,'adit','cash.save',{...txn,date:'2026-02-30'}));
 assert.throws(()=>serial(s,'adit','cash.save',{...txn,link:'http://example.com'}));
 serial(s,'adit','cash.save',{...txn,notes:'Tagihan'});
 assert.equal(s.cash.at(-1).status,'open');
});
test('API meminta identitas, membatasi akses, menolak origin lain, dan tidak cache data',async()=>{
 const env={DB:memoryDb(),OWNER_EMAIL:'owner@example.com'};
 assert.equal((await api(env,'state')).status,401);
 assert.equal((await api(env,'state','x','outsider@example.com')).status,403);
 const owner=await api(env,'state','root','owner@example.com');assert.equal(owner.status,200);assert.equal(owner.headers.get('cache-control'),'no-store');
 const invite={action:'member.save',data:{name:'A',email:'a@example.com',role:'employee',salary:4000000}};
 assert.equal((await api(env,'action','root','owner@example.com',invite,'https://other.example')).status,403);
 assert.equal((await api(env,'action','root','owner@example.com',invite)).status,200);
 const employee=await api(env,'state','a','a@example.com');
 assert.equal((await employee.json()).actor.role,'employee');
 assert.equal((await api(env,'state','wrong-account','a@example.com')).status,403);
 assert.equal((await api(env,'action','a','a@example.com',invite)).status,403);
});
test('Dua perubahan simultan tersimpan tanpa saling menimpa',async()=>{
 const env={DB:memoryDb(),OWNER_EMAIL:'owner@example.com'};
 await api(env,'state','root','owner@example.com');
 const write=name=>api(env,'action','root','owner@example.com',{action:'project.save',data:{name,type:'VFX'}});
 const result=await Promise.all([write('Proyek A'),write('Proyek B')]);
 assert.deepEqual(result.map(r=>r.status),[200,200]);
 const response=await api(env,'state','root','owner@example.com');
 assert.deepEqual((await response.json()).projects.map(p=>p.name).sort(),['Proyek A','Proyek B']);
});


test('Workspace membatasi proyek, biaya, peran, dan gaji untuk satu akun',async()=>{
 const env={DB:memoryDb(),OWNER_EMAIL:'owner@example.com'};
 const owner=(id,action,data)=>api(env,'action?workspace='+id,'root','owner@example.com',{action,data});
 const staff=(id,payload)=>api(env,(payload?'action':'state')+'?workspace='+id,'staff','a@example.com',payload);
 const b='bstudio',m='matte-magic',o='omera-cinema';
 const add=(role,salary)=>({name:'Ari',email:'a@example.com',role,salary});
 assert.equal((await owner(b,'member.save',add('employee',4000000))).status,200);
 assert.equal((await owner(m,'member.save',add('employee',3200000))).status,200);
 assert.equal((await staff(o)).status,403);
 assert.equal((await staff(o,{action:'attendance.clock',data:{mode:'in'}})).status,403);
 const role=await (await staff(b)).json();
 assert.deepEqual(role.workspaces.map(a=>a.id),[b,m]);
 assert.equal(role.payroll[0].base,4000000);
 assert.deepEqual(role.ownerFinance,[]);
 assert.equal((await (await staff(m)).json()).payroll[0].base,3200000);
 assert.equal((await staff(b,{action:'attendance.clock',data:{mode:'in'}})).status,200);
 assert.equal((await (await staff(m)).json()).attendance.length,0);
 const project={name:'Kampanye Motion',type:'Motion'};
 assert.equal((await owner(b,'project.save',project)).status,400);
 const created=await (await owner(m,'project.save',project)).json();
 assert.equal(created.projects[0].name,'Kampanye Motion');
 assert.equal((await (await api(env,'state?workspace='+b,'root','owner@example.com')).json()).projects.length,0);
 const txn={title:'DP',date:dayOf(new Date()),amount:50000,type:'in',status:'paid',category:'Pembayaran klien',projectId:created.projects[0].id};
 assert.equal((await owner(b,'cash.save',txn)).status,404);
 assert.equal((await owner(m,'cash.save',txn)).status,200);
 const all=await (await api(env,'state?workspace='+b,'root','owner@example.com')).json();
 assert.deepEqual(all.ownerFinance.map(a=>a.incoming),[0,50000,0,0]);
 assert.deepEqual(all.cash,[]);
 assert.equal((await owner(o,'member.save',add('finance'))).status,200);
 const finance=await (await staff(o)).json();
 assert.equal(finance.actor.role,'finance');
 assert.deepEqual(finance.ownerFinance,[]);
 assert.deepEqual(finance.payroll,[]);
});

test('Migrasi snapshot menjaga data lama di Bstudio dan membuat workspace baru kosong',async()=>{
 const DB=memoryDb(),env={DB,OWNER_EMAIL:'owner@example.com'};
 const initial=studio();
 await DB.batch([
  DB.prepare('insert into studio_state(id,version) values(1,?)').bind('legacy'),
  DB.prepare('insert into studio_chunk(version,part,data) values(?,?,?)').bind('legacy',0,JSON.stringify(initial))
 ]);
 const b=await (await api(env,'state?workspace=bstudio','old-owner','owner@example.com')).json();
 const m=await (await api(env,'state?workspace=matte-magic','old-owner','owner@example.com')).json();
 assert.deepEqual(b.projects,initial.projects);
 assert.deepEqual(b.cash,initial.cash);
 assert.deepEqual(m.projects,[]);
 assert.deepEqual(m.payroll,[]);
 assert.deepEqual(m.workspaces.map(a=>a.id),['bstudio','matte-magic','omera-cinema','magic-post']);
 const old=await (await api(env,'state?workspace=bstudio&period=2026-10','old-owner','owner@example.com')).json();
 assert.deepEqual(old.payroll.find(p=>p.employeeId==='ari'),initial.slips[0]);
});

test('Magic Post dibuat saat membuka snapshot empat workspace yang belum lengkap dan kontennya terisolasi',async()=>{
 const DB=memoryDb(),env={DB,OWNER_EMAIL:'owner@example.com'};
 const original=studio();
 await DB.batch([
  DB.prepare('insert into studio_state(id,version) values(1,?)').bind('three-workspaces'),
  DB.prepare('insert into studio_chunk(version,part,data) values(?,?,?)').bind('three-workspaces',0,JSON.stringify({entities:{bstudio:original,'matte-magic':original,'omera-cinema':original}}))
 ]);
 const owner=(workspace,action,data)=>api(env,'action?workspace='+workspace,'root','owner@example.com',{action,data});
 const seed={title:'Reels studio',channel:'Instagram',format:'Reels',priority:'Normal',stage:'Produksi',checklist:'Edit\nQC',checked:['Edit','Other']};
 assert.equal((await owner('bstudio','content.save',seed)).status,403);
 assert.equal((await owner('magic-post','content.save',{...seed,stage:'Terjadwal'})).status,400);
 const state=await (await owner('magic-post','member.save',{name:'Editor',email:'editor@example.com',role:'employee',salary:0})).json();
 const assignee=state.people.find(p=>p.email==='editor@example.com').id;
 const created=await (await owner('magic-post','content.save',{...seed,assignee})).json();
 const [item]=created.content;
 assert.deepEqual(item.checked,['Edit']);
 const staff=(data)=>api(env,'action?workspace=magic-post','staff','editor@example.com',{action:'content.save',data});
 assert.equal((await staff({id:item.id,stage:'Disetujui'})).status,400);
 const updated=await (await staff({id:item.id,title:'Override',stage:'Review',draft:'https://review.example/video',checked:['Edit','QC']})).json();
 assert.equal(updated.content[0].title,seed.title);
 assert.equal(updated.content[0].stage,'Review');
 assert.deepEqual(updated.content[0].checked,['Edit','QC']);
 const b=await (await api(env,'state?workspace=bstudio','root','owner@example.com')).json();
 assert.deepEqual(b.projects,original.projects);
 assert.deepEqual(b.content,[]);
});

test('Omera menyimpan kru, jobdesk, dan jadwal per proyek saat proyek diedit',async()=>{
 const env={DB:memoryDb(),OWNER_EMAIL:'owner@example.com'};
 const send=(workspace,action,data)=>api(env,'action?workspace='+workspace,'root','owner@example.com',{action,data});
 const project={name:'Wedding R & A',type:'Wedding',event:{stage:'Persiapan',shoot:'2026-12-12',location:'Bandung'}};
 const created=await (await send('omera-cinema','project.save',project)).json();
 const [{id:projectId}]=created.projects;
 const member={projectId,name:'Rini',position:'Photographer',duties:'Foto akad dan keluarga'};
 assert.equal((await send('matte-magic','crew.save',member)).status,403);
 const roster=await (await send('omera-cinema','crew.save',member)).json();
 const [{id}]=roster.projects[0].crew;
 const edited=await (await send('omera-cinema','project.save',{...project,id:projectId,event:{...project.event,stage:'Shoot'}})).json();
 assert.equal(edited.projects[0].event.stage,'Shoot');
 assert.equal(edited.projects[0].crew[0].duties,member.duties);
 const removed=await (await send('omera-cinema','crew.remove',{id,projectId})).json();
 assert.deepEqual(removed.projects[0].crew,[]);
});
