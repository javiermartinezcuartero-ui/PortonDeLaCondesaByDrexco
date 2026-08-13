import { describe, expect, it } from "vitest"
import { assertIsolatedTestDatabase, UnsafeTestDatabaseError } from "@/lib/testing/e2e-database-guard"

/**
 * Pruebas de la guardia que impide que las E2E vacíen una base que no sea de
 * pruebas. Todas las cadenas son ficticias.
 */

const LOCAL = "postgresql://porton_e2e:secreto-ficticio@127.0.0.1:55432/porton_e2e?schema=public"

describe("assertIsolatedTestDatabase — bases aceptadas", () => {
  it("acepta el contenedor local del proyecto y devuelve una descripción sin credenciales", () => {
    const described = assertIsolatedTestDatabase({ candidateUrl: LOCAL })

    expect(described).toBe("127.0.0.1:55432/porton_e2e")
    expect(described).not.toContain("secreto-ficticio")
    expect(described).not.toContain("porton_e2e:")
  })

  it("acepta localhost y host.docker.internal", () => {
    expect(() =>
      assertIsolatedTestDatabase({ candidateUrl: "postgresql://u:p@localhost:55432/cualquier_nombre" })
    ).not.toThrow()
    expect(() =>
      assertIsolatedTestDatabase({ candidateUrl: "postgresql://u:p@host.docker.internal:5432/db" })
    ).not.toThrow()
  })

  it("acepta un host remoto solo con permiso explícito y nombre de pruebas", () => {
    expect(() =>
      assertIsolatedTestDatabase({
        candidateUrl: "postgresql://u:p@postgres.ci.internal:5432/porton_e2e",
        allowNonLocal: true,
      })
    ).not.toThrow()
  })
})

describe("assertIsolatedTestDatabase — bases rechazadas", () => {
  it("rechaza que falte la variable", () => {
    expect(() => assertIsolatedTestDatabase({ candidateUrl: undefined })).toThrow(UnsafeTestDatabaseError)
    expect(() => assertIsolatedTestDatabase({ candidateUrl: "   " })).toThrow(/Falta E2E_DATABASE_URL/)
  })

  it("rechaza una cadena que no es una URL", () => {
    expect(() => assertIsolatedTestDatabase({ candidateUrl: "no-es-una-url" })).toThrow(/no es una URL válida/)
  })

  it("rechaza un protocolo que no sea postgres", () => {
    expect(() => assertIsolatedTestDatabase({ candidateUrl: "mysql://u:p@localhost:3306/db" })).toThrow(
      /Protocolo inesperado/
    )
  })

  it("rechaza una conexión sin nombre de base", () => {
    expect(() => assertIsolatedTestDatabase({ candidateUrl: "postgresql://u:p@localhost:55432" })).toThrow(
      /no indica ninguna base de datos/
    )
  })

  it("rechaza la base de la aplicación aunque sea local", () => {
    expect(() =>
      assertIsolatedTestDatabase({
        candidateUrl: "postgresql://u:p@localhost:5432/porton_dev",
        applicationUrl: "postgresql://otro:otra@localhost:5432/porton_dev",
      })
    ).toThrow(/la misma base que usa la aplicación/)
  })

  it("detecta la misma base aunque cambien los parámetros de conexión", () => {
    // El caso real: el pooler de Supabase se declara con `?pgbouncer=true` en
    // DATABASE_URL y sin él en DIRECT_URL. Comparar cadenas completas dejaría
    // pasar exactamente el accidente que se quiere evitar.
    expect(() =>
      assertIsolatedTestDatabase({
        candidateUrl: "postgresql://u:p@aws-0-eu-west-3.pooler.supabase.com:6543/postgres",
        applicationUrl: "postgresql://u:p@aws-0-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true",
        allowNonLocal: true,
      })
    ).toThrow(/la misma base que usa la aplicación/)
  })

  it("rechaza un host de Supabase sin permiso explícito", () => {
    expect(() =>
      assertIsolatedTestDatabase({
        candidateUrl: "postgresql://u:p@aws-0-eu-west-3.pooler.supabase.com:6543/postgres",
      })
    ).toThrow(/parece una base gestionada/)
  })

  it("rechaza cualquier host remoto sin permiso explícito", () => {
    expect(() =>
      assertIsolatedTestDatabase({ candidateUrl: "postgresql://u:p@10.20.30.40:5432/porton_e2e" })
    ).toThrow(/no es local/)
  })

  it("rechaza un host remoto permitido si el nombre de la base no delata que es de pruebas", () => {
    // Es el despiste más probable: dar el permiso y pegar la cadena de
    // producción, cuya base se llama "postgres".
    expect(() =>
      assertIsolatedTestDatabase({
        candidateUrl: "postgresql://u:p@db.proyecto.supabase.co:5432/postgres",
        allowNonLocal: true,
      })
    ).toThrow(/su nombre no contiene/)
  })

  it("no filtra la contraseña en ningún mensaje de error", () => {
    const secret = "contrasena-ficticia-que-no-debe-aparecer"
    try {
      assertIsolatedTestDatabase({ candidateUrl: `postgresql://usuario:${secret}@10.20.30.40:5432/postgres` })
      throw new Error("debería haber abortado")
    } catch (error) {
      expect(error).toBeInstanceOf(UnsafeTestDatabaseError)
      expect((error as Error).message).not.toContain(secret)
    }
  })
})
