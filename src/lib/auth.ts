import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { AuthSession } from './types';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'task-manager-super-secret-key-change-in-production-2025'
);

export async function createToken(session: AuthSession): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(SECRET);
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as AuthSession;
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<AuthSession> {
  const session = await getSession();
  if (!session) {
    throw new Error('No autenticado');
  }
  return session;
}

export async function requireRole(...roles: string[]): Promise<AuthSession> {
  const session = await requireAuth();
  if (!roles.includes(session.role)) {
    throw new Error('Sin permisos');
  }
  return session;
}
