import { NextResponse } from 'next/server';
import { verifyPassword } from '~/lib/auth/password';
import { COOKIE_NAME, createToken } from '~/lib/auth/session';
import prisma from '~/lib/prisma';
import { firstIssue, loginSchema } from '~/lib/validation';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.password))) {
    return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 });
  }

  const token = await createToken({
    sub: user.id,
    name: user.name,
    email: user.email,
  });

  const res = NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
  });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
