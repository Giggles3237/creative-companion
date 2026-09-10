import type { Project, Artifact } from './types';
import { provider, PublicError, runtime } from './server';
import { selectionsText } from './engine';
import { composeSketch, practiceText } from './samples';
export type Output = {title:string;text:string;kind:Artifact['kind'];image?:string;bytes?:Uint8Array;mime?:string;provider:string};
export async function generate(p:Project,sample:boolean,change:string,previous?:Artifact):Promise<Output>{
 const cap=p.journey.capability;
 if(sample){const text=practiceText(p,change),get=(id:string)=>p.session.history.find(s=>s.stepId===id)?.value||'';if(cap==='generate_music')return {title:text.split('\n')[0],text,kind:'music',bytes:composeSketch(p.session.seed+p.artifacts.length*71,get('style'),get('mood'),get('pace'),change),mime:'audio/wav',provider:'practice-composer-v2'};const image=cap==='generate_image'?(get('subject')==='fox'?'/artwork/moonlit-fox.png':get('subject')==='flowers'?'/artwork/botanical-card.png':'/artwork/watercolor-elephant.png'):cap==='create_printable'?'/artwork/botanical-card.png':undefined;return {title:cap==='generate_image'?'A little inspiration':text.split('\n')[0],text:cap==='generate_image'?'A prepared studio example. Connect artwork creation to make a new picture from your choices.':text,kind:cap==='generate_image'?'image':cap==='create_printable'?'printable':'text',image,provider:'prepared-examples-v1'};}
 const id=cap==='generate_music'?'suno':cap==='generate_image'?'openai-image':'openai-text';const config=await provider(id);if(!config.key)throw new PublicError('This part of the studio is still being connected. Your choices are saved.',503);
 const input=`${p.journey.instruction}\nCreator selections: ${selectionsText(p.session)}.\n${change?`Requested change: ${change}. Preserve the other choices.`:''}`;
 if(cap==='generate_music'){
 // Suno's official Platform documents its REST contract inside the signed-in
 // developer dashboard. Fail closed until that contract is loaded rather than
 // sending the user's key or creative choices to an unofficial Suno wrapper.
 throw new PublicError('Suno is selected for songs. Finish the official Suno Platform connection in studio management, then try again.',503);
 }
 if(cap==='generate_image'){
 let payload:BodyInit;const headers:Record<string,string>={Authorization:`Bearer ${config.key}`};let url='https://api.openai.com/v1/images/generations';
 if(previous?.media&&!previous.sample){const source=await runtime().FILES.get(`artifacts/${p.id}/${previous.id}`);if(!source)throw new PublicError('The earlier picture could not be opened.',404);const form=new FormData();form.set('model',config.model);form.set('prompt',input);form.set('image',new Blob([await source.arrayBuffer()],{type:'image/png'}),'original.png');form.set('size','1024x1024');payload=form;url='https://api.openai.com/v1/images/edits';}else{headers['Content-Type']='application/json';payload=JSON.stringify({model:config.model,prompt:input,n:1,size:'1024x1024',quality:'medium'});}
 const r=await fetch(url,{method:'POST',headers,body:payload,signal:AbortSignal.timeout(180000)});if(!r.ok)throw new PublicError('That picture didn’t work. Want to try again?',502);const data=await r.json() as {data?:{b64_json?:string}[]};const b64=data.data?.[0]?.b64_json;if(!b64||b64.length>24000000)throw new PublicError('The picture could not be opened. Please try again.',502);return {kind:'image',title:`${p.session.history[0]?.label||'My artwork'}`,text:'',bytes:Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),mime:'image/png',provider:`openai:${config.model}`};
 }
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:config.model,store:false,max_output_tokens:2200,instructions:p.journey.instruction,input:`${input}${previous?.text?`\nPrevious creation to revise:\n${previous.text}`:''}`}),signal:AbortSignal.timeout(120000)});
 if(!r.ok)throw new PublicError('The words didn’t come through. Want to try again?',502);const data=await r.json() as {output?:{content?:{type:string;text?:string}[]}[]};const text=(data.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join('\n').trim();if(!text)throw new PublicError('That one didn’t work. Try a different idea.',502);return {kind:cap==='create_printable'?'printable':'text',title:text.split('\n')[0].replace(/^#+\s*/, '').slice(0,100),text,image:cap==='create_printable'?'/artwork/botanical-card.png':undefined,provider:`openai:${config.model}`};
}
