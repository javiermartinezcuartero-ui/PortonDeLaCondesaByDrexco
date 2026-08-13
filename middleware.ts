import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

// Solo redirige según la presencia de la cookie de sesión (comprobación
// barata, sin tocar la base de datos: apta para Edge). Nunca sustituye la
// autorización real: cada Server Component/Route Handler/Server Action de
// /admin vuelve a validar la sesión y el rol en servidor (lib/auth/session.ts).
//
// **El login se deja pasar siempre.** Antes, si había cookie, el middleware
// redirigía /admin/login → /admin. Con una cookie que sobrevivía a su sesión
// (caducada, revocada, secreto rotado, base restaurada) eso montaba un bucle
// infinito: el panel mandaba al login por no haber sesión y el middleware
// devolvía al panel por haber cookie, hasta `ERR_TOO_MANY_REDIRECTS`. La
// redirección de quien **sí** tiene sesión vive ahora en la propia página del
// login, que puede validarla contra la base de datos. Aquí no se puede.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isLogin = pathname === "/admin/login"
  const hasSessionCookie = Boolean(getSessionCookie(request))

  const response =
    isLogin || hasSessionCookie
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/admin/login", request.url))

  response.headers.set("Cache-Control", "no-store")
  return response
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
}
