import { NextResponse } from 'next/server';
import { hashPassword } from '~/lib/auth/password';
import { COOKIE_NAME, createToken } from '~/lib/auth/session';
import { newId } from '~/lib/id';
import prisma from '~/lib/prisma';
import { firstIssue, registerSchema } from '~/lib/validation';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'E-mail já cadastrado.' }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { id: newId(), name, email, password: await hashPassword(password) },
  });

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
