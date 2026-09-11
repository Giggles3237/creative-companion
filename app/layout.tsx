import type { Metadata } from 'next';
import './globals.css';
import IdentityRedirect from '@/components/studio/identity-redirect';
export const metadata: Metadata = { title: 'Creative Companion — Your creative studio', description: 'Make a song, write a story, or try something new. One easy choice at a time.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><IdentityRedirect/>{children}</body></html>; }
