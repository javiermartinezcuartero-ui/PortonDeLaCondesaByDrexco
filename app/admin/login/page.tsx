import type { Metadata } from "next"
import Image from "next/image"
import { redirect } from "next/navigation"
import { brand } from "@/data/site-content"
import { getSessionUser } from "@/lib/auth/session"
import { GateForm } from "./gate-form"

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
    <main className="admin-gate relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      {/*
        El fondo va en un elemento propio y no en `body::before`: el `body` es
        común a todo el sitio, así que el efecto se habría colado en las páginas
        públicas. Con `position: fixed` sobre este div el resultado visual es el
        mismo y queda confinado a esta pantalla.
      */}
      <div className="admin-gate__backdrop" aria-hidden />
      {/* Velo oscuro: la fotografía es muy saturada y sin él ni el texto blanco
          ni el propio formulario se leen encima. */}
      <div className="admin-gate__veil" aria-hidden />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/25 bg-white/10 p-8 shadow-[0_25px_70px_-15px_rgba(30,64,175,0.65)] backdrop-blur-xl sm:p-10">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image
            src="/brand/icon-porton-hq.png"
            alt={brand.name}
            width={64}
            height={64}
            priority
            className="drop-shadow-lg"
          />
          <p className="text-xs uppercase tracking-[0.3em] text-white/70">Acceso privado</p>
        </div>

        <GateForm />
      </div>
    </main>
  )
}
