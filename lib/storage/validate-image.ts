/**
 * Validación de imágenes subidas al CMS. Se ejecuta **en servidor** sobre los
 * bytes reales del archivo, no sobre lo que declara el navegador: el `type` y
 * el nombre de un File son datos aportados por el cliente y se pueden falsear.
 *
 * Se comprueban, en este orden: tamaño, extensión declarada, MIME declarado,
 * firma real de bytes (magic number) coherente con ese MIME, y dimensiones
 * reales leídas de la cabecera del propio formato.
 *
 * Las dimensiones se leen a mano (PNG/JPEG/WebP) en vez de con `sharp`: sharp
 * ya arrastra vulnerabilidades conocidas en este proyecto (README §12) y para
 * leer una cabecera no hace falta decodificar el bitmap completo.
 */

/** 10 MB por imagen. Documentado en README §10 y docs/cms.md. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/** Mínimo razonable para un hero a pantalla completa; evita subir miniaturas por error. */
export const MIN_IMAGE_DIMENSION = 200
/** Tope para no guardar originales de cámara sin procesar en el bucket. */
export const MAX_IMAGE_DIMENSION = 8000

type AllowedFormat = {
  mimeType: string
  extensions: readonly string[]
  matches: (bytes: Uint8Array) => boolean
  readDimensions: (bytes: Uint8Array) => { width: number; height: number } | null
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false
  return signature.every((byte, index) => bytes[index] === byte)
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  return Array.from(bytes.slice(offset, offset + length))
    .map((byte) => String.fromCharCode(byte))
    .join("")
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const

function readPngDimensions(bytes: Uint8Array) {
  // 0-7 firma, 8-11 longitud del chunk, 12-15 "IHDR", 16-19 ancho, 20-23 alto.
  if (bytes.length < 24 || asciiAt(bytes, 12, 4) !== "IHDR") return null
  return { width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) }
}

function readJpegDimensions(bytes: Uint8Array) {
  // Recorre los marcadores hasta encontrar un SOF (Start Of Frame), que es
  // quien lleva las dimensiones reales. Los marcadores intermedios (EXIF,
  // comentarios, tablas de cuantización) se saltan por su longitud.
  let offset = 2
  const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = bytes[offset + 1]
    if (SOF_MARKERS.has(marker)) {
      // offset+2..3 longitud, +4 precisión, +5..6 alto, +7..8 ancho.
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6]
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8]
      return { width, height }
    }
    // 0xD8 (SOI) y 0xD9 (EOI) no llevan longitud; el resto sí.
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2
      continue
    }
    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3]
    if (segmentLength <= 0) return null
    offset += 2 + segmentLength
  }
  return null
}

function readWebpDimensions(bytes: Uint8Array) {
  if (bytes.length < 30) return null
  const chunk = asciiAt(bytes, 12, 4)

  if (chunk === "VP8 ") {
    // Lossy: ancho y alto son enteros de 14 bits a partir del offset 26.
    const width = ((bytes[27] << 8) | bytes[26]) & 0x3fff
    const height = ((bytes[29] << 8) | bytes[28]) & 0x3fff
    return { width, height }
  }
  if (chunk === "VP8L") {
    // Lossless: 14 bits de (ancho-1) y 14 de (alto-1) empaquetados desde el 21.
    const packed = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)
    return { width: (packed & 0x3fff) + 1, height: ((packed >> 14) & 0x3fff) + 1 }
  }
  if (chunk === "VP8X") {
    // Extendido: (ancho-1) y (alto-1) como enteros de 24 bits little-endian.
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16))
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16))
    return { width, height }
  }
  return null
}

const ALLOWED_FORMATS: readonly AllowedFormat[] = [
  {
    mimeType: "image/jpeg",
    extensions: [".jpg", ".jpeg"],
    matches: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
    readDimensions: readJpegDimensions,
  },
  {
    mimeType: "image/png",
    extensions: [".png"],
    matches: (bytes) => startsWith(bytes, PNG_SIGNATURE),
    readDimensions: readPngDimensions,
  },
  {
    mimeType: "image/webp",
    extensions: [".webp"],
    matches: (bytes) => asciiAt(bytes, 0, 4) === "RIFF" && asciiAt(bytes, 8, 4) === "WEBP",
    readDimensions: readWebpDimensions,
  },
]

export const ALLOWED_IMAGE_MIME_TYPES = ALLOWED_FORMATS.map((format) => format.mimeType)
export const ALLOWED_IMAGE_EXTENSIONS = ALLOWED_FORMATS.flatMap((format) => format.extensions)

export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidImageError"
  }
}

export type ValidatedImage = {
  mimeType: string
  extension: string
  sizeBytes: number
  width: number
  height: number
}

export type ImageCandidate = {
  bytes: Uint8Array
  /** MIME declarado por el cliente. Se valida contra la firma real. */
  declaredMimeType: string
  /** Nombre declarado por el cliente. Solo se usa para leer la extensión; nunca como nombre de objeto. */
  declaredFileName: string
}

export function validateImage(candidate: ImageCandidate): ValidatedImage {
  const { bytes, declaredMimeType, declaredFileName } = candidate

  if (bytes.length === 0) {
    throw new InvalidImageError("El archivo está vacío.")
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new InvalidImageError(
      `El archivo supera el máximo de ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB por imagen.`
    )
  }

  const normalizedMime = declaredMimeType.trim().toLowerCase()
  const format = ALLOWED_FORMATS.find((item) => item.mimeType === normalizedMime)
  if (!format) {
    throw new InvalidImageError(`Tipo de archivo no permitido. Se aceptan: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}.`)
  }

  const dotIndex = declaredFileName.lastIndexOf(".")
  const extension = dotIndex >= 0 ? declaredFileName.slice(dotIndex).toLowerCase() : ""
  if (!format.extensions.includes(extension)) {
    throw new InvalidImageError(
      `La extensión "${extension || "(sin extensión)"}" no corresponde a ${format.mimeType}.`
    )
  }

  // La comprobación que de verdad importa: los bytes reales del archivo.
  if (!format.matches(bytes)) {
    throw new InvalidImageError("El contenido del archivo no corresponde al tipo declarado.")
  }

  const dimensions = format.readDimensions(bytes)
  if (!dimensions || !dimensions.width || !dimensions.height) {
    throw new InvalidImageError("No se han podido leer las dimensiones de la imagen.")
  }
  if (dimensions.width < MIN_IMAGE_DIMENSION || dimensions.height < MIN_IMAGE_DIMENSION) {
    throw new InvalidImageError(`La imagen es demasiado pequeña (mínimo ${MIN_IMAGE_DIMENSION}px por lado).`)
  }
  if (dimensions.width > MAX_IMAGE_DIMENSION || dimensions.height > MAX_IMAGE_DIMENSION) {
    throw new InvalidImageError(`La imagen es demasiado grande (máximo ${MAX_IMAGE_DIMENSION}px por lado).`)
  }

  return {
    mimeType: format.mimeType,
    extension,
    sizeBytes: bytes.length,
    width: dimensions.width,
    height: dimensions.height,
  }
}
