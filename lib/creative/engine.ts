import type { Journey, Session, Selection } from './types';
export function validateJourney(value: unknown): string[] {
 const errors:string[]=[]; const j=value as Journey;
 if(!j||typeof j!=='object')return ['A journey must be an object.'];
 if(!/^[a-z][a-z0-9-]{0,60}$/.test(j.id||''))errors.push('Use a short lowercase journey ID.');
 if(!j.title||j.title.length>100)errors.push('Add a title of up to 100 characters.');
 if(!['generate_music','generate_text','generate_image','create_printable'].includes(j.capability))errors.push('Choose a supported capability.');
 if(typeof j.instruction!=='string'||!j.instruction.trim()||j.instruction.length>4000)errors.push('Add generation instructions (up to 4,000 characters).');
 if(!Array.isArray(j.steps)||!j.steps.length||j.steps.length>20)return [...errors,'Add between 1 and 20 steps.'];
 const ids=new Set(j.steps.map(s=>s.id));
 if(ids.size!==j.steps.length||ids.has('create'))errors.push('Step IDs must be unique and cannot be create.');
 if(!ids.has(j.start))errors.push('The starting step does not exist.');
 const reachable=new Set<string>(); const visiting=new Set<string>();
 function visit(id:string){if(id==='create')return;if(visiting.has(id)){errors.push('Choice steps must not form a loop.');return;}if(reachable.has(id))return;reachable.add(id);visiting.add(id);const s=j.steps.find(s=>s.id===id);if(s){for(const o of s.options||[])visit(o.next||s.next||'create');}visiting.delete(id);}
 for(const s of j.steps){if(!s.question||s.question.length>200)errors.push('Every step needs a short question.');if(!Array.isArray(s.options)||!s.options.length||s.options.length>8){errors.push('Each step needs 1–8 choices.');continue;}if(new Set(s.options.map(o=>o.id)).size!==s.options.length)errors.push('Choice IDs must be unique within each step.');for(const o of s.options){if(!o.id||!o.label||o.label.length>100)errors.push('Every choice needs an ID and short label.');const next=o.next||s.next||'create';if(next!=='create'&&!ids.has(next))errors.push('A branch points to a missing step.');if(o.artwork&&!/^\/artwork\/[a-z0-9-]+\.png$/.test(o.artwork))errors.push('Use a studio artwork path.');}}
 if(!errors.length)visit(j.start);
 if(!errors.length&&reachable.size!==j.steps.length)errors.push('Some steps cannot be reached.');
 if(!Array.isArray(j.refinements)||j.refinements.length>6||j.refinements.some(r=>!r.id||!r.label||r.label.length>100))errors.push('Add up to six valid refinement actions.');
 if(!Array.isArray(j.related)||j.related.some(r=>typeof r!=='string'))errors.push('Related journeys must be a list.');
 return [...new Set(errors)];
}
export function choose(j:Journey, session:Session, choiceId:string, input?:string):Session {
 const step=j.steps.find(s=>s.id===session.node);if(!step)throw new Error('This step is no longer available.');
 let choice=step.options.find(o=>o.id===choiceId);let seed=session.seed;
 if(choiceId==='surprise'){seed=(Math.imul(seed,1664525)+1013904223)>>>0;choice=step.options[seed%step.options.length];}
 if(choiceId==='custom'&&step.allowInput&&input?.trim()){choice={id:'custom',label:input.trim().slice(0,200)};}
 if(!choice)throw new Error('Please choose one of these options.');
 const selection:Selection={stepId:step.id,value:choice.id,label:choice.label,...(choiceId==='surprise'?{surprise:true}:{})};
 return {...session,seed,node:choice.next||step.next||'create',history:[...session.history,selection]};
}
export function goBack(j:Journey,session:Session):Session{const last=session.history.at(-1);return last?{...session,node:last.stepId,history:session.history.slice(0,-1)}:{...session,node:j.start};}
export function guide(j:Journey,session:Session){return {step:j.steps.find(s=>s.id===session.node),heading:session.node==='create'?'Ready to make it?':j.steps.find(s=>s.id===session.node)?.question,canGoBack:session.history.length>0};}
export function selectionsText(session:Session){return session.history.map(s=>`${s.stepId}: ${s.label}`).join('; ')+(session.inherited?`; Inspired by: ${session.inherited}`:'');}
