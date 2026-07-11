import { jwtVerify, SignJWT } from 'jose';

export const COOKIE_NAME = 'mi_token';
const ALG = 'HS256';
const EXPIRATION = '7d';

export type UserRole = 'admin' | 'user';

export interface ISessionPayload {
  sub: string; // userId
  name: string;
  email: string;
  type: UserRole; // papel do usuário (coluna users.type)
}

const MIN_SECRET_LENGTH = 32;

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    throw new Error('AUTH_SECRET não definido no ambiente.');
  }
  if (value.length < MIN_SECRET_LENGTH) {
    // Segredo curto = JWT HS256 forjável por força bruta → account takeover.
    throw new Error(
      `AUTH_SECRET muito curto (${value.length} caracteres); use pelo menos ${MIN_SECRET_LENGTH}.`,
    );
  }
  return new TextEncoder().encode(value);
}

export async function createToken(payload: ISessionPayload): Promise<string> {
  return new SignJWT({ name: payload.name, email: payload.email, type: payload.type })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(secret());
}

export async function verifyToken(token: string): Promise<ISessionPayload | null> {
  try {
    // Fixa o algoritmo esperado — não aceitar nada além de HS256.
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      name: String(payload.name ?? ''),
      email: String(payload.email ?? ''),
      // Tokens antigos (sem `type`) degradam para 'user'.
      type: payload.type === 'admin' ? 'admin' : 'user',
    };
  } catch {
    return null;
  }
}
