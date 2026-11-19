
export const statuses = ['Dikerjakan','Menunggu Materi','Siap Review','Revisi','Lolos QC','Terkirim'];
export const types = ['VFX','Konten','Wedding'];
export const roles = ['owner','production','payroll','finance','employee','viewer'];
export const monthOf = date => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(date).slice(0,7);
export const dayOf = date => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const money = value => 'Rp'+new Intl.NumberFormat('id-ID').format(value);
export class AppError extends Error {
  constructor(message,status=400){super(message);this.status=status;}
}
function requireThat(ok,message,status){if(!ok)throw new AppError(message,status);}
function text(value,max=500){return typeof value==='string'?value.trim().slice(0,max):'';}
function required(value,max=120){const result=text(value,max);requireThat(result,'Lengkapi isian wajib.');return result;}
function amount(value,min=0,max=1e12){
  const n=Number(value);requireThat(Number.isSafeInteger(n)&&n>=min&&n<=max,'Masukkan angka yang valid.');return n;
}
function dateOf(value){
  const s=required(value,10);
  requireThat(/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Tanggal tidak valid.');
  return s;
}
function month(value){const s=required(value,7);requireThat(/^\d{4}-(0[1-9]|1[0-2])$/.test(s),'Periode tidak valid.');return s;}
export function safeLink(value){
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
function link(value){const v=text(value,1600);if(!v)return '';const url=safeLink(v);requireThat(url,'Gunakan link HTTPS yang valid.');return url;}
const person=(id,name,role,extra={})=>({id,name,role,active:true,projects:[],workdays:[1,2,3,4,5],...extra});
export function fresh(ownerId,ownerEmail){return {
  people:[person(ownerId,'Owner','owner',{email:ownerEmail})],projects:[],tasks:[],attendance:[],corrections:[],prayers:[],cash:[],slips:[],audit:[],
  holidays:[],categories:['Pembayaran klien','Freelancer','Software','Operasional','Gaji'],
  rules:[{id:'vfx-initial',key:'vfx',name:'Poin Produksi VFX',metric:'vfx',target:100,threshold:50,partial:500000,full:1000000,from:'2000-01',active:true}],
  settings:{attendanceBonus:250000,prayerBonus:250000,prayerScope:'workdays',clockMode:'anywhere'}
};}
function weekday(date){return new Date(date+'T12:00:00Z').getUTCDay();}
const attendanceDay=(person,date,store)=>person.workdays.includes(weekday(date))&&!store.holidays.includes(date);
function periodDates(period){
  const days=new Date(Date.UTC(+period.slice(0,4),+period.slice(5),0)).getUTCDate();
  return Array.from({length:days},(_,i)=>period+'-'+String(i+1).padStart(2,'0'));
}
function activeRules(rules,period){
  const latest=new Map();
  for(const rule of [...rules].sort((a,b)=>a.from.localeCompare(b.from)))if(rule.from<=period)latest.set(rule.key,rule);
  return [...latest.values()].filter(rule=>rule.active);
}
export function tier(value,rule){
  const boundary=Math.ceil(rule.target*rule.threshold/100);
  return value>=rule.target?rule.full:value>=boundary?rule.partial:0;
}
export function payroll(store,id,period,today){
  const employee=store.people.find(p=>p.id===id);
  requireThat(employee,'Karyawan tidak ditemukan.',404);
  const record=store.slips.find(s=>s.employeeId===id&&s.period===period);
  if(record)return record;
  const completed=store.tasks.filter(t=>t.credit?.person===id&&t.credit.date.slice(0,7)===period);
  const details=completed.filter(t=>t.credit.points>0).map(t=>({id:t.id,title:t.title,points:t.credit.points,date:t.credit.date}));
  const points=details.reduce((a,b)=>a+b.points,0);
  const bonuses=activeRules(store.rules,period).map(r=>{
    const value=r.metric==='vfx'?points:r.metric==='on-time'?completed.filter(t=>t.credit.deadline&&t.credit.date<=t.credit.deadline).length:completed.length;
    return {key:r.key,name:r.name,value,target:r.target,bonus:tier(value,r)};
  });
  const dates=periodDates(period).filter(d=>(!employee.started||d>=employee.started)&&(!employee.ended||d<employee.ended));
  const workdays=dates.filter(d=>attendanceDay(employee,d,store));
  const prayerDays=store.settings.prayerScope==='calendar'?dates:workdays;
  const closed=period<today.slice(0,7);
  const att=closed&&workdays.length>0&&workdays.every(date=>store.attendance.some(a=>a.person===id&&a.day===date&&a.status==='Hadir'&&a.inAt&&a.outAt))?store.settings.attendanceBonus:0;
  const prayer=closed&&prayerDays.length>0&&prayerDays.every(date=>store.prayers.some(p=>p.person===id&&p.day===date))?store.settings.prayerBonus:0;
  const base=(employee.salaryHistory??[]).filter(r=>r.from<=period).sort((a,b)=>b.from.localeCompare(a.from))[0]?.value??0;
  return {employeeId:id,period,base,points,details,bonuses,attendance:att,prayer,total:base+att+prayer+bonuses.reduce((v,b)=>v+b.bonus,0),closed,final:false};
}
export function scope(store,id,period,today){
  const actor=store.people.find(p=>p.id===id&&p.active);
  requireThat(actor,'Akun ini belum memiliki akses.',403);
  const role=actor.role;
  const canProduce=['owner','production'].includes(role);
  const canPay=['owner','payroll'].includes(role);
  const canFinance=['owner','finance'].includes(role);
  const tasks=canProduce?store.tasks:role==='employee'?store.tasks.filter(t=>t.pic===id):role==='viewer'?store.tasks.filter(t=>actor.projects.includes(t.projectId)):[];
  const projects=canProduce||canFinance?store.projects:role==='viewer'?store.projects.filter(p=>actor.projects.includes(p.id)):store.projects.filter(p=>tasks.some(t=>t.projectId===p.id));
  const lightweight=p=>({id:p.id,name:p.name,role:p.role,active:p.active});
  return {actor:lightweight(actor),projects:canProduce||canFinance?projects:projects.map(({id,name,type,archived})=>({id,name,type,archived})),tasks:role==='viewer'?tasks.map(({id,projectId,title,status,deadline})=>({id,projectId,title,status,deadline})):tasks,
    people:role==='owner'?store.people:canPay?store.people.filter(p=>p.role==='employee').map(({id,name,role,active,workdays})=>({id,name,role,active,workdays})):canProduce?store.people.map(lightweight):[],
    attendance:canPay?store.attendance.filter(a=>a.day.startsWith(period)):role==='employee'?store.attendance.filter(a=>a.person===id&&(a.day.startsWith(period)||a.day===today||!a.outAt&&a.status==='Hadir')):[],
    corrections:canPay?store.corrections:role==='employee'?store.corrections.filter(c=>c.person===id):[],
    prayers:role==='employee'?store.prayers.filter(a=>a.person===id&&(a.day.startsWith(period)||a.day===today)):[],
    payroll:canPay?store.people.filter(p=>p.role==='employee'&&(p.active||p.ended?.slice(0,7)===period||store.slips.some(s=>s.employeeId===p.id&&s.period===period))).map(p=>payroll(store,p.id,period,today)):role==='employee'?[payroll(store,id,period,today)]:[],
    rules:canPay?store.rules:[],cash:canFinance?store.cash:[],categories:canFinance?store.categories:[],
    audit:role==='owner'?store.audit:canProduce?store.audit.filter(a=>a.area==='production'):[],
    settings:role==='owner'?store.settings:role==='employee'?{prayerScope:store.settings.prayerScope}:null,
    holidays:role==='owner'?store.holidays:[],today,period
  };
}
function upsert(list,row,index){if(index<0)list.push(row);else list[index]=row;}
export function apply(store,id,action,data,now=new Date()){
  const actor=store.people.find(p=>p.id===id&&p.active);
  requireThat(actor,'Akun ini belum memiliki akses.',403);
  const role=actor.role, today=dayOf(now), period=today.slice(0,7), time=now.toISOString();
  const allow=(...allowed)=>requireThat(allowed.includes(role),'Akses ditolak.',403);
  const get=(list,recordId)=>{const record=list.find(r=>r.id===recordId);requireThat(record,'Data tidak ditemukan.',404);return record;};
  const uid=()=>crypto.randomUUID();
  const task=()=>get(store.tasks,data.id);
  const employee=()=>{const p=get(store.people,data.employeeId);requireThat(p.role==='employee','Pilih karyawan.');return p;};
  const editPeriod=d=>requireThat(d>=period,'Setelan hanya bisa berlaku mulai periode berjalan atau berikutnya.');
  const audit=(area,entry,projectId='')=>{
    store.audit.unshift({id:uid(),area,entry,projectId,actor:actor.name,time});
    if(store.audit.length>1000)store.audit.length=1000;
  };
  switch(action){
    case 'project.save': {
      allow('owner','production');
      const old=data.id?get(store.projects,data.id):null;
      requireThat(types.includes(data.type),'Pilih jenis proyek.');
      requireThat(!old||old.type===data.type||!store.tasks.some(t=>t.projectId===old.id),'Pindahkan tugas sebelum mengubah jenis proyek.');
      const row={id:old?.id??uid(),name:required(data.name),type:data.type,notes:text(data.notes,1000),material:link(data.material),archived:!!data.archived};
      upsert(store.projects,row,store.projects.indexOf(old));
      audit('production',(old?'Memperbarui ':'Membuat ') +row.name,row.id);break;
    }
    case 'task.save': {
      allow('owner','production');
      const old=data.id?task():null;
      const p=get(store.projects,data.projectId);
      requireThat(!p.archived||old?.projectId===p.id,'Proyek sudah diarsipkan.');
      const pic=get(store.people,data.pic);
      requireThat(pic.role==='employee'&&(pic.active||old?.pic===pic.id),'Pilih karyawan yang aktif.');
      const type=p.type==='VFX'?(data.kind==='asset'?'asset':'shot'):'delivery';
      const points=type==='shot'?1:type==='asset'?amount(data.points,3,10):0;
      requireThat(type!=='asset'||[3,5,10].includes(points),'Bobot aset harus 3, 5, atau 10 poin.');
      requireThat(!old?.credit||old.pic===pic.id&&old.points===points&&old.projectId===p.id&&old.kind===type,'Penugasan dan bobot terkunci setelah QC.');
      const title=required(data.title,160);
      const code=text(data.code,36).toUpperCase();
      requireThat(type!=='shot'||code,'Kode shot wajib diisi.');
      requireThat(!code||!store.tasks.some(t=>t.id!==old?.id&&t.projectId===p.id&&t.code===code),'Kode sudah dipakai dalam proyek tersebut.');
      const requestedStatus=data.status||old?.status||'Dikerjakan';
      requireThat(!old?.credit||requestedStatus===old.status||requestedStatus==='Terkirim','Tugas yang sudah lolos QC hanya bisa ditandai terkirim.');
      requireThat(['Dikerjakan','Menunggu Materi','Revisi'].includes(requestedStatus)||requestedStatus===old?.status||requestedStatus==='Terkirim'&&!!old?.credit,'Gunakan aksi QC untuk menyetujui hasil.');
      const row={...old,id:old?.id??uid(),projectId:p.id,pic:pic.id,title,code,kind:type,points,deadline:dateOf(data.deadline),notes:text(data.notes,1500),material:link(data.material),status:requestedStatus,checklist:text(data.checklist,1000),checked:old?.checked??[],submissions:old?.submissions??[],issues:old?.issues??[]};
      upsert(store.tasks,row,store.tasks.indexOf(old));
      audit('production',(old?'Memperbarui ':'Menambahkan ')+(code||title),p.id);break;
    }
    case 'task.checklist': {
      allow('owner','production');const t=task();
      const item=required(data.item,1000);
      requireThat(t.checklist.split('\n').map(s=>s.trim()).includes(item),'Butir checklist tidak ditemukan.');
      const checked=new Set(t.checked??[]);
      if(data.checked===true)checked.add(item);else checked.delete(item);
      t.checked=[...checked];audit('production','Memperbarui checklist '+(t.code||t.title),t.projectId);break;
    }
    case 'task.submit': {
      allow('employee');const t=task();requireThat(t.pic===id,'Akses ditolak.',403);
      requireThat(!['Siap Review','Lolos QC','Terkirim'].includes(t.status),'Tugas ini tidak sedang menerima preview.');
      const url=link(data.link);requireThat(url,'Masukkan link preview.');
      t.submissions.push({id:uid(),link:url,note:text(data.note),time});t.status='Siap Review';
      audit('production','Mengirim preview '+(t.code||t.title),t.projectId);break;
    }
    case 'task.issue': {
      allow('employee');const t=task();requireThat(t.pic===id,'Akses ditolak.',403);
      requireThat(!['Lolos QC','Terkirim'].includes(t.status),'Tugas ini sudah selesai.');
      t.issues.push({note:required(data.note,500),time});
      audit('production','Melaporkan kendala '+(t.code||t.title),t.projectId);break;
    }
    case 'task.review': {
      allow('owner','production');const t=task();
      requireThat(t.status==='Siap Review'&&t.submissions.at(-1)?.id===data.submission,'Preview sudah berubah. Muat ulang antrean.');
      const note=text(data.note,1000);
      if(data.result==='revise'){requireThat(note,'Isi feedback revisi.');t.status='Revisi';}
      else{
        requireThat(data.result==='approve','Hasil QC tidak valid.');
        requireThat(!t.credit,'Poin tugas ini sudah tercatat.');t.status='Lolos QC';
        t.credit={person:t.pic,points:t.points,date:today,deadline:t.deadline};
      }
      t.feedback=note;audit('production',t.status+' / '+(t.code||t.title),t.projectId);break;
    }
    case 'attendance.clock': {
      allow('employee');
      const open=store.attendance.find(a=>a.person===id&&a.status==='Hadir'&&a.inAt&&!a.outAt);
      if(data.mode==='out'){requireThat(open,'Belum ada clock in yang terbuka.');open.outAt=time;break;}
      requireThat(data.mode==='in','Aksi absensi tidak valid.');
      requireThat(!open,'Selesaikan clock out atau ajukan koreksi.');
      requireThat(!store.attendance.some(a=>a.person===id&&a.day===today),'Absensi hari ini sudah dicatat.');
      store.attendance.push({person:id,day:today,status:'Hadir',inAt:time,outAt:''});break;
    }
    case 'attendance.request': {
      allow('employee');const day=dateOf(data.day);
      requireThat(day<=today,'Tanggal koreksi belum tiba.');
      requireThat(!store.slips.some(s=>s.employeeId===id&&s.period===day.slice(0,7)),'Slip periode ini sudah final.');
      requireThat(!store.corrections.some(c=>c.person===id&&c.day===day&&c.status==='Menunggu'),'Koreksi untuk tanggal ini sedang ditinjau.');
      store.corrections.push({id:uid(),person:id,day,note:required(data.note,500),status:'Menunggu'});break;
    }
    case 'attendance.resolve': {
      allow('owner','payroll');const c=data.requestId?get(store.corrections,data.requestId):null;
      if(c)requireThat(c.status==='Menunggu','Pengajuan sudah diproses.');
      const p=c?get(store.people,c.person):employee();
      const day=c?c.day:dateOf(data.day);
      requireThat(day<=today,'Tanggal koreksi belum tiba.');
      requireThat(!store.slips.some(s=>s.employeeId===p.id&&s.period===day.slice(0,7)),'Slip periode ini sudah final.');
      if(data.status==='Ditolak'){requireThat(c,'Pilih pengajuan koreksi.');c.status='Ditolak';c.answer=required(data.note,500);break;}
      requireThat(['Hadir','Sakit','Cuti','Izin','Absen'].includes(data.status),'Status tidak valid.');
      const timeOf=(slot,date)=>{requireThat(/^\d\d:\d\d$/.test(slot)&&!Number.isNaN(Date.parse(date+'T'+slot+':00+07:00'))&&+slot.slice(0,2)<24,'Isi jam absen yang valid.');return new Date(date+'T'+slot+':00+07:00').toISOString();};
      const had=data.status==='Hadir';const inAt=had?timeOf(data.inTime,day):'';const outAt=had?timeOf(data.outTime,data.nextDay?new Date(Date.parse(day)+86400000).toISOString().slice(0,10):day):'';
      requireThat(!had||outAt>inAt&&outAt<=time,'Jam keluar harus setelah jam masuk dan sudah berlalu.');
      const note=required(data.note,500);
      const row={person:p.id,day,status:data.status,inAt,outAt};
      upsert(store.attendance,row,store.attendance.findIndex(a=>a.person===p.id&&a.day===day));
      if(c){c.status='Disetujui';c.answer=note;}
      audit('payroll','Koreksi absensi '+p.name+' / '+day+' / '+note);break;
    }
    case 'prayer.save': {
      allow('employee');requireThat(['Berjamaah','Sendiri (halangan)'].includes(data.mode),'Pilih catatan salat.');
      requireThat(store.settings.prayerScope==='calendar'||attendanceDay(actor,today,store),'Hari ini di luar jadwal kerja.');
      upsert(store.prayers,{person:id,day:today,mode:data.mode},store.prayers.findIndex(a=>a.person===id&&a.day===today));break;
    }
    case 'rule.save': {
      allow('owner','payroll');const from=month(data.from);editPeriod(from);
      const old=data.key?store.rules.find(r=>r.key===data.key):null;requireThat(!data.key||old,'KPI tidak ditemukan.',404);
      requireThat(['vfx','on-time','completed'].includes(data.metric),'Pilih sumber KPI.');
      requireThat(!old||old.metric===data.metric,'Sumber data KPI yang sudah ada terkunci.');
      const row={id:uid(),key:old?.key??uid(),name:required(data.name),metric:data.metric,target:amount(data.target,2,100000),threshold:amount(data.threshold,1,99),partial:amount(data.partial),full:amount(data.full),from,active:data.active!==false};
      requireThat(Math.ceil(row.target*row.threshold/100)<row.target,'Ambang bonus pertama harus di bawah target penuh.');
      requireThat(row.partial<=row.full,'Bonus pertama tidak boleh melebihi bonus penuh.');
      upsert(store.rules,row,store.rules.findIndex(r=>r.key===row.key&&r.from===from));
      audit('payroll','Menyimpan KPI '+row.name+' mulai '+from);break;
    }
    case 'payroll.finalize': {
      allow('owner','payroll');const p=employee();const m=month(data.period);
      requireThat(m<period,'Periode berjalan belum bisa difinalisasi.');
      requireThat(!store.slips.some(s=>s.employeeId===p.id&&s.period===m),'Slip sudah final.');
      requireThat(!store.corrections.some(c=>c.person===p.id&&c.day.startsWith(m)&&c.status==='Menunggu')&&!store.attendance.some(a=>a.person===p.id&&a.day.startsWith(m)&&a.status==='Hadir'&&!a.outAt),'Selesaikan koreksi atau clock out yang terbuka dulu.');
      const slip=payroll(store,p.id,m,today);store.slips.push({...slip,final:true,finalizedAt:time});
      audit('payroll','Finalisasi slip '+p.name+' / '+m);break;
    }
    case 'cash.save': {
      allow('owner','finance');const old=data.id?get(store.cash,data.id):null;
      requireThat(['in','out'].includes(data.type)&&['paid','open'].includes(data.status),'Jenis atau status transaksi tidak valid.');
      requireThat(data.type==='in'||data.status==='paid','Pengeluaran dicatat pada saat dibayar.');
      requireThat(store.categories.includes(data.category),'Pilih kategori yang tersedia.');
      if(data.projectId)get(store.projects,data.projectId);
      const row={id:old?.id??uid(),title:required(data.title),date:dateOf(data.date),due:data.due?dateOf(data.due):'',amount:amount(data.amount,1),type:data.type,status:data.status,category:data.category,projectId:data.projectId||'',notes:text(data.notes,1000),link:link(data.link)};
      requireThat(row.status!=='paid'||row.date<=today,'Tanggal transaksi yang sudah dibayar belum tiba.');
      upsert(store.cash,row,store.cash.indexOf(old));audit('finance','Mencatat '+row.title,row.projectId);break;
    }
    case 'category.save': {
      allow('owner','finance');const name=required(data.name,70);
      requireThat(!store.categories.some(c=>c.toLowerCase()===name.toLowerCase()&&c!==data.old),'Kategori sudah ada.');
      if(data.old){const index=store.categories.indexOf(data.old);requireThat(index>=0,'Kategori tidak ditemukan.',404);store.categories[index]=name;for(const c of store.cash)if(c.category===data.old)c.category=name;}
      else store.categories.push(name);
      break;
    }
    case 'member.save': {
      allow('owner');const email=required(data.email,160).toLowerCase();
      requireThat(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Alamat email tidak valid.');
      const old=data.id?get(store.people,data.id):null;
      requireThat(!store.people.some(p=>p.email===email&&p.id!==old?.id),'Email sudah terdaftar.');
      requireThat(roles.includes(data.role)&&data.role!=='owner'&&old?.role!=='owner','Peran ini tidak dapat diubah.');
      requireThat(!old||old.role===data.role||!store.tasks.some(t=>t.pic===old.id),'Akun yang punya riwayat tugas hanya bisa dinonaktifkan.');
      requireThat(!old?.boundIdentity||old.email===email,'Email akun yang sudah tertaut tidak dapat diganti.');
      const projects=Array.isArray(data.projects)?[...new Set(data.projects)]:[];projects.forEach(pid=>get(store.projects,pid));
      const workdays=Array.isArray(data.workdays)?[...new Set(data.workdays.map(v=>amount(v,0,6)))]:[1,2,3,4,5];
      if(data.role==='employee')requireThat(workdays.length,'Pilih minimal satu hari kerja.');
      const entry=person(old?.id??uid(),required(data.name),data.role,{email,active:data.active!==false,projects,workdays,started:old?.started??(data.started?dateOf(data.started):today),boundIdentity:old?.boundIdentity,ended:data.active===false?(old?.ended??today):undefined});
      const history=[...old?.salaryHistory??[]];
      if(data.role==='employee'){const from=month(data.salaryFrom||period);editPeriod(from);const value=amount(data.salary??0);upsert(history,{from,value},history.findIndex(s=>s.from===from));}
      entry.salaryHistory=history;upsert(store.people,entry,store.people.indexOf(old));audit('access','Memperbarui akses '+entry.name);break;
    }
    case 'settings.save': {
      allow('owner');requireThat(['workdays','calendar'].includes(data.prayerScope),'Pilih periode catatan salat.');
      const days=text(data.holidays,1200).split(/\s*,\s*/).filter(Boolean).map(dateOf);
      store.holidays=[...new Set(days)];
      store.settings={...store.settings,prayerScope:data.prayerScope};
      audit('payroll','Memperbarui kalender studio');break;
    }
    default:throw new AppError('Aksi tidak ditemukan.',404);
  }
}
export function requestedPeriod(value,today){return value?month(value):today.slice(0,7);}
