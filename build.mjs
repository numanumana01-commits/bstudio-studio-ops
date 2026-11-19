
import { readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
const root = new URL('./',import.meta.url);
const at = path=>new URL(path,root);
const files={'/':'index.html','/style.css':'style.css','/app.mjs':'app.mjs','/domain.mjs':'domain.mjs','/seed.mjs':'seed.mjs','/preview-entitas':'preview-entitas.html','/preview-entitas.css':'preview-entitas.css'};
await mkdir(at('dist/server/'),{recursive:true});
await mkdir(at('dist/.openai/'),{recursive:true});
await copyFile(at('.openai/hosting.json'),at('dist/.openai/hosting.json'));
const assets={};
for(const [path,name] of Object.entries(files))assets[path]=await readFile(at('public/'+name),'utf8');
const domain=(await readFile(at('public/domain.mjs'),'utf8')).replace(/^export /gm,'');
const server=(await readFile(at('server.mjs'),'utf8')).trimStart().replace(/^import[^\r\n]*\r?\n/,'').replace(/^export /gm,'');
const staticSource='const ASSETS='+JSON.stringify(assets)+';\n';
const fetchSource=String.raw`
export default {async fetch(request,env){
 const route=new URL(request.url).pathname;
 if(route.startsWith('/api/'))return endpoint(request,env);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:protectedHeaders});
 if(!Object.hasOwn(ASSETS,route))return new Response('Halaman tidak ditemukan.',{status:404,headers:protectedHeaders});
 const type=route==='/'||route==='/preview-entitas'?'text/html':route.endsWith('.css')?'text/css':'text/javascript';
 return new Response(request.method==='HEAD'?null:ASSETS[route],{headers:{...protectedHeaders,'content-type':type+'; charset=utf-8'}});
}};
`;
await writeFile(at('dist/server/index.js'),domain+'\n'+server+'\n'+staticSource+fetchSource);
