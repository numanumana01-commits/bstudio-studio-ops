
import { fresh,dayOf } from './domain.mjs';
export function sample(now=new Date()){
 const s=fresh('numan','owner@example.com');
 const today=dayOf(now), current=today.slice(0,7);
 const previous=new Date(Date.UTC(+today.slice(0,4),+today.slice(5,7)-1,0)).toISOString().slice(0,7);
 const at=(delta=0)=>new Date(now.getTime()+delta*86400000).toISOString();
 const d=(delta=0)=>dayOf(new Date(now.getTime()+delta*86400000));
 const people=[['sari','Sari','production'],['rini','Rini','payroll'],['adit','Adit','finance'],['ari','Ari','employee'],['dita','Dita','employee'],['raka','Raka','employee'],['viewer','Viewer','viewer']];
 s.people[0].name='Numan';
 for(const [id,name,role] of people)s.people.push({id,name,role,email:id+'@example.com',active:true,projects:role==='viewer'?['wantugo']:[],workdays:[1,2,3,4,5],started:previous+'-01',salaryHistory:role==='employee'?[{from:previous,value:4000000}]:[]});
 s.projects.push(
 {id:'wantugo',name:'Wantugo',type:'VFX',notes:'Reel 05 menunggu plate non-retime dari post.',material:'',archived:false},
 {id:'muzz',name:'Muzz Moment',type:'Konten',notes:'Recap untuk kanal sosial.',material:'',archived:false},
 {id:'wedding',name:'Wedding Highlight',type:'Wedding',notes:'Siapkan teaser untuk review internal.',material:'',archived:false});
 const task=(id,p,title,pic,status,opt={})=>({id,projectId:p,title,code:'',pic,status,kind:p==='wantugo'?'shot':'delivery',points:p==='wantugo'?1:0,deadline:d(2),notes:'',material:'',checklist:'',submissions:[],issues:[],...opt});
 s.tasks.push(
 task('wg10','wantugo','Wire removal','ari','Revisi',{code:'WG00_0010',deadline:today,feedback:'Rapikan masking di dekat kepala.',notes:'Pakai plate non-retime dari post.',checklist:'Bersihkan wire utama\nCek edge di frame akhir'}),
 task('wg20','wantugo','Screen comp','dita','Siap Review',{code:'WG00_0020',submissions:[{id:'prev-002',link:'https://frame.io/',note:'Masking layar dan tracking sudah dirapikan.',time:at()}]}),
 task('env','wantugo','Environment / Gang malam','ari','Dikerjakan',{kind:'asset',points:5,checklist:'Layout\nLighting\nQC internal'}),
 task('wg30','wantugo','Cleanup','dita','Menunggu Materi',{code:'WG00_0030'}),
 task('recap','muzz','Muzz Moment / Recap','raka','Siap Review',{submissions:[{id:'prev-001',link:'https://frame.io/',note:'Draft siap ditinjau.',time:at()}]}),
 task('teaser','wedding','Teaser / Draft 1','ari','Dikerjakan',{deadline:d(1)}));
 for(let i=1;i<=8;i++)s.tasks.push(task('asset-'+i,'wantugo','Aset environment '+i,'ari','Lolos QC',{kind:'asset',points:10,credit:{person:'ari',points:10,date:today,deadline:d(2)}}));
 for(let i=1;i<=2;i++)s.tasks.push(task('finished-'+i,'wantugo','Cleanup detail '+i,'ari','Lolos QC',{code:'WG01_00'+i+'0',credit:{person:'ari',points:1,date:today,deadline:d(2)}}));
 s.audit.push({id:'log-1',projectId:'wantugo',area:'production',entry:'WG00_0030 menunggu materi.',actor:'Numan',time:at(-1)});
 s.cash.push(
 {id:'dp',projectId:'wantugo',title:'DP klien',date:current+'-01',category:'Pembayaran klien',amount:12000000,type:'in',status:'paid',notes:'DP tahap pertama.',due:'',link:''},
 {id:'roto',projectId:'wantugo',title:'Freelancer roto',date:current+'-01',category:'Freelancer',amount:3000000,type:'out',status:'paid',notes:'Pengerjaan Reel 05.',due:'',link:''},
 {id:'plug',projectId:'',title:'Langganan plugin',date:current+'-01',category:'Software',amount:750000,type:'out',status:'paid',notes:'Perpanjangan bulanan.',due:'',link:''},
 {id:'final',projectId:'wantugo',title:'Pelunasan klien',date:current+'-01',category:'Pembayaran klien',amount:8000000,type:'in',status:'open',notes:'Ditagih setelah final delivery.',due:current+'-25',link:''});
 s.slips.push({employeeId:'ari',period:previous,base:4000000,points:100,details:[],bonuses:[{key:'vfx',name:'Poin Produksi VFX',value:100,target:100,bonus:1000000}],attendance:250000,prayer:250000,total:5500000,closed:true,final:true,finalizedAt:at(-2)});
 return s;
}