import { type NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifyToken } from '~/lib/auth/session';

// Rotas públicas (acessíveis sem login).
const PUBLIC_PATHS = new Set(['/', '/login', '/register', '/terms', '/privacy']);

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith('/api/public');
}

export async function middleware(req: NextRequest) {
  if (isPublic(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

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
  // Roda em tudo, exceto auth APIs, assets e arquivos do PWA. As rotas públicas
  // são liberadas dentro do middleware (acima).
  matcher: [
    '/((?!api/auth|_next/static|_next/image|manifest.json|sw.js|workbox-|icons|favicon.ico).*)',
  ],
};
