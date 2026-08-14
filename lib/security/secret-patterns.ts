/**
 * Patrones de secreto y excepciones verificadas, en un único sitio.
 *
 * Los usan dos escáneres distintos:
 *
 * - `lib/security/secrets-scan.test.ts` — el **árbol de trabajo**: lo que git
 *   subiría ahora mismo. Se ejecuta con `npm test`, así que una fuga rompe la
 *   suite antes de llegar a un commit.
 * - `scripts/secrets-scan-history.ts` — el **historial**: todas las versiones de
 *   todos los archivos de todos los commits. Se ejecuta con
 *   `npm run secrets:history`. Hace falta porque limpiar el árbol no limpia lo
 *   que ya se subió: un secreto borrado en un commit posterior sigue estando en
 *   el anterior, y en GitHub sigue siendo consultable.
 *
 * Tener la lista duplicada garantizaba que los dos escáneres se desviaran. Está
 * aquí, y cada uno la importa.
 *
 * Este archivo no dispara sus propios patrones: cada expresión regular exige
 * caracteres concretos justo después del prefijo, y en el código fuente lo que
 * sigue es siempre `[` o `\`. Comprobado, y con una prueba que lo fija.
 */

export type SecretPattern = { name: string; regex: RegExp }

export const SECRET_PATTERNS: SecretPattern[] = [
  { name: "clave secreta de Supabase (formato nuevo)", regex: /\bsb_secret_[A-Za-z0-9_-]{8,}/ },
  { name: "clave publicable de Supabase (formato nuevo)", regex: /\bsb_publishable_[A-Za-z0-9_-]{8,}/ },
  { name: "JWT de Supabase (anon/service_role)", regex: /\beyJhbGciOi[A-Za-z0-9_-]{10,}/ },
  // Sustituye al patrón de SendGrid, que se retiró junto con el proveedor: la lista
  // reconoce las credenciales que pueden aparecer en ESTE repositorio, y una de un
  // servicio que ya no se usa solo alarga una lista que hay que poder leer de un
  // vistazo.
  //
  // El formato es `re_` seguido de una cadena larga de letras, dígitos y guiones
  // bajos. **Sin guiones medios**, y eso no es un detalle: la primera versión del
  // patrón los admitía y marcaba como secreto la constante ficticia de
  // `lib/email/resend.test.ts` (`re_clave-de-prueba-…`), que es texto con guiones. Lo
  // detectó el propio escáner al ejecutar la suite. Ceñirse al formato real cumple dos
  // cosas a la vez: detecta mejor y deja fuera los valores de prueba, que se escriben
  // con guiones justo para no parecer una credencial.
  { name: "clave de API de Resend", regex: /\bre_[A-Za-z0-9_]{24,}\b/ },
  { name: "cadena de conexión de PostgreSQL con contraseña", regex: /postgres(?:ql)?:\/\/[^\s:@"']+:[^\s@"']+@/ },
  { name: "secreto hexadecimal de 64 caracteres", regex: /\b[0-9a-f]{64}\b/ },
  { name: "clave privada", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "token de GitHub", regex: /\bgh[pousr]_[A-Za-z0-9]{16,}/ },
  { name: "clave de AWS", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  // Los ocho patrones anteriores son formatos de proveedor: todos reconocen la
  // FORMA de una credencial concreta. Ninguno detecta una contraseña en claro, y
  // es justo la fuga que este proyecto ya tuvo —en la Fase 6 el README llegó a
  // contener la contraseña de administración— y la que sus runbooks siguen
  // arriesgando: `ADMIN_BOOTSTRAP_PASSWORD`, `DEMO_ADMIN_PASSWORD` y
  // `E2E_POSTGRES_PASSWORD` circulan por documentos versionados. Con el alta
  // pública desactivada a propósito, una de esas contraseñas publicada es acceso
  // ADMIN directo al CRM.
  //
  // Se cubren con dos patrones en lugar de uno porque hay dos formas distintas de
  // escribir el mismo error, y un patrón que intente las dos a la vez produce
  // ruido. Se aprendió por las malas: la primera versión usaba `\s*` después del
  // igual, `\s` incluye el salto de línea, y en `.env.example` acababa tomando el
  // NOMBRE de la variable siguiente como si fuera el valor de la anterior. Diez
  // falsos positivos. De ahí que aquí solo se admita `[ \t]`.
  {
    // 1. Literal entre comillas en código o documentación:
    //    `ADMIN_PASSWORD = "…"`, `"apiKey": "…"`.
    //
    // El valor tiene que ir ENTRECOMILLADO, lo que descarta de un golpe todo el
    // código legítimo que asigna desde otro sitio (`SECRET: process.env.X`,
    // `SECRET = requireVar(...)`): ahí el valor es una expresión, no un literal, y
    // no hay nada que filtrar.
    //
    // La exclusión de valores con marca de ficticio (`prueba`, `test`, `ejemplo`,
    // `no-debe-aparecer`…) evita tener que apuntar en la lista de excepciones cada
    // constante de los tests, que son seis archivos. El precio es explícito: una
    // contraseña real que contuviera la palabra "test" pasaría. Es un intercambio
    // asumido, porque un escáner con seis excepciones permanentes deja de leerse.
    //
    // El umbral son **12 caracteres**, no 8, y no es arbitrario: es el mínimo que
    // el propio proyecto exige a sus contraseñas (`ADMIN_BOOTSTRAP_PASSWORD` y
    // `DEMO_ADMIN_PASSWORD` los validan). Por debajo de 12 no puede haber una
    // credencial válida de este sistema, y en cambio sí hay literales cortos de
    // prueba como `"SG.clave"` que solo producirían ruido.
    name: "contraseña o secreto asignado en claro",
    regex:
      /\b[A-Z0-9_]*(?:PASSWORD|PASSWD|PASSPHRASE|SECRET|TOKEN|API_?KEY)[ \t]*[:=][ \t]*["'](?![^"'\n]*(?:prueba|test|ejemplo|fake|placeholder|dummy|no-debe-aparecer|CAMBIA|xxxx))[^"'\n]{12,}["']/,
  },
  {
    // 2. Línea de archivo de entorno con valor: `DB_PASSWORD=loQueSea`.
    //
    // Anclado a la línea completa (`^…$` con `m`). Las plantillas versionadas
    // terminan todas en `=` sin valor, así que no las toca; un `.env.production`
    // versionado por error, sí.
    //
    // `(?!\$\{)` descarta las interpolaciones: `scripts/e2e-env-init.mjs` compone
    // el archivo de pruebas con líneas como `E2E_POSTGRES_PASSWORD=${dbPassword}`,
    // que es una plantilla y no un valor. Solo se excluye cuando el valor
    // **empieza** por `${`, para no perder una contraseña real que contenga `$`.
    name: "variable de entorno con contraseña o secreto en claro",
    regex: /^[A-Z0-9_]*(?:PASSWORD|PASSWD|PASSPHRASE|SECRET|TOKEN|API_?KEY)=(?!\$\{)[^\s"'#]{12,}$/m,
  },
]

/** Extensiones de texto donde tiene sentido buscar. Se salta binarios y bloqueos. */
export const SCANNED_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|yaml|yml|sql|prisma|css|txt|example|toml)$/i

/**
 * Archivos de texto sin extensión que también se revisan.
 *
 * Filtrar solo por extensión dejaba fuera a `NOTICE`, y dejaría fuera a
 * `LICENSE`, a un `Dockerfile` o a un `Procfile` si algún día existen. Son
 * archivos de texto perfectamente capaces de llevar una cadena de conexión
 * pegada, y el escáner los habría dado por revisados sin abrirlos.
 */
export const SCANNED_FILENAMES = new Set([
  "NOTICE",
  "LICENSE",
  "LICENCE",
  "COPYING",
  "AUTHORS",
  "CODEOWNERS",
  "Dockerfile",
  "Procfile",
  "Makefile",
])

/**
 * Decide si un archivo entra en el escaneo: por extensión, por nombre conocido, o
 * por pertenecer a la familia `.env`.
 *
 * La familia `.env` va aparte porque es la que más importa y la que el filtro por
 * extensión dejaba fuera. `.env.example` colaba por casualidad —acaba en
 * `.example`, que está en la lista—, pero `.env`, `.env.local` o `.env.production`
 * no se habrían abierto nunca. Si alguna llega a estar versionada por un
 * `git add -f` o por un patrón mal escrito en `.gitignore`, lo mínimo es aplicarle
 * los patrones en vez de darla por revisada.
 */
export function isScannedFile(file: string): boolean {
  const path = normalizePath(file)
  const name = path.split("/").pop() ?? path
  return SCANNED_EXTENSIONS.test(path) || SCANNED_FILENAMES.has(name) || name.startsWith(".env")
}

/**
 * Archivos que se excluyen del escaneo por completo.
 *
 * `package-lock.json` porque son megabytes de hashes de integridad. Los dos
 * archivos de escaneo porque contienen —o contuvieron— los patrones que buscan:
 * `secret-patterns.ts` no se dispara a sí mismo, pero versiones anteriores del
 * test sí llevaban la lista dentro, y el escáner del historial las vería.
 */
export const SKIPPED_FILES = [
  "package-lock.json",
  "lib/security/secrets-scan.test.ts",
  "lib/security/secret-patterns.ts",
  // Contiene a propósito los casos POSITIVOS: contraseñas y cadenas de conexión
  // con la forma exacta que el escáner debe detectar. Sin ellos el escáner no
  // tendría ninguna prueba de que encuentra algo, que fue justo cómo pasó
  // inadvertido que no detectaba contraseñas en claro.
  "lib/security/secret-patterns.test.ts",
  "scripts/secrets-scan-history.ts",
]

/**
 * Falsos positivos conocidos y verificados uno a uno. Cada excepción lleva su
 * motivo: una lista sin explicación acaba silenciando fugas reales.
 */
export const ALLOWED_FINDINGS: Array<{ file: string; pattern: string; reason: string }> = [
  {
    file: "project-reference/data/image-manifest.json",
    pattern: "secreto hexadecimal de 64 caracteres",
    reason: "checksums SHA-256 de las imágenes del proyecto, versionados desde el primer commit",
  },
  {
    file: "docs/despliegue-vercel.md",
    pattern: "cadena de conexión de PostgreSQL con contraseña",
    reason:
      "plantillas de las cadenas de Supabase con las palabras USUARIO y CONTRASEÑA en lugar de valores. " +
      "El documento tiene que enseñar la forma exacta de la cadena (puerto 6543 con pgbouncer=true frente " +
      "a 5432 sin él) porque confundirlas es el error de configuración más frecuente del proyecto",
  },
  {
    file: "lib/testing/e2e-database-guard.test.ts",
    pattern: "cadena de conexión de PostgreSQL con contraseña",
    reason:
      "cadenas ficticias que la guardia de la base de pruebas tiene que rechazar. Una de ellas es " +
      "literalmente 'contrasena-ficticia-que-no-debe-aparecer', usada para comprobar que ningún mensaje " +
      "de error filtra la contraseña",
  },
  {
    file: "scripts/e2e-env-init.mjs",
    pattern: "cadena de conexión de PostgreSQL con contraseña",
    reason:
      "plantilla que compone la cadena del contenedor local con una contraseña generada al azar en " +
      "tiempo de ejecución (`${dbPassword}`). No hay ningún valor en el archivo; el resultado se escribe " +
      "en .env.e2e, que está en .gitignore",
  },
  {
    file: "docs/publicacion-github.md",
    pattern: "cadena de conexión de PostgreSQL con contraseña",
    reason:
      "el documento explica qué buscan los escáneres y muestra la forma de una cadena de conexión con " +
      "credenciales de ejemplo para que quien revise sepa reconocerla. No contiene ningún valor real",
  },
]

/** Normaliza separadores de Windows para comparar rutas de git. */
export function normalizePath(file: string): string {
  return file.replace(/\\/g, "/")
}

export function isSkippedFile(file: string): boolean {
  const path = normalizePath(file)
  return SKIPPED_FILES.some((skip) => path === skip || path.endsWith(`/${skip}`))
}

export function isAllowedFinding(file: string, pattern: string): boolean {
  const path = normalizePath(file)
  return ALLOWED_FINDINGS.some((entry) => path.endsWith(entry.file) && entry.pattern === pattern)
}

/** Devuelve los nombres de los patrones que aparecen en el contenido, sin excepciones aplicadas. */
export function matchingPatterns(content: string): string[] {
  return SECRET_PATTERNS.filter(({ regex }) => regex.test(content)).map(({ name }) => name)
}
