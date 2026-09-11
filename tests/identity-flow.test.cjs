const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');

function mount(file, hash, identity={}) {
  const states=[], effects=[], calls=[];
  let cursor=0;
  const window={location:{hash,pathname:'/login',replace:url=>calls.push(url)},history:{replaceState(){}}};
  const react={useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],v=>states[i]=v];},useRef:v=>({current:v}),useEffect:fn=>effects.push(fn)};
  const exports={};
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(source,{exports,window,URLSearchParams,FormData:class{constructor(data){this.data=data;}get(key){return this.data[key];}},require:name=>name==='react'?react:name==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:name==='@netlify/identity'?identity:{}});
  const render=()=>{cursor=0;return exports.default({});};
  render();
  return {states,calls,render,run:async()=>{effects[0]();await new Promise(resolve=>setImmediate(resolve));}};
}
function findForm(node){if(!node||typeof node!=='object')return; if(node.type==='form')return node;for(const child of [node.props?.children].flat(Infinity)){const found=findForm(child);if(found)return found;}}
const file='components/studio/login.tsx';
test('invitation waits for a password, then submits token and password',async()=>{
  let accepted;
  const app=mount(file,'#invite_token=test-invite',{handleAuthCallback(){throw Error('must not redeem before password');},acceptInvite:async(...args)=>accepted=args});
  await app.run();assert.equal(app.states[0],'invite');
  await findForm(app.render()).props.onSubmit({preventDefault(){},currentTarget:{password:'test-password'}});
  assert.deepEqual(accepted,['test-invite','test-password']);
});
test('confirmation link for an invited user switches to password setup',async()=>{
  const app=mount(file,'#confirmation_token=test-confirmation',{handleAuthCallback:async()=>{throw Error('Invited users must specify a password');}});
  await app.run();assert.equal(app.states[0],'invite');assert.equal(app.states[1],'test-confirmation');assert.equal(app.states[3],'');
});
test('expired confirmation stays an error',async()=>{
  const app=mount(file,'#confirmation_token=expired',{handleAuthCallback:async()=>{throw Error('Token expired');}});
  await app.run();assert.equal(app.states[0],'login');assert.equal(app.states[3],'Token expired');
});
test('recovery asks for a replacement password',async()=>{
  const app=mount(file,'#recovery_token=test',{handleAuthCallback:async()=>({type:'recovery'})});
  await app.run();assert.equal(app.states[0],'recovery');assert.equal(app.calls.length,0);
});
test('login callback does not redirect to itself',async()=>{
  const app=mount('components/studio/identity-redirect.tsx','#invite_token=test');
  await app.run();assert.equal(app.calls.length,0);
});
