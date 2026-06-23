import { jwtVerify, SignJWT } from 'jose';

export const COOKIE_NAME = 'mi_token';
const ALG = 'HS256';
const EXPIRATION = '7d';

export interface ISessionPayload {
  sub: string; // userId
  name: string;
  email: string;
}

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    throw new Error('AUTH_SECRET não definido no ambiente.');
  }
  return new TextEncoder().encode(value);
}

export async function createToken(payload: ISessionPayload): Promise<string> {
  return new SignJWT({ name: payload.name, email: payload.email })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(secret());
}

export async function verifyToken(token: string): Promise<ISessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      name: String(payload.name ?? ''),
      email: String(payload.email ?? ''),
    };
  } catch {
    return null;
  }
}
