import { describe, expect, it } from "vitest"
import { normalizeEmail, normalizePhone } from "@/lib/domain/normalize"

describe("normalizeEmail", () => {
  it("recorta espacios y pasa a minúsculas", () => {
    expect(normalizeEmail("  Laura.Ejemplo@GMAIL.com ")).toBe("laura.ejemplo@gmail.com")
  })
})

describe("normalizePhone", () => {
  it("añade +34 a un número español de 9 dígitos sin prefijo", () => {
    expect(normalizePhone("619 86 54 03")).toBe("+34619865403")
  })

  it("conserva el prefijo internacional si ya lo tiene", () => {
    expect(normalizePhone("+34 619 86 54 03")).toBe("+34619865403")
  })

  it("no añade +34 a números que no tienen 9 dígitos", () => {
    expect(normalizePhone("123")).toBe("123")
  })
})
