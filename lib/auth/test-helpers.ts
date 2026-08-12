import { randomBytes } from "node:crypto"
import type { Role } from "@prisma/client"
import { auth } from "@/lib/auth"
import { uniqueTestEmail } from "@/lib/domain/test-helpers"

export const TEST_PASSWORD = "un-password-de-prueba-123"

// El rate limit de /sign-in/email (3 solicitudes/10s, ver lib/auth.ts) se
// aplica por IP+ruta. Cada sign-in de prueba usa una IP simulada distinta
// (aleatoria, no un contador) para no agotar ese límite: Vitest aísla cada
// archivo de test en su propio registro de módulos, así que un contador
// reiniciaría desde 0 en cada archivo y varios archivos ejecutándose en
// paralelo podrían coincidir en la misma IP simulada dentro de la misma
// ventana de 10s.
function nextFakeIp(): string {
  const bytes = randomBytes(3)
  return `10.${bytes[0]}.${bytes[1]}.${bytes[2]}`
}

/** Crea un usuario con cuenta "credential" real, igual que scripts/admin-bootstrap.ts. */
export async function createAuthTestUser(role: Role) {
  const ctx = await auth.$context
  const email = uniqueTestEmail(`auth-${role.toLowerCase()}`)
  const passwordHash = await ctx.password.hash(TEST_PASSWORD)
  const user = await ctx.internalAdapter.createUser({
    name: `Test ${role}`,
    email,
    emailVerified: true,
    role,
  })
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: passwordHash,
  })
  return { id: user.id, email }
}

/** Inicia sesión a través del handler real de Better Auth (misma vía que un
 * navegador) y devuelve unos Headers con la cookie de sesión ya firmada. */
export async function signInHeaders(email: string, password: string = TEST_PASSWORD): Promise<Headers> {
  const response = await signInRaw(email, password)
  const setCookie = response.headers.get("set-cookie")
  if (!setCookie) {
    throw new Error(`Sign-in de prueba sin cookie de sesión (status ${response.status}): ${await response.text()}`)
  }
  return new Headers({ cookie: setCookie.split(";")[0] })
}

/** Igual que `signInHeaders`, pero devuelve la Response completa (para
 * inspeccionar status/mensaje en tests de credenciales inválidas). */
export async function signInRaw(email: string, password: string): Promise<Response> {
  return auth.handler(
    new Request("http://localhost:3001/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3001",
        "x-forwarded-for": nextFakeIp(),
      },
      body: JSON.stringify({ email, password }),
    })
  )
}
