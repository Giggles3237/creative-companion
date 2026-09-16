const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');

function provider(responses){
 const calls=[],logs=[],exports={};
 class PublicError extends Error {constructor(message,status){super(message);this.status=status;}}
 const source=ts.transpileModule(fs.readFileSync('lib/creative/providers.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(source,{exports,Response,AbortSignal,Uint8Array,console:{error:(...args)=>logs.push(args)},fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});assert.ok(responses.length,'unexpected provider call');return responses.shift();},require:name=>name==='./server'?{PublicError,provider:async()=>({key:'secret-test-key',model:'music_v2'})}:name==='./engine'?{selectionsText:()=> 'A cheerful country celebration'}:{}});
 return {generate:exports.generate,calls,logs};
}
const project={journey:{capability:'generate_music',instruction:'Write an original song.'},session:{history:[{stepId:'subject',value:'love',label:'Someone I love'},{stepId:'voice',value:'singing'}]},artifacts:[]};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});

test('planning rejection exposes status without falsely blaming billing or revealing response content',async()=>{
 const app=provider([json({detail:{status:'bad_request',message:'private song text secret-test-key'}},400)]);
 await assert.rejects(app.generate(project,false,''),e=>{
  assert.match(e.message,/Music plan: HTTP 400, bad_request/);
  assert.doesNotMatch(e.message,/billing|private song text|secret-test-key/);return true;
 });
 assert.equal(app.calls.length,1);
 assert.doesNotMatch(JSON.stringify(app.logs),/private song text|secret-test-key/);
});
test('non-JSON upstream failures remain diagnosable',async()=>{
 const app=provider([new Response('<html>upstream error</html>',{status:502})]);
 await assert.rejects(app.generate(project,false,''),/Music plan: HTTP 502/);
});
test('quota status takes precedence over a permission HTTP status',async()=>{
 const app=provider([json({detail:{status:'quota_exceeded'}},403)]);
 await assert.rejects(app.generate(project,false,''),/credit limit/);
});
test('model rejection identifies configuration rather than billing',async()=>{
 const app=provider([json({error:{code:'model_not_found'}},400)]);
 await assert.rejects(app.generate(project,false,''),/selected music model is unavailable/);
});
test('unrecognized provider codes are not reflected into logs or UI',async()=>{
 const app=provider([json({detail:{status:'secret-test-key'}},400)]);
 await assert.rejects(app.generate(project,false,''),e=>{assert.doesNotMatch(e.message,/secret-test-key/);return true;});
 assert.doesNotMatch(JSON.stringify(app.logs),/secret-test-key/);
});
test('successful vocal song keeps the plan lyrics and generated audio',async()=>{
 const plan={chunks:[{text:'[Verse]\nA brand new day',duration_ms:40000,positive_styles:['country'],negative_styles:[]}]};
 const app=provider([json(plan),new Response(new Uint8Array([73,68,51]))]);
 const result=await app.generate(project,false,'');
 assert.equal(app.calls[0].url,'https://api.elevenlabs.io/v1/music/plan');
 assert.deepEqual(app.calls[1].body.composition_plan,plan);
 assert.equal(result.text,plan.chunks[0].text);assert.equal(result.bytes.length,3);
});
test('composition failures are labeled separately from planning failures',async()=>{
 const app=provider([json({chunks:[{text:'Lyrics'}]}),json({detail:{status:'too_many_concurrent_requests'}},429)]);
 await assert.rejects(app.generate(project,false,''),/Music compose: HTTP 429, too_many_concurrent_requests/);
});
