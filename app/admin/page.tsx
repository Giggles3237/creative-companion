import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { isAdmin } from '@/lib/creative/server';
import Admin from '@/components/studio/admin';
export const dynamic='force-dynamic';
export default async function AdminPage(){const u=await requireChatGPTUser('/admin');if(!isAdmin(u.email))return <main className="main-content"><h1>Studio management</h1><p className="intro">This area is for the studio administrator.</p><a className="button" href="/">Back to the studio</a></main>;return <Admin/>;}
