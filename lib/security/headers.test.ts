import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { buildContentSecurityPolicy, isCspEnforced, securityHeaders, supabaseHost } from "@/lib/security/headers"
import { CANONICAL_SITE_ORIGIN, isSiteIndexable } from "@/lib/seo/indexing"

const originalSupabase = process.env.SUPABASE_URL
const originalEnforce = process.env.CSP_ENFORCE

beforeEach(() => {
  process.env.SUPABASE_URL = "https://proyecto.supabase.co"
  delete process.env.CSP_ENFORCE
})

afterEach(() => {
  if (originalSupabase === undefined) delete process.env.SUPABASE_URL
  else process.env.SUPABASE_URL = originalSupabase
  if (originalEnforce === undefined) delete process.env.CSP_ENFORCE
  else process.env.CSP_ENFORCE = originalEnforce
})

describe("supabaseHost", () => {
  it("deriva el host de la variable en vez de escribirlo a mano", () => {
    expect(supabaseHost("https://proyecto.supabase.co")).toBe("proyecto.supabase.co")
  })

  it("rechaza http y valores inválidos", () => {
    // Autorizar un origen http en la CSP permitiría degradar la conexión.
    expect(supabaseHost("http://proyecto.supabase.co")).toBeNull()
    expect(supabaseHost("no-es-una-url")).toBeNull()
    expect(supabaseHost("")).toBeNull()
  })

  it("sin la variable configurada devuelve null", () => {
    // Se borra el entorno en vez de pasar `undefined`: el parámetro tiene valor
    // por defecto, así que pasarlo explícitamente no lo anula.
    delete process.env.SUPABASE_URL
    expect(supabaseHost()).toBeNull()
  })
})

describe("Content-Security-Policy", () => {
  it("permite los orígenes que el proyecto usa de verdad", () => {
    const csp = buildContentSecurityPolicy("proyecto.supabase.co")

    // URLs firmadas del bucket privado y cliente de Storage.
    expect(csp).toContain("img-src 'self' data: blob: https://proyecto.supabase.co")
    expect(csp).toContain("connect-src 'self' https://proyecto.supabase.co")
    // El iframe del mapa de la sección de contacto.
    expect(csp).toContain("frame-src https://www.google.com")
  })

  it("no autoriza los dominios de Google Fonts: las tipografías se sirven del propio dominio", () => {
    // Desde la Fase 10 las fuentes son `next/font/local` (app/fonts/README.md).
    // Si alguien volviera a `next/font/google`, el texto no se pintaría con la CSP
    // en modo bloqueo y este test es lo que lo avisaría antes de desplegar.
    const csp = buildContentSecurityPolicy("proyecto.supabase.co")

    expect(csp).not.toContain("fonts.googleapis.com")
    expect(csp).not.toContain("fonts.gstatic.com")
    expect(csp).toContain("font-src 'self' data:")
  })

  it("no autoriza comodines ni orígenes arbitrarios", () => {
    const csp = buildContentSecurityPolicy("proyecto.supabase.co")

    expect(csp).not.toContain("*")
    expect(csp).not.toContain("http:")
    expect(csp).toContain("default-src 'self'")
  })

  it("cierra las vías que no se usan", () => {
    const csp = buildContentSecurityPolicy("proyecto.supabase.co")

    expect(csp).toContain("object-src 'none'")
    // Nadie puede enmarcar el sitio: clickjacking.
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
  })

  it("no menciona SendGrid: el envío es servidor a servidor", () => {
    expect(buildContentSecurityPolicy("proyecto.supabase.co")).not.toContain("sendgrid")
  })

  it("sin Supabase configurado no añade un origen vacío ni roto", () => {
    const csp = buildContentSecurityPolicy(null)
    expect(csp).toContain("img-src 'self' data: blob:")
    expect(csp).not.toContain("https:// ")
    expect(csp).not.toContain("undefined")
  })
})

describe("securityHeaders", () => {
  it("por defecto la CSP va en Report-Only", () => {
    const keys = securityHeaders().map((header) => header.key)
    expect(keys).toContain("Content-Security-Policy-Report-Only")
    expect(keys).not.toContain("Content-Security-Policy")
    expect(isCspEnforced()).toBe(false)
  })

  it("con CSP_ENFORCE=true pasa a bloquear", () => {
    process.env.CSP_ENFORCE = "true"
    const keys = securityHeaders().map((header) => header.key)
    expect(keys).toContain("Content-Security-Policy")
    expect(keys).not.toContain("Content-Security-Policy-Report-Only")
  })

  it("incluye las cabeceras defensivas básicas", () => {
    const headers = new Map(securityHeaders().map((header) => [header.key, header.value]))

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(headers.get("X-Frame-Options")).toBe("DENY")
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin")
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin")
    expect(headers.get("Permissions-Policy")).toContain("camera=()")
  })

  it("no fija HSTS desde la aplicación", () => {
    // Ponerla en desarrollo sobre http://localhost obligaría al navegador a
    // recordar que ese host es solo-HTTPS y rompería el desarrollo local.
    const keys = securityHeaders().map((header) => header.key)
    expect(keys).not.toContain("Strict-Transport-Security")
  })

  it("ninguna cabecera filtra un secreto", () => {
    process.env.SENDGRID_API_KEY = "SG.no-debe-aparecer"
    const serialized = JSON.stringify(securityHeaders())
    expect(serialized).not.toContain("SG.no-debe-aparecer")
    delete process.env.SENDGRID_API_KEY
  })
})

describe("X-Robots-Tag", () => {
  function robotsTag(options?: { indexable?: boolean }): string | undefined {
    return new Map(securityHeaders(options).map((header) => [header.key, header.value])).get("X-Robots-Tag")
  }

  it("excluye de los buscadores un despliegue que no es el sitio oficial", () => {
    // Es el mecanismo que de verdad mantiene la demo fuera de los resultados, y
    // se aplica a todas las respuestas: también a las imágenes y a cualquier
    // archivo, que una etiqueta `<meta>` no alcanza.
    expect(robotsTag({ indexable: false })).toBe("noindex, nofollow")
  })

  it("no la emite en el sitio oficial", () => {
    expect(robotsTag({ indexable: true })).toBeUndefined()
  })

  it("excluye por defecto cuando no se le dice nada", () => {
    // El lado seguro: un sitio de más fuera de los buscadores es un problema
    // menor que un duplicado compitiendo contra el dominio del cliente.
    expect(robotsTag()).toBe("noindex, nofollow")
    expect(robotsTag({})).toBe("noindex, nofollow")
  })

  it("la decisión sale del dominio servido", () => {
    // La regla completa vive en lib/seo/indexing.ts y tiene sus propias pruebas;
    // aquí se comprueba que las dos piezas encajan.
    expect(robotsTag({ indexable: isSiteIndexable(CANONICAL_SITE_ORIGIN) })).toBeUndefined()
    expect(robotsTag({ indexable: isSiteIndexable("https://elportondelacondesa.solucionesbonicas.com") })).toBe(
      "noindex, nofollow"
    )
  })

  it("next.config.mjs pasa el valor real, no el de por defecto", () => {
    // Sin esta prueba, el fallo sería mudo: si alguien quita el argumento de
    // `securityHeaders()` en la configuración, todo sigue verde y el sitio
    // oficial deja de indexarse sin que nada avise. `headers.ts` no puede
    // importar `indexing.ts` por sí mismo —rompe el build—, así que este
    // acoplamiento solo existe en next.config.mjs y solo se puede fijar leyéndolo.
    const config = readFileSync("next.config.mjs", "utf8")

    expect(config).toContain("lib/seo/indexing.ts")
    expect(config).toContain("securityHeaders({ indexable: isSiteIndexable() })")
  })
})
