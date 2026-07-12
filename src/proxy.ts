import { type NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '~/lib/auth/admin';
import { COOKIE_NAME, verifyToken } from '~/lib/auth/session';

// Rotas públicas (acessíveis sem login).
const PUBLIC_PATHS = new Set(['/', '/login', '/register', '/terms', '/privacy']);

// Telas restritas ao admin (defesa em profundidade — as rotas de API também
// checam por conta própria e retornam 403).
const ADMIN_PATHS = ['/invoices/import/key'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith('/api/public');
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(req: NextRequest) {
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

  if (isAdminPath(req.nextUrl.pathname) && !isAdmin(session)) {
    const url = req.nextUrl.clone();
    url.pathname = '/invoices';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Roda em tudo, exceto auth APIs, assets e arquivos do PWA. As rotas públicas
  // são liberadas dentro do proxy (acima).
  matcher: [
    '/((?!api/auth|_next/static|_next/image|manifest.json|sw.js|workbox-|icons|favicon.ico).*)',
  ],
};
