import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

// Solo redirige según la presencia de la cookie de sesión (comprobación
// barata, sin tocar la base de datos: apta para Edge). Nunca sustituye la
// autorización real: cada Server Component/Route Handler/Server Action de
// /admin vuelve a validar la sesión y el rol en servidor (lib/auth/session.ts).
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSessionCookie = Boolean(getSessionCookie(request))

  let response: NextResponse

  if (pathname === "/admin/login") {
    response = hasSessionCookie
      ? NextResponse.redirect(new URL("/admin", request.url))
      : NextResponse.next()
  } else if (!hasSessionCookie) {
    response = NextResponse.redirect(new URL("/admin/login", request.url))
  } else {
    response = NextResponse.next()
  }

  response.headers.set("Cache-Control", "no-store")
  return response
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
}
