import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { hashPassword, verifyPassword } from '~/lib/auth/password';
import { COOKIE_NAME, createToken } from '~/lib/auth/session';
import prisma from '~/lib/prisma';
import { checkRateLimit, enforceRateLimit, rateLimitResponse } from '~/lib/rate-limit';
import { firstIssue, loginSchema } from '~/schemas/auth';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Hash de uma senha qualquer: quando o e-mail não existe, comparamos contra ele
// para a resposta levar o mesmo tempo — senão o tempo revela quais e-mails têm
// conta. Gerado uma vez, sob demanda.
let dummyHash: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword('carestia-dummy-password');
  return dummyHash;
}

export async function POST(req: Request) {
  // Anti brute-force: 10 tentativas por IP a cada 15 min.
  const limited = enforceRateLimit(req, 'login', 10, LOGIN_WINDOW_MS);
  if (limited) {
    return limited;
  }

  const body = await req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: firstIssue(parsed.error) },
      { status: StatusCodes.BAD_REQUEST },
    );
  }
  const { email, password } = parsed.data;

  // Limite também por conta: um ataque distribuído (muitos IPs) contra o mesmo
  // e-mail não passa do limite por IP.
  const byEmail = checkRateLimit(`login:email:${email}`, 10, LOGIN_WINDOW_MS);
  if (!byEmail.ok) {
    return rateLimitResponse(byEmail.retryAfter);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await verifyPassword(password, user?.password ?? (await getDummyHash()));
  if (!user || user.deleted_at || !user.active || !passwordOk) {
    return NextResponse.json(
      { message: 'Credenciais inválidas.' },
      { status: StatusCodes.UNAUTHORIZED },
    );
  }

  const token = await createToken({
    sub: user.id,
    name: user.name,
    email: user.email,
    type: user.type,
  });

  const res = NextResponse.json(
    {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    { status: StatusCodes.OK },
  );
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
