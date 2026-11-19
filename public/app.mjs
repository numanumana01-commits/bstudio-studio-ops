
import {apply,scope,dayOf,money,safeLink,statuses,types,roles} from './domain.mjs';
import {sample} from './seed.mjs';
const root=document.querySelector('#app'), modal=document.querySelector('#dialog'), notice=document.querySelector('#notice');
const labels={owner:'Owner',production:'Admin Produksi',payroll:'Admin Payroll',finance:'Admin Keuangan',employee:'Karyawan',viewer:'Viewer'};
const allNav={today:'Hari Ini',tasks:'Tugas Saya',clock:'Absensi',salary:'Gaji',projects:'Proyek',review:'Antrean Review',attendance:'Absensi',payroll:'Payroll',finance:'Keuangan',kpi:'Pengaturan KPI',team:'Akses Tim'};
const navFor={owner:['projects','review','attendance','payroll','finance','kpi','team'],production:['projects','review'],payroll:['attendance','payroll','kpi'],finance:['finance'],employee:['today','tasks','clock','salary'],viewer:['projects']};
const metricNames={vfx:'Poin VFX lolos QC','on-time':'Jumlah tugas lolos QC tepat waktu',completed:'Jumlah tugas lolos QC'};
let state,mode,db,demoUser='numan',period=dayOf(new Date()).slice(0,7),busy=false,toastTimer,drawSerial=0;
let selectedProject='',selectedReview='',projectTab='tasks',searchText='',taskStatus='',taskType='',taskPic='',cashProject='',cashCategory='',cashStatus='',showArchived=false,selectedRule='';
const dateLabel=date=>date?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',timeZone:'Asia/Jakarta'}).format(new Date(date.length===10?date+'T12:00:00+07:00':date)):'–';
const timeLabel=date=>date?new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}).format(new Date(date)):'–';
const monthLabel=value=>new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(value+'-01T12:00:00+07:00'));
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const absent=(label)=>'<p class="empty">'+e(label)+'</p>';
const brand='<span class="brand"><span class="mark" aria-hidden="true">B</span>Bstudio</span>';
const btn=(label,action,id='',primary=false)=>'<button type="button" class="'+(primary?'primary':'')+'" data-action="'+e(action)+'" data-id="'+e(id)+'">'+e(label)+'</button>';
const jump=(label,route,primary=false)=>'<a class="button '+(primary?'primary':'')+'" href="#'+e(route)+'">'+e(label)+'</a>';
const external=(url,label)=>safeLink(url)?'<a href="'+e(safeLink(url))+'" target="_blank" rel="noopener noreferrer">'+e(label)+'</a>':'';
const status=value=>'<span class="pill '+({'Siap Review':'blue','Revisi':'amber','Menunggu Materi':'red','Lolos QC':'green','Terkirim':'green','Hadir':'green','Menunggu':'amber','Ditolak':'red','Disetujui':'green','Dibayar':'green','Diterima':'green','Belum dibayar':'amber','Final':'green'})[value]+'">'+e(value)+'</span>';
const title=(headline,sub='',action='')=>'<header class="page-head"><div><h1>'+e(headline)+'</h1>'+(sub?'<p>'+e(sub)+'</p>':'')+'</div>'+action+'</header>';
const card=(body,extra='')=>'<section class="panel '+extra+'">'+body+'</section>';
const metric=(name,value,hint='')=>'<article class="metric"><small>'+e(name)+'</small><strong>'+e(value)+'</strong>'+(hint?'<small>'+e(hint)+'</small>':'')+'</article>';
const table=(heads,rows)=>rows.length?'<div class="table-wrap" tabindex="0" role="region" aria-label="Tabel data"><table><thead><tr>'+heads.map(h=>'<th scope="col">'+e(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':absent('Belum ada data untuk pilihan ini.');
const option=(value,name,selected)=>'<option value="'+e(value)+'"'+(String(value)===String(selected)?' selected':'')+'>'+e(name)+'</option>';
const select=(label,name,options,value,extra='')=>'<label>'+e(label)+'<select name="'+e(name)+'" '+extra+'>'+options.map(([v,t])=>option(v,t,value)).join('')+'</select></label>';
const input=(label,name,value='',type='text',opts='')=>'<label>'+e(label)+'<input type="'+type+'" name="'+e(name)+'" value="'+e(value)+'" '+opts+'></label>';
const textarea=(label,name,value='',opts='')=>'<label class="wide">'+e(label)+'<textarea name="'+e(name)+'" '+opts+'>'+e(value)+'</textarea></label>';
const check=(label,name,on=false,value='1')=>'<label class="inline-check"><input type="checkbox" name="'+e(name)+'" value="'+e(value)+'"'+(on?' checked':'')+'>'+e(label)+'</label>';
const projectName=id=>state.projects.find(p=>p.id===id)?.name??'Operasional';
const personName=id=>state.people.find(p=>p.id===id)?.name??'–';
const taskName=t=>[t.code,t.title].filter(Boolean).join(' / ');
const role=()=>state.actor.role;
const producer=()=>['owner','production'].includes(role());
const projectOptions=()=>state.projects.map(p=>[p.id,p.name]);
const periodField=()=>input('Periode','period',period,'month','data-filter="period"');
const route=()=>location.hash.slice(1).split('/').map(v=>{try{return decodeURIComponent(v)}catch{return ''}});
const home=()=>navFor[role()][0];
function tell(msg){notice.textContent=msg;clearTimeout(toastTimer);toastTimer=setTimeout(()=>notice.textContent='',5500);}
async function remote(path,init){
 const response=await fetch(path,init);const value=await response.json();
 if(!response.ok)throw Object.assign(new Error(value.error||'Permintaan gagal.'),{status:response.status});
 return value;
}
const calculate=()=>scope(db,demoUser,period,dayOf(new Date()));
async function refresh(forceFocus=false){
 const serial=++drawSerial;
 try{
  const next=mode==='demo'?calculate():await remote('/api/state?period='+encodeURIComponent(period));
  if(serial!==drawSerial)return;state=next;render(forceFocus);
 }catch(err){if(serial===drawSerial)failure(err);}
}
function failure(error){
 root.innerHTML='<main id="content" tabindex="-1" class="stack">'+brand+title('Akses ruang kerja',error.message)+(error.status===401?'<a class="button primary" href="/signin-with-chatgpt?return_to=%2F" target="_top">Masuk dengan ChatGPT</a>':btn('Coba lagi','retry'))+'</main>';
}
async function mutate(action,data){
 if(busy)return;busy=true;
 const submit=modal.querySelector('[type=submit]');
 if(submit)submit.disabled=true;
 try{
  if(mode==='demo'){
   const draft=structuredClone(db);
   apply(draft,demoUser,action,data);
   db=draft;
   try{sessionStorage.setItem('bstudio-demo-v1',JSON.stringify(db));}catch{}
   state=calculate();
  }else state=await remote('/api/action?period='+encodeURIComponent(period),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,data})});
  if(modal.open)modal.close();
  render();tell('Perubahan tersimpan.');
 }catch(err){
  const failure=modal.querySelector('#dialog-error');
  if(modal.open&&failure)failure.textContent=err.message;else tell(err.message);
 }finally{busy=false;if(submit)submit.disabled=false;}
}
function render(focus=false){
 const [screen,id]=route();
 const visible=navFor[role()];
 const key=visible.includes(screen)?screen:home();
 const nav=className=>'<nav class="'+className+'" aria-label="Navigasi utama">'+visible.map(v=>'<a href="#'+v+'"'+(key===v?' aria-current="page"':'')+'>'+e(allNav[v])+'</a>').join('')+'</nav>';
 const views={today:todayView,tasks:()=>id?taskView(id):tasksView(),clock:clockView,salary:salaryView,projects:()=>id==='task'?taskView(route()[2]):projectsView(id),review:reviewView,attendance:attendanceView,payroll:payrollView,finance:financeView,kpi:kpiView,team:teamView};
 const roleSelect=mode==='demo'?'<span class="demo">Preview</span><select aria-label="Ganti akun contoh" data-filter="demoUser">'+db.people.filter(p=>p.active).map(p=>option(p.id,p.name+' / '+labels[p.role],demoUser)).join('')+'</select>':'<span class="role-name">'+e(state.actor.name)+' / '+e(labels[role()])+'</span><a href="/signout-with-chatgpt?return_to=%2F" target="_top">Keluar</a>';
 root.innerHTML='<div class="layout"><aside class="rail">'+brand+nav('rail-nav')+(mode==='demo'?'<div class="foot">Data contoh</div>':'')+'</aside><div><header class="top">'+brand+'<span class="location">'+e(allNav[key])+'</span><div class="user">'+roleSelect+'</div></header><main id="content" tabindex="-1">'+views[key]()+'</main>'+nav('bottom')+'</div></div>';
 if(focus)document.querySelector('#content').focus();
}
function taskCards(tasks,base){
 return tasks.length?'<div class="stack">'+tasks.map(t=>'<a class="panel cardlink" href="#'+base+e(t.id)+'"><div class="row between"><strong>'+e(taskName(t))+'</strong>'+status(t.status)+'</div><small>'+e(projectName(t.projectId))+' · '+e(dateLabel(t.deadline))+(t.points?' · '+e(t.points)+' poin':'')+'</small></a>').join('')+'</div>':absent('Tidak ada tugas.');
}
function attendanceHero(){
 const open=state.attendance.find(a=>a.status==='Hadir'&&a.inAt&&!a.outAt);
 const today=state.attendance.find(a=>a.day===state.today);
 const label=open?'Masuk '+timeLabel(open.inAt)+' WIB':today?today.status==='Hadir'?'Absensi selesai':today.status:'Belum clock in';
 return card('<div class="row between"><div><small>'+e(dateLabel(state.today))+'</small><br><strong>'+e(label)+'</strong></div>'+(open?btn('Clock Out','clock','out',true):today?'':btn('Clock In','clock','in',true))+'</div>','banner');
}
function todayView(){
 const tasks=state.tasks.filter(t=>!['Lolos QC','Terkirim','Siap Review'].includes(t.status)).sort((a,b)=>a.deadline.localeCompare(b.deadline)).slice(0,4);
 return title('Hari Ini','Pekerjaan dan absensi '+state.actor.name)+
 '<div class="stack">'+attendanceHero()+'<div class="row between"><h2>Perlu tindakan</h2>'+jump('Lihat Tugas Saya','tasks')+'</div>'+taskCards(tasks,'tasks/')+'</div>';
}
function filters(tasks){
 return tasks.filter(t=>(!taskStatus||t.status===taskStatus)&&(!taskType||state.projects.find(p=>p.id===t.projectId)?.type===taskType)&&(!taskPic||t.pic===taskPic)&&(!searchText||taskName(t).toLowerCase().includes(searchText.toLowerCase())));
}
function taskFilters(admin=false){
 const statusOptions=[['','Semua status'],...statuses.map(v=>[v,v])];
 return '<div class="bar">'+input('Cari tugas','search',searchText,'search','data-filter="search" placeholder="Judul atau kode shot"')+
 select('Status','status',statusOptions,taskStatus,'data-filter="taskStatus"')+select('Jenis','type',[['','Semua jenis'],...types.map(v=>[v,v])],taskType,'data-filter="taskType"')+
 (admin?select('PIC','pic',[['','Semua PIC'],...state.people.filter(p=>p.role==='employee').map(p=>[p.id,p.name])],taskPic,'data-filter="taskPic"'):'')+'</div>';
}
function tasksView(){return title('Tugas Saya')+taskFilters()+taskCards(filters(state.tasks),'tasks/');}
function taskView(id){
 const t=state.tasks.find(t=>t.id===id);
 if(!t)return title('Tugas tidak ditemukan')+absent('Tugas ini tidak tersedia untuk akunmu.');
 const own=role()==='employee', viewer=role()==='viewer', p=state.projects.find(p=>p.id===t.projectId), last=t.submissions?.at(-1);
 const back=own?'tasks':'projects/'+t.projectId;
 const issues=t.issues??[];
 return '<p class="bar"><a href="#'+e(back)+'">‹ '+(own?'Tugas Saya':e(p?.name??'Proyek'))+'</a></p>'+
 title(taskName(t),projectName(t.projectId),producer()?btn('Edit Tugas','task-form',id):'')+
 '<div class="stack">'+card('<div class="row between">'+status(t.status)+'<strong>Deadline '+e(dateLabel(t.deadline))+'</strong>'+(t.points?'<span>'+e(t.points)+' poin</span>':'')+'</div>')+
 (viewer?'':(t.feedback?card('<h2>Feedback terbaru</h2><p class="notes">'+e(t.feedback)+'</p>','warn'):'')+
 card('<div class="stack"><div><h2>Notes</h2><p class="notes">'+e(t.notes||'Belum ada catatan.')+'</p></div>'+
 (t.checklist?'<div><h2>Checklist</h2>'+t.checklist.split('\n').map(v=>v.trim()).filter(Boolean).map(item=>'<label class="inline-check"><input type="checkbox" '+(producer()?'data-checklist="'+e(t.id)+'" value="'+e(item)+'"':'disabled')+(t.checked?.includes(item)?' checked':'')+'>'+e(item)+'</label><br>').join('')+'</div>':'')+
 '<div class="row">'+external(t.material,'Buka materi')+external(last?.link,'Buka preview terbaru')+'</div></div>')+
 (issues.length?card('<h2>Kendala</h2>'+issues.map(i=>'<div class="activity"><small>'+e(dateLabel(i.time))+'</small><p class="notes">'+e(i.note)+'</p></div>').join('')):'')+
 (own&&!['Lolos QC','Terkirim'].includes(t.status)?'<div class="row">'+(t.status!=='Siap Review'?btn('Kirim Review','submit-form',id,true):'')+btn('Laporkan Kendala','issue-form',id)+'</div>':'')+
 (producer()&&t.status==='Siap Review'?btn('Review Preview','open-review',id,true):''))+'</div>';
}
function projectsView(id){
 const p=state.projects.find(v=>v.id===id);
 if(id&&!p)return title('Proyek tidak ditemukan')+absent('Proyek ini tidak tersedia untuk akunmu.');
 if(!p){
  const projects=state.projects.filter(v=>v.archived===showArchived);
  return title('Proyek','Daftar pekerjaan produksi studio',producer()?btn('+ Buat Proyek','project-form','',true):'')+
   (producer()?'<div class="tabs">'+btn(showArchived?'Lihat proyek aktif':'Lihat arsip','toggle-archives')+'</div>':'')+
   (projects.length?'<div class="metrics">'+projects.map(p=>'<a class="panel cardlink" href="#projects/'+e(p.id)+'"><div class="row between"><strong>'+e(p.name)+'</strong><span class="pill">'+e(p.type)+'</span></div><small>'+state.tasks.filter(t=>t.projectId===p.id).length+' tugas</small></a>').join('')+'</div>':absent('Belum ada proyek.'));
 }
 const list=state.tasks.filter(t=>t.projectId===p.id);
 const tabs=producer()?'<div class="tabs">'+['tasks','activity',...(['owner','finance'].includes(role())?['finance']:[])].map(k=>'<button type="button" data-action="project-tab" data-id="'+k+'"'+(k===projectTab?' aria-current="page"':'')+'>'+({tasks:'Tugas',activity:'Aktivitas',finance:'Keuangan'}[k])+'</button>').join('')+'</div>':'';
 const actions=producer()?'<div class="row">'+btn('Edit Proyek','project-form',p.id)+(!p.archived?btn('+ Buat Tugas','task-new',p.id,true):'')+'</div>':'';
 const header='<p class="bar"><a href="#projects">‹ Semua proyek</a></p>'+title(p.name,p.type+(p.archived?' · Arsip':''),actions)+tabs;
 if(projectTab==='finance'&&role()==='owner')return header+'<div class="bar">'+btn('+ Catat Transaksi','cash-form','',true)+'</div>'+cashContent(p.id);
 if(projectTab==='activity'&&producer())return header+activity(p.id);
 const counts='<div class="metrics">'+metric('Tugas di tracker',list.length)+metric('Siap Review',list.filter(t=>t.status==='Siap Review').length)+metric('Menunggu Materi',list.filter(t=>t.status==='Menunggu Materi').length)+'</div>';
 const tasks=filters(list);
 if(!producer())return header+counts+taskCards(tasks,'projects/task/');
 const result=table(['Shot / judul','PIC','Deadline','Status','Preview','Poin'],tasks.map(t=>
 ['<a href="#projects/task/'+e(t.id)+'">'+e(taskName(t))+'</a>',e(personName(t.pic)),e(dateLabel(t.deadline)),status(t.status),external(t.submissions.at(-1)?.link,'Buka')||'–',e(t.points||'–')]));
 return header+counts+'<div class="grid"><div>'+taskFilters(true)+result+'</div><div class="stack">'+card('<h2>Notes proyek</h2><p class="notes">'+e(p.notes||'Belum ada catatan.')+'</p>'+external(p.material,'Buka materi proyek'))+activity(p.id,4)+'</div></div>';
}
function activity(id,max=100){
 const rows=state.audit.filter(a=>a.projectId===id).slice(0,max);
 return card('<h2>Riwayat perubahan</h2>'+(rows.length?rows.map(a=>'<div class="activity"><small>'+e(dateLabel(a.time))+' · '+e(a.actor)+'</small><p>'+e(a.entry)+'</p></div>').join(''):'<p class="muted">Belum ada aktivitas.</p>'));
}
function reviewView(){
 const queue=state.tasks.filter(t=>t.status==='Siap Review');
 const t=queue.find(t=>t.id===selectedReview)??queue[0];
 if(!t)return title('Antrean Review')+absent('Semua preview sudah ditinjau.');
 const last=t.submissions.at(-1);
 return title('Antrean Review',queue.length+' tugas menunggu review')+
 '<div class="grid"><div class="stack">'+queue.map(q=>'<button type="button" class="cardlink panel '+(q.id===t.id?'banner':'')+'" data-action="select-review" data-id="'+e(q.id)+'"><strong>'+e(taskName(q))+'</strong><br><small>'+e(projectName(q.projectId))+' · '+e(personName(q.pic))+'</small></button>').join('')+'</div>'+
 card('<div class="stack"><div><h2>'+e(taskName(t))+'</h2><small>'+e(projectName(t.projectId))+' · '+e(personName(t.pic))+'</small></div>'+
 external(last.link,'Buka preview')+'<div><h3>Catatan karyawan</h3><p class="notes">'+e(last.note||'Belum ada catatan.')+'</p></div><div class="row">'+btn('Minta Revisi','review-revise',t.id)+btn('Tandai Lolos QC','review-approve',t.id,true)+'</div>'+
 '<small>'+(t.points?'Lolos QC mencatat '+e(t.points)+' poin untuk '+e(personName(t.pic))+'.':'Status hasil review tercatat di tracker.')+'</small></div>')+'</div>';
}
function clockView(){
 const prayer=state.prayers.find(p=>p.day===state.today);
 return title('Absensi','Waktu dicatat dalam WIB')+'<div class="stack">'+attendanceHero()+
 card('<h2>Catatan salat hari ini</h2><p class="muted">'+e(prayer?.mode??'Belum dicatat')+'</p><div class="row">'+btn('Berjamaah','prayer','Berjamaah')+btn('Sendiri (halangan)','prayer','Sendiri (halangan)')+'</div>')+
 '<div class="row between"><h2>Riwayat</h2>'+periodField()+btn('Ajukan Koreksi','correction-form')+'</div>'+
 table(['Tanggal','Masuk','Keluar','Status'],state.attendance.filter(a=>a.day.startsWith(period)).sort((a,b)=>b.day.localeCompare(a.day)).map(a=>[e(dateLabel(a.day)),e(timeLabel(a.inAt)),e(timeLabel(a.outAt)),status(a.status)]))+
 (state.corrections.length?table(['Pengajuan','Notes','Status'],state.corrections.filter(a=>a.day.startsWith(period)).map(c=>[e(dateLabel(c.day)),e(c.note)+(c.answer?'<small>'+e(c.answer)+'</small>':''),status(c.status)])):'')+'</div>';
}
function payrollRows(s){
 return [['Gaji pokok',money(s.base)],...s.bonuses.map(b=>[b.name,money(b.bonus)]),['Bonus kehadiran',s.closed?money(s.attendance):'Menunggu rekap'],['Bonus salat',s.closed?money(s.prayer):'Menunggu rekap']];
}
function salaryView(){
 const s=state.payroll[0];if(!s)return title('Gaji')+absent('Periode tidak tersedia.');
 const b=s.bonuses.find(x=>x.key==='vfx');
 return title('Gaji',s.final?'Slip final':'Estimasi periode',periodField())+'<div class="stack">'+
 (b?card('<span class="big">'+e(b.value)+' / '+e(b.target)+' poin</span><progress aria-label="Poin produksi VFX" max="'+e(b.target)+'" value="'+e(Math.min(b.value,b.target))+'"></progress><p><strong>Bonus KPI '+e(money(b.bonus))+'</strong></p>','banner'):'')+
 table(['Komponen','Nominal'],[...payrollRows(s),[s.final?'Total final':'Total sementara',money(s.total)]].map(([a,b])=>[e(a),e(b)]))+
 '<details class="panel"><summary>Rincian Shot dan Aset</summary>'+table(['Tugas','QC','Poin'],s.details.map(t=>[e(t.title),e(dateLabel(t.date)),e(t.points)]))+'</details></div>';
}
function attendanceView(){
 return title('Absensi Tim','Koreksi dan rekap per periode',btn('+ Catat Koreksi','resolve-form','',true))+'<div class="stack"><div class="bar">'+periodField()+'</div>'+
 '<h2>Pengajuan koreksi</h2>'+table(['Karyawan','Tanggal','Notes','Status','Aksi'],state.corrections.filter(c=>c.day.startsWith(period)).map(c=>[e(personName(c.person)),e(dateLabel(c.day)),e(c.note),status(c.status),c.status==='Menunggu'?btn('Tinjau','resolve-form',c.id):'–']))+
 '<h2>Riwayat absensi</h2>'+table(['Karyawan','Tanggal','Masuk','Keluar','Status'],state.attendance.map(a=>[e(personName(a.person)),e(dateLabel(a.day)),e(timeLabel(a.inAt)),e(timeLabel(a.outAt)),status(a.status)]))+'</div>';
}
function payrollView(){
 return title('Payroll','Gaji pokok, poin VFX, dan bonus','<div class="row">'+periodField()+btn('Ekspor Slip Final','export-payroll')+'</div>')+
 table(['Karyawan','Poin VFX','Total','Status','Aksi'],state.payroll.map(s=>[e(personName(s.employeeId)),e(s.points),e(money(s.total)),s.final?status('Final'):'Draf',btn('Lihat rincian','payroll-form',s.employeeId)]));
}
function cashContent(fixed=''){
 const cash=state.cash.filter(t=>(t.status==='open'?t.date.slice(0,7)<=period:t.date.startsWith(period))&&(!(fixed||cashProject)||t.projectId===(fixed||cashProject))&&(!cashCategory||t.category===cashCategory));
 const sum=(type,status)=>cash.filter(t=>t.type===type&&t.status===status).reduce((v,t)=>v+t.amount,0);
 const incoming=sum('in','paid'),outgoing=sum('out','paid');
 return '<div class="bar">'+periodField()+(fixed?'':select('Proyek','project',[['','Semua proyek'],...projectOptions()],cashProject,'data-filter="cashProject"'))+
 select('Kategori','category',[['','Semua kategori'],...state.categories.map(v=>[v,v])],cashCategory,'data-filter="cashCategory"')+
 select('Status','cashStatus',[['','Semua status'],['paid','Sudah dibayar'],['open','Tagihan terbuka']],cashStatus,'data-filter="cashStatus"')+'</div>'+
 '<div class="metrics">'+metric('Uang masuk',money(incoming))+metric('Uang keluar',money(outgoing))+metric('Arus kas bersih',money(incoming-outgoing))+metric('Tagihan terbuka',money(sum('in','open')))+'</div>'+
 '<div class="stack">'+table(['Tanggal','Uraian','Proyek','Nominal','Status','Notes'],cash.filter(t=>!cashStatus||t.status===cashStatus).sort((a,b)=>b.date.localeCompare(a.date)).map(t=>[
 e(dateLabel(t.status==='open'?(t.due||t.date):t.date)),btn(t.title,'cash-form',t.id),e(projectName(t.projectId)),e(money(t.amount)),status(t.status==='open'?'Belum dibayar':t.type==='in'?'Diterima':'Dibayar'),e(t.notes)+(t.link?'<small>'+external(t.link,'Lihat bukti')+'</small>':'')]))+
 '<div class="row">'+btn('Kelola Kategori','category-form')+btn('Ekspor CSV','export-cash',fixed)+'</div></div>';
}
function financeView(){return title('Keuangan','Transaksi dan tagihan studio',btn('+ Catat Transaksi','cash-form','',true))+cashContent();}
function kpiView(){
 const rule=state.rules.find(r=>r.id===selectedRule)??[...state.rules].sort((a,b)=>b.from.localeCompare(a.from))[0];
 return title('Pengaturan KPI','Aturan disimpan berdasarkan bulan mulai berlaku.',btn('+ Tambah KPI','rule-form','',true))+
 '<div class="grid"><div class="stack">'+table(['KPI','Mulai berlaku','Status'],[...state.rules].sort((a,b)=>b.from.localeCompare(a.from)).map(r=>[btn(r.name,'select-rule',r.id),e(monthLabel(r.from)),e(r.active?'Aktif':'Nonaktif')]))+'</div>'+
 (rule?card('<div class="stack"><h2>'+e(rule.name)+'</h2><small>'+e(metricNames[rule.metric])+'</small><div class="row">'+btn('Ubah aturan','rule-form',rule.id,true)+(rule.active?btn('Jadwalkan nonaktif','rule-disable',rule.id):'')+'</div>'+
 table(['Ambang','Bonus'],[[(Math.ceil(rule.target*rule.threshold/100))+' poin',money(rule.partial)],[rule.target+' poin',money(rule.full)]].map(row=>row.map(e)))+'</div>'):'')+'</div>';
}
function teamView(){
 return title('Akses Tim','Batasi data menurut akun dan peran',btn('+ Tambah Akun','member-form','',true))+
 '<div class="stack">'+card('<div class="row between"><div><h2>Kalender dan bonus</h2><p class="muted">Clock in dari mana saja · Catatan salat '+(state.settings.prayerScope==='calendar'?'per hari kalender':'per hari kerja')+'</p></div>'+btn('Atur kalender','settings-form')+'</div>')+
 table(['Nama','Email','Peran','Status','Aksi'],state.people.map(p=>[e(p.name),e(p.email),e(labels[p.role]),e(p.active?'Aktif':'Nonaktif'),p.role==='owner'?'–':btn('Edit akses','member-form',p.id)]))+'</div>';
}

function form(title,action,fields,convert,submitLabel='Simpan'){
 modal.innerHTML='<header><h2 id="dialog-title">'+e(title)+'</h2><button aria-label="Tutup" type="button" data-action="close">Tutup</button></header><form><div class="fields">'+fields+'</div><p id="dialog-error" role="alert"></p><div class="row"><button type="submit" class="primary">'+e(submitLabel)+'</button><button type="button" data-action="close">Batal</button></div></form>';
 const formEl=modal.querySelector('form');
 formEl.addEventListener('submit',event=>{
  event.preventDefault();const values=new FormData(formEl);
  mutate(action,convert(Object.fromEntries(values),values));
 });
 modal.showModal();
 return formEl;
}
const required='required', maxText='maxlength="1500"', onlyUrl='maxlength="1600" placeholder="https://"';
function projectForm(p){
 form(p?'Edit Proyek':'Buat Proyek','project.save',input('Nama proyek','name',p?.name,'text','required maxlength="120"')+
 select('Jenis','type',types.map(v=>[v,v]),p?.type)+input('Link materi','material',p?.material,'url',onlyUrl)+
 (p?check('Arsipkan proyek','archived',p.archived):'')+textarea('Notes','notes',p?.notes,'maxlength="1000"'),
 v=>({...v,id:p?.id,archived:!!v.archived}));
}
function taskForm(t,projectId){
 const pics=state.people.filter(p=>p.role==='employee'&&(p.active||p.id===t?.pic));
 const projects=state.projects.filter(p=>!p.archived||p.id===t?.projectId);
 const statusesForEdit=t?.credit?[...new Set([t.status,'Terkirim'])]:[...new Set(['Dikerjakan','Menunggu Materi','Revisi',...(t?.status?[t.status]:[])])];
 const el=form(t?'Edit Tugas':'Buat Tugas','task.save',
 input('Judul tugas','title',t?.title,'text','required maxlength="160"')+input('Kode shot','code',t?.code,'text','maxlength="36"')+
 select('Proyek','projectId',projects.map(p=>[p.id,p.name]),t?.projectId??projectId,required)+
 select('PIC','pic',[['','Pilih karyawan'],...pics.map(p=>[p.id,p.name])],t?.pic,required)+
 input('Deadline','deadline',t?.deadline??state.today,'date',required)+select('Status','status',statusesForEdit.map(v=>[v,v]),t?.status)+
 select('Jenis VFX','kind',[['shot','Shot'],['asset','Aset']],t?.kind)+
 select('Bobot aset','points',[[3,'3 poin'],[5,'5 poin'],[10,'10 poin']],t?.points??5)+
 input('Link materi','material',t?.material,'url',onlyUrl)+textarea('Checklist (satu butir per baris)','checklist',t?.checklist??({VFX:'QC Internal\nFrame.io\nDPX',Wedding:'Draft\nRevisi\nFinal Delivery',Konten:'Draft\nReview\nFinal Delivery'}[state.projects.find(p=>p.id===projectId)?.type]??''),'maxlength="1000"')+
 textarea('Notes','notes',t?.notes,maxText),v=>({...v,id:t?.id}));
 const toggle=()=>{
  const isVfx=state.projects.find(p=>p.id===el.elements.projectId.value)?.type==='VFX';
  for(const n of ['kind','points','code'])el.elements[n].closest('label').toggleAttribute('hidden',!isVfx||(n==='points'&&el.elements.kind.value!=='asset'));
  el.elements.code.required=isVfx&&el.elements.kind.value==='shot';
 };
 el.addEventListener('change',toggle);toggle();
}
function correctionForm(id){
 const c=state.corrections.find(c=>c.id===id);
 const el=form(c?'Tinjau Koreksi':'Catat Koreksi','attendance.resolve',
 (c?'<p class="wide"><strong>'+e(personName(c.person))+' · '+e(dateLabel(c.day))+'</strong><br>'+e(c.note)+'</p>':
 select('Karyawan','employeeId',state.people.filter(p=>p.role==='employee').map(p=>[p.id,p.name]),'',required)+input('Tanggal','day',state.today,'date','required max="'+e(state.today)+'"'))+
 select('Keputusan','status',[...['Hadir','Sakit','Cuti','Izin','Absen'],...(c?['Ditolak']:[])].map(v=>[v,v]),'Hadir')+
 input('Masuk (WIB)','inTime','','time')+input('Keluar (WIB)','outTime','','time')+check('Keluar hari berikutnya','nextDay')+
 textarea('Notes admin','note','','required maxlength="500"'),v=>({...v,requestId:c?.id,nextDay:!!v.nextDay}));
 const toggle=()=>{for(const n of ['inTime','outTime','nextDay'])el.elements[n].closest('label').toggleAttribute('hidden',el.elements.status.value!=='Hadir');};
 el.addEventListener('change',toggle);toggle();
}
function cashForm(t){
 const fixed=route()[0]==='projects'?route()[1]:'';
 const el=form(t?'Edit Transaksi':'Catat Transaksi','cash.save',
 input('Uraian','title',t?.title,'text','required maxlength="120"')+
 select('Jenis','type',[['in','Uang masuk'],['out','Uang keluar']],t?.type)+
 input('Tanggal pencatatan / pembayaran','date',t?.date??state.today,'date',required)+input('Jatuh tempo','due',t?.due,'date')+
 select('Status','status',[['paid','Sudah dibayar'],['open','Tagihan terbuka']],t?.status)+
 input('Nominal (Rp)','amount',t?.amount,'number','required min="1" step="1"')+
 select('Proyek','projectId',[['','Operasional'],...projectOptions()],t?.projectId??fixed)+
 select('Kategori','category',state.categories.map(v=>[v,v]),t?.category,required)+
 input('Link invoice / bukti','link',t?.link,'url',onlyUrl)+textarea('Notes','notes',t?.notes,'maxlength="1000"'),v=>({...v,id:t?.id}));
 const toggle=()=>{
  const out=el.elements.type.value==='out';el.elements.status.options[1].disabled=out;
  if(out)el.elements.status.value='paid';
  el.elements.due.closest('label').toggleAttribute('hidden',el.elements.status.value!=='open');
 };
 el.addEventListener('change',toggle);toggle();
}
function ruleForm(r,disable=false){
 if(disable){
  form('Jadwalkan KPI nonaktif','rule.save',input('Mulai periode','from',state.today.slice(0,7),'month',required),v=>({...r,from:v.from,active:false}),'Jadwalkan');
  return;
 }
 const f=form(r?'Ubah Aturan KPI':'Tambah KPI','rule.save',
 input('Nama KPI','name',r?.name,'text','required maxlength="120"')+
 select('Sumber data','metric',Object.entries(metricNames),r?.metric,r?'disabled':'')+
 input('Target penuh','target',r?.target??100,'number','required min="2" max="100000" step="1"')+
 input('Ambang bonus pertama (%)','threshold',r?.threshold??50,'number','required min="1" max="99" step="1"')+
 input('Bonus pertama (Rp)','partial',r?.partial??0,'number','required min="0" step="1"')+
 input('Bonus penuh (Rp)','full',r?.full??0,'number','required min="0" step="1"')+
 input('Berlaku mulai','from',r?.from>=state.today.slice(0,7)?r.from:state.today.slice(0,7),'month',required)+
 '<div class="wide panel" aria-live="polite" id="rule-preview"></div>',
 v=>({...v,key:r?.key,metric:r?.metric??v.metric,active:true}));
 function simulate(){
  const val=n=>Number(f.elements[n].value);
  const target=val('target'),low=Math.ceil(target*val('threshold')/100);
  const line=(a,b)=>'<p>'+e(a)+' · <strong>'+e(money(b))+'</strong></p>';
  f.querySelector('#rule-preview').innerHTML=target>=2&&low>=1&&low<target?
   '<h3>Pratinjau bonus</h3>'+line('0–'+(low-1)+' poin',0)+line(low+'–'+(target-1)+' poin',val('partial'))+line(target+' poin ke atas',val('full')):
   '<p>Masukkan target dan ambang yang valid.</p>';
 }
 f.addEventListener('input',simulate);simulate();
}
function memberForm(p){
 const days=['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
 const current=state.today.slice(0,7);
 const salary=[...(p?.salaryHistory??[])].filter(x=>x.from<=current).sort((a,b)=>b.from.localeCompare(a.from))[0]?.value??0;
 const el=form(p?'Edit Akses':'Tambah Akun','member.save',
 input('Nama','name',p?.name,'text','required maxlength="120"')+input('Email ChatGPT','email',p?.email,'email','required maxlength="160"')+
 select('Peran','role',roles.filter(v=>v!=='owner').map(v=>[v,labels[v]]),p?.role??'employee')+
 check('Akun aktif','active',p?.active??true)+
 '<fieldset class="wide" data-members="viewer"><legend>Proyek yang boleh dilihat Viewer</legend>'+state.projects.map(v=>check(v.name,'projects',p?.projects.includes(v.id),v.id)).join('')+'</fieldset>'+
 '<fieldset class="wide" data-members="employee"><legend>Hari kerja</legend>'+days.map((v,i)=>check(v,'workdays',(p?.workdays??[1,2,3,4,5]).includes(i),String(i))).join('')+'</fieldset>'+
 '<div class="wide fields" data-members="employee">'+input('Gaji pokok (Rp)','salary',salary,'number','min="0" step="1"')+input('Gaji berlaku mulai','salaryFrom',current,'month')+
 input('Tanggal mulai kerja','started',p?.started??state.today,'date',p?'readonly':'')+'</div>',
 (v,a)=>({...v,id:p?.id,active:!!v.active,projects:a.getAll('projects'),workdays:a.getAll('workdays')}));
 const toggle=()=>{for(const node of el.querySelectorAll('[data-members]'))node.toggleAttribute('hidden',node.dataset.members!==el.elements.role.value);};
 el.addEventListener('change',toggle);toggle();
}
function showSlip(id){
 const s=state.payroll.find(v=>v.employeeId===id);
 if(!s)return;
 form('Rincian Payroll · '+personName(id),'payroll.finalize',
 '<div class="wide stack"><p>'+e(monthLabel(s.period))+' · '+(s.final?'Final':'Draf')+'</p>'+table(['Komponen','Nominal'],[...payrollRows(s),['Total',money(s.total)]].map(r=>r.map(e)))+'</div>',
 ()=>({employeeId:id,period:s.period}),'Finalisasi Slip');
 if(s.final||!s.closed)modal.querySelector('[type=submit]').remove();
}
function csv(rows,name){
 const cell=value=>{
  const raw=String(value??'');
  const guarded=/^[\s]*[=+\-@\u0000-\u001f]/.test(raw)?"'"+raw:raw;
  return '"'+guarded.replaceAll('"','""')+'"';
 };
 const url=URL.createObjectURL(new Blob(['\ufeff',rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const actions={
 retry:()=>refresh(),
 close:()=>modal.close(),
 'toggle-archives':()=>{showArchived=!showArchived;render();},
 'project-tab':id=>{projectTab=id;render();},
 'select-review':id=>{selectedReview=id;render();},
 'open-review':id=>{selectedReview=id;location.hash='review';},
 'select-rule':id=>{selectedRule=id;render();},
 clock:id=>mutate('attendance.clock',{mode:id}),
 prayer:id=>mutate('prayer.save',{mode:id}),
 'project-form':id=>projectForm(state.projects.find(p=>p.id===id)),
 'task-new':id=>taskForm(null,id),
 'task-form':id=>taskForm(state.tasks.find(t=>t.id===id)),
 'submit-form':id=>form('Kirim Review','task.submit',input('Link preview HTTPS','link','','url','required '+onlyUrl)+textarea('Catatan untuk reviewer','note','','maxlength="500"'),v=>({...v,id}),'Kirim Review'),
 'issue-form':id=>form('Laporkan Kendala','task.issue',textarea('Jelaskan kendala','note','','required maxlength="500"'),v=>({...v,id}),'Kirim Laporan'),
 'correction-form':()=>form('Ajukan Koreksi','attendance.request',input('Tanggal','day',state.today,'date','required max="'+e(state.today)+'"')+textarea('Apa yang perlu dikoreksi?','note','','required maxlength="500"'),v=>v,'Ajukan Koreksi'),
 'resolve-form':correctionForm,
 'review-revise':id=>reviewForm(id,'revise'),
 'review-approve':id=>reviewForm(id,'approve'),
 'payroll-form':showSlip,
 'cash-form':id=>cashForm(state.cash.find(t=>t.id===id)),
 'category-form':()=>form('Kelola Kategori','category.save',select('Ubah kategori','old',[['','Tambah kategori baru'],...state.categories.map(v=>[v,v])],'')+input('Nama kategori','name','','text','required maxlength="70"'),v=>v),
 'rule-form':id=>ruleForm(state.rules.find(r=>r.id===id)),
 'rule-disable':id=>ruleForm(state.rules.find(r=>r.id===id),true),
 'member-form':id=>memberForm(state.people.find(p=>p.id===id)),
 'settings-form':()=>form('Kalender Studio','settings.save',
 select('Catatan salat dihitung','prayerScope',[['workdays','Hari kerja'],['calendar','Hari kalender']],state.settings.prayerScope)+textarea('Libur studio (YYYY-MM-DD, pisahkan dengan koma)','holidays',state.holidays.join(', '),'maxlength="1200"'),v=>v),
 'export-payroll':()=>{
  const final=state.payroll.filter(s=>s.final);
  if(!final.length){tell('Belum ada slip final untuk periode ini.');return;}
  csv([['Periode','Karyawan','Gaji pokok','Bonus KPI','Bonus kehadiran','Bonus salat','Total'],...final.map(s=>[s.period,personName(s.employeeId),s.base,s.bonuses.reduce((n,b)=>n+b.bonus,0),s.attendance,s.prayer,s.total])],'Bstudio_Payroll_'+period+'.csv');
 },
 'export-cash':fixed=>{
  const rows=state.cash.filter(t=>(t.status==='open'?t.date.slice(0,7)<=period:t.date.startsWith(period))&&(!(fixed||cashProject)||t.projectId===(fixed||cashProject))&&(!cashCategory||t.category===cashCategory)&&(!cashStatus||t.status===cashStatus));
  csv([['Tanggal','Uraian','Proyek','Kategori','Jenis','Nominal','Status','Jatuh tempo','Notes'],...rows.map(t=>[t.date,t.title,projectName(t.projectId),t.category,t.type==='in'?'Masuk':'Keluar',t.amount,t.status==='paid'?'Dibayar':'Terbuka',t.due,t.notes])],'Bstudio_Keuangan_'+period+'.csv');
 }
};
function reviewForm(id,result){
 const t=state.tasks.find(t=>t.id===id), submission=t.submissions.at(-1)?.id,revising=result==='revise';
 form(revising?'Minta Revisi':'Tandai Lolos QC','task.review',
 '<p class="wide"><strong>'+e(taskName(t))+'</strong>'+(revising?'':'<br>'+e(t.points?t.points+' poin VFX akan masuk ke periode QC.':'Status review akan tercatat.') )+'</p>'+
 textarea(revising?'Feedback revisi':'Catatan QC (opsional)','note','',(revising?'required ':'')+'maxlength="1000"'),v=>({...v,id,submission,result}),revising?'Kirim Revisi':'Konfirmasi QC');
}
document.addEventListener('click',event=>{
 const b=event.target.closest('button[data-action]');
 if(!b||busy&&b.dataset.action!=='close')return;
 actions[b.dataset.action]?.(b.dataset.id);
});
const filterUpdates={taskStatus:v=>taskStatus=v,taskType:v=>taskType=v,taskPic:v=>taskPic=v,cashProject:v=>cashProject=v,cashCategory:v=>cashCategory=v,cashStatus:v=>cashStatus=v,search:v=>searchText=v};
root.addEventListener('change',event=>{
 const key=event.target.dataset.filter,value=event.target.value;
 if(event.target.dataset.checklist){const checked=event.target.checked;event.target.checked=!checked;mutate('task.checklist',{id:event.target.dataset.checklist,item:value,checked});return;}
 if(key==='demoUser'){
  if(busy){event.target.value=demoUser;return;}
  demoUser=value;selectedProject='';projectTab='tasks';searchText='';taskPic='';taskType='';taskStatus='';period=dayOf(new Date()).slice(0,7);state=calculate();
  history.replaceState(null,'','#'+home());render(true);
 }else if(key==='period'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value)){period=value;refresh();}
 else if(key!=='search'&&filterUpdates[key]){filterUpdates[key](value);render();}
});
root.addEventListener('input',event=>{
 if(event.target.dataset.filter!=='search')return;
 searchText=event.target.value;
 const pos=event.target.selectionStart;
 render();
 const current=root.querySelector('[data-filter="search"]');
 if(current){current.focus();current.setSelectionRange(pos,pos);}
});
window.addEventListener('hashchange',()=>{
 if(!state)return;
 const [screen,id]=route();
 if(screen==='projects'&&id!=='task'&&selectedProject!==id){selectedProject=id;projectTab='tasks';searchText='';taskStatus='';taskPic='';taskType='';}
 render(true);
});
modal.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
async function start(){
 try{
  ({mode}=await remote('/api/config'));
  if(mode==='demo'){try{db=JSON.parse(sessionStorage.getItem('bstudio-demo-v1'))??sample();if(!db.people.some(p=>p.id==='numan'))db=sample();}catch{db=sample();}}
  await refresh();
 }catch(err){failure(err);}
}
start();
