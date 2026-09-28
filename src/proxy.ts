import { type NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '~/lib/auth/admin';
import { COOKIE_NAME, verifyToken } from '~/lib/auth/session';

// Rotas públicas (acessíveis sem login).
// `/scanner` é público: consultar preço por código de barras não exige conta (as
// abas de etiqueta e de cupom pedem login dentro da própria tela).
const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/terms',
  '/privacy',
  '/scanner',
  '/robots.txt',
  '/sitemap.xml',
]);

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
    // API sem sessão responde 401 em JSON: um 307 para /login faria o axios
    // seguir o redirect e receber HTML com status 200.
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', `${req.nextUrl.pathname}${req.nextUrl.search}`);
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
    '/((?!api/auth|_next/static|_next/image|manifest.json|sw.js|workbox-|fallback-|icons|icon|apple-icon|favicon.ico).*)',
  ],
};
