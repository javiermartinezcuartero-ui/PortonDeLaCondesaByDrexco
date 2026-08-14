import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ADMIN_THEME_COOKIE, normalizeAdminTheme } from "@/lib/admin-theme"
import { getSessionUser, roleHasPermission, type Permission } from "@/lib/auth/session"
import { LogoutButton } from "./logout-button"
import { ThemeToggle } from "./theme-toggle"

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
/*
 * Los rótulos los fijó el titular y **no describen la tecnología, describen el negocio**:
 * «Captaciones» en vez de «Contactos», «Acciones» en vez de «Tareas». Las
 * rutas no cambian —siguen siendo /admin/contactos, /admin/tareas…— y eso es deliberado:
 * renombrar carpetas rompería los enlaces guardados en marcadores, las llamadas a
 * `revalidatePath` de cada Server Action y los diez escenarios E2E, sin ganar nada que se
 * vea en pantalla.
 */
type NavSection = { href: string; label: string; permission: Permission }

/**
 * Los ocho apartados agrupados por tipología, cada grupo con su propio matiz.
 *
 * Reutiliza el mismo sistema `[data-tono]` que ya tiñe las pastillas de fase del
 * pipeline (ver app/globals.css): un grupo fija `--tono` y `.admin-navgroup` lo lee
 * a baja opacidad, así que no hace falta un segundo esquema de color para esto.
 * "naranja" queda fuera a propósito: es el único matiz que no identifica a ningún
 * grupo, así que sirve sin ambigüedad para la línea de hover de cualquier pestaña,
 * sea cual sea su grupo.
 */
const NAV_GROUPS: Array<{ tono: "gris" | "azul" | "verde" | "violeta"; items: NavSection[] }> = [
  {
    tono: "gris",
    items: [{ href: "/admin", label: "Estatus Plataforma", permission: "crm:access" }],
  },
  {
    tono: "azul",
    items: [
      { href: "/admin/contactos", label: "Captaciones", permission: "crm:access" },
      { href: "/admin/solicitudes", label: "Solicitudes Formulario", permission: "crm:access" },
    ],
  },
  {
    tono: "verde",
    items: [
      { href: "/admin/pipeline", label: "Seguimiento clientes", permission: "crm:access" },
      { href: "/admin/tareas", label: "Acciones", permission: "crm:access" },
    ],
  },
  {
    tono: "violeta",
    items: [
      { href: "/admin/contenidos", label: "Contenidos Biblioteca", permission: "cms:access" },
      { href: "/admin/informes", label: "Informes captación", permission: "crm:access" },
      { href: "/admin/configuracion", label: "Puntuación Visitantes", permission: "settings:manage" },
    ],
  },
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

  // Cada grupo se filtra por separado y se descarta si se queda vacío: un
  // perfil CONTENT, por ejemplo, no debe ver un bloque violeta de un único
  // elemento ("Contenidos Biblioteca") con el aire de una caja vacía a su lado.
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((section) => roleHasPermission(user.role, section.permission)),
  })).filter((group) => group.items.length > 0)

  // El modo se lee aquí, en el servidor, para que el HTML salga ya con el que
  // corresponde. Sin esto habría un parpadeo en cada carga: el primer pintado en un
  // modo y la corrección justo después de hidratar.
  const tema = normalizeAdminTheme((await cookies()).get(ADMIN_THEME_COOKIE)?.value)

  return (
    // `admin-shell` redefine los tokens de color de todo el subárbol (ver
    // app/globals.css) y `data-tema` elige la paleta, sin que ninguna de las nueve
    // vistas tenga que saberlo.
    <div className="admin-shell min-h-screen" data-tema={tema}>
      {/* La cabecera necesita su propia base ahora que detrás hay una fotografía:
          sin ella los enlaces de sección quedan a merced de lo que toque de la
          imagen. El color sale de `admin-chrome`, que cambia con el modo. */}
      <header className="admin-chrome sticky top-0 z-20 border-b backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-5">
          {/* No es un `h1`: el encabezado de la página lo pone cada vista
              ("Estatus Plataforma", "Solicitudes Formulario"). Esto es el rótulo del
              panel, así que va en un `span` y no compite en la jerarquía de encabezados.
              La barra de acento le da presencia sin robarle tamaño al título de la
              sección.

              El cuerpo baja de 26/34 px a 22/30: el rótulo pasó de dos palabras a tres, y
              a 34 px se comía el ancho de la cabecera en cuanto se le sumaban el
              conmutador de tema y «Salir». */}
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="h-9 w-[3px] shrink-0 self-center rounded-full bg-gradient-to-b from-accent to-primary"
            />
            <span className="admin-title-strong text-[22px] md:text-[30px] font-bold leading-none tracking-[-0.045em]">
              Gestión seguimiento comercial
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle initial={tema} />
            <LogoutButton />
          </div>
        </div>
        {/* Los rótulos nuevos son largos —"Solicitudes Formulario", "Contenidos
            Biblioteca"— y en mayúsculas con 0,15em de espaciado entre letras las ocho
            pastillas no cabían en una línea ni en pantalla ancha: se partían en tres
            filas y la cabecera crecía hasta comerse el título de la página. Se pasan a
            caja normal con el espaciado justo, que además es lo que hace un CRM: la
            navegación se lee, no se declama. */}
        <nav aria-label="Secciones del panel" className="flex flex-wrap gap-2.5 px-6 pb-2 pt-3">
          {groups.map((group) => (
            <div key={group.tono} data-tono={group.tono} className="admin-navgroup flex flex-wrap gap-0.5 rounded-full p-1">
              {group.items.map((section) => (
                <Link
                  key={section.href}
                  href={section.href}
                  className="admin-navlink rounded-full px-3 py-1.5 text-[13px] font-medium tracking-[-0.005em]"
                >
                  {section.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </header>
      <main className="px-6 py-10">{children}</main>
    </div>
  )
}
