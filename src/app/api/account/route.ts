import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { COOKIE_NAME, createToken } from '~/lib/auth/session';
import { parseBody, safeRoute } from '~/lib/http';
import { normalizeName } from '~/lib/normalize';
import prisma from '~/lib/prisma';
import { updateAccountSchema } from '~/schemas/account';

export const runtime = 'nodejs';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** Atualiza o nome e reemite o cookie para refletir o nome novo no header. */
export const PATCH = safeRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(updateAccountSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.error }, { status: StatusCodes.BAD_REQUEST });
  }

  const user = await prisma.user.update({
    where: { id: session.sub },
    data: { name: normalizeName(parsed.data.name) ?? parsed.data.name },
  });

  const token = await createToken({
    sub: user.id,
    name: user.name,
    email: user.email,
    type: user.type,
  });
  const res = NextResponse.json({ data: { name: user.name, email: user.email } });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
});

/** Exclui a conta (soft-delete) e encerra a sessão. */
export const DELETE = safeRoute(async () => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  await prisma.user.update({
    where: { id: session.sub },
    data: { deleted_at: new Date(), active: false },
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
});
