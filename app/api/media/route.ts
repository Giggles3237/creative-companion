import { db,failure,getMedia,PublicError,user } from '@/lib/creative/server';

export const dynamic='force-dynamic';

export async function GET(request:Request){
 try{
  const u=await user(),url=new URL(request.url),id=url.searchParams.get('id');
  const row=await db().prepare('SELECT a.storage_key,a.payload FROM artifacts a JOIN projects p ON p.id=a.project_id WHERE a.id=? AND p.owner=?').bind(id,u.userId).first<{storage_key:string;payload:string}>();
  if(!row?.storage_key)throw new PublicError('That file could not be found.',404);
  const object=await getMedia(row.storage_key);
  if(!object)throw new PublicError('That file could not be opened.',404);
  const artifact=JSON.parse(row.payload);
  const contentType=typeof object.metadata?.contentType==='string'?object.metadata.contentType:'application/octet-stream';
  const headers=new Headers({'Content-Type':contentType,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
  if(url.searchParams.has('download'))headers.set('Content-Disposition',`attachment; filename="my-creation.${artifact.kind==='music'?(artifact.sample?'wav':'mp3'):'png'}"`);
  return new Response(object.data,{headers});
 }catch(e){return failure(e);}
}
