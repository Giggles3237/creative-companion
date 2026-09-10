import type { Project, Artifact } from './types';
import { provider, PublicError, runtime } from './server';
import { selectionsText } from './engine';
import { composeSketch, practiceText } from './samples';
export type Output = {title:string;text:string;kind:Artifact['kind'];image?:string;bytes?:Uint8Array;mime?:string;provider:string};
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
 if(!instrumental){
  const planned=await fetch('https://api.elevenlabs.io/v1/music/plan',{method:'POST',headers,body:JSON.stringify({prompt,music_length_ms:40000,model_id:config.model}),signal:AbortSignal.timeout(120000)});
  if(!planned.ok)throw new PublicError('The song idea didn’t come together. Want to try again?',502);
  compositionPlan=await planned.json();
  if(!compositionPlan||JSON.stringify(compositionPlan).length>120000)throw new PublicError('The song plan could not be opened. Please try again.',502);
  const plan=compositionPlan as {chunks?:{text?:string}[];sections?:{section_name?:string;lines?:string[]}[]};
  lyrics=plan.chunks?.map(chunk=>chunk.text||'').filter(Boolean).join('\n\n')||plan.sections?.map(section=>`[${section.section_name||'Section'}]\n${(section.lines||[]).join('\n')}`).join('\n\n')||'';
 }
 const body=instrumental?{prompt,music_length_ms:40000,model_id:config.model,force_instrumental:true}:{composition_plan:compositionPlan,model_id:config.model,respect_sections_durations:true};
 const made=await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_48000_192',{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(300000)});
 if(!made.ok)throw new PublicError('That song didn’t work. Want me to try again?',502);
 const size=Number(made.headers.get('content-length')||0);if(size>30000000)throw new PublicError('The finished song was too large to save. Please try a shorter version.',502);
 const bytes=new Uint8Array(await made.arrayBuffer());if(!bytes.length||bytes.length>30000000)throw new PublicError('The song could not be opened. Please try again.',502);
 const subject=p.session.history.find(s=>s.stepId==='subject')?.label||'Your idea';
 return {kind:'music',title:`A song about ${subject.toLowerCase()}`,text:lyrics||`An original instrumental inspired by ${subject.toLowerCase()}.`,bytes,mime:'audio/mpeg',provider:`elevenlabs:${config.model}`};
 }
 if(cap==='generate_image'){
 let payload:BodyInit;const headers:Record<string,string>={Authorization:`Bearer ${config.key}`};let url='https://api.openai.com/v1/images/generations';
 if(previous?.media&&!previous.sample){const source=await runtime().FILES.get(`artifacts/${p.id}/${previous.id}`);if(!source)throw new PublicError('The earlier picture could not be opened.',404);const form=new FormData();form.set('model',config.model);form.set('prompt',input);form.set('image',new Blob([await source.arrayBuffer()],{type:'image/png'}),'original.png');form.set('size','1024x1024');payload=form;url='https://api.openai.com/v1/images/edits';}else{headers['Content-Type']='application/json';payload=JSON.stringify({model:config.model,prompt:input,n:1,size:'1024x1024',quality:'medium'});}
 const r=await fetch(url,{method:'POST',headers,body:payload,signal:AbortSignal.timeout(180000)});if(!r.ok)throw new PublicError('That picture didn’t work. Want to try again?',502);const data=await r.json() as {data?:{b64_json?:string}[]};const b64=data.data?.[0]?.b64_json;if(!b64||b64.length>24000000)throw new PublicError('The picture could not be opened. Please try again.',502);return {kind:'image',title:`${p.session.history[0]?.label||'My artwork'}`,text:'',bytes:Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),mime:'image/png',provider:`openai:${config.model}`};
 }
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:config.model,store:false,max_output_tokens:2200,instructions:p.journey.instruction,input:`${input}${previous?.text?`\nPrevious creation to revise:\n${previous.text}`:''}`}),signal:AbortSignal.timeout(120000)});
 if(!r.ok)throw new PublicError('The words didn’t come through. Want to try again?',502);const data=await r.json() as {output?:{content?:{type:string;text?:string}[]}[]};const text=(data.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join('\n').trim();if(!text)throw new PublicError('That one didn’t work. Try a different idea.',502);return {kind:cap==='create_printable'?'printable':'text',title:text.split('\n')[0].replace(/^#+\s*/, '').slice(0,100),text,image:cap==='create_printable'?'/artwork/botanical-card.png':undefined,provider:`openai:${config.model}`};
}
