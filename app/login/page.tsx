import Login from '@/components/studio/login';

export default async function LoginPage({searchParams}:{searchParams:Promise<{returnTo?:string}>}){
  const requested=(await searchParams).returnTo;
  const returnTo=requested?.startsWith('/')&&!requested.startsWith('//')?requested:'/';
  return <Login returnTo={returnTo}/>;
}
