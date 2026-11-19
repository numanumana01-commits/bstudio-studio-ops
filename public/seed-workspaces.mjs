
import { dayOf } from './domain.mjs';
import { sample } from './seed.mjs';
import { workspaceState } from './workspaces.mjs';

export function demoWorkspaceState(now=new Date(), legacy=null) {
  const seed=sample(now);
  // Preserve locally edited records in the original demo workspace.
  const db=workspaceState(legacy??seed,'numan','owner@example.com');
  const {entities}=db;
  const current=seed.slips[0].period;
  const receipt=seed.cash[0];
  const template=legacy?seed:structuredClone(seed);
  if(!legacy){
    entities.bstudio.projects=entities.bstudio.projects.filter(p=>p.id==='wantugo');
    entities.bstudio.tasks=entities.bstudio.tasks.filter(t=>t.projectId==='wantugo');
  }
  for (const [id,project,people,base] of [
    ['matte-magic','muzz',['numan','sari','adit','ari','raka'],3200000],
    ['omera-cinema','wedding',['numan','rini','ari'],2800000]
  ]){
    const entity=entities[id];
    entity.people=template.people.filter(p=>people.includes(p.id)).map(p=>({
      ...p, projects:[],salaryHistory:p.role==='employee'?[{from:current,value:base}]:[],
      role:id==='matte-magic'&&p.id==='sari'?'finance':p.role
    }));
    entity.projects=template.projects.filter(p=>p.id===project).map(p=>({...p,type:id==='matte-magic'?'Motion':p.type}));
    entity.tasks=template.tasks.filter(t=>t.projectId===project);
    entity.cash=[{...receipt,id:'dp-'+id,projectId:project,amount:id==='matte-magic'?6500000:4500000,notes:'DP contoh untuk workspace ini.'}];
    entity.slips=[{...seed.slips[0],base,points:0,bonuses:[],attendance:0,prayer:0,total:base}];
  }
  const today=dayOf(now);
  const omera=entities['omera-cinema'];
  const project=omera.projects[0];
  if(project){
    project.event={client:'Contoh Pasangan',shoot:today,due:'',location:'Bandung',stage:'Persiapan',delivery:''};
    project.crew=[
      {id:'wedding-crew-photo',name:'Rini',position:'Photographer',duties:'Dokumentasi akad, potret keluarga, dan kurasi foto.'},
      {id:'wedding-crew-video',name:'Ari',position:'Videographer',duties:'Liputan video akad dan resepsi.'}
    ];
  }
  const magic=entities['magic-post'];
  magic.people=seed.people.filter(p=>['numan','raka'].includes(p.id));
  const base={campaign:'Portofolio Studio',priority:'Normal',due:today,publish:'',assignee:'raka',brief:'',caption:'',draft:'',final:'',reviewNote:'',checklist:'',checked:[],archived:false};
  magic.content=[
    {...base,id:'behind-the-scenes',title:'Behind the scenes produksi',channel:'Instagram',format:'Reels',stage:'Review',brief:'Potong footage BTS menjadi video 30 detik.',checklist:'Pilih footage\nEdit rough cut\nCek caption',checked:['Pilih footage','Edit rough cut']},
    {...base,id:'showreel-teaser',title:'Teaser showreel studio',channel:'TikTok',format:'Video pendek',stage:'Terjadwal',publish:today},
    {...base,id:'project-recap',title:'Recap proyek terbaru',channel:'Instagram',format:'Carousel',stage:'Ide'}
  ];
  return db;
}
