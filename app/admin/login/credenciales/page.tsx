import type { Metadata } from "next"
import Image from "next/image"
import { redirect } from "next/navigation"
import { brand } from "@/data/site-content"
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
 * Acceso con correo y contraseña.
 *
 * La pantalla principal (`/admin/login`) pasó en la Fase 14 a pedir una clave
 * única sin usuario, por decisión del titular. Esta ruta conserva el acceso por
 * credenciales, que sigue siendo el mecanismo real de autenticación, y hace falta
 * por dos motivos concretos:
 *
 * 1. **Los perfiles que no son ADMIN.** La clave única entra siempre como la
 *    misma cuenta administradora, así que sin esta pantalla no habría forma de
 *    entrar como CONTENT o COMMERCIAL y los dos roles quedarían inservibles.
 * 2. **Las pruebas E2E**, que inician sesión con los tres perfiles para comprobar
 *    que cada uno ve lo suyo y no ve lo ajeno. Sin credenciales no se puede
 *    probar la autorización por rol, que es de lo que más depende este proyecto.
 *
 * **No está enlazada desde ninguna parte**, y eso no es seguridad por
 * oscuridad: lo que protege el panel es la validación de sesión en servidor de
 * cada ruta, no que este formulario sea difícil de encontrar. Simplemente no
 * estorba a quien entra por la puerta principal.
 */
export default async function AdminCredentialsLoginPage() {
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
