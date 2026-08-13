/**
 * Escáner de secretos sobre **todo el historial de Git**.
 *
 * Uso:
 *   npm run secrets:history
 *
 * Por qué hace falta, si ya existe el escáner del árbol
 * (`lib/security/secrets-scan.test.ts`): porque limpiar el árbol no limpia el
 * historial. Un secreto añadido en un commit y borrado en el siguiente sigue
 * estando en el primero, y en GitHub sigue siendo consultable con la URL del
 * commit para siempre. El escáner del árbol diría que todo está bien.
 *
 * Qué revisa: todas las versiones de todos los archivos de todos los commits
 * alcanzables desde cualquier referencia (`git rev-list --all`), incluidas ramas
 * que no sean `main`. Los blobs se deduplican por SHA: un archivo que no cambia
 * entre veinte commits se lee una vez.
 *
 * Qué NO revisa:
 *
 * - Objetos sueltos que no pertenecen a ningún commit alcanzable (un `git
 *   commit --amend` deja el anterior colgando). No se publican al hacer push, así
 *   que no son una fuga; si aparecen en el reflog local y se quiere estar
 *   seguro, `git reflog expire --expire=now --all && git gc --prune=now`.
 * - Mensajes de commit. Se revisan aparte, más abajo.
 * - Archivos binarios y `package-lock.json` (ver SKIPPED_FILES).
 *
 * Salida: 0 si está limpio, 1 si encuentra algo. Pensado para poder colgarlo de
 * CI sin más envoltorio.
 */
import { execFileSync, spawnSync } from "node:child_process"
import {
  SECRET_PATTERNS,
  isAllowedFinding,
  isScannedFile,
  isSkippedFile,
  normalizePath,
} from "@/lib/security/secret-patterns"

const MAX_BLOB_BYTES = 2 * 1024 * 1024

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
}

function lines(output: string): string[] {
  return output.split("\n").map((line) => line.trim()).filter(Boolean)
}

type Blob = { sha: string; paths: Set<string>; commits: Set<string> }

/** Recorre el árbol de cada commit y agrupa por SHA de blob. */
function collectBlobs(commits: string[]): Map<string, Blob> {
  const blobs = new Map<string, Blob>()

  for (const commit of commits) {
    // `-r` recursivo, y se filtra a `blob` porque también salen árboles y
    // submódulos.
    for (const line of lines(git(["ls-tree", "-r", commit]))) {
      // <modo> <tipo> <sha>\t<ruta>
      const match = /^(\d+)\s+(\w+)\s+([0-9a-f]{40})\t(.+)$/.exec(line)
      if (!match) continue

      const [, , type, sha, rawPath] = match
      if (type !== "blob") continue

      const path = normalizePath(rawPath)
      if (!isScannedFile(path) || isSkippedFile(path)) continue

      const existing = blobs.get(sha)
      if (existing) {
        existing.paths.add(path)
        existing.commits.add(commit)
        continue
      }
      blobs.set(sha, { sha, paths: new Set([path]), commits: new Set([commit]) })
    }
  }

  return blobs
}

/**
 * Lee varios blobs con un solo proceso.
 *
 * `git cat-file -p` por blob serían cientos de procesos, y en Windows eso son
 * decenas de segundos. `--batch` acepta los SHA por stdin y devuelve
 * `<sha> blob <tamaño>\n<contenido>\n` por cada uno.
 */
function readBlobs(shas: string[]): Map<string, string> {
  const contents = new Map<string, string>()
  if (!shas.length) return contents

  // Sin `encoding`, `spawnSync` devuelve Buffers, que es lo que hace falta: el
  // tamaño que anuncia la cabecera va en bytes, no en caracteres, y con UTF-8 las
  // dos cosas no coinciden. (Pasar `encoding: "buffer"` no sirve: Node lo aplica
  // también a `input` y falla al convertir la cadena de SHAs.)
  const result = spawnSync("git", ["cat-file", "--batch"], {
    input: `${shas.join("\n")}\n`,
    maxBuffer: 512 * 1024 * 1024,
  })

  if (result.status !== 0) {
    throw new Error(`git cat-file --batch falló: ${result.stderr?.toString("utf8") ?? "sin detalle"}`)
  }

  const buffer = result.stdout
  let offset = 0

  while (offset < buffer.length) {
    const newline = buffer.indexOf(0x0a, offset)
    if (newline === -1) break

    const header = buffer.subarray(offset, newline).toString("utf8")
    offset = newline + 1

    const match = /^([0-9a-f]{40}) (\w+) (\d+)$/.exec(header)
    if (!match) {
      // "<sha> missing": no hay contenido que saltar.
      continue
    }

    const [, sha, , sizeText] = match
    const size = Number(sizeText)
    const body = buffer.subarray(offset, offset + size)
    offset += size + 1 // el salto de línea final

    if (size <= MAX_BLOB_BYTES) contents.set(sha, body.toString("utf8"))
  }

  return contents
}

/** Los mensajes de commit también se pueden llevar un secreto pegado. */
function scanCommitMessages(commits: string[]): string[] {
  const findings: string[] = []

  for (const commit of commits) {
    const message = git(["log", "-1", "--format=%B%n%an %ae", commit])
    for (const { name, regex } of SECRET_PATTERNS) {
      if (regex.test(message)) findings.push(`${commit.slice(0, 8)} (mensaje de commit): ${name}`)
    }
  }

  return findings
}

function main() {
  let commits: string[]
  try {
    commits = lines(git(["rev-list", "--all"]))
  } catch {
    console.error("No parece haber un repositorio de Git aquí.")
    process.exit(1)
  }

  if (!commits.length) {
    console.log("El repositorio no tiene commits todavía: no hay historial que revisar.")
    return
  }

  const blobs = collectBlobs(commits)
  const contents = readBlobs([...blobs.keys()])

  const findings: string[] = []
  const allowed: string[] = []

  for (const blob of blobs.values()) {
    const content = contents.get(blob.sha)
    if (content === undefined) continue

    for (const { name, regex } of SECRET_PATTERNS) {
      if (!regex.test(content)) continue

      // Un mismo blob puede haber vivido en varias rutas (un `git mv`). Si
      // cualquiera de ellas está permitida, se acepta: es el mismo contenido.
      const paths = [...blob.paths]
      if (paths.some((path) => isAllowedFinding(path, name))) {
        allowed.push(`${paths.join(", ")}: ${name}`)
        continue
      }

      const commit = [...blob.commits][0].slice(0, 8)
      findings.push(`${commit} ${paths.join(", ")}: ${name}`)
    }
  }

  findings.push(...scanCommitMessages(commits))

  console.log(`Commits revisados:      ${commits.length}`)
  console.log(`Versiones de archivo:   ${blobs.size} (deduplicadas por contenido)`)
  console.log(`Patrones aplicados:     ${SECRET_PATTERNS.length}`)
  if (allowed.length) {
    console.log(`Excepciones conocidas:  ${allowed.length}`)
    for (const entry of [...new Set(allowed)]) console.log(`  - ${entry}`)
  }

  if (!findings.length) {
    console.log("\nHistorial limpio: ningún secreto en ninguna versión de ningún archivo.")
    return
  }

  console.error(`\n${findings.length} hallazgo(s) en el historial:\n`)
  for (const finding of findings) console.error(`  - ${finding}`)
  console.error(
    "\nATENCIÓN: un secreto en el historial NO se arregla borrándolo en un commit nuevo.\n" +
      "Procedimiento en docs/publicacion-github.md §5. El primer paso es SIEMPRE rotar la\n" +
      "credencial: hay que darla por comprometida, se haya publicado el repositorio o no."
  )
  process.exit(1)
}

main()
