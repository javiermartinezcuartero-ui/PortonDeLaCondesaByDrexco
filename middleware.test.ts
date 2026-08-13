import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { middleware } from "@/middleware"

function buildRequest(pathname: string, cookie?: string): NextRequest {
  const headers = new Headers()
  if (cookie) headers.set("cookie", cookie)
  return new NextRequest(new Request(`http://localhost:3001${pathname}`, { headers }))
}

describe("middleware de /admin", () => {
  it("redirige /admin a /admin/login sin cookie de sesión", () => {
    const response = middleware(buildRequest("/admin"))
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("http://localhost:3001/admin/login")
  })

  it("redirige subrutas de /admin sin cookie de sesión", () => {
    const response = middleware(buildRequest("/admin/usuarios"))
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("http://localhost:3001/admin/login")
  })

  it("deja pasar /admin con cookie de sesión presente (la validez real la comprueba el layout, no el middleware)", () => {
    const response = middleware(buildRequest("/admin", "better-auth.session_token=valor-no-verificado.firma"))
    expect(response.headers.get("location")).toBeNull()
  })

  it("deja pasar /admin/login incluso con cookie de sesión: la redirección la decide la página", () => {
    // Antes redirigía a /admin por el simple hecho de haber cookie, y eso montaba
    // un bucle infinito con una cookie que sobrevivía a su sesión: el panel
    // mandaba al login (no hay sesión) y el middleware devolvía al panel (hay
    // cookie), hasta ERR_TOO_MANY_REDIRECTS. Quien sí tiene sesión válida lo
    // resuelve `app/admin/login/page.tsx`, que puede consultar la base de datos.
    const response = middleware(buildRequest("/admin/login", "better-auth.session_token=valor-no-verificado.firma"))
    expect(response.headers.get("location")).toBeNull()
  })

  it("deja pasar /admin/login sin cookie de sesión", () => {
    const response = middleware(buildRequest("/admin/login"))
    expect(response.headers.get("location")).toBeNull()
  })

  it("fija Cache-Control: no-store en toda respuesta de /admin", () => {
    const withRedirect = middleware(buildRequest("/admin"))
    const withoutRedirect = middleware(buildRequest("/admin/login"))
    expect(withRedirect.headers.get("cache-control")).toBe("no-store")
    expect(withoutRedirect.headers.get("cache-control")).toBe("no-store")
  })
})
