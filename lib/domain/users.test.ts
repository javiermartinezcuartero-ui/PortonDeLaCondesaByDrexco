import { describe, expect, it } from "vitest"
import { isValidRole, leavesSystemWithoutAdmin } from "@/lib/domain/users"

/**
 * El guardián del último administrador.
 *
 * Se prueba aquí como función pura porque la rama que importa —"queda exactamente
 * un ADMIN"— no se puede provocar de forma fiable contra la base de desarrollo:
 * es compartida y siempre tiene administradores reales. La alternativa habría sido
 * degradar cuentas de verdad para forzar el escenario, o dejar sin cobertura la
 * única comprobación que evita un bloqueo irrecuperable.
 */

describe("leavesSystemWithoutAdmin", () => {
  it("bloquea degradar al último ADMIN", () => {
    expect(leavesSystemWithoutAdmin("ADMIN", "SALES", 1)).toBe(true)
    expect(leavesSystemWithoutAdmin("ADMIN", "CONTENT", 1)).toBe(true)
  })

  it("permite degradar a un ADMIN cuando queda otro", () => {
    expect(leavesSystemWithoutAdmin("ADMIN", "SALES", 2)).toBe(false)
    expect(leavesSystemWithoutAdmin("ADMIN", "CONTENT", 7)).toBe(false)
  })

  it("no bloquea nada si quien cambia no era ADMIN", () => {
    expect(leavesSystemWithoutAdmin("SALES", "CONTENT", 1)).toBe(false)
    expect(leavesSystemWithoutAdmin("CONTENT", "SALES", 1)).toBe(false)
  })

  it("no bloquea promover a ADMIN, ni con cero administradores", () => {
    // El caso de recuperación: si el sistema ya se quedó sin administración (por
    // ejemplo tras restaurar una copia), promover debe seguir siendo posible.
    expect(leavesSystemWithoutAdmin("SALES", "ADMIN", 0)).toBe(false)
    expect(leavesSystemWithoutAdmin("ADMIN", "ADMIN", 1)).toBe(false)
  })

  it("con cero administradores no impide degradar a quien no lo es", () => {
    expect(leavesSystemWithoutAdmin("SALES", "CONTENT", 0)).toBe(false)
  })
})

describe("isValidRole", () => {
  it("acepta los tres roles del sistema", () => {
    expect(isValidRole("ADMIN")).toBe(true)
    expect(isValidRole("SALES")).toBe(true)
    expect(isValidRole("CONTENT")).toBe(true)
  })

  it("rechaza cualquier otra cosa", () => {
    for (const value of ["SUPERADMIN", "admin", "", "OWNER", "ADMIN "]) {
      expect(isValidRole(value)).toBe(false)
    }
  })
})
