import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { prisma } from "@/lib/db"

// Configuración de Better Auth. No se inventa ninguna opción: cada campo usado
// aquí está documentado en better-auth.com/docs y verificado contra los tipos
// del paquete instalado (better-auth@1.6.26) antes de escribirse.
/**
 * Better Auth solo confía en el origen de `baseURL`, así que en desarrollo el
 * login falla con `INVALID_ORIGIN` si Next arranca en un puerto distinto al de
 * `BETTER_AUTH_URL` (pasa en cuanto otro proceso ocupa el 3000).
 *
 * Se añaden ambos puertos locales como orígenes de confianza **solo fuera de
 * producción**: en producción la lista queda vacía y el único origen válido
 * sigue siendo el dominio real de `BETTER_AUTH_URL`.
 */
const developmentTrustedOrigins =
  process.env.NODE_ENV === "production"
    ? []
    : ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"]

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: developmentTrustedOrigins,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // El alta pública queda deshabilitada: el único alta soportada es
    // scripts/admin-bootstrap.ts (primer ADMIN) y, en el futuro, la creación
    // de usuarios por un ADMIN ya autenticado.
    disableSignUp: true,
    minPasswordLength: 12,
    // Sin `password.hash` propio: se usa el hash por defecto de Better Auth
    // (scrypt vía node:crypto, con fallback puro en runtimes sin soporte).
  },
  rateLimit: {
    // Habilitado también fuera de producción: por defecto Better Auth solo
    // lo activa en producción, pero el login es sensible en cualquier
    // entorno. Persistente (`storage: "database"`) para que sobreviva a
    // invocaciones serverless sin estado en memoria compartido.
    enabled: true,
    storage: "database",
    // Sin `customRules`: las reglas por defecto de Better Auth ya limitan
    // /sign-in, /sign-up y /change-password a 3 solicitudes cada 10s.
  },
  databaseHooks: {
    session: {
      create: {
        /**
         * Minimización de datos en la sesión administrativa.
         *
         * Better Auth guarda por defecto la IP y el user-agent completos de cada
         * sesión. El proyecto no tiene ninguna función que los use —no hay
         * "cerrar sesión en otros dispositivos" ni panel de sesiones activas—, así
         * que son datos personales almacenados sin finalidad.
         *
         * **No se usa `advanced.ipAddress.disableIpTracking`**, que sería el
         * interruptor obvio: además de no guardar la IP, deja al limitador de
         * Better Auth sin clave por la que agrupar y **desactiva el rate limit del
         * login** (ver `resolveRateLimitConfig` en su código: sin IP y con esa
         * opción activa devuelve `null`). Cambiar protección contra fuerza bruta
         * por minimización sería un mal negocio.
         *
         * Este hook es la vía precisa: la IP se sigue resolviendo en memoria para
         * el rate limit, pero no llega a la tabla. Si algún día hiciera falta
         * detectar accesos desde ubicaciones inusuales, lo correcto sería guardar
         * su HMAC (como ya se hace en lib/security/rate-limit.ts), no el valor.
         */
        before: async (session) => ({ data: { ...session, ipAddress: "", userAgent: "" } }),
      },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "CONTENT",
        // El propio usuario nunca puede fijar su rol desde el cliente (ni al
        // registrarse -deshabilitado- ni al actualizar su perfil). El rol
        // solo cambia a través de la acción de servidor protegida por ADMIN
        // (app/admin/(protected)/usuarios/actions.ts).
        input: false,
      },
    },
  },
  // Cookies: httpOnly y sameSite="lax" son el comportamiento por defecto de
  // Better Auth (no configurable a la baja sin `advanced.useSecureCookies`,
  // que aquí no se toca). `secure` se activa solo cuando BETTER_AUTH_URL usa
  // https o NODE_ENV=production, exactamente lo pedido ("Secure en
  // producción"). Ver node_modules/better-auth/dist/cookies/index.mjs.
  plugins: [nextCookies()],
})

export type Session = typeof auth.$Infer.Session
