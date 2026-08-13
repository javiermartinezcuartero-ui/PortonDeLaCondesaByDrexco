import type { Metadata } from "next"
import Image from "next/image"
import { redirect } from "next/navigation"
import { brand } from "@/data/site-content"
import { getSessionUser } from "@/lib/auth/session"
import { LoginForm } from "./login-form"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Acceso privado",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
}

/**
 * Quien ya tiene sesión válida no necesita ver este formulario.
 *
 * La comprobación se hace **aquí** y no en el middleware a propósito. El
 * middleware solo puede mirar si la cookie existe (es Edge, no llega a la base de
 * datos), y con eso se producía un bucle infinito de redirecciones en cuanto una
 * cookie sobrevivía a su sesión —sesión caducada o revocada, rotación de
 * `BETTER_AUTH_SECRET`, base restaurada—: el panel redirigía al login por no
 * haber sesión, y el middleware devolvía al panel por haber cookie. El resultado
 * era `ERR_TOO_MANY_REDIRECTS`, no una pantalla de acceso.
 *
 * Validando la sesión de verdad, el caso se resuelve solo: sin sesión válida se
 * ve el formulario, aunque quede una cookie vieja en el navegador.
 */
export default async function AdminLoginPage() {
  if (await getSessionUser()) {
    redirect("/admin")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-24">
      <div className="w-full max-w-sm space-y-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <Image
            src="/brand/icon-porton-hq.png"
            alt={brand.name}
            width={56}
            height={56}
            className="opacity-90"
          />
          <div className="space-y-1">
            <h1 className="font-serif text-2xl font-light text-foreground">Acceso privado</h1>
            <p className="text-sm text-muted-foreground">{brand.name} — equipo interno</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
