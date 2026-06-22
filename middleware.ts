import { NextResponse } from 'next/server'
import { auth } from '@/auth'

const isUserRole = (role?: string | null) => role?.toUpperCase() === 'USER'

export default auth((request) => {
  const { nextUrl, auth: session } = request
  const pathname = nextUrl.pathname
  const isLoginRoute = pathname === '/login'
  const isUnauthorizedRoute = pathname === '/unauthorized'

   if (
    pathname.startsWith('/ventas/') &&
    pathname.endsWith('/comprobante')
  ) {
    return NextResponse.next()
  }

  if (!session?.user) {
    if (isLoginRoute) return NextResponse.next()

    const loginUrl = new URL('/login', nextUrl)
    loginUrl.searchParams.set('callbackUrl', `${nextUrl.pathname}${nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  if (isUserRole(session.user.role)) {
    if (isUnauthorizedRoute) return NextResponse.next()
    return NextResponse.redirect(new URL('/unauthorized', nextUrl))
  }

  if (isLoginRoute || isUnauthorizedRoute) {
    return NextResponse.redirect(new URL('/', nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'
  ],
}