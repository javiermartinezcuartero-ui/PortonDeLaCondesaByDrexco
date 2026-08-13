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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-4">
          <span className="font-serif text-lg font-light text-foreground">Panel privado</span>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              {user.name} · {user.role}
            </span>
            <LogoutButton />
          </div>
        </div>
        <nav aria-label="Secciones del panel" className="flex flex-wrap gap-1 px-6 pt-3">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="px-3 py-2.5 text-xs tracking-[0.15em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300"
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
