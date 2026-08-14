import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser, roleHasPermission, type Permission } from "@/lib/auth/session"
import { LogoutButton } from "./logout-button"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
}

/**
 * Apartados del panel y el permiso que exige cada uno. Es la misma lista que
 * autoriza cada página: si aquí figura `crm:access`, la página vuelve a llamar a
 * `requirePermission("crm:access")`. Ocultar un enlace es una cortesía de
 * interfaz, **nunca** la protección (ver docs/crm.md §2).
 */
const SECTIONS: Array<{ href: string; label: string; permission: Permission }> = [
  { href: "/admin", label: "Resumen", permission: "crm:access" },
  { href: "/admin/contactos", label: "Contactos", permission: "crm:access" },
  { href: "/admin/solicitudes", label: "Solicitudes", permission: "crm:access" },
  { href: "/admin/pipeline", label: "Pipeline", permission: "crm:access" },
  { href: "/admin/tareas", label: "Tareas", permission: "crm:access" },
  { href: "/admin/contenidos", label: "Contenidos", permission: "cms:access" },
  { href: "/admin/informes", label: "Informes", permission: "crm:access" },
  { href: "/admin/configuracion", label: "Configuración", permission: "settings:manage" },
]

export default async function AdminProtectedLayout({ children }: { children: ReactNode }) {
  // El middleware ya redirige si falta la cookie de sesión, pero esa
  // comprobación es superficial (solo mira si la cookie existe). Aquí se
  // valida la sesión de verdad contra la base de datos: es la autorización
  // real, no la del middleware.
  const user = await getSessionUser()
  if (!user) {
    redirect("/admin/login")
  }

  const sections = SECTIONS.filter((section) => roleHasPermission(user.role, section.permission))

  return (
    // `admin-shell` redefine los tokens de color de todo el subárbol (ver
    // app/globals.css): el panel usa la gama azul noche de la pantalla de acceso
    // en vez del blanco editorial del sitio público, sin que ninguna de las nueve
    // vistas tenga que saberlo.
    <div className="admin-shell min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-4">
          <span className="text-lg font-semibold tracking-[-0.02em] text-foreground">Seguimiento comercial</span>
          <LogoutButton />
        </div>
        <nav aria-label="Secciones del panel" className="flex flex-wrap gap-1 px-6 pb-2 pt-3">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-full px-3.5 py-2 text-xs tracking-[0.15em] uppercase text-muted-foreground transition-all duration-300 hover:bg-white/10 hover:text-foreground"
            >
              {section.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="px-6 py-10">{children}</main>
    </div>
  )
}
