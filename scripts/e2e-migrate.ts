/**
 * Aplica las migraciones a la base de pruebas E2E.
 *
 * Se usa `prisma migrate deploy`, el mismo comando que en producción: aplica las
 * migraciones existentes en orden y no genera ninguna nueva. `migrate dev` está
 * descartado a propósito porque es interactivo y puede decidir recrear el
 * esquema, cosa que no debe hacer un comando automatizado.
 *
 * Uso: npm run e2e:db:migrate
 */
import { spawnSync } from "node:child_process"
import { prepareE2eEnvironment } from "./e2e-env"

const environment = prepareE2eEnvironment()
console.log(`Aplicando migraciones en ${environment.database}`)

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
  // Windows: `npx` es un .cmd, así que necesita shell para resolverse.
  shell: true,
})

process.exit(result.status ?? 1)
