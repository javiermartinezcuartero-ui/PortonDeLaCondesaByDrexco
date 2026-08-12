# Arquitectura de backend — Fase 2 (persistencia y dominio)

Fecha: 2026-08-11. Complementa `docs/modelo-datos.md` (modelo de datos) y
`docs/auditoria-v2.md` (Fase 0). No implementa todavía autenticación, CMS con
UI de administración, ni pantallas de admin — solo persistencia y dominio.

## 1. Por qué Prisma 6, no Prisma 7

`npm view prisma@latest` apunta a la 7.9.1. Se probó primero con esa versión y
se descartó **deliberadamente** por un motivo concreto, no por evitar lo
nuevo: Prisma 7 elimina `url`/`directUrl` del bloque `datasource` del schema
(mueve la configuración a un `prisma.config.ts` nuevo) y **obliga** a
instanciar `PrismaClient` con un *driver adapter* explícito (p. ej.
`@prisma/adapter-pg`) — no basta con `DATABASE_URL` en el entorno. Es un
cambio de arquitectura real, no cosmético, y añade piezas (adapter, nuevo
formato de configuración, imports `.ts` en el cliente generado) antes de que
exista siquiera autenticación o UI de administración. Se optó por **Prisma
6.19.3** (última estable de la serie anterior): el patrón clásico
`url`/`directUrl` en `schema.prisma` sigue funcionando exactamente como se
documentó en la Fase 0.1 al configurar las credenciales de Supabase, sin
dependencias nuevas ni conceptos adicionales. Revisar esta decisión cuando el
ecosistema (Better Auth, Next.js) tenga soporte documentado y probado para
Prisma 7 con Supabase.

## 2. Topología de conexión a Supabase

Al ejecutar la primera migración, la conexión directa
(`db.<ref>.supabase.co:5432`) falló con `ENOTFOUND`. Una prueba de socket TCP
confirmó que ese host no resuelve en este entorno, mientras que el host del
*pooler* (`aws-1-eu-west-1.pooler.supabase.com`) responde en los puertos 6543
y 5432. Es un problema conocido de Supabase: el host de conexión directa solo
publica registro `AAAA` (IPv6) salvo que el proyecto tenga el add-on de IPv4,
y este entorno no tiene salida IPv6.

Solución adoptada — **usar el pooler para todo, en dos modos distintos**:

- `DATABASE_URL` → pooler, **modo Transaction** (puerto 6543, `pgbouncer=true`). Conexión de runtime, apta para entornos serverless (sin conexiones persistentes).
- `DIRECT_URL` → mismo host del pooler, **modo Session** (puerto 5432, sin `pgbouncer=true`). Es la conexión que usa `prisma migrate`/`db push`: el modo Transaction no soporta los *prepared statements* y *advisory locks* que necesita Migrate; el modo Session sí, y es la alternativa que recomienda la propia Supabase para redes sin conexión directa.

Si en otro entorno (por ejemplo, en despliegue) el host directo sí resuelve,
`DIRECT_URL` puede volver a apuntar a `db.<ref>.supabase.co:5432` sin cambiar
nada más.

## 3. Capa de dominio (`lib/domain/`)

Cada operación de negocio listada en el Prompt 2 es una función exportada,
tipada, sin clases ni contenedor de inyección de dependencias (no aporta
nada a este tamaño de proyecto): `lib/domain/leads.ts`,
`lead-requests.ts`, `consents.ts`, `activities.ts`, `notes.ts`, `tasks.ts`,
`content.ts`, `vip-sessions.ts`, `interactions.ts`, `scoring.ts`, `audit.ts`.
Todas importan el singleton `lib/db.ts` (Prisma Client, patrón recomendado
por Next.js para no agotar conexiones con el hot-reload de `next dev`).

Las operaciones que deben ser atómicas usan `prisma.$transaction` de forma
explícita (`getOrCreateLead`, `createLeadRequest`, `anonymizeLead`,
`createContentEntry`, `changeLeadRequestStatus`), no solo porque Prisma lo
garantice implícitamente en algunos casos, sino para que quede explícito en
el código qué operaciones son indivisibles.

Errores de dominio (`lib/domain/errors.ts`) son clases (`InvalidTransitionError`,
`DuplicateSlugError`, `MissingTranslationError`, `DomainError`) en vez de
strings o códigos, para que el código que los use pueda usar
`instanceof` en vez de comparar texto.

## 4. Privacidad — decisiones concretas

- **Hash HMAC-SHA256 con rotación** (`lib/security/hash.ts`) para dos usos: identificadores de rate limit (`hashRateLimitKey`) y tokens de sesión VIP (`hashVipToken`/`vipTokenHashCandidates`). Cada uso tiene su propio secreto (`RATE_LIMIT_HASH_SECRET`, `VIP_TOKEN_HASH_SECRET`) para limitar el radio de exposición si uno se filtra. Cada secreto admite una lista `*_PREVIOUS` (separada por comas) para poder rotar la clave sin invalidar de golpe lo ya hasheado con la anterior.
- **Ningún dato se compara por hash con un escaneo completo de tabla.** Como el HMAC es determinista, `verifyVipAccessSession` calcula los hashes candidatos (clave actual + anteriores) y hace una búsqueda indexada por `tokenHash IN (...)`, no un `findMany` + comparación en memoria de toda la tabla.
- **`sanitizeMetadata`** (`lib/domain/metadata.ts`) se aplica siempre antes de escribir `LeadActivity.metadata` o `AuditEvent.metadata`: descarta claves que parezcan contraseñas/tokens/IP/user-agent/tarjetas, trunca strings a 500 caracteres y limita la profundidad de objetos anidados a 3 niveles. No se guarda nunca un cuerpo de petición completo.
- **No se guarda IP ni user-agent completos en ningún modelo de negocio.** `Session.ipAddress`/`userAgent` existen porque son parte del esquema oficial de Better Auth (no se han eliminado por compatibilidad), pero ningún servicio de dominio propio persiste esos datos fuera de ese esquema de autenticación.
- **Anonimización transaccional** (`anonymizeLead`): lee el Lead y escribe los campos anonimizados dentro de la misma transacción; si falla, no queda un Lead a medio anonimizar. Probada en `lib/domain/leads.test.ts`.

## 5. Estrategia de pruebas de dominio

No hay Postgres local ni Docker disponible en este entorno (`docker ps`
falla: el daemon de Docker Desktop no está en marcha), así que las pruebas
de dominio que necesitan base de datos se ejecutan **contra la misma base de
desarrollo de Supabase** (`porton-tfm-dev`), no contra una base aislada. Para
que esto sea seguro y no ensucie los datos de ejemplo:

- Cada test crea sus propios datos con emails/slugs únicos (`uniqueTestEmail`, `uniqueSlug`) y los borra en `afterEach` (`lib/domain/test-helpers.ts`).
- El borrado de un `Lead` arrastra en cascada todo lo suyo (ver `docs/modelo-datos.md` §5), así que limpiar es una sola llamada `prisma.lead.deleteMany`.
- Los tests de normalización (`lib/domain/normalize.test.ts`) son puros y no requieren base de datos.

**Limitación reconocida, no oculta:** esto no es aislamiento real de tests
(dos ejecuciones en paralelo contra la misma base podrían, en teoría,
interferir si comparten una clave única). Es aceptable para el tamaño actual
del proyecto y evita añadir infraestructura (Testcontainers, Postgres local)
que hoy no se puede levantar en este entorno. Si se instala Docker más
adelante, migrar a un contenedor de Postgres efímero por ejecución de test es
la mejora natural — pendiente, no bloqueante.

**CI sin secretos:** `.github/workflows/ci.yml` (Fase 1) ejecuta `npm run
test` sin `DATABASE_URL` configurada, tal como se decidió al no incluir
secretos en el pipeline. `lib/domain/test-helpers.ts` exporta `itDb`, un
`it`/`it.skip` condicionado a `process.env.DATABASE_URL`: los tests de
dominio que hablan con la base se saltan automáticamente en CI y se ejecutan
de verdad en local (donde sí existe `.env`). El job de CI sigue en verde;
documentar esto explícitamente para que "verde en CI" no se lea como
"probado contra base de datos" cuando no lo está.

## 6. Migraciones

- `npx prisma migrate dev --name init` generó `prisma/migrations/20260811101614_init/migration.sql`, aplicada contra la base de desarrollo real. Es revisable: el SQL queda commiteado en el repositorio.
- No se ha ejecutado `migrate deploy` contra ningún entorno de producción — no existe todavía ese entorno.
- Regla para el futuro: `migrate dev` solo contra la base marcada como desarrollo (`porton-tfm-dev`); un entorno de producción usaría `prisma migrate deploy` (sin generar migraciones nuevas, solo aplicar las ya revisadas) desde el pipeline de despliegue, nunca `migrate dev`.

## 7. Qué falta para las fases siguientes

- **Autenticación (Better Auth):** el esquema `User`/`Session`/`Account`/`Verification` ya es compatible; falta instalar `better-auth`, configurar el adaptador de Prisma, y decidir si `role` se expone como `additionalFields` de Better Auth o se gestiona aparte.
- **CMS con UI:** los servicios de `lib/domain/content.ts` ya permiten crear/editar/publicar/despublicar/archivar; falta la UI de `/admin` y decidir cuándo migrar `data/vip-stories.ts` a `ContentEntry` en el frontend público (hoy son dos fuentes de contenido en paralelo a propósito, ver `docs/modelo-datos.md` §6).
- **Storage de Supabase para `ContentMedia`:** el campo `storagePath` existe en el esquema pero ningún servicio sube todavía archivos a Supabase Storage; los 6 casos de ejemplo siguen usando rutas de `public/images/...`.
- **Endpoint propio de leads:** `createLeadRequest` ya existe como servicio de dominio, pero no hay todavía ninguna Route Handler de Next.js que lo llame desde el formulario público (sigue yendo a Web3Forms, ver `README.md`).
- **Rate limiting real:** `hashRateLimitKey` existe pero no está conectado a ningún middleware/límite todavía — es la pieza de privacidad preparada, no una funcionalidad activa.
