import "server-only"
import { createHash, timingSafeEqual } from "node:crypto"

/**
 * Acceso al panel con una única contraseña, sin usuario.
 *
 * **Esto es una decisión explícita del titular del proyecto, tomada a sabiendas.**
 * Sustituye el par correo + contraseña por una sola clave compartida, y con ello
 * se pierden tres cosas que el resto del proyecto sí tiene: saber *quién* hizo
 * cada acción (todo queda atribuido a la misma cuenta), poder revocar el acceso a
 * una persona sin cambiársela a todas, y la separación de perfiles ADMIN /
 * CONTENT / COMMERCIAL, porque quien entra por aquí entra como administrador. Los
 * `AuditEvent` se siguen registrando, pero todos con el mismo actor.
 *
 * Lo que sí se ha evitado, porque no formaba parte de lo pedido y habría sido un
 * daño gratuito:
 *
 * 1. **La contraseña no está en el código.** Sale de `ADMIN_GATE_PASSWORD`. El
 *    repositorio es público: escribirla aquí la habría publicado en GitHub, donde
 *    queda en el historial aunque después se borre, y además el escáner de
 *    secretos del propio proyecto la habría detectado y roto la integración
 *    continua.
 * 2. **Sin variable configurada no se entra.** No hay valor por defecto. Un
 *    despliegue mal configurado deja la puerta cerrada, no abierta.
 * 3. **La comparación es en tiempo constante.** Con una clave única y sin usuario,
 *    el tiempo de respuesta es la única señal que un atacante puede medir.
 * 4. **Sigue habiendo rate limit por IP** (`app/admin/login/gate-action.ts`): una
 *    contraseña única sin límite de intentos se rompe por fuerza bruta.
 *
 * El acceso por correo y contraseña sigue existiendo por debajo: esta puerta se
 * apoya en él, iniciando sesión contra una cuenta real. No se ha introducido un
 * segundo sistema de autenticación, que es justo lo que las reglas del proyecto
 * prohíben; se ha añadido una forma distinta de abrir el mismo.
 */

/** Longitud mínima que se exige a la clave configurada. */
const MIN_LENGTH = 8

export type AdminGateConfig = {
  /** La clave que se teclea en la pantalla de acceso. */
  password: string
  /** Cuenta real contra la que se inicia sesión al acertar. */
  email: string
  /** Contraseña de esa cuenta. Nunca se teclea ni se muestra. */
  accountPassword: string
}

/**
 * Configuración de la puerta, o `null` si falta cualquier pieza.
 *
 * Devolver `null` en vez de lanzar es deliberado: la pantalla de acceso tiene que
 * poder renderizarse aunque el despliegue esté a medio configurar, y decir «no se
 * puede entrar» en lugar de reventar con un error 500.
 */
export function readAdminGateConfig(env: NodeJS.ProcessEnv = process.env): AdminGateConfig | null {
  const password = env.ADMIN_GATE_PASSWORD?.trim()
  const email = env.ADMIN_GATE_EMAIL?.trim()
  const accountPassword = env.ADMIN_GATE_ACCOUNT_PASSWORD?.trim()

  if (!password || password.length < MIN_LENGTH) return null
  if (!email || !accountPassword) return null

  return { password, email, accountPassword }
}

/**
 * ¿Es correcta la clave tecleada?
 *
 * `timingSafeEqual` exige buffers del mismo tamaño, así que una clave de longitud
 * distinta se rechazaría antes de comparar y filtraría la longitud correcta por el
 * tiempo de respuesta. Se comparan por eso los hashes de longitud fija en lugar de
 * los valores, y así toda comparación cuesta lo mismo.
 */
export function matchesAdminGatePassword(candidate: string, expected: string): boolean {
  const a = fixedLengthDigest(candidate)
  const b = fixedLengthDigest(expected)

  return timingSafeEqual(a, b)
}

/** Digest de 32 bytes. Se hashea para igualar longitudes, no para proteger nada. */
function fixedLengthDigest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest()
}

/**
 * ¿Está disponible el acceso por correo y contraseña?
 *
 * Por decisión del titular, la clave única es la **única** puerta del despliegue.
 * `/admin/login/credenciales` responde 404 salvo que el entorno declare
 * `ENABLE_CREDENTIALS_LOGIN=true`, y quien lo declara es únicamente el servidor
 * bajo prueba de `playwright.config.ts`, porque la autorización por rol no se
 * puede verificar entrando siempre como la misma cuenta.
 *
 * Solo el valor exacto `"true"` activa, igual que `ENABLE_DEMO_CONTENT` y
 * `SEND_LEAD_ACKNOWLEDGEMENT`: abrir una puerta de acceso es una decisión que se
 * toma a propósito, no algo que se herede de un valor mal escrito.
 */
export function isCredentialsLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ENABLE_CREDENTIALS_LOGIN?.trim() === "true"
}
