import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/session"
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

export default async function AdminProtectedLayout({ children }: { children: ReactNode }) {
  // El middleware ya redirige si falta la cookie de sesión, pero esa
  // comprobación es superficial (solo mira si la cookie existe). Aquí se
  // valida la sesión de verdad contra la base de datos: es la autorización
  // real, no la del middleware.
  const user = await getSessionUser()
  if (!user) {
    redirect("/admin/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="flex items-center gap-8">
          <span className="font-serif text-lg font-light text-foreground">Panel privado</span>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/admin" className="hover:text-foreground transition-colors duration-300">
              Inicio
            </Link>
            {(user.role === "ADMIN" || user.role === "CONTENT") && (
              <Link href="/admin/contenidos" className="hover:text-foreground transition-colors duration-300">
                Contenidos
              </Link>
            )}
            {user.role === "ADMIN" && (
              <Link href="/admin/usuarios" className="hover:text-foreground transition-colors duration-300">
                Usuarios
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            {user.name} · {user.role}
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className="px-6 py-12">{children}</main>
    </div>
  )
}
