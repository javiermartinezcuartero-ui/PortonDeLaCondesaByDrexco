/**
 * Genera `.env.e2e` con secretos aleatorios.
 *
 * Idempotente y **no destructivo**: si el archivo ya existe no lo toca. Sobrescribirlo
 * cambiaría la contraseña del contenedor de PostgreSQL sin cambiar la del volumen
 * ya creado, y las conexiones empezarían a fallar con un error que no dice eso.
 *
 * Uso: npm run e2e:env
 */
import { randomBytes } from "node:crypto"
import { existsSync, writeFileSync } from "node:fs"

const TARGET = ".env.e2e"

if (existsSync(TARGET)) {
  console.log(`${TARGET} ya existe: no se toca. Bórralo a mano si quieres regenerarlo`)
  console.log("(si lo regeneras, ejecuta también `npm run e2e:db:reset` para recrear el contenedor).")
  process.exit(0)
}

const hex = (bytes) => randomBytes(bytes).toString("hex")
// `base64url` no incluye `+`, `/` ni `=`: así la contraseña no necesita
// escaparse dentro de una cadena de conexión.
const password = () => `${randomBytes(12).toString("base64url")}aA1`

const dbPassword = password()
const connection = `postgresql://porton_e2e:${dbPassword}@127.0.0.1:55432/porton_e2e?schema=public`

const content = `# Generado por \`npm run e2e:env\`. NO se versiona.
# Todos los valores son ficticios y locales: solo sirven para el contenedor de
# docker-compose.e2e.yml y para el servidor de pruebas.

E2E_POSTGRES_USER=porton_e2e
E2E_POSTGRES_PASSWORD=${dbPassword}
E2E_POSTGRES_DB=porton_e2e

E2E_DATABASE_URL=${connection}

E2E_BASE_URL=http://localhost:3100

E2E_BETTER_AUTH_SECRET=${hex(32)}
E2E_RATE_LIMIT_HASH_SECRET=${hex(32)}
E2E_VIP_TOKEN_HASH_SECRET=${hex(32)}

E2E_ADMIN_EMAIL=admin.e2e@portondelacondesa.test
E2E_ADMIN_PASSWORD=${password()}
E2E_SALES_EMAIL=comercial.e2e@portondelacondesa.test
E2E_SALES_PASSWORD=${password()}
E2E_CONTENT_EMAIL=contenido.e2e@portondelacondesa.test
E2E_CONTENT_PASSWORD=${password()}
`

writeFileSync(TARGET, content)
console.log(`${TARGET} creado con secretos aleatorios.`)
console.log("Siguiente paso: npm run e2e:setup")
