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
  const data=object.data as ArrayBuffer;
  const size=data.byteLength;
  const headers=new Headers({'Content-Type':contentType,'Content-Length':String(size),'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
  if(url.searchParams.has('download'))headers.set('Content-Disposition',`attachment; filename="my-creation.${artifact.kind==='music'?(artifact.sample?'wav':'mp3'):'png'}"`);
  const range=request.headers.get('range');
  if(range){
   const match=/^bytes=(\d*)-(\d*)$/.exec(range);
   if(!match)throw new PublicError('That file range could not be read.',416);
   const start=match[1]?Number(match[1]):0;
   const end=match[2]?Number(match[2]):size-1;
   if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>=size)throw new PublicError('That file range could not be read.',416);
   headers.set('Content-Length',String(end-start+1));
   headers.set('Content-Range',`bytes ${start}-${end}/${size}`);
   return new Response(data.slice(start,end+1),{status:206,headers});
  }
  return new Response(data,{headers});
 }catch(e){return failure(e);}
}
