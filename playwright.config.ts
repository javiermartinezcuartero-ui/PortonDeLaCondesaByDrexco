import { defineConfig, devices } from "@playwright/test"
import { existsSync } from "node:fs"

/**
 * Configuración de las pruebas E2E.
 *
 * Las variables se cargan aquí y no en el `package.json` porque hacen falta en
 * dos sitios: para arrancar el servidor bajo prueba y para que el `globalSetup`
 * pueda sembrar la base. `.env` se carga primero para heredar las credenciales
 * de Supabase Storage (no hay equivalente local del bucket, ver
 * docs/pruebas-e2e.md §3) y `.env.e2e` después, que es donde vive todo lo propio
 * del entorno de pruebas.
 */
for (const file of [".env", ".env.e2e"]) {
  if (existsSync(file)) process.loadEnvFile(file)
}

const baseURL = process.env.E2E_BASE_URL?.trim() || "http://localhost:3100"
const port = new URL(baseURL).port || "3100"

/**
 * Entorno del servidor bajo prueba.
 *
 * `DATABASE_URL` se sustituye por la base de pruebas: es lo que hace que el
 * servidor y las pruebas miren la misma base aislada. La guardia de
 * `lib/testing/e2e-database-guard.ts` ya ha validado en el `globalSetup` que esa
 * base es desechable, así que si algo va mal el proceso no llega hasta aquí.
 */
function serverEnvironment(): Record<string, string> {
  const database = process.env.E2E_DATABASE_URL
  if (!database) {
    throw new Error("Falta E2E_DATABASE_URL. Ver docs/pruebas-e2e.md §2.")
  }

  return {
    // Sin pooler: la base de pruebas es PostgreSQL directo.
    DATABASE_URL: database,
    DIRECT_URL: database,
    BETTER_AUTH_URL: baseURL,
    NEXT_PUBLIC_SITE_URL: baseURL,
    BETTER_AUTH_SECRET: process.env.E2E_BETTER_AUTH_SECRET ?? "",
    RATE_LIMIT_HASH_SECRET: process.env.E2E_RATE_LIMIT_HASH_SECRET ?? "",
    VIP_TOKEN_HASH_SECRET: process.env.E2E_VIP_TOKEN_HASH_SECRET ?? "",
    // Las fichas del escenario son isDemo=true: sin esto no se listarían.
    ENABLE_DEMO_CONTENT: "true",
    // Storage se hereda del entorno real: el escenario 8 sube una imagen de
    // verdad y `scripts/e2e-seed.ts` borra después los objetos que subió.
    SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    // Ninguna prueba debe poder enviar un correo real. Sin transporte, cada
    // intento queda como SKIPPED_CONFIG en NotificationLog, que es justo lo que
    // el escenario del formulario comprueba.
    SENDGRID_API_KEY: "",
    LEADS_FROM_EMAIL: "",
    SEND_LEAD_ACKNOWLEDGEMENT: "",
  }
}

export default defineConfig({
  testDir: "./e2e",
  // Contra una única base compartida, la ejecución en paralelo haría que una
  // prueba viese los datos de otra. La suite es corta: la determinación vale
  // más que los segundos que se ahorrarían.
  fullyParallel: false,
  workers: 1,
  // Un reintento en CI absorbe la inestabilidad de red o de arranque; en local
  // ninguno, para que un fallo intermitente se vea en vez de esconderse.
  retries: process.env.CI ? 1 : 0,
  // `test.only` olvidado en un commit haría que CI pasara ejecutando una sola
  // prueba y nadie se daría cuenta.
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  outputDir: "e2e/.results",

  globalSetup: "./e2e/global-setup.ts",

  use: {
    baseURL,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      // Inicia sesión una vez por rol y guarda el estado. Evita repetir el
      // login en cada prueba, que además chocaría con el límite de 3 intentos
      // por 10 segundos de Better Auth (lib/auth.ts).
      name: "setup",
      testMatch: /auth\.setup\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "e2e",
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    // Build de producción, no `next dev`: esta fase prepara el despliegue, así
    // que las pruebas deben recorrer el mismo código que se va a desplegar.
    // Además, `next dev` activa los orígenes de confianza de desarrollo de
    // Better Auth y ocultaría un problema de configuración de producción.
    command: `npm run build && npx next start -p ${port}`,
    url: `${baseURL}/api/health`,
    env: serverEnvironment(),
    // El build entra en este tiempo: no es un servidor que tarde en escuchar,
    // es una compilación completa.
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
  },
})
