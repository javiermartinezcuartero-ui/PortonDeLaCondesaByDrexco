import { describe, expect, it } from "vitest"
import { UTF8_BOM, buildCsv, toCsvCell } from "@/lib/domain/crm-export"

/**
 * La exportación es la salida más peligrosa del proyecto: un CSV sale del control
 * de acceso de la aplicación y se abre en Excel. Estas pruebas cubren lo que
 * puede convertir un archivo en un problema.
 */

describe("toCsvCell — inyección de fórmulas", () => {
  it("neutraliza los cuatro prefijos que Excel interpreta como fórmula", () => {
    // Sin esto, abrir el CSV ejecutaría la fórmula que escribió un desconocido en
    // el formulario público (CSV injection).
    expect(toCsvCell("=1+1")).toBe("'=1+1")
    expect(toCsvCell("+34600112233")).toBe("'+34600112233")
    expect(toCsvCell("-2")).toBe("'-2")
    expect(toCsvCell("@SUM(A1:A9)")).toBe("'@SUM(A1:A9)")
  })

  it("neutraliza también con espacios o tabuladores delante", () => {
    // Algunas versiones de Excel ignoran el espacio inicial y siguen viendo la
    // fórmula que hay detrás, así que el apóstrofo va en la **primera** posición
    // de la celda: ahí es donde Excel lo lee como "todo esto es texto". Ponerlo
    // después del espacio lo dejaría a la vista como un carácter más.
    expect(toCsvCell(' =HYPERLINK("http://x")')).toBe('"\' =HYPERLINK(""http://x"")"')
    expect(toCsvCell("\t=1+1")).toBe("'\t=1+1")
  })

  it("no toca un texto normal", () => {
    expect(toCsvCell("Boda en septiembre")).toBe("Boda en septiembre")
    expect(toCsvCell("María Ñúñez")).toBe("María Ñúñez")
  })

  it("entrecomilla y escapa lo que rompería el formato", () => {
    expect(toCsvCell('Dijo "sí"')).toBe('"Dijo ""sí"""')
    expect(toCsvCell("Primera;segunda")).toBe('"Primera;segunda"')
    expect(toCsvCell("Con\nsalto")).toBe('"Con\nsalto"')
  })

  it("convierte vacíos, fechas y booleanos de forma predecible", () => {
    expect(toCsvCell(null)).toBe("")
    expect(toCsvCell(undefined)).toBe("")
    expect(toCsvCell(true)).toBe("sí")
    expect(toCsvCell(false)).toBe("no")
    expect(toCsvCell(new Date("2027-06-12T10:00:00.000Z"))).toBe("2027-06-12T10:00:00.000Z")
  })
})

describe("buildCsv", () => {
  it("empieza con el BOM de UTF-8 para que Excel no destroce los acentos", () => {
    const csv = buildCsv(["Nombre"], [["Celebración"]])
    expect(csv.startsWith(UTF8_BOM)).toBe(true)
    expect(csv).toContain("Celebración")
  })

  it("usa punto y coma como separador y CRLF como fin de línea", () => {
    const csv = buildCsv(["A", "B"], [["1", "2"]])
    expect(csv).toBe(`${UTF8_BOM}A;B\r\n1;2\r\n`)
  })

  it("mantiene el número de columnas aunque haya valores vacíos", () => {
    const csv = buildCsv(["A", "B", "C"], [["1", null, "3"]])
    const dataLine = csv.replace(UTF8_BOM, "").split("\r\n")[1]
    expect(dataLine.split(";")).toHaveLength(3)
    expect(dataLine).toBe("1;;3")
  })
})
