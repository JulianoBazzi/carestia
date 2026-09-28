import { cookies } from 'next/headers';
import { COOKIE_NAME, type ISessionPayload, verifyToken } from '~/lib/auth/session';

export { isAdmin } from '~/lib/auth/admin';

/**
 * Reads the session from the httpOnly cookie. Use in Server Components and route handlers.
 * Returns null when not authenticated.
 */
export async function getSession(): Promise<ISessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verifyToken(token);
}

export async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('Não autenticado.');
  }
  return session.sub;
}
