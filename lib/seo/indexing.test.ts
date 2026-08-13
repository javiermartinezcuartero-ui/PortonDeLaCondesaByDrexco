import { describe, expect, it } from "vitest"
import { brand } from "@/data/site-content"
import { CANONICAL_SITE_ORIGIN, isSiteIndexable, normalizeOrigin } from "@/lib/seo/indexing"

/**
 * La regla que fijan estas pruebas es una sola: solo se indexa el despliegue que
 * se sirve desde el dominio oficial del negocio.
 *
 * Viene de un defecto real. La aplicación se desplegó en
 * `elportondelacondesa.solucionesbonicas.com` y seguía generando el sitemap y las
 * URL canónicas con `brand.website`, es decir, con las URL del WordPress del
 * cliente. Un sitemap con URL de otro dominio no lo acepta Search Console, y el
 * subdominio habría competido con el sitio real si algún buscador lo hubiera
 * indexado.
 */

const SUBDOMINIO_DEMO = "https://elportondelacondesa.solucionesbonicas.com"

describe("normalizeOrigin", () => {
  it("descarta la ruta, la barra final y la caja", () => {
    // Las tres formas que aparecen en la práctica al copiar una URL a una
    // variable de entorno.
    expect(normalizeOrigin("https://EJEMPLO.com/")).toBe("https://ejemplo.com")
    expect(normalizeOrigin("https://ejemplo.com/una/ruta?x=1")).toBe("https://ejemplo.com")
    expect(normalizeOrigin("  https://ejemplo.com  ")).toBe("https://ejemplo.com")
  })

  it("conserva el puerto y el protocolo, que sí distinguen un origen", () => {
    expect(normalizeOrigin("http://localhost:3000")).toBe("http://localhost:3000")
    expect(normalizeOrigin("http://ejemplo.com")).not.toBe(normalizeOrigin("https://ejemplo.com"))
  })

  it("devuelve null en lugar de lanzar ante una URL inválida o ausente", () => {
    // Importa porque el valor viene de una variable de entorno que puede llegar
    // a medio escribir, y una excepción aquí rompería el build entero.
    expect(normalizeOrigin(undefined)).toBeNull()
    expect(normalizeOrigin("")).toBeNull()
    expect(normalizeOrigin("   ")).toBeNull()
    expect(normalizeOrigin("elportondelacondesa.com")).toBeNull()
    expect(normalizeOrigin("no es una url")).toBeNull()
  })
})

describe("isSiteIndexable", () => {
  it("indexa el dominio oficial del negocio", () => {
    expect(isSiteIndexable(CANONICAL_SITE_ORIGIN)).toBe(true)
    expect(isSiteIndexable(`${CANONICAL_SITE_ORIGIN}/`)).toBe(true)
  })

  it("trata www como el mismo sitio", () => {
    // Es la diferencia más fácil de introducir al rellenar la variable en
    // Vercel, y equivocarse dejaría el sitio oficial sin indexar en silencio.
    expect(isSiteIndexable("https://www.elportondelacondesa.com")).toBe(true)
  })

  it("NO indexa el subdominio de demostración", () => {
    // El caso que motivó todo esto.
    expect(isSiteIndexable(SUBDOMINIO_DEMO)).toBe(false)
  })

  it("NO indexa una preview de Vercel ni el desarrollo local", () => {
    expect(isSiteIndexable("https://porton-web-crm-git-main.vercel.app")).toBe(false)
    expect(isSiteIndexable("http://localhost:3000")).toBe(false)
  })

  it("no indexa por defecto cuando la variable falta o es inválida", () => {
    // La única opción segura: un despliegue que no declara desde dónde se sirve
    // tampoco puede afirmar que es el sitio canónico.
    expect(isSiteIndexable(undefined)).toBe(false)
    expect(isSiteIndexable("")).toBe(false)
    expect(isSiteIndexable("elportondelacondesa.com")).toBe(false)
  })

  it("no confunde un dominio que solo contiene al oficial", () => {
    // `elportondelacondesa.com.atacante.net` contiene la cadena del dominio
    // oficial; comparar orígenes y no subcadenas es lo que lo impide.
    expect(isSiteIndexable("https://elportondelacondesa.com.atacante.net")).toBe(false)
  })
})

describe("coherencia con el contenido del sitio", () => {
  it("CANONICAL_SITE_ORIGIN coincide con brand.website", () => {
    // `lib/seo/indexing.ts` no puede importar `data/site-content.ts`: lo carga
    // `next.config.mjs` fuera del grafo de módulos de Next, donde el alias `@/`
    // no se resuelve. Esta prueba es lo que impide que las dos declaraciones del
    // dominio se separen sin que nadie se entere.
    expect(normalizeOrigin(brand.website)).toBe(normalizeOrigin(CANONICAL_SITE_ORIGIN))
  })
})
