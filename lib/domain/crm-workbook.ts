import ExcelJS from "exceljs"

/**
 * Serialización de una tabla del CRM a un libro de Excel (`.xlsx`).
 *
 * Sustituye al CSV que se descargaba antes. El cambio lo pidió el titular, y no es
 * solo de extensión: un `.xlsx` tiene **tipos**, y eso arregla los dos problemas que
 * tenía el archivo anterior al abrirse.
 *
 * 1. **Las fechas son fechas y los números son números.** En CSV todo era texto, así
 *    que Excel no podía ordenar por fecha ni sumar invitados sin que alguien
 *    convirtiera las columnas a mano. Peor: al abrir el archivo, Excel interpretaba
 *    algunas fechas ISO según la configuración regional y podía cambiar el día.
 * 2. **La inyección de fórmulas deja de ser un riesgo por construcción.** En CSV, un
 *    valor que empieza por `=`, `+`, `-` o `@` lo ejecuta la hoja de cálculo al
 *    abrirla, y el asunto de una solicitud es texto que escribe un desconocido; había
 *    que prefijarlo con un apóstrofo, que ensuciaba el dato. En `.xlsx` una celda
 *    lleva su tipo declarado: una cadena es una cadena, y solo es fórmula lo que se
 *    escribe explícitamente como tal. Aquí nunca se escribe ninguna, así que no hay
 *    nada que neutralizar y el texto llega íntegro.
 *
 * Lo que **no** cambia: la lista blanca de columnas y el registro de auditoría siguen
 * en `crm-export.ts`. Este módulo solo da forma a lo que ya se decidió exportar; no
 * lee de la base de datos y no sabe qué es un contacto.
 */

/** Ancho de columna, en caracteres. Se acota para que ni desaparezca ni desborde. */
const MIN_WIDTH = 12
const MAX_WIDTH = 48

/**
 * Formato de fecha con hora, en orden español. Se elige explícito y no se deja al
 * criterio de Excel: el mismo libro abierto en dos equipos con configuración regional
 * distinta mostraría 12/06 y 06/12 para la misma celda, y en una fecha de evento eso
 * es un error de seis meses.
 */
const DATE_FORMAT = "dd/mm/yyyy hh:mm"

export function buildWorkbook(sheetName: string, headers: string[], rows: unknown[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "El Portón de la Condesa"
  // Sin `created`/`modified`: exceljs pone la hora actual, y una marca de tiempo hace
  // que dos exportaciones del mismo dato den archivos distintos byte a byte, lo que
  // impide comprobar en una prueba que la salida es estable.

  const sheet = workbook.addWorksheet(sheetName, {
    // Encabezado siempre visible: una exportación de contactos tiene cientos de
    // filas y trece columnas, y sin esto se pierde de vista qué es cada una.
    views: [{ state: "frozen", ySplit: 1 }],
  })

  sheet.addRow(headers)
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEA" } }
  headerRow.alignment = { vertical: "middle" }

  for (const row of rows) {
    sheet.addRow(row.map(toCell))
  }

  // Filtro automático sobre el rango real: es lo que convierte la descarga en algo
  // que se puede usar sin tocar nada. Solo si hay datos; sobre una hoja vacía Excel
  // considera el archivo corrupto.
  if (rows.length > 0) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }
  }

  headers.forEach((header, index) => {
    const column = sheet.getColumn(index + 1)
    const longest = rows.reduce((max, row) => Math.max(max, cellLength(row[index])), header.length)
    column.width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longest + 2))
    if (rows.some((row) => row[index] instanceof Date)) column.numFmt = DATE_FORMAT
  })

  // Se devuelve como `ArrayBuffer` y no con el tipo propio de exceljs (`ExcelJS.Buffer`,
  // que lo extiende): así el tipo de la librería no se filtra a la ruta, y quien la
  // llame trabaja con un tipo estándar.
  return workbook.xlsx.writeBuffer()
}

/**
 * Valor listo para una celda, conservando el tipo cuando lo hay.
 *
 * `null` y `undefined` se convierten en cadena vacía y no se dejan pasar: exceljs
 * escribiría una celda vacía igualmente, pero un `undefined` explícito en una fila
 * desplaza las columnas siguientes en algunas versiones.
 */
function toCell(value: unknown): string | number | Date | boolean {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value
  if (typeof value === "number") return Number.isFinite(value) ? value : ""
  // Los booleanos se escriben en palabras y no como TRUE/FALSE: la columna dice
  // "Consiente marketing" y quien la lee espera sí o no, no un valor lógico en inglés.
  if (typeof value === "boolean") return value ? "sí" : "no"
  return String(value)
}

/** Longitud aproximada del valor ya pintado, para calcular el ancho de columna. */
function cellLength(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (value instanceof Date) return DATE_FORMAT.length
  return String(value).length
}
