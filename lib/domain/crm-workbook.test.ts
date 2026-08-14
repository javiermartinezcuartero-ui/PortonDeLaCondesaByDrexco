import ExcelJS from "exceljs"
import { describe, expect, it } from "vitest"
import { buildWorkbook } from "@/lib/domain/crm-workbook"

/**
 * La exportación es la salida más peligrosa del proyecto: sale del control de acceso de
 * la aplicación y se abre en el equipo de alguien.
 *
 * Estas pruebas **releen el archivo generado** en lugar de comprobar la llamada a la
 * librería. Es la diferencia entre afirmar que se escribió algo y afirmar que ese algo
 * es un libro de Excel válido con las celdas correctas: un `.xlsx` es un ZIP con varios
 * XML dentro, y un error de estructura no lo detecta nadie hasta que Excel se niega a
 * abrirlo.
 *
 * Sustituyen a las pruebas del CSV que había antes, cuyo tema central era neutralizar
 * fórmulas. Aquí ese problema se comprueba igual, pero al revés: lo que se verifica es
 * que **ya no hace falta neutralizar nada**.
 */

/** Abre el libro generado y devuelve su primera hoja. */
async function leerHoja(buffer: ArrayBuffer) {
  const libro = new ExcelJS.Workbook()
  await libro.xlsx.load(buffer)
  const hoja = libro.worksheets[0]
  if (!hoja) throw new Error("El libro no tiene ninguna hoja")
  return hoja
}

describe("buildWorkbook — el archivo se abre y tiene lo que debe", () => {
  it("genera un libro válido, con la hoja nombrada y el encabezado en la primera fila", async () => {
    const hoja = await leerHoja(await buildWorkbook("Contactos", ["Nombre", "Email"], [["Ana", "ana@example.test"]]))

    expect(hoja.name).toBe("Contactos")
    expect(hoja.getRow(1).values).toEqual([undefined, "Nombre", "Email"])
    expect(hoja.getRow(2).getCell(1).value).toBe("Ana")
    expect(hoja.getRow(2).getCell(2).value).toBe("ana@example.test")
  })

  it("conserva los acentos", async () => {
    // En CSV esto exigía un BOM: sin él, Excel abría "Celebración" como "CelebraciÃ³n".
    // Un `.xlsx` guarda el XML en UTF-8 por norma, así que el problema desaparece.
    const hoja = await leerHoja(await buildWorkbook("H", ["Título"], [["Celebración en Molina de Segura"]]))

    expect(hoja.getRow(1).getCell(1).value).toBe("Título")
    expect(hoja.getRow(2).getCell(1).value).toBe("Celebración en Molina de Segura")
  })

  it("mantiene el número de columnas aunque haya valores vacíos", async () => {
    const hoja = await leerHoja(await buildWorkbook("H", ["A", "B", "C"], [["1", null, "3"]]))

    expect(hoja.getRow(2).getCell(1).value).toBe("1")
    expect(hoja.getRow(2).getCell(2).value).toBe("")
    expect(hoja.getRow(2).getCell(3).value).toBe("3")
  })
})

describe("buildWorkbook — tipos de celda", () => {
  it("escribe las fechas como fecha, no como texto", async () => {
    // Es la razón de haber pasado de CSV a Excel: con texto, quien recibe el archivo no
    // puede ordenar por fecha ni filtrar por mes sin convertir la columna a mano.
    const fecha = new Date("2027-06-12T10:00:00.000Z")
    const hoja = await leerHoja(await buildWorkbook("H", ["Fecha del evento"], [[fecha]]))

    const celda = hoja.getRow(2).getCell(1)
    expect(celda.value).toBeInstanceOf(Date)
    expect((celda.value as Date).toISOString()).toBe(fecha.toISOString())
  })

  it("da a la columna de fechas un formato explícito, y no el del equipo que la abre", async () => {
    // Sin formato declarado, el mismo libro muestra 12/06 y 06/12 según la
    // configuración regional. En una fecha de evento, eso son seis meses de error.
    const hoja = await leerHoja(await buildWorkbook("H", ["Fecha"], [[new Date("2027-06-12T10:00:00.000Z")]]))

    expect(hoja.getColumn(1).numFmt).toBe("dd/mm/yyyy hh:mm")
  })

  it("escribe los números como número", async () => {
    const hoja = await leerHoja(await buildWorkbook("H", ["Invitados"], [[120]]))

    expect(hoja.getRow(2).getCell(1).value).toBe(120)
    expect(typeof hoja.getRow(2).getCell(1).value).toBe("number")
  })

  it("escribe los booleanos en palabras, no como TRUE/FALSE", async () => {
    // La columna se llama "Consiente marketing": quien la lee espera sí o no.
    const hoja = await leerHoja(await buildWorkbook("H", ["Consiente"], [[true], [false]]))

    expect(hoja.getRow(2).getCell(1).value).toBe("sí")
    expect(hoja.getRow(3).getCell(1).value).toBe("no")
  })
})

describe("buildWorkbook — la inyección de fórmulas ya no es posible", () => {
  it("un texto que empieza por = queda como texto y no como fórmula", async () => {
    // El caso real: alguien escribe `=HYPERLINK(...)` en el mensaje del formulario
    // público. En CSV, Excel lo ejecutaba al abrir el archivo y había que prefijarlo
    // con un apóstrofo, lo que ensuciaba el dato. En `.xlsx` la celda declara su tipo.
    const peligrosos = ['=HYPERLINK("http://malicioso","pulsa")', "+34600112233", "-2", "@SUM(A1:A9)"]
    const hoja = await leerHoja(await buildWorkbook("H", ["Mensaje"], peligrosos.map((v) => [v])))

    peligrosos.forEach((valor, indice) => {
      const celda = hoja.getRow(indice + 2).getCell(1)
      // Ni fórmula, ni apóstrofo añadido: el texto llega tal cual se escribió.
      expect(celda.formula).toBeUndefined()
      expect(celda.value).toBe(valor)
    })
  })
})

describe("buildWorkbook — usable al abrirlo", () => {
  it("congela el encabezado y activa el filtro cuando hay datos", async () => {
    const hoja = await leerHoja(await buildWorkbook("H", ["A", "B"], [["1", "2"]]))

    expect(hoja.views[0]).toMatchObject({ state: "frozen", ySplit: 1 })
    expect(hoja.autoFilter).toBeTruthy()
  })

  it("no activa el filtro con la hoja vacía", async () => {
    // Excel considera corrupto un autoFilter sobre un rango sin datos, y una
    // exportación puede salir vacía sin más: basta un filtro que no case con nada.
    const hoja = await leerHoja(await buildWorkbook("H", ["A", "B"], []))

    expect(hoja.autoFilter).toBeFalsy()
    expect(hoja.getRow(1).values).toEqual([undefined, "A", "B"])
  })
})
