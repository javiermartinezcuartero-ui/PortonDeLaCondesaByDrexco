import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { LocaleProvider } from "@/lib/i18n"

// La cabecera monta `AdminAccess`, que usa `useRouter` y la sesión de Better Auth.
// Fuera del runtime de Next no hay router montado, y aquí no se prueba el botón de
// acceso sino la estructura de landmarks y el foco: se sustituyen los dos.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}))

/**
 * Accesibilidad de la cabecera y el pie del sitio público.
 *
 * No existía ninguna prueba de estos dos componentes, y ahí estaban los dos
 * defectos de accesibilidad más serios del proyecto: el menú móvil cerrado seguía
 * en el recorrido de teclado, y ninguno de los tres landmarks de navegación tenía
 * nombre. El README declaraba resuelto lo segundo.
 */

function renderWithLocale(ui: React.ReactElement) {
  return render(<LocaleProvider>{ui}</LocaleProvider>)
}

describe("Header — accesibilidad", () => {
  it("cada landmark de navegación tiene un nombre accesible, y son distintos", () => {
    renderWithLocale(<Header />)

    const navs = screen.getAllByRole("navigation")
    expect(navs.length).toBeGreaterThanOrEqual(1)

    const names = navs.map((nav) => nav.getAttribute("aria-label") ?? nav.getAttribute("aria-labelledby"))
    // Ninguno sin nombre.
    expect(names).not.toContain(null)
    // Y ninguno repetido: dos landmarks con el mismo nombre no se distinguen mejor
    // que dos sin nombre.
    expect(new Set(names).size).toBe(names.length)
  })

  it("el menú móvil cerrado está inerte: fuera del teclado y del árbol de accesibilidad", () => {
    // Regresión. Solo se apagaba con `opacity-0 pointer-events-none`, y ninguna de
    // las dos retira nada del orden de tabulación: por debajo de `xl`, pulsar Tab
    // desde el botón de hamburguesa metía el foco en ocho controles invisibles.
    const { container } = renderWithLocale(<Header />)

    // El contenedor del menú móvil es el que lleva `xl:hidden fixed inset-0`.
    const panel = container.querySelector(".xl\\:hidden.fixed.inset-0")
    expect(panel, "no se encuentra el contenedor del menú móvil").not.toBeNull()
    expect(panel?.hasAttribute("inert")).toBe(true)
  })

  it("los conmutadores de idioma tienen nombre accesible", () => {
    // Hay dos, el de escritorio y el del menú móvil: solo uno es visible según el
    // ancho, pero los dos existen en el árbol. `getAllBy` a propósito.
    renderWithLocale(<Header />)

    const toggles = screen.getAllByRole("checkbox", { name: /idioma|language/i })
    expect(toggles.length).toBeGreaterThanOrEqual(1)
    for (const toggle of toggles) {
      expect(toggle.getAttribute("aria-label")).toBeTruthy()
    }
  })
})

describe("Footer — accesibilidad", () => {
  it("sus dos landmarks de navegación toman el nombre de su encabezado visible", () => {
    renderWithLocale(<Footer />)

    const navs = screen.getAllByRole("navigation")
    expect(navs).toHaveLength(2)

    for (const nav of navs) {
      const labelledBy = nav.getAttribute("aria-labelledby")
      expect(labelledBy, "el nav del pie no está enlazado a su encabezado").not.toBeNull()
      // El id referenciado tiene que existir de verdad: un aria-labelledby a un id
      // inexistente deja el landmark sin nombre y no avisa de nada.
      expect(document.getElementById(labelledBy as string)).not.toBeNull()
      expect(document.getElementById(labelledBy as string)?.textContent?.trim()).toBeTruthy()
    }
  })
})
