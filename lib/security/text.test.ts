import { describe, expect, it } from "vitest"
import { escapeHtml, stripControlCharacters } from "@/lib/security/text"

describe("stripControlCharacters", () => {
  it("elimina el byte NUL, que PostgreSQL no admite en texto", () => {
    const withNul = `Hola${String.fromCharCode(0)}mundo`
    expect(stripControlCharacters(withNul)).toBe("Holamundo")
  })

  it("conserva saltos de línea, retornos y tabuladores", () => {
    const text = "Primera línea\nSegunda\r\nTercera\tcon tabulador"
    expect(stripControlCharacters(text)).toBe(text)
  })

  it("no toca el contenido legible, ni acentos ni emojis", () => {
    const text = "Celebración en septiembre 🎉 — ¿nos visitas?"
    expect(stripControlCharacters(text)).toBe(text)
  })

  it("no destruye el texto que parece código: se guarda tal cual", () => {
    const text = '<script>alert("hola")</script> & \'comillas\''
    expect(stripControlCharacters(text)).toBe(text)
  })

  it("propaga undefined sin convertirlo en cadena", () => {
    expect(stripControlCharacters(undefined)).toBeUndefined()
  })
})

describe("escapeHtml", () => {
  it("escapa los caracteres que romperían un cuerpo HTML", () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;")
  })

  it("deja intacto el texto sin caracteres especiales", () => {
    expect(escapeHtml("Boda en septiembre para 120 invitados")).toBe("Boda en septiembre para 120 invitados")
  })
})
