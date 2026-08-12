// Crea el primer usuario ADMIN. Idempotente: si ya existe un usuario con el
// email indicado, no hace nada (no sobrescribe ni contraseña ni rol).
//
// Uso: npm run admin:bootstrap
//
// Variables requeridas (retíralas de .env inmediatamente después de usarlas
// una sola vez; no deben quedar en el entorno de forma permanente):
//   ADMIN_BOOTSTRAP_NAME
//   ADMIN_BOOTSTRAP_EMAIL
//   ADMIN_BOOTSTRAP_PASSWORD (mínimo 12 caracteres)
//
// No usa el endpoint público de alta (signUpEmail): está deshabilitado a
// propósito (emailAndPassword.disableSignUp) y lo rechazaría con
// EMAIL_PASSWORD_SIGN_UP_DISABLED. En su lugar reproduce, con la misma API
// interna que ese endpoint usa por debajo (auth.$context.internalAdapter y
// auth.$context.password), los mismos dos pasos que Better Auth ejecuta al
// dar de alta un usuario con contraseña: crear el User y enlazar el Account
// "credential" con el hash. Es la vía que la propia documentación de Better
// Auth describe para crear usuarios sin pasar por el alta pública.
import { auth } from "@/lib/auth"

async function main() {
  const name = process.env.ADMIN_BOOTSTRAP_NAME
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD

  if (!name || !email || !password) {
    console.error("Faltan ADMIN_BOOTSTRAP_NAME / ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD.")
    process.exitCode = 1
    return
  }

  if (password.length < 12) {
    console.error("ADMIN_BOOTSTRAP_PASSWORD debe tener al menos 12 caracteres.")
    process.exitCode = 1
    return
  }

  const ctx = await auth.$context
  const normalizedEmail = email.toLowerCase()
  const existing = await ctx.internalAdapter.findUserByEmail(normalizedEmail)

  if (existing?.user) {
    console.log(`Ya existe un usuario con ese email (id=${existing.user.id}). No se sobrescribe.`)
    return
  }

  const passwordHash = await ctx.password.hash(password)
  const user = await ctx.internalAdapter.createUser({
    name,
    email: normalizedEmail,
    emailVerified: true,
    role: "ADMIN",
  })
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: passwordHash,
  })

  console.log(`Usuario ADMIN creado (id=${user.id}, email=${user.email}).`)
  console.log("Retira ahora ADMIN_BOOTSTRAP_NAME/EMAIL/PASSWORD de tu .env: ya no se necesitan.")
}

main()
  .catch((error) => {
    console.error("No se ha podido crear el usuario ADMIN:", error)
    process.exitCode = 1
  })
  .finally(() => process.exit(process.exitCode ?? 0))
