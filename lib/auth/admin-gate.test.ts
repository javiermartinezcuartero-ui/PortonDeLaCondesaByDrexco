import { describe, expect, it } from "vitest"
import { isCredentialsLoginEnabled, matchesAdminGatePassword, readAdminGateConfig } from "@/lib/auth/admin-gate"

/**
 * La puerta de clave única es la parte del proyecto con menos margen de error:
 * quien la abre entra como administrador. Estas pruebas fijan las tres cosas que
 * la hacen aceptable —no hay valor por defecto, la clave sale del entorno y la
 * comparación es exacta— y una cuarta que es la que de verdad importa en un
 * repositorio público: que la clave no esté escrita en el código.
 */

const COMPLETA = {
  ADMIN_GATE_PASSWORD: "clave-de-prueba-ficticia",
  ADMIN_GATE_EMAIL: "admin@ejemplo.test",
  ADMIN_GATE_ACCOUNT_PASSWORD: "contrasena-de-prueba-ficticia",
} as unknown as NodeJS.ProcessEnv

describe("readAdminGateConfig", () => {
  it("lee las tres variables cuando están completas", () => {
    expect(readAdminGateConfig(COMPLETA)).toEqual({
      password: "clave-de-prueba-ficticia",
      email: "admin@ejemplo.test",
      accountPassword: "contrasena-de-prueba-ficticia",
    })
  })

  it("sin configuración devuelve null: no hay acceso por defecto", () => {
    // Es la propiedad que hace segura la puerta en un despliegue a medio
    // configurar. Un valor por defecto aquí sería una puerta abierta.
    expect(readAdminGateConfig({} as NodeJS.ProcessEnv)).toBeNull()
  })

  it.each([
    ["ADMIN_GATE_PASSWORD", "falta la clave"],
    ["ADMIN_GATE_EMAIL", "falta la cuenta"],
    ["ADMIN_GATE_ACCOUNT_PASSWORD", "falta la contraseña de la cuenta"],
  ])("con %s ausente no se puede entrar (%s)", (variable) => {
    const parcial = { ...COMPLETA }
    delete parcial[variable as keyof NodeJS.ProcessEnv]

    expect(readAdminGateConfig(parcial)).toBeNull()
  })

  it("rechaza una clave demasiado corta", () => {
    // Sin mínimo, un despliegue podría quedar detrás de una clave de dos
    // caracteres y el rate limit no bastaría.
    expect(readAdminGateConfig({ ...COMPLETA, ADMIN_GATE_PASSWORD: "corta" } as NodeJS.ProcessEnv)).toBeNull()
  })

  it("ignora los espacios alrededor, que es como se pegan en un panel de Vercel", () => {
    const config = readAdminGateConfig({
      ...COMPLETA,
      ADMIN_GATE_PASSWORD: "  clave-de-prueba-ficticia  ",
    } as NodeJS.ProcessEnv)

    expect(config?.password).toBe("clave-de-prueba-ficticia")
  })

  it("una variable con solo espacios no vale como configurada", () => {
    expect(readAdminGateConfig({ ...COMPLETA, ADMIN_GATE_EMAIL: "   " } as NodeJS.ProcessEnv)).toBeNull()
  })
})

describe("matchesAdminGatePassword", () => {
  const esperada = "clave-de-prueba-ficticia"

  it("acepta la clave exacta", () => {
    expect(matchesAdminGatePassword(esperada, esperada)).toBe(true)
  })

  it("rechaza cualquier variación", () => {
    expect(matchesAdminGatePassword("otra-cosa", esperada)).toBe(false)
    expect(matchesAdminGatePassword("", esperada)).toBe(false)
    // Sin recortes ni normalizaciones: la clave es la que es.
    expect(matchesAdminGatePassword(`${esperada} `, esperada)).toBe(false)
    expect(matchesAdminGatePassword(esperada.toUpperCase(), esperada)).toBe(false)
  })

  it("no se rinde antes de tiempo con longitudes distintas", () => {
    // El motivo de comparar digests de 32 bytes y no las cadenas: con
    // `timingSafeEqual` sobre los valores, una longitud distinta habría que
    // descartarla antes de comparar, y eso filtra la longitud correcta por el
    // tiempo de respuesta. Aquí toda comparación cuesta lo mismo.
    expect(matchesAdminGatePassword("x", esperada)).toBe(false)
    expect(matchesAdminGatePassword("x".repeat(500), esperada)).toBe(false)
  })
})

describe("isCredentialsLoginEnabled", () => {
  it("solo el valor exacto \"true\" abre la segunda puerta", () => {
    // Es lo que hace que el despliegue tenga una sola forma de entrar. Cualquier
    // otro valor —incluido "TRUE" o "1"— deja la ruta en 404.
    expect(isCredentialsLoginEnabled({ ENABLE_CREDENTIALS_LOGIN: "true" } as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(isCredentialsLoginEnabled({ ENABLE_CREDENTIALS_LOGIN: "  true  " } as unknown as NodeJS.ProcessEnv)).toBe(true)

    for (const valor of ["TRUE", "True", "1", "yes", "sí", "false", ""]) {
      expect(
        isCredentialsLoginEnabled({ ENABLE_CREDENTIALS_LOGIN: valor } as unknown as NodeJS.ProcessEnv),
        `"${valor}" no debe abrir la puerta`
      ).toBe(false)
    }
  })

  it("cerrada por defecto", () => {
    expect(isCredentialsLoginEnabled({} as NodeJS.ProcessEnv)).toBe(false)
  })

  it("el entorno real de este proyecto la tiene cerrada", () => {
    // Vitest no carga .env.e2e, así que aquí se lee el entorno de desarrollo: si
    // alguien añadiera la variable a .env, esta prueba lo diría.
    expect(isCredentialsLoginEnabled()).toBe(false)
  })
})
