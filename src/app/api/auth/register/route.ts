import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { hashPassword } from '~/lib/auth/password';
import { COOKIE_NAME, createToken } from '~/lib/auth/session';
import { newId } from '~/lib/id';
import { normalizeName } from '~/lib/normalize';
import prisma from '~/lib/prisma';
import { enforceRateLimit } from '~/lib/rate-limit';
import { firstIssue, registerSchema } from '~/schemas/auth';

// Beta fechado: novos cadastros estão desabilitados neste primeiro momento.
// Para reabrir, defina REGISTRATION_OPEN=true no ambiente.
const REGISTRATION_OPEN = process.env.REGISTRATION_OPEN === 'true';

export async function POST(req: Request) {
  // Anti-abuso: 5 cadastros por IP por hora.
  const limited = enforceRateLimit(req, 'register', 5, 60 * 60 * 1000);
  if (limited) return limited;

  if (!REGISTRATION_OPEN) {
    return NextResponse.json(
      {
        message: 'A Carestia está em beta fechado e não está aceitando novos cadastros no momento.',
      },
      { status: StatusCodes.FORBIDDEN },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: firstIssue(parsed.error) },
      { status: StatusCodes.BAD_REQUEST },
    );
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { message: 'E-mail já cadastrado.' },
      { status: StatusCodes.CONFLICT },
    );
  }

  const user = await prisma.user.create({
    data: {
      id: newId(),
      name: normalizeName(name) ?? name,
      email,
      password: await hashPassword(password),
    },
  });

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
    { status: StatusCodes.CREATED },
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
