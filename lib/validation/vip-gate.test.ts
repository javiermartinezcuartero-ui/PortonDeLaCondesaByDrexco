import { describe, expect, it } from "vitest"
import { vipGateSchema } from "@/lib/validation/vip-gate"
import { PRIVACY_POLICY_VERSION } from "@/lib/legal"

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    email: "persona@example.test",
    privacyConsent: true,
    policyVersion: PRIVACY_POLICY_VERSION,
    marketingConsent: false,
    section: "REAL_WEDDING",
    ...overrides,
  }
}

describe("vipGateSchema — email", () => {
  it.each(["persona@example.test", "nombre.apellido+etiqueta@dominio.co.uk"])("acepta %s", (email) => {
    expect(vipGateSchema.safeParse(baseInput({ email })).success).toBe(true)
  })

  it.each([["vacío", ""], ["sin arroba", "personaexample.test"], ["sin dominio", "persona@"], ["solo espacios", "   "]])(
    "rechaza un email %s",
    (_descripcion, email) => {
      expect(vipGateSchema.safeParse(baseInput({ email })).success).toBe(false)
    }
  )

  it("recorta espacios alrededor del email", () => {
    const parsed = vipGateSchema.parse(baseInput({ email: "  persona@example.test  " }))
    expect(parsed.email).toBe("persona@example.test")
  })
})

describe("vipGateSchema — consentimientos", () => {
  it("exige la privacidad de forma explícita", () => {
    expect(vipGateSchema.safeParse(baseInput({ privacyConsent: false })).success).toBe(false)
    expect(vipGateSchema.safeParse(baseInput({ privacyConsent: undefined })).success).toBe(false)
    // No basta con un valor "truthy": tiene que ser literalmente true.
    expect(vipGateSchema.safeParse(baseInput({ privacyConsent: "si" })).success).toBe(false)
  })

  it("el marketing es opcional y por defecto false", () => {
    const parsed = vipGateSchema.parse(baseInput({ marketingConsent: undefined }))
    expect(parsed.marketingConsent).toBe(false)
  })

  it("acepta el marketing marcado", () => {
    expect(vipGateSchema.parse(baseInput({ marketingConsent: true })).marketingConsent).toBe(true)
  })
})

describe("vipGateSchema — honeypot", () => {
  it("acepta el campo vacío o ausente (persona)", () => {
    expect(vipGateSchema.safeParse(baseInput({ honeypot: "" })).success).toBe(true)
    expect(vipGateSchema.safeParse(baseInput()).success).toBe(true)
  })

  it("rechaza el campo relleno (bot)", () => {
    expect(vipGateSchema.safeParse(baseInput({ honeypot: "http://spam.example.com" })).success).toBe(false)
  })
})

describe("vipGateSchema — sección y ruta de retorno", () => {
  it.each(["REAL_WEDDING", "CATERING_EVENT"])("acepta la sección %s", (section) => {
    expect(vipGateSchema.safeParse(baseInput({ section })).success).toBe(true)
  })

  it("rechaza una sección inexistente", () => {
    expect(vipGateSchema.safeParse(baseInput({ section: "CUMPLEANOS" })).success).toBe(false)
  })

  it.each(["/bodas-reales", "/catering/gala-empresa-alcayna"])("acepta la ruta interna %s", (returnPath) => {
    expect(vipGateSchema.safeParse(baseInput({ returnPath })).success).toBe(true)
  })

  it.each([
    ["absoluta", "https://evil.example.com"],
    ["protocol-relative", "//evil.example.com"],
    ["sin barra inicial", "bodas-reales"],
  ])("rechaza la ruta de retorno %s", (_descripcion, returnPath) => {
    expect(vipGateSchema.safeParse(baseInput({ returnPath })).success).toBe(false)
  })
})

describe("vipGateSchema — atribución", () => {
  it("es opcional", () => {
    expect(vipGateSchema.parse(baseInput()).attribution).toBeUndefined()
  })

  it("conserva los UTM y el referrer", () => {
    const parsed = vipGateSchema.parse(
      baseInput({
        attribution: {
          utmSource: "instagram",
          utmMedium: "social",
          utmCampaign: "bodas-2026",
          referrer: "https://www.instagram.com/",
        },
      })
    )
    expect(parsed.attribution).toMatchObject({ utmSource: "instagram", utmCampaign: "bodas-2026" })
  })

  it("convierte los campos vacíos en undefined en vez de guardar cadenas vacías", () => {
    const parsed = vipGateSchema.parse(baseInput({ attribution: { utmSource: "", utmMedium: "  " } }))
    expect(parsed.attribution?.utmSource).toBeUndefined()
    expect(parsed.attribution?.utmMedium).toBeUndefined()
  })
})

describe("vipGateSchema — versión de la política", () => {
  it("la exige: sin ella no se puede registrar sobre qué texto se consintió", () => {
    // Antes de la auditoría final el esquema no tenía este campo y el gate guardaba
    // la constante del servidor, así que `policyVersion` podía acabar apuntando a un
    // texto que la persona nunca vio. Es justo el campo que existe para demostrar lo
    // contrario.
    const { policyVersion: _omitida, ...sinVersion } = baseInput()
    expect(vipGateSchema.safeParse(sinVersion).success).toBe(false)
  })

  it("acepta la versión vigente y la conserva tal cual", () => {
    const parsed = vipGateSchema.parse(baseInput())
    expect(parsed.policyVersion).toBe(PRIVACY_POLICY_VERSION)
  })

  it("acepta una versión distinta: quien decide si vale es el servidor, no el esquema", () => {
    // El esquema solo comprueba la forma. La comparación con la vigente la hace
    // `submitVipGateAction`, que devuelve `policy-version-mismatch`: así el error es
    // distinguible de un payload malformado y el cliente puede pedir recargar.
    const parsed = vipGateSchema.parse(baseInput({ policyVersion: "1999-01" }))
    expect(parsed.policyVersion).toBe("1999-01")
  })
})
