const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');

function server(env={}){
 const exports={};
 const source=ts.transpileModule(fs.readFileSync('lib/creative/server.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(source,{exports,Request,Response,URL,crypto,process:{env},require:name=>{
  if(name==='@netlify/blobs')return {getStore:()=>({})};
  if(name==='@/app/auth')return {getStudioUser:async()=>null};
  if(name==='@/db')return {database:{}};
  if(name==='./journeys')return {journeys:[]};
  return {};
 }});
 return exports;
}
function request(url,origin,headers={}){
 return new Request(url,{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{}),...headers},body:'{}'});
}

test('allows the public Netlify site origin when the function request URL is internal',()=>{
 const app=server({URL:'https://tericreativecompanion.netlify.app'});
 assert.doesNotThrow(()=>app.protectMutation(request('https://creative-companion.netlify.app/api/generate','https://tericreativecompanion.netlify.app')));
});

test('allows a configured custom studio origin',()=>{
 const app=server({STUDIO_ALLOWED_ORIGINS:'https://studio.example.com'});
 assert.doesNotThrow(()=>app.protectMutation(request('https://internal.netlify.app/api/generate','https://studio.example.com')));
});

test('rejects unexpected origins',()=>{
 const app=server({URL:'https://tericreativecompanion.netlify.app'});
 assert.throws(()=>app.protectMutation(request('https://creative-companion.netlify.app/api/generate','https://other.example.com')),/Please return to the studio and try again/);
});

test('rejects cross-site requests without an origin header',()=>{
 const app=server({URL:'https://tericreativecompanion.netlify.app'});
 assert.throws(()=>app.protectMutation(request('https://tericreativecompanion.netlify.app/api/generate',undefined,{'sec-fetch-site':'cross-site'})),/Please return to the studio/);
});

test('requires JSON controls',()=>{
 const app=server({URL:'https://tericreativecompanion.netlify.app'});
 const req=new Request('https://tericreativecompanion.netlify.app/api/generate',{method:'POST',headers:{origin:'https://tericreativecompanion.netlify.app','content-type':'text/plain'},body:'hi'});
 assert.throws(()=>app.protectMutation(req),/Please use the studio controls/);
});
