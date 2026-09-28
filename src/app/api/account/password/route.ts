import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { hashPassword, verifyPassword } from '~/lib/auth/password';
import { parseBody, safeRoute } from '~/lib/http';
import prisma from '~/lib/prisma';
import { enforceRateLimit } from '~/lib/rate-limit';
import { changePasswordSchema } from '~/schemas/account';

export const runtime = 'nodejs';

export const POST = safeRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }
  // Sem limite, um cookie roubado permitiria testar senhas atuais à vontade.
  const limited = enforceRateLimit(req, 'account-password', 10, 15 * 60 * 1000, session, {
    by: 'user',
  });
  if (limited) {
    return limited;
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(changePasswordSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.error }, { status: StatusCodes.BAD_REQUEST });
  }

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) {
    return NextResponse.json(
      { message: 'Usuário não encontrado.' },
      { status: StatusCodes.NOT_FOUND },
    );
  }

  const valid = await verifyPassword(parsed.data.currentPassword, user.password);
  if (!valid) {
    return NextResponse.json(
      { message: 'Senha atual incorreta.' },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(parsed.data.newPassword) },
  });

  return NextResponse.json({ ok: true });
});
