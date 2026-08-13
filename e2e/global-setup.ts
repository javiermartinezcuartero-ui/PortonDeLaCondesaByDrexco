import { spawnSync } from "node:child_process"

/**
 * Prepara la base antes de la suite.
 *
 * Se invoca el script de sembrado como proceso aparte en vez de importar su
 * lógica: así el sembrado pasa **siempre** por la guardia de
 * `lib/testing/e2e-database-guard.ts`, sea quien sea el que lo llame, y las
 * pruebas no pueden acabar ejecutándose contra una base sin validar por haber
 * tomado un atajo.
 */
export default function globalSetup(): void {
  const result = spawnSync("npm", ["run", "e2e:seed"], {
    stdio: "inherit",
    env: process.env,
    // Windows: `npm` es un .cmd y necesita shell para resolverse.
    shell: true,
  })

  if (result.status !== 0) {
    throw new Error(
      "El sembrado del escenario E2E ha fallado. Revisa que la base de pruebas esté " +
        "levantada y migrada (npm run e2e:setup)."
    )
  }
}
