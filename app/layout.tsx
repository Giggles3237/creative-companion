import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Creative Companion — Your creative studio', description: 'Make a song, write a story, or try something new. One easy choice at a time.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
