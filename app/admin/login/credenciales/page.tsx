import type { Metadata } from "next"
import Image from "next/image"
import { notFound, redirect } from "next/navigation"
import { brand } from "@/data/site-content"
import { isCredentialsLoginEnabled } from "@/lib/auth/admin-gate"
import { getSessionUser } from "@/lib/auth/session"
import { LoginForm } from "../login-form"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Acceso con credenciales",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
}

/**
 * Acceso con correo y contraseña. **Desactivado salvo que se active a propósito.**
 *
 * El titular pidió que la clave única de `/admin/login` sea la **única** forma de
 * entrar, así que esta ruta responde **404** a menos que el entorno declare
 * `ENABLE_CREDENTIALS_LOGIN=true`. En el despliegue esa variable no existe: no hay
 * segunda puerta.
 *
 * Entonces, ¿por qué sigue existiendo el archivo? Porque **las pruebas E2E la
 * necesitan** y son lo que sostiene la parte del proyecto que más depende de
 * verificación: la autorización por rol. La suite inicia sesión como ADMIN,
 * COMMERCIAL y CONTENT para comprobar que cada uno ve lo suyo y no ve lo ajeno;
 * con una clave única que entra siempre como la misma cuenta administradora, esas
 * comprobaciones no se podrían escribir. `playwright.config.ts` activa la
 * variable en el servidor bajo prueba, y solo ahí.
 *
 * **La consecuencia real, que conviene tener presente:** mientras la variable no
 * esté en el despliegue, los perfiles CONTENT y COMMERCIAL no pueden iniciar
 * sesión en producción. Siguen existiendo y sus permisos se siguen validando en
 * servidor, pero no hay puerta para ellos. Es exactamente lo que se pidió; el día
 * que haya equipo, basta con declarar la variable.
 *
 * El 404 no es seguridad por oscuridad: lo que protege el panel es la validación
 * de sesión en servidor de cada ruta. Es, simplemente, que la puerta no está.
 */
export default async function AdminCredentialsLoginPage() {
  if (!isCredentialsLoginEnabled()) {
    // 404 y no 403, igual que el resto del proyecto: un 403 confirmaría que la
    // ruta existe.
    notFound()
  }

  if (await getSessionUser()) {
    redirect("/admin")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-24">
      <div className="w-full max-w-sm space-y-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <Image src="/brand/icon-porton-hq.png" alt={brand.name} width={56} height={56} className="opacity-90" />
          <div className="space-y-1">
            <h1 className="font-serif text-2xl font-light text-foreground">Acceso con credenciales</h1>
            <p className="text-sm text-muted-foreground">{brand.name} — equipo interno</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
