const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');

function route(){
 const exports={};
 class PublicError extends Error {constructor(message,status){super(message);this.status=status;}}
 const media=new Uint8Array([1,2,3,4,5]).buffer;
 const db={prepare:()=>({bind:()=>({first:async()=>({storage_key:'artifact-key',payload:JSON.stringify({kind:'music',sample:false})})})})};
 const source=ts.transpileModule(fs.readFileSync('app/api/media/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(source,{exports,Request,Response,Headers,URL,PublicError,require:name=>{
  if(name==='@/lib/creative/server')return {db:()=>db,failure:e=>Response.json({error:e.message},{status:e.status||500}),getMedia:async()=>({data:media,metadata:{contentType:'audio/mpeg'}}),PublicError,user:async()=>({userId:'user-1'})};
  return {};
 }});
 return exports;
}

test('media response includes audio length and range support',async()=>{
 const app=route();
 const response=await app.GET(new Request('https://studio.test/api/media?id=a'));
 assert.equal(response.status,200);
 assert.equal(response.headers.get('content-type'),'audio/mpeg');
 assert.equal(response.headers.get('content-length'),'5');
 assert.equal(response.headers.get('accept-ranges'),'bytes');
 assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3,4,5]);
});

test('media route serves requested byte ranges',async()=>{
 const app=route();
 const response=await app.GET(new Request('https://studio.test/api/media?id=a',{headers:{range:'bytes=1-3'}}));
 assert.equal(response.status,206);
 assert.equal(response.headers.get('content-range'),'bytes 1-3/5');
 assert.equal(response.headers.get('content-length'),'3');
 assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[2,3,4]);
});
