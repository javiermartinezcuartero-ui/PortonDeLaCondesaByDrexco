import { crc32, deflateSync } from "node:zlib"

/**
 * Genera un PNG válido en memoria para la prueba de subida.
 *
 * Se construye byte a byte en vez de guardar un archivo binario en el
 * repositorio por dos motivos: un `.png` versionado es un archivo que nadie
 * revisa y que crece con cada variante, y sobre todo porque la validación del
 * servidor (`lib/storage/validate-image.ts`) comprueba la **firma real de bytes
 * y las dimensiones leídas de la cabecera**. Un archivo generado aquí prueba ese
 * camino de verdad; un placeholder de 1x1 lo suspendería por tamaño mínimo.
 */

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)

  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data])

  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(typeAndData), 0)

  return Buffer.concat([length, typeAndData, checksum])
}

/**
 * PNG en escala de grises de `size` x `size` píxeles.
 *
 * @param size lado en píxeles. Debe ser ≥ MIN_IMAGE_DIMENSION (200).
 */
export function makePng(size = 400): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(size, 0) // ancho
  ihdrData.writeUInt32BE(size, 4) // alto
  ihdrData.writeUInt8(8, 8) // 8 bits por muestra
  ihdrData.writeUInt8(0, 9) // tipo de color 0: escala de grises, 1 canal
  ihdrData.writeUInt8(0, 10) // compresión deflate (el único valor válido)
  ihdrData.writeUInt8(0, 11) // filtrado estándar
  ihdrData.writeUInt8(0, 12) // sin entrelazado

  // Cada línea lleva delante su byte de filtro (0 = sin filtro). Se rellena con
  // un degradado simple para que la imagen no sea un rectángulo plano.
  const raw = Buffer.alloc((size + 1) * size)
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size + 1)
    raw[rowStart] = 0
    for (let x = 0; x < size; x++) {
      raw[rowStart + 1 + x] = (x + y) % 256
    }
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdrData),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}
