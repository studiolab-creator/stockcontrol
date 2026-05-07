import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!)
const PUBLIC_ROUTES = ['/login']
const DEFAULT_REDIRECT = '/dashboard'

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isPublicRoute = PUBLIC_ROUTES.includes(path)

  // IMPORTANT: Use req.cookies.get(), NOT cookies() from next/headers.
  // next/headers cookies() is not available in proxy/Edge runtime.
  const token = req.cookies.get('session')?.value
  let session = null
  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET)
      session = payload
    } catch {
      // Expired or invalid token — treat as unauthenticated.
      // Do not rethrow: a bad cookie should redirect to login, not crash.
    }
  }

  if (!isPublicRoute && !session) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  if (isPublicRoute && session) {
    return NextResponse.redirect(new URL(DEFAULT_REDIRECT, req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  // Exclude static files, images, and Next.js internals from proxy.
  // This prevents proxy from running on every font, icon, or CSS request.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
