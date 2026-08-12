import { describe, expect, it } from "vitest"
import {
  InvalidImageError,
  MAX_IMAGE_BYTES,
  MIN_IMAGE_DIMENSION,
  validateImage,
  type ImageCandidate,
} from "@/lib/storage/validate-image"

// Cabeceras mínimas reales de cada formato. No son imágenes completas: la
// validación solo lee la cabecera, que es exactamente lo que se quiere probar.

function pngBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(64)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8) // longitud del chunk IHDR
  bytes.set([0x49, 0x48, 0x44, 0x52], 12) // "IHDR"
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

function jpegBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(64)
  bytes.set([0xff, 0xd8, 0xff], 0) // SOI + inicio de marcador
  bytes.set([0xff, 0xc0], 2) // SOF0
  bytes.set([0x00, 0x11], 4) // longitud del segmento
  bytes[6] = 0x08 // precisión
  bytes[7] = (height >> 8) & 0xff
  bytes[8] = height & 0xff
  bytes[9] = (width >> 8) & 0xff
  bytes[10] = width & 0xff
  return bytes
}

function webpBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(64)
  const ascii = (text: string, offset: number) => {
    for (let index = 0; index < text.length; index += 1) bytes[offset + index] = text.charCodeAt(index)
  }
  ascii("RIFF", 0)
  ascii("WEBP", 8)
  ascii("VP8X", 12) // formato extendido: ancho/alto como enteros de 24 bits
  const w = width - 1
  const h = height - 1
  bytes[24] = w & 0xff
  bytes[25] = (w >> 8) & 0xff
  bytes[26] = (w >> 16) & 0xff
  bytes[27] = h & 0xff
  bytes[28] = (h >> 8) & 0xff
  bytes[29] = (h >> 16) & 0xff
  return bytes
}

function candidate(overrides: Partial<ImageCandidate> = {}): ImageCandidate {
  return {
    bytes: pngBytes(1200, 800),
    declaredMimeType: "image/png",
    declaredFileName: "foto.png",
    ...overrides,
  }
}

describe("validateImage — formatos válidos", () => {
  it("acepta un PNG y lee sus dimensiones reales de la cabecera", () => {
    const result = validateImage(candidate({ bytes: pngBytes(1920, 1080) }))
    expect(result).toMatchObject({ mimeType: "image/png", extension: ".png", width: 1920, height: 1080 })
  })

  it("acepta un JPEG leyendo el marcador SOF", () => {
    const result = validateImage(
      candidate({ bytes: jpegBytes(800, 600), declaredMimeType: "image/jpeg", declaredFileName: "foto.jpg" })
    )
    expect(result).toMatchObject({ mimeType: "image/jpeg", width: 800, height: 600 })
  })

  it("acepta .jpeg además de .jpg", () => {
    const result = validateImage(
      candidate({ bytes: jpegBytes(800, 600), declaredMimeType: "image/jpeg", declaredFileName: "foto.jpeg" })
    )
    expect(result.extension).toBe(".jpeg")
  })

  it("acepta un WebP extendido (VP8X)", () => {
    const result = validateImage(
      candidate({ bytes: webpBytes(1000, 750), declaredMimeType: "image/webp", declaredFileName: "foto.webp" })
    )
    expect(result).toMatchObject({ mimeType: "image/webp", width: 1000, height: 750 })
  })
})

describe("validateImage — rechazos", () => {
  it("rechaza un archivo vacío", () => {
    expect(() => validateImage(candidate({ bytes: new Uint8Array(0) }))).toThrow(InvalidImageError)
  })

  it("rechaza un tipo MIME no permitido (p. ej. SVG, que puede llevar scripts)", () => {
    expect(() =>
      validateImage(candidate({ declaredMimeType: "image/svg+xml", declaredFileName: "malicioso.svg" }))
    ).toThrow(/no permitido/i)
  })

  it("rechaza un PDF renombrado como imagen", () => {
    expect(() =>
      validateImage(candidate({ declaredMimeType: "application/pdf", declaredFileName: "documento.pdf" }))
    ).toThrow(/no permitido/i)
  })

  it("rechaza cuando la extensión no corresponde al MIME declarado", () => {
    expect(() => validateImage(candidate({ declaredFileName: "foto.jpg" }))).toThrow(/extensión/i)
  })

  it("rechaza cuando los bytes reales no corresponden al MIME declarado", () => {
    // Se declara PNG con extensión .png, pero el contenido es un JPEG: es el
    // caso que una comprobación por extensión/MIME dejaría pasar.
    expect(() => validateImage(candidate({ bytes: jpegBytes(900, 900) }))).toThrow(
      /contenido del archivo no corresponde/i
    )
  })

  it("rechaza un ejecutable disfrazado de PNG", () => {
    const fake = new Uint8Array(64)
    fake.set([0x4d, 0x5a, 0x90, 0x00], 0) // cabecera "MZ" de un .exe de Windows
    expect(() => validateImage(candidate({ bytes: fake }))).toThrow(/contenido del archivo no corresponde/i)
  })

  it("rechaza una imagen por debajo del mínimo de dimensiones", () => {
    const tiny = MIN_IMAGE_DIMENSION - 1
    expect(() => validateImage(candidate({ bytes: pngBytes(tiny, tiny) }))).toThrow(/demasiado pequeña/i)
  })

  it("rechaza una imagen por encima del máximo de dimensiones", () => {
    expect(() => validateImage(candidate({ bytes: pngBytes(12000, 12000) }))).toThrow(/demasiado grande/i)
  })

  it("rechaza un archivo que supera los 10 MB", () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1)
    big.set(pngBytes(1200, 800).slice(0, 24), 0)
    expect(() => validateImage(candidate({ bytes: big }))).toThrow(/MB por imagen/i)
  })

  it("rechaza un PNG cuya cabecera IHDR no es legible", () => {
    const broken = new Uint8Array(24)
    broken.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
    // Sin "IHDR" en el offset 12 no se pueden leer las dimensiones.
    expect(() => validateImage(candidate({ bytes: broken }))).toThrow(/dimensiones/i)
  })
})
