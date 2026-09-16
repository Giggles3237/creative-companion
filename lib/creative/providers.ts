import type { Project, Artifact } from './types';
import { getMedia, provider, PublicError } from './server';
import { selectionsText } from './engine';
import { composeSketch, practiceText } from './samples';
export type Output = {title:string;text:string;kind:Artifact['kind'];image?:string;bytes?:Uint8Array;mime?:string;provider:string};
const knownElevenMusicCodes=new Set(['invalid_api_key','missing_permissions','quota_exceeded','rate_limit_exceeded','too_many_concurrent_requests','bad_composition_plan','bad_request','invalid_model_id','model_not_found','model_not_supported','model_not_available','prompt_too_long','content_policy_violation','prompt_blocked','payment_required','subscription_required']);
async function elevenMusicCode(response:Response){
 try{
  const data=await response.clone().json() as {detail?:{status?:unknown;code?:unknown};error?:{code?:unknown};code?:unknown};
  const value=data?.detail?.status||data?.detail?.code||data?.error?.code||data?.code;
  if(typeof value==='string'&&knownElevenMusicCodes.has(value))return value;
 }catch{}
 return 'unknown';
}
async function elevenMusicError(response:Response,stage:'plan'|'compose'){
 // Provider messages can contain the creator's prompt. Only expose recognized
 // error codes and HTTP status, never the raw response body or request headers.
 const code=await elevenMusicCode(response);
 console.error('Eleven Music request failed',{stage,httpStatus:response.status,code,requestId:response.headers.get('request-id')||response.headers.get('x-request-id')||undefined});
 const fail=(message:string,status=502)=>new PublicError(`${message} (Music ${stage}: HTTP ${response.status}${code==='unknown'?'':`, ${code}`}).`,status);
 if(code==='quota_exceeded'||response.status===402)return fail('The music account has reached its credit limit. Your choices are saved',503);
 if(response.status===401||code==='invalid_api_key')return fail('The music connection needs to be reconnected by the studio administrator',503);
 if(['invalid_model_id','model_not_found','model_not_supported','model_not_available'].includes(code))return fail('The selected music model is unavailable. Ask the studio administrator to check the music model setting',503);
 if(response.status===403||code==='missing_permissions')return fail('ElevenLabs refused permission for this music request. Ask the studio administrator to check the music connection',503);
 if(response.status===429)return fail('The music service is busy or has reached its request limit. Your choices are saved. Please try again later',429);
 if(response.status===422||code==='bad_composition_plan'||code==='prompt_too_long')return fail('Those song directions could not be arranged. Try another version or change one choice',422);
 if(code==='content_policy_violation'||code==='prompt_blocked')return fail('The music service could not accept those song directions. Please change your description',422);
 if(response.status>=500)return fail('The music service had a problem. Your choices are saved. Please try again later');
 return fail(stage==='plan'?'The music service could not plan this song. Your choices are saved. Share the error below with the studio administrator':'The music service could not finish this song. Your choices are saved. Share the error below with the studio administrator');
}
async function shouldComposeWithoutPlan(response:Response){const code=await elevenMusicCode(response);return [400,422].includes(response.status)&&(code==='unknown'||code==='bad_request');}
function withMusicModel<T extends Record<string,unknown>>(body:T,model?:string){return model?{...body,model_id:model}:body;}
export async function generate(p:Project,sample:boolean,change:string,previous?:Artifact):Promise<Output>{
 const cap=p.journey.capability;
 if(sample){const text=practiceText(p,change),get=(id:string)=>p.session.history.find(s=>s.stepId===id)?.value||'';if(cap==='generate_music')return {title:text.split('\n')[0],text,kind:'music',bytes:composeSketch(p.session.seed+p.artifacts.length*71,get('style'),get('mood'),get('pace'),change),mime:'audio/wav',provider:'practice-composer-v2'};const image=cap==='generate_image'?(get('subject')==='fox'?'/artwork/moonlit-fox.png':get('subject')==='flowers'?'/artwork/botanical-card.png':'/artwork/watercolor-elephant.png'):cap==='create_printable'?'/artwork/botanical-card.png':undefined;return {title:cap==='generate_image'?'A little inspiration':text.split('\n')[0],text:cap==='generate_image'?'A prepared studio example. Connect artwork creation to make a new picture from your choices.':text,kind:cap==='generate_image'?'image':cap==='create_printable'?'printable':'text',image,provider:'prepared-examples-v1'};}
 const id=cap==='generate_music'?'elevenlabs-music':cap==='generate_image'?'openai-image':'openai-text';const config=await provider(id);if(!config.key)throw new PublicError('This part of the studio is still being connected. Your choices are saved.',503);
 const input=`${p.journey.instruction}\nCreator selections: ${selectionsText(p.session)}.\n${change?`Requested change: ${change}. Preserve the other choices.`:''}`;
 if(cap==='generate_music'){
 const selected=(stepId:string)=>p.session.history.find(s=>s.stepId===stepId)?.value||'';
 const instrumental=selected('voice')==='instrumental';
 const prompt=`${input}\nCreate one original 40-second song. ${instrumental?'Instrumental only, with no voice, spoken words, or lyrics.':'Write and sing original lyrics with a clear verse, memorable chorus, and brief ending.'} Never reference or imitate a real artist, songwriter, recording, album, or existing song.`;
 const headers={'xi-api-key':config.key,'Content-Type':'application/json'};
 let compositionPlan:unknown;
 let lyrics='';
 let planFailed=false;
 if(!instrumental){
  const planned=await fetch('https://api.elevenlabs.io/v1/music/plan',{method:'POST',headers,body:JSON.stringify(withMusicModel({prompt,music_length_ms:40000},config.model)),signal:AbortSignal.timeout(120000)});
  if(planned.ok){
   compositionPlan=await planned.json();
   if(!compositionPlan||JSON.stringify(compositionPlan).length>120000)throw new PublicError('The song plan could not be opened. Please try again.',502);
   const plan=compositionPlan as {chunks?:{text?:string}[];sections?:{section_name?:string;lines?:string[]}[]};
   lyrics=plan.chunks?.map(chunk=>chunk.text||'').filter(Boolean).join('\n\n')||plan.sections?.map(section=>`[${section.section_name||'Section'}]\n${(section.lines||[]).join('\n')}`).join('\n\n')||'';
  }else if(await shouldComposeWithoutPlan(planned)){
   planFailed=true;
   console.error('Eleven Music plan rejected; composing directly',{httpStatus:planned.status,requestId:planned.headers.get('request-id')||planned.headers.get('x-request-id')||undefined});
  }else throw await elevenMusicError(planned,'plan');
 }
 const body=instrumental||planFailed?withMusicModel({prompt,music_length_ms:40000,...(instrumental?{force_instrumental:true}:{})},config.model):withMusicModel({composition_plan:compositionPlan,respect_sections_durations:true},config.model);
 const made=await fetch('https://api.elevenlabs.io/v1/music',{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(300000)});
 if(!made.ok)throw await elevenMusicError(made,'compose');
 const size=Number(made.headers.get('content-length')||0);if(size>30000000)throw new PublicError('The finished song was too large to save. Please try a shorter version.',502);
 const bytes=new Uint8Array(await made.arrayBuffer());if(!bytes.length||bytes.length>30000000)throw new PublicError('The song could not be opened. Please try again.',502);
 const subject=p.session.history.find(s=>s.stepId==='subject')?.label||'Your idea';
 return {kind:'music',title:`A song about ${subject.toLowerCase()}`,text:lyrics||`An original instrumental inspired by ${subject.toLowerCase()}.`,bytes,mime:'audio/mpeg',provider:`elevenlabs:${config.model||'default'}`};
 }
 if(cap==='generate_image'){
 const imageModel=config.model||'gpt-image-1';
 let payload:BodyInit;const headers:Record<string,string>={Authorization:`Bearer ${config.key}`};let url='https://api.openai.com/v1/images/generations';
 if(previous?.media&&!previous.sample){const source=await getMedia(`artifacts/${p.id}/${previous.id}`);if(!source)throw new PublicError('The earlier picture could not be opened.',404);const form=new FormData();form.set('model',imageModel);form.set('prompt',input);form.set('image',new Blob([source.data],{type:'image/png'}),'original.png');form.set('size','1024x1024');payload=form;url='https://api.openai.com/v1/images/edits';}else{headers['Content-Type']='application/json';payload=JSON.stringify({model:imageModel,prompt:input,n:1,size:'1024x1024',quality:'medium'});}
 const r=await fetch(url,{method:'POST',headers,body:payload,signal:AbortSignal.timeout(180000)});if(!r.ok)throw new PublicError('That picture didn’t work. Want to try again?',502);const data=await r.json() as {data?:{b64_json?:string}[]};const b64=data.data?.[0]?.b64_json;if(!b64||b64.length>24000000)throw new PublicError('The picture could not be opened. Please try again.',502);return {kind:'image',title:`${p.session.history[0]?.label||'My artwork'}`,text:'',bytes:Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),mime:'image/png',provider:`openai:${imageModel}`};
 }
 const textModel=config.model||'gpt-6-astra';
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:textModel,store:false,max_output_tokens:2200,instructions:p.journey.instruction,input:`${input}${previous?.text?`\nPrevious creation to revise:\n${previous.text}`:''}`}),signal:AbortSignal.timeout(120000)});
 if(!r.ok)throw new PublicError('The words didn’t come through. Want to try again?',502);const data=await r.json() as {output?:{content?:{type:string;text?:string}[]}[]};const text=(data.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join('\n').trim();if(!text)throw new PublicError('That one didn’t work. Try a different idea.',502);return {kind:cap==='create_printable'?'printable':'text',title:text.split('\n')[0].replace(/^#+\s*/, '').slice(0,100),text,image:cap==='create_printable'?'/artwork/botanical-card.png':undefined,provider:`openai:${textModel}`};
}
