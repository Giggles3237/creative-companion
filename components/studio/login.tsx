'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, KeyRound } from 'lucide-react';
import { acceptInvite, handleAuthCallback, login, requestPasswordRecovery, signup, updateUser } from '@netlify/identity';

export default function Login({ returnTo = '/' }: { returnTo?: string }) {
  const [mode,setMode]=useState<'login'|'signup'|'invite'|'recovery'|'forgot'>('login');
  const [inviteToken,setInviteToken]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  const callbackStarted=useRef(false);
  useEffect(()=>{
    if(callbackStarted.current)return;
    callbackStarted.current=true;
    const params=new URLSearchParams(window.location.hash.slice(1));
    const invitation=params.get('invite_token');
    const confirmation=params.get('confirmation_token');
    const showInvitation=(token:string)=>{
      setInviteToken(token);
      setMode('invite');
    };
    // Keep invitation links intact until submission so a refresh can resume setup.
    if(invitation){showInvitation(invitation);return;}
    setBusy(true);
    handleAuthCallback().then(result=>{
      if(result?.type==='invite'&&result.token)showInvitation(result.token);
      else if(result?.type==='recovery')setMode('recovery');
      else if(result)window.location.replace(returnTo);
    }).catch(e=>{
      // Some invitation emails use confirmation_token. GoTrue requires the
      // same token plus a password to finish accepting these invitations.
      if(confirmation&&/invited users must specify a password/i.test((e as Error).message))showInvitation(confirmation);
      else setError((e as Error).message);
    }).finally(()=>setBusy(false));
  },[returnTo]);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');setMessage('');
    const form=new FormData(event.currentTarget),email=String(form.get('email')||''),password=String(form.get('password')||'');
    try{
      if(mode==='forgot'){
        await requestPasswordRecovery(email.trim());
        setMessage('If an account exists for that email address, you’ll receive a link to reset your password. Check your inbox and spam folder.');
        return;
      }
      if(mode==='invite')await acceptInvite(inviteToken,password);
      else if(mode==='recovery')await updateUser({password});
      else if(mode==='login')await login(email,password);
      else{
        const created=await signup(email,password,{full_name:String(form.get('name')||'')});
        if(!created.confirmedAt){setMessage('Check your email to finish creating your account.');return;}
      }
      window.location.href=returnTo;
    }catch(e){setError((e as Error).message||'That sign-in did not work. Please try again.');}
    finally{setBusy(false);}
  }

  return <main className="login-page"><section className="login-panel" aria-labelledby="login-heading"><a className="wordmark" href="/">creative<br/><span>companion.</span></a><div className="login-icon" aria-hidden="true"><KeyRound/></div><p className="eyebrow">YOUR PRIVATE CREATIVE STUDIO</p><h1 id="login-heading">{mode==='forgot'?'Forgot your password?':mode==='login'?'Welcome back.':mode==='recovery'?'Reset your password.':mode==='invite'?'Choose your password.':'Make your studio yours.'}</h1><p className="intro">{mode==='forgot'?'Enter your email address and we’ll send you a password reset link.':mode==='login'?'Sign in to find your creations and make something new.':mode==='recovery'?'Choose a new password to return to your studio.':mode==='invite'?'Your invitation is ready. Choose a password to open your studio.':'Create an account so your work stays private and waiting for you.'}</p>{error&&<p className="error-notice" role="alert">{error}</p>}{message&&<p className="success-notice" role="status"><Check/>{message}</p>}<form className="login-form" onSubmit={submit}>{mode==='signup'&&<label>Your name<input name="name" required autoComplete="name"/></label>}{(mode==='login'||mode==='signup'||mode==='forgot')&&<label>Email address<input name="email" type="email" required autoComplete="email" inputMode="email"/></label>}{mode!=='forgot'&&<label>Password<input name="password" type="password" required minLength={8} autoComplete={mode==='login'?'current-password':'new-password'}/></label>}<button className="button" disabled={busy}>{busy?'One moment…':mode==='forgot'?'Send reset link':mode==='login'?<>Sign in <ArrowRight/></>:mode==='recovery'?<>Save password <ArrowRight/></>:mode==='invite'?<>Open my studio <ArrowRight/></>:<>Create account <ArrowRight/></>}</button></form>{(mode==='login'||mode==='forgot')&&<button type="button" className="text-button login-mode" disabled={busy} onClick={()=>{setMode(mode==='forgot'?'login':'forgot');setError('');setMessage('');}}>{mode==='forgot'?'Back to sign in':'Forgot password?'}</button>}{(mode==='login'||mode==='signup')&&<button className="text-button login-mode" disabled={busy} onClick={()=>{setMode(mode==='login'?'signup':'login');setError('');setMessage('');}}>{mode==='login'?'I need an account':'I already have an account'}</button>}</section></main>;
}
