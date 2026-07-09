import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { verifyPassword } from '~/lib/auth/password';
import { COOKIE_NAME, createToken } from '~/lib/auth/session';
import prisma from '~/lib/prisma';
import { firstIssue, loginSchema } from '~/schemas/auth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: firstIssue(parsed.error) },
      { status: StatusCodes.BAD_REQUEST },
    );
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (
    !user ||
    user.deleted_at ||
    !user.active ||
    !(await verifyPassword(password, user.password))
  ) {
    return NextResponse.json(
      { message: 'Credenciais inválidas.' },
      { status: StatusCodes.UNAUTHORIZED },
    );
  }

  const token = await createToken({
    sub: user.id,
    name: user.name,
    email: user.email,
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
