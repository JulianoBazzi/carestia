import { type NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifyToken } from '~/lib/auth/session';

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Protege tudo, exceto auth, assets e arquivos públicos do PWA.
  matcher: [
    '/((?!login|register|api/auth|_next/static|_next/image|manifest.json|sw.js|workbox-|icons|favicon.ico).*)',
  ],
};
