'use client';

import { useEffect } from 'react';

const identityHash=/^#(confirmation_token|recovery_token|invite_token|email_change_token|access_token)=/;

export default function IdentityRedirect(){
  useEffect(()=>{if(identityHash.test(window.location.hash))window.location.replace(`/login${window.location.hash}`);},[]);
  return null;
}
