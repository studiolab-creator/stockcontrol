import 'server-only'
import { redirect } from 'next/navigation'
import { verifySession, type SessionPayload } from '@/lib/session'

/**
 * Returns the authenticated user's session payload.
 * Redirects to /login if no valid session exists.
 * Use this in every Server Component or Server Action that requires auth.
 *
 * Pattern (RESEARCH.md §Pitfall 2): middleware provides optimistic redirect only.
 * Server Components and Server Actions MUST independently verify the session.
 */
export async function getAuthenticatedUser(): Promise<SessionPayload> {
  const session = await verifySession()
  if (!session) {
    redirect('/login')
  }
  return session
}

/**
 * Returns the authenticated user's session if they are an Admin.
 * Redirects to /dashboard if authenticated but not Admin.
 * Redirects to /login if not authenticated at all.
 */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getAuthenticatedUser()
  if (session.role !== 'ADMIN') {
    redirect('/dashboard')
  }
  return session
}
