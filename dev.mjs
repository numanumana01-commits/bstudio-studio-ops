
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {endpoint,protectedHeaders} from './server.mjs';
const assets={'/':'index.html','/style.css':'style.css','/app.mjs':'app.mjs','/domain.mjs':'domain.mjs','/seed.mjs':'seed.mjs'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:'+(process.env.PORT||4173));let response;
  if(url.pathname.startsWith('/api/'))response=await endpoint(new Request(url,{method:req.method}),{});
  else if(Object.hasOwn(assets,url.pathname)){
   const file=assets[url.pathname];const type=file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript';
   response=new Response(await readFile(new URL('./public/'+file,import.meta.url)),{headers:{...protectedHeaders,'content-type':type+'; charset=utf-8'}});
  }else response=new Response('Halaman tidak ditemukan.',{status:404,headers:protectedHeaders});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Preview gagal dimuat.');}
});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('Bstudio preview: http://127.0.0.1:'+server.address().port));
