
import { AppError, fresh, scope } from './domain.mjs';

export const workspaces = [
  { id:'bstudio', name:'Bstudio', focus:'Film', projectTypes:['VFX'] },
  { id:'matte-magic', name:'Matte Magic', focus:'Iklan, motion, dan VFX', projectTypes:['Iklan','Motion','VFX','Konten'] },
  { id:'omera-cinema', name:'Omera.Cinema', focus:'Wedding, prewedding, dan dokumenter', projectTypes:['Wedding','Prewedding','Dokumenter'] }
];
export const defaultWorkspace = workspaces[0].id;

function initialWorkspace(id,ownerId,ownerEmail) {
  const state=fresh(ownerId,ownerEmail);
  if(id==='omera-cinema')state.rules=[];
  return state;
}

export function workspaceState(existing, ownerId, ownerEmail) {
  if (existing?.entities) return existing;
  return { entities:Object.fromEntries(workspaces.map(({id})=>[
    id, (id===defaultWorkspace && existing) || initialWorkspace(id,ownerId,ownerEmail)
  ])) };
}

export function memberships(data, findMember) {
  return workspaces.flatMap(workspace=>{
    const store=data.entities[workspace.id];
    const member=store && findMember(store.people);
    return member ? [{workspace,member,store}] : [];
  });
}

export function selectWorkspace(access, requested) {
  if (requested && !workspaces.some(w=>w.id===requested)) throw new AppError('Ruang kerja tidak ditemukan.',404);
  const current=requested ? access.find(entry=>entry.workspace.id===requested) : access[0];
  if (!current) throw new AppError('Kamu belum punya akses ke ruang kerja ini.',403);
  return current;
}

export function cashTotals(entries, period) {
  let incoming=0, outgoing=0, open=0;
  for(const row of entries){
    if(row.status==='open' && row.type==='in' && row.date.slice(0,7)<=period)open+=row.amount;
    else if(row.status==='paid' && row.date.startsWith(period)){
      if(row.type==='in')incoming+=row.amount;
      if(row.type==='out')outgoing+=row.amount;
    }
  }
  return {incoming,outgoing,open,net:incoming-outgoing};
}

export function workspaceView(access, current, period, today) {
  const {workspace,member,store}=current;
  return {
    ...scope(store,member.id,period,today),
    workspace,
    workspaces:access.map(({workspace,member})=>({id:workspace.id,name:workspace.name,role:member.role})),
    ownerFinance:member.role==='owner' ? access.filter(item=>item.member.role==='owner').map(item=>({
      id:item.workspace.id,name:item.workspace.name,...cashTotals(item.store.cash,period)
    })) : []
  };
}

export function assertWorkspaceProjectType(current, action, data) {
  if(action!=='project.save')return;
  // Older projects can retain their original type, while new projects follow the business.
  const previous=current.store.projects.find(p=>p.id===data.id);
  if(data.type!==previous?.type && !current.workspace.projectTypes.includes(data.type)) {
    throw new AppError('Jenis proyek tidak tersedia di ruang kerja ini.');
  }
}
