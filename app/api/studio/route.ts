import { availability,body,db,eventStatement,failure,getJourneys,getProject,isAdmin,json,listProjects,protectMutation,PublicError,user } from '@/lib/creative/server';
import { choose,goBack } from '@/lib/creative/engine';
import type { Session } from '@/lib/creative/types';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const u=await user();const id=new URL(request.url).searchParams.get('project');if(id)return json({project:await getProject(id,u.userId)});return json({journeys:await getJourneys(),projects:await listProjects(u.userId),availability:await availability(),isAdmin:isAdmin(u.email),signedIn:true});}catch(e){return failure(e);}}
export async function POST(request:Request){try{protectMutation(request);const u=await user(),b=await body(request),now=new Date().toISOString();
 if(b.action==='start'){
 const j=(await getJourneys()).find(j=>j.id===b.journeyId);if(!j)throw new PublicError('That creative journey is not available.');
 if(typeof b.requestKey!=='string'||!/^[a-f0-9-]{36}$/.test(b.requestKey))throw new PublicError('Please try starting again.');
 const existing=await db().prepare('SELECT id FROM projects WHERE id=? AND owner=?').bind(b.requestKey,u.userId).first<{id:string}>();if(existing)return json({project:await getProject(existing.id,u.userId)});
 let inherited:string|undefined;let sourceProject;
 if(b.fromProject){sourceProject=await getProject(String(b.fromProject),u.userId);inherited=sourceProject.session.history.map(s=>s.label).join(', ');}
 const session:Session={node:j.start,history:[],seed:crypto.getRandomValues(new Uint32Array(1))[0],...(inherited?{inherited}:{})};
 // Only carry over a subject when the receiving journey has the same semantic field.
 if(sourceProject&&j.id==='story'){const source=sourceProject.session.history.find(s=>s.stepId==='subject');if(source){session.history=[{...source}];session.node=j.steps.find(s=>s.id==='subject')?.next||j.start;}}
 await db().batch([db().prepare('INSERT INTO projects (id,owner,title,journey,session,status,kept,version,created_at,updated_at) VALUES (?,?,?,?,?,?,0,0,?,?)').bind(b.requestKey,u.userId,j.title,JSON.stringify(j),JSON.stringify(session),'choosing',now,now),eventStatement(u.userId,b.requestKey,b.fromProject?'related_journey_selected':'journey_started',{journeyId:j.id,version:j.version})]);return json({project:await getProject(b.requestKey,u.userId)});
 }
 const p=await getProject(String(b.projectId),u.userId);
 if(b.version!==p.version)throw new PublicError('This creation was updated. Open it again to see your latest choices.',409);
 if(p.status==='generating'&&b.action!=='check')throw new PublicError('Your creation is still being made. You can come back in a moment.',409);
 if(b.action==='choose'||b.action==='back'){
 let session;try{session=b.action==='back'?goBack(p.journey,p.session):choose(p.journey,p.session,String(b.choiceId),typeof b.input==='string'?b.input:undefined);}catch(e){throw new PublicError((e as Error).message);}
 const result=await db().prepare('UPDATE projects SET session=?,status=?,version=version+1,updated_at=? WHERE id=? AND owner=? AND version=?').bind(JSON.stringify(session),session.node==='create'?'ready':'choosing',now,p.id,u.userId,p.version).run();if(!result.meta.changes)throw new PublicError('Your choices changed in another window. Please reopen this creation.',409);
 await eventStatement(u.userId,p.id,b.action==='back'?'choice_undone':'choice_selected',{stepId:p.session.node,choiceId:b.choiceId||null}).run();
 }else if(b.action==='keep'){
 if(!p.artifacts.length)throw new PublicError('Make something first, then keep your favorite version.');await db().batch([db().prepare('UPDATE projects SET kept=1,status=?,version=version+1,updated_at=? WHERE id=? AND owner=? AND version=?').bind('complete',now,p.id,u.userId,p.version),eventStatement(u.userId,p.id,'artifact_saved',{artifactId:p.activeArtifactId}),eventStatement(u.userId,p.id,'journey_completed')]);
 }else if(b.action==='restore'){
 if(!p.artifacts.some(a=>a.id===b.artifactId))throw new PublicError('That version could not be found.');await db().batch([db().prepare('UPDATE projects SET active_artifact_id=?,status=?,version=version+1,updated_at=? WHERE id=? AND owner=? AND version=?').bind(b.artifactId,'review',now,p.id,u.userId,p.version),eventStatement(u.userId,p.id,'revision_restored',{artifactId:b.artifactId})]);
 }else if(b.action==='check'){
 const g=await db().prepare('SELECT updated_at FROM generations WHERE id=? AND project_id=? AND status=?').bind(p.generationId||'',p.id,'running').first<{updated_at:string}>();if(g&&Date.now()-Date.parse(g.updated_at)>240000){await db().batch([db().prepare('UPDATE generations SET status=?,error=? WHERE id=? AND status=?').bind('failed','The connection was interrupted. Your choices are saved.',p.generationId!,'running'),db().prepare('UPDATE projects SET status=?,version=version+1 WHERE id=? AND status=?').bind('failed',p.id,'generating')]);}
 }else throw new PublicError('Please choose an action from the studio.');
 return json({project:await getProject(p.id,u.userId)});
 }catch(e){return failure(e);}}
