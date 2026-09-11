import { getUser as getNetlifyUser } from '@netlify/identity';
import { redirect } from 'next/navigation';

export type StudioUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export async function getStudioUser(): Promise<StudioUser | null> {
  const user = await getNetlifyUser();
  if (!user?.id || !user.email) return null;
  const name = user.name || (typeof user.userMetadata?.full_name === 'string' ? user.userMetadata.full_name : null);
  return { userId: user.id, displayName: name || user.email, email: user.email, fullName: name };
}

export async function requireStudioUser(returnTo: string): Promise<StudioUser> {
  const user = await getStudioUser();
  if (user) return user;
  redirect(`/login?returnTo=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`);
}

function safeRelativeReturnPath(value: string) {
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const url = new URL(value, 'https://app.local');
    return url.origin === 'https://app.local' ? `${url.pathname}${url.search}${url.hash}` : '/';
  } catch {
    return '/';
  }
}
