# Autenticación y roles — Fase 3

Fecha: 2026-08-11. Complementa `docs/modelo-datos.md` (el esquema `User`/
`Session`/`Account`/`Verification` ya se documentó en la Fase 2 como
compatible con el adaptador de Prisma de Better Auth) y
`docs/arquitectura-backend.md` §7 (que dejaba esto como pendiente).

## Dos pantallas de acceso (Fase 14)

`/admin/login` pide **una sola clave, sin usuario**, por decisión del titular.
`/admin/login/credenciales` conserva el acceso por correo y contraseña, y hace
falta para los perfiles CONTENT y COMMERCIAL —la clave única entra siempre como
la misma cuenta ADMIN— y para las pruebas E2E, que comprueban la autorización por
rol.

**No hay dos sistemas de autenticación.** La clave única no crea sesiones por su
cuenta: cuando acierta, el servidor llama a `auth.api.signInEmail` contra una
cuenta real, así que todo lo que describe el resto de este documento —sesión,
cookie, expiración, revocación, roles— se aplica igual por las dos puertas.

Qué se pierde con la clave única, qué se protegió a pesar de ella y por qué la
exclusión se implementó así: README §Seguridad y `lib/auth/admin-gate.ts`.

## 1. Por qué Better Auth (y no Auth.js, sugerido en el documento de referencia)

`project-reference/docs/03-arquitectura-crm-leads.md` sugería Auth.js si la
plantilla no imponía otra cosa. Se ha usado **Better Auth 1.6.26** en su
lugar porque, sobre el esquema ya creado en la Fase 2, ofrece de forma nativa
y sin dependencias adicionales las tres piezas que pedía el Prompt 3:

- Adaptador oficial de Prisma (`better-auth/adapters/prisma`) sin ORM
  paralelo.
- Rate limiting persistente incorporado (`rateLimit.storage: "database"`),
  sin añadir Redis ni ningún almacén externo.
- Campos de rol propios vía `user.additionalFields`, sin tabla de roles
  paralela ni plugin adicional.

## 2. Flujo

1. `/admin/login` es pública. Formulario de email + contraseña
   (`app/admin/login/login-form.tsx`) que llama a
   `authClient.signIn.email` (`lib/auth-client.ts`).
2. Better Auth valida las credenciales, aplica su rate limit por defecto
   (3 intentos / 10s en `/sign-in/email`, ver §5) y, si son correctas, fija
   una cookie de sesión firmada (`HttpOnly`, `SameSite=Lax`, `Secure` cuando
   `BETTER_AUTH_URL` es `https://` o `NODE_ENV=production` — comportamiento
   por defecto de Better Auth, no configurado a mano).
3. `middleware.ts` redirige según la **presencia** de esa cookie (comprobación
   barata, sin tocar la base de datos): sin cookie fuera de `/admin/login` →
   a `/admin/login`; con cookie en `/admin/login` → a `/admin`.
4. `app/admin/(protected)/layout.tsx` vuelve a comprobar la sesión, esta vez
   de verdad (`getSessionUser`, que llama a `auth.api.getSession` contra la
   base de datos). Si no hay sesión válida, redirige — esta es la
   autorización real; el middleware nunca la sustituye.
5. Cada Route Handler de `/api/admin/*` y cada Server Action privada vuelve a
   llamar a `requireSession`/`requireRole`/`requirePermission`
   (`lib/auth/session.ts`) de forma independiente, sin asumir que ya se pasó
   por el middleware o el layout.
6. El botón discreto (`components/admin-access.tsx`, esquina inferior
   izquierda) usa `authClient.useSession()` para decidir si navega a
   `/admin/login` o directamente a `/admin`.

## 3. Roles y permisos

`User.role`: `ADMIN` | `SALES` | `CONTENT` (enum ya creado en la Fase 2).

| Rol | Alcance previsto |
|---|---|
| `ADMIN` | Acceso completo: usuarios, exportación, anonimización y configuración |
| `SALES` | CRM, notas y tareas; sin gestión de usuarios ni CMS destructivo |
| `CONTENT` | CMS, media, preview y publicación; sin acceso a PII del CRM |

De estas tres áreas, en esta fase solo existe una pantalla real construida
sobre el modelo de permisos: **gestión de usuarios** (`/admin/usuarios`,
ADMIN únicamente), porque es la única explícitamente pedida por el Prompt 3.
CRM y CMS ya tienen su capa de dominio (Fase 2) pero no tienen todavía UI de
administración — construirla no es alcance de esta fase.

`lib/auth/session.ts` expone:

- `getSessionUser(headers?)` — usuario de la sesión actual o `null`.
- `requireSession(headers?)` — usuario o lanza `UnauthenticatedError`.
- `requireRole(roles, headers?)` — usuario si su rol está en la lista, o
  lanza `ForbiddenError` (tras comprobar primero la sesión).
- `requirePermission(permission, headers?)` — azúcar sobre `requireRole` a
  partir de un mapa fijo (`"users:manage" → ["ADMIN"]`,
  `"crm:access" → ["ADMIN", "SALES"]`, `"cms:access" → ["ADMIN", "CONTENT"]`).

Las tres aceptan un `Headers` explícito (para Route Handlers, que lo reciben
en `request.headers`, y para tests) o, si se omite, leen `headers()` de
`next/headers` (el camino real dentro de un Server Component/layout/Server
Action, que corre dentro del scope de la petición de Next.js).

`role` se expone como `user.additionalFields` de Better Auth con
`input: false`: ningún usuario puede fijar su propio rol, ni al iniciar
sesión ni al actualizar su perfil. Solo cambia a través de
`updateUserRoleAction` (`app/admin/(protected)/usuarios/actions.ts`),
protegida con `requireRole(["ADMIN"])`.

## 4. Primer ADMIN (`npm run admin:bootstrap`)

El alta pública está desactivada (`emailAndPassword.disableSignUp: true`), así
que el endpoint estándar de registro (`signUpEmail`) la rechaza también si se
llama desde un script — devuelve `EMAIL_PASSWORD_SIGN_UP_DISABLED` sin
excepciones. `scripts/admin-bootstrap.ts` no rodea esa protección: reproduce,
con la misma API interna que ese endpoint usa por debajo
(`auth.$context.internalAdapter` y `auth.$context.password`), los mismos dos
pasos que Better Auth ejecuta al dar de alta un usuario con contraseña
(crear el `User`, hashear la contraseña con el hash por defecto de Better
Auth y enlazar el `Account` del proveedor `credential` con ese hash). Es la
vía que la documentación de Better Auth describe para crear usuarios sin
pasar por el alta pública — no es una API inventada para esta fase.

El comando:

- Lee `ADMIN_BOOTSTRAP_NAME`, `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`.
- Es **idempotente**: si ya existe un usuario con ese email, no hace nada (no
  sobrescribe ni contraseña ni rol).
- Nunca imprime la contraseña, solo el `id`/email del usuario creado.
- Termina recordando retirar esas tres variables de `.env`: no deben quedar
  guardadas de forma permanente una vez creado el primer ADMIN.

Verificado en la base de desarrollo (`porton-tfm-dev`): primera ejecución crea
el usuario; segunda ejecución (y una tercera vía `npm run admin:bootstrap`)
detectan el email existente y no hacen nada.

Los 3 usuarios ficticios de `prisma/seed.ts` (`admin@portondelacondesa.dev`,
`comercial@...`, `contenido@...`) **siguen sin credenciales de acceso**: son
datos de demostración para el CRM (propietario de `LeadRequest`, etc.), no
cuentas pensadas para iniciar sesión. El primer ADMIN operativo se crea con
un email real distinto, vía `admin:bootstrap`.

## 5. Seguridad — decisiones concretas y verificadas

Todo lo siguiente se comprobó con peticiones HTTP reales contra el servidor
de desarrollo (no son solo afirmaciones de la configuración), ver §6.

- **Alta pública rechazada.** `POST /api/auth/sign-up/email` devuelve `400
  EMAIL_PASSWORD_SIGN_UP_DISABLED` siempre, sin excepción para ningún
  llamador.
- **Mensaje de login genérico.** Contraseña incorrecta de un usuario real y
  email inexistente devuelven exactamente el mismo `401
  INVALID_EMAIL_OR_PASSWORD` — no permiten distinguir si una cuenta existe.
  Es el comportamiento nativo de Better Auth (`api/routes/sign-in.mjs`), no
  algo añadido; el formulario (`login-form.tsx`) además nunca muestra el
  mensaje del servidor tal cual, sino un texto fijo propio.
- **Rate limit persistente.** `rateLimit.storage: "database"` (tabla
  `rateLimit`, migración `20260811120036_add_rate_limit_table`): sobrevive a
  invocaciones serverless sin estado compartido en memoria. Las reglas por
  defecto de Better Auth limitan `/sign-in`, `/sign-up` y
  `/change-password` a 3 solicitudes cada 10 segundos; no se han tocado ni
  relajado con `customRules`.
- **CSRF / validación de origen activa, no desactivada.** Una petición de
  estado (`sign-out`) sin cabecera `Origin` coincidente con `BETTER_AUTH_URL`
  se rechaza con `403`; con el `Origin` correcto, funciona. No se ha tocado
  ninguna opción de `advanced` relacionada con esto.
- **Cookies.** `HttpOnly` y `SameSite=Lax` son el comportamiento por defecto
  de Better Auth, no configurable "a la baja" sin tocar `advanced` (que aquí
  no se toca). `Secure` se activa automáticamente cuando `BETTER_AUTH_URL`
  usa `https://` o `NODE_ENV=production`.
- **Sesiones persistidas y revocables de verdad.** Viven en la tabla
  `Session` (Fase 2). El logout (`authClient.signOut()` →
  `POST /api/auth/sign-out`) borra la fila de sesión en servidor — se
  verificó que, tras cerrar sesión, la cookie ya no resuelve ningún usuario
  (`auth.api.getSession` devuelve `null`) y que `Session` para ese usuario
  queda en 0 filas. No es solo borrar la cookie del navegador.
- **`noindex`/`nofollow`/`no-store`.** `/admin/login` y todo `/admin/**`
  exportan `metadata.robots = { index: false, follow: false, nocache: true
  }`; `middleware.ts` añade `Cache-Control: no-store` a toda respuesta bajo
  `/admin`.
- **Contraseña mínima de 12 caracteres** (`emailAndPassword.minPasswordLength:
  12`) y **hash por defecto de Better Auth** (scrypt vía `node:crypto`, con
  *fallback* puro en runtimes sin soporte) — no se ha sustituido por un hash
  propio.

## 6. Verificación manual realizada (servidor de desarrollo real, puerto 3001)

No sustituye a los tests automáticos (§7), pero registra que el flujo
completo se probó de extremo a extremo con peticiones HTTP reales antes de
escribir los tests:

| Comprobación | Resultado |
|---|---|
| Login con el ADMIN creado por `admin:bootstrap` | `200`, cookie de sesión firmada recibida |
| `GET /admin` con esa cookie | `200`, panel renderizado |
| `GET /api/admin/users` con esa cookie | `200`, lista real de usuarios de la base de datos |
| `GET /api/admin/users` sin cookie | `401` |
| `GET /api/admin/users` con sesión de un usuario `SALES` | `403` |
| `GET /admin/usuarios` con sesión `SALES` (página, no API) | Muestra "Acceso no autorizado", no redirige ni filtra datos |
| `POST /api/auth/sign-up/email` (alta pública) | `400 EMAIL_PASSWORD_SIGN_UP_DISABLED` |
| Contraseña incorrecta vs. email inexistente | Mismo `401 INVALID_EMAIL_OR_PASSWORD` en ambos casos |
| 4 intentos de login en menos de 10s | Los dos últimos devuelven `429` (rate limit persistido en la tabla `rateLimit`) |
| `sign-out` sin cabecera `Origin` | `403` (protección de origen activa) |
| `sign-out` con `Origin` correcto | `200`; fila de `Session` borrada en la base de datos |
| `GET /admin` sin cookie | `307` a `/admin/login`, con `Cache-Control: no-store` |

**No verificado en un navegador real** (sin herramienta de automatización de
navegador disponible en este entorno): la interacción visual del botón
discreto, el estado de carga del formulario de login y la navegación
`router.push`/`router.refresh` del cliente. Se comprobó en su lugar que el
HTML servido contiene los elementos esperados (`curl` sobre `/` y
`/admin/login`). Limitación reconocida, no oculta — ver README §Limitaciones conocidas.

## 7. Pruebas automatizadas

Todas en `lib/auth/`, `app/api/admin/users/`, `app/admin/(protected)/usuarios/`
y `middleware.test.ts`, siguiendo el mismo patrón de la Fase 2
(`itDb`, contra la base de desarrollo real, sin Docker/Postgres local
disponible — ver `docs/arquitectura-backend.md` §5). Los sign-in de prueba
usan una IP simulada aleatoria por llamada (`lib/auth/test-helpers.ts`) para
no chocar entre tests con el rate limit real de `/sign-in/email`.

- `lib/auth/session.test.ts` — `requireSession`/`requireRole`/`requirePermission` contra sesiones reales.
- `lib/auth/auth-flow.test.ts` — alta pública rechazada, mensaje de error genérico, logout revoca la sesión en servidor.
- `app/api/admin/users/route.test.ts` — 401 sin sesión, 403 con rol distinto de ADMIN, 200 con ADMIN.
- `app/admin/(protected)/usuarios/actions.test.ts` — la Server Action `updateUserRoleAction` rechaza la llamada directa sin sesión y con un rol distinto de ADMIN.
- `middleware.test.ts` — redirección anónima, redirección inversa con cookie en `/admin/login`, `Cache-Control: no-store`.
