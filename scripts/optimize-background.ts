/**
 * Prepara una fotografía de cámara para servirla como fondo a pantalla completa.
 *
 * `npm run images:optimize -- <origen> <destino> [ancho] [calidad]`
 *
 * Existe porque los originales no se pueden servir. Los dos fondos de las
 * bibliotecas llegaron con 4096×4096 (9 MB) y 5158×3439 (23 MB): son archivos de
 * cámara, y un fondo decorativo de 23 MB tarda más de medio minuto en una conexión
 * móvil, consume el ancho de banda facturable del despliegue y no se ve mejor,
 * porque debajo lleva un velo que tapa cualquier detalle fino.
 *
 * Los parámetros no son arbitrarios:
 *
 * - **El ancho y la calidad se pasan por argumento** porque el valor bueno depende
 *   de la fotografía, y eso se midió en lugar de suponerlo. Una imagen gráfica y de
 *   poca frecuencia comprime bien y conviene servirla grande; una de mucho detalle
 *   —polvo, especias, follaje— no comprime a ninguna calidad razonable y sale más
 *   barato bajarle la resolución que la calidad, porque reescalar filtra el detalle
 *   fino que se está pagando y que el velo iba a tapar de todas formas.
 * - **mozjpeg, y no WebP ni AVIF.** Contra la intuición, aquí los formatos modernos
 *   pesan MÁS: la foto de las cucharas da 941 KB en JPEG, 1,3 MB en WebP y 1,9 MB en
 *   AVIF al mismo ancho. Con texturas de altísima frecuencia la predicción de esos
 *   formatos no encuentra nada que predecir y el submuestreo de croma de JPEG gana.
 *   Por lo mismo el fondo va en CSS y no en `next/image`: el optimizador de Next
 *   serviría WebP y aquí eso sería un archivo más grande.
 * - **`chromaSubsampling: 4:2:0`**, el valor por omisión de mozjpeg, que aquí es el
 *   correcto: no hay texto ni líneas finas donde el submuestreo de color se note.
 * - Se **descartan los metadatos** (EXIF, GPS, perfil del fabricante). Una foto de
 *   cámara puede llevar coordenadas del lugar y modelo del equipo, y un fondo
 *   público no tiene por qué publicar eso. `withMetadata` se deja fuera a
 *   propósito; solo se conserva el perfil de color, vía `toColourspace`.
 *
 * El original no se toca: este script escribe una copia derivada. Los originales se
 * quedan fuera del control de versiones (ver .gitignore) porque son material de
 * partida, no un activo que haya que desplegar.
 */
import { mkdir, stat } from "node:fs/promises"
import { dirname } from "node:path"
import sharp from "sharp"

const DEFAULT_WIDTH = 1920
const DEFAULT_QUALITY = 66

async function main() {
  const [source, destination, widthArg, qualityArg] = process.argv.slice(2)

  if (!source || !destination) {
    console.error("Uso: npm run images:optimize -- <origen> <destino> [ancho] [calidad]")
    process.exit(1)
  }

  const width = widthArg ? Number.parseInt(widthArg, 10) : DEFAULT_WIDTH
  if (!Number.isInteger(width) || width < 320 || width > 6000) {
    console.error(`Ancho no válido: ${widthArg}. Se espera un entero entre 320 y 6000.`)
    process.exit(1)
  }

  const quality = qualityArg ? Number.parseInt(qualityArg, 10) : DEFAULT_QUALITY
  if (!Number.isInteger(quality) || quality < 30 || quality > 95) {
    console.error(`Calidad no válida: ${qualityArg}. Se espera un entero entre 30 y 95.`)
    process.exit(1)
  }

  const before = await stat(source)
  const original = await sharp(source).metadata()

  await mkdir(dirname(destination), { recursive: true })

  // `withoutEnlargement` evita reescalar hacia arriba una imagen que ya sea más
  // pequeña que el objetivo: ampliarla añadiría peso sin añadir detalle.
  const info = await sharp(source)
    .resize({ width, withoutEnlargement: true })
    .toColourspace("srgb")
    .jpeg({ quality, mozjpeg: true, progressive: true })
    .toFile(destination)

  const after = await stat(destination)
  const saved = 100 - (after.size / before.size) * 100

  console.log(`${source} → ${destination}`)
  console.log(`  ${original.width}×${original.height} → ${info.width}×${info.height}`)
  console.log(
    `  ${mb(before.size)} → ${mb(after.size)} (${saved.toFixed(1)} % menos, calidad ${quality})`
  )
}

function mb(bytes: number): string {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
