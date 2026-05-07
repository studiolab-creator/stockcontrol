import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!)
const COOKIE_NAME = 'session'
const MAX_AGE = 60 * 60 * 24 * 30  // 30 days in seconds (D-02)

export type SessionPayload = {
  userId: string
  username: string
  role: 'ADMIN' | 'OPERADOR'
  expiresAt: Date
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')  // D-02: 30-day persistent session
    .sign(SECRET)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,                                    // D-01: XSS protection
    secure: process.env.NODE_ENV === 'production',     // HTTPS in prod
    sameSite: 'lax',                                   // CSRF mitigation
    maxAge: MAX_AGE,                                   // D-02: persistent, survives browser close
    path: '/',
  })
}

export async function verifySession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    // Handles: JWTExpired, JWSSignatureVerificationFailed, JWTInvalid
    return null
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
