'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Check, KeyRound } from 'lucide-react';
import { handleAuthCallback, login, signup } from '@netlify/identity';

export default function Login({ returnTo = '/' }: { returnTo?: string }) {
  const [mode,setMode]=useState<'login'|'signup'>('login');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  useEffect(()=>{handleAuthCallback().then(result=>{if(result)window.location.href=returnTo;}).catch(e=>setError((e as Error).message));},[returnTo]);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');setMessage('');
    const form=new FormData(event.currentTarget),email=String(form.get('email')||''),password=String(form.get('password')||'');
    try{
      if(mode==='login')await login(email,password);
      else{
        const created=await signup(email,password,{full_name:String(form.get('name')||'')});
        if(!created.confirmedAt){setMessage('Check your email to finish creating your account.');return;}
      }
      window.location.href=returnTo;
    }catch(e){setError((e as Error).message||'That sign-in did not work. Please try again.');}
    finally{setBusy(false);}
  }

  return <main className="login-page"><section className="login-panel" aria-labelledby="login-heading"><a className="wordmark" href="/">creative<br/><span>companion.</span></a><div className="login-icon" aria-hidden="true"><KeyRound/></div><p className="eyebrow">YOUR PRIVATE CREATIVE STUDIO</p><h1 id="login-heading">{mode==='login'?'Welcome back.':'Make your studio yours.'}</h1><p className="intro">{mode==='login'?'Sign in to find your creations and make something new.':'Create an account so your work stays private and waiting for you.'}</p>{error&&<p className="error-notice" role="alert">{error}</p>}{message&&<p className="success-notice" role="status"><Check/>{message}</p>}<form className="login-form" onSubmit={submit}>{mode==='signup'&&<label>Your name<input name="name" required autoComplete="name"/></label>}<label>Email address<input name="email" type="email" required autoComplete="email" inputMode="email"/></label><label>Password<input name="password" type="password" required minLength={8} autoComplete={mode==='login'?'current-password':'new-password'}/></label><button className="button" disabled={busy}>{busy?'One moment…':mode==='login'?<>Sign in <ArrowRight/></>:<>Create account <ArrowRight/></>}</button></form><button className="text-button login-mode" onClick={()=>{setMode(mode==='login'?'signup':'login');setError('');setMessage('');}}>{mode==='login'?'I need an account':'I already have an account'}</button></section></main>;
}
