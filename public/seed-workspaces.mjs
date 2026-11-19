
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
  return db;
}
