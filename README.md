# El Portón de la Condesa — Web & Lead CRM

## 1. Descripción y objetivos

Web pública de El Portón de la Condesa (finca para bodas y celebraciones, Molina de Segura, Murcia), construida sobre una plantilla Next.js editorial adaptada a la marca real del negocio. El objetivo final del proyecto (TFM) es combinar esta experiencia pública con un backend propio de captación, cualificación y seguimiento comercial de leads (CRM), una zona VIP con acceso por email validado en servidor, y un panel de administración.

**Este documento es la referencia técnica viva del proyecto.** Se actualiza en cada fase; lo que no está confirmado o implementado se marca explícitamente como `PENDIENTE`, nunca como completado.

## 2. Estado actual

| Área | Estado |
|---|---|
| Frontend público (home, bodas reales, catering, legal) | **Implementado** — ver §4 y `docs/auditoria-v2.md` |
| Saneamiento técnico (lint, typecheck real, tests, CI) | **Implementado** (Fase 1) — ver §13 y §18 |
| Base de datos / Prisma / dominio | **Implementado** (Fase 2) — schema completo, migración aplicada, servicios de dominio y seed. Ver §8 |
| Autenticación administrativa | **Implementado** (Fase 3) — Better Auth, `/admin` protegido, roles, rate limit persistente, bootstrap del primer ADMIN. Ver §9 y `docs/autenticacion.md` |
| CMS de contenido (`ContentEntry`) | **Implementado** (Fase 4) — `/admin/contenidos` con listado, editor completo, media en Supabase Storage y preview autenticada. Ver §10 y `docs/cms.md` |
| Rutas públicas VIP conectadas al CMS | **Implementado** (Fase 5) — `/bodas-reales` y `/catering` (listados y fichas) leen de `ContentEntry`; sin `generateStaticParams`, publicación visible de inmediato. Ver §11 y `docs/gate-vip.md` |
| Gate de email con sesión en servidor | **Implementado** (Fase 5) — cookie `HttpOnly` respaldada por `VipAccessSession`, consentimientos separados, rate limit persistente. **Resuelto el riesgo crítico** de las Fases 0–4. Ver §11–§12 |
| Captación de leads con backend propio | **Implementado** (Fase 6) — `POST /api/leads/requests` conecta el formulario público y los CTA de ficha con `Lead`/`LeadRequest`. Web3Forms retirado. Ver §11 y `docs/flujo-captacion.md` |
| CRM (`Lead`/`LeadRequest`, pipeline, scoring) | **Modelo, servicios y alta desde la web implementados**; `PENDIENTE` la UI de `/admin` para trabajar el pipeline |
| Zona VIP con sesión server-side | **Implementado** (Fase 5) — el gate valida en servidor antes de consultar contenido; sin `localStorage`, sin contenido desenfocado, sin opción de saltarlo |
| Despliegue | `PENDIENTE` — no se ha desplegado en ningún entorno todavía |

## 3. Arquitectura

### Objetivo aprobado

- Un único proyecto Next.js full-stack (no se crea un backend separado).
- PostgreSQL + Prisma como ORM.
- Supabase para PostgreSQL y Storage privado.
- Better Auth para acceso administrativo (email/contraseña). **Registro público desactivado.**
- CMS propio de `ContentEntry` para fichas `REAL_WEDDING` y `CATERING_EVENT` (sustituirá a `data/vip-stories.ts`).
- CRM con `Lead` separado de `LeadRequest`, pipeline, scoring, actividad y propietario de lead (detalle en `project-reference/docs/03-arquitectura-crm-leads.md`).
- Zona VIP con sesión server-side y cookie `HttpOnly` (sustituirá al `localStorage` actual).

### Estado real de implementación

- **Implementado (Fase 2):** PostgreSQL (Supabase) + Prisma como ORM único, con el modelo de datos completo (`prisma/schema.prisma`, ver `docs/modelo-datos.md`) y una capa de servicios de dominio tipados (`lib/domain/`) para Lead/LeadRequest/consentimientos/actividades/tareas/pipeline/contenido/sesiones VIP/interacciones/scoring.
- **Implementado (Fase 3):** Better Auth sobre ese mismo esquema — `/admin` protegido en servidor (no solo en middleware), roles `ADMIN`/`SALES`/`CONTENT`, primer ADMIN vía `npm run admin:bootstrap`, rate limit persistente. Detalle en §9 y `docs/autenticacion.md`.
- **Implementado (Fase 4):** CMS privado de bodas reales y catering en `/admin/contenidos` (listado con filtros y paginación server-side, editor completo, media en un bucket privado de Supabase Storage con validación real de bytes, preview autenticada, auditoría de todas las operaciones). Detalle en §10 y `docs/cms.md`.
- **Implementado (Fase 5):** las cuatro rutas públicas VIP leen de `ContentEntry` y están protegidas por un gate de email con sesión en servidor (cookie `HttpOnly` + `VipAccessSession`), consentimientos separados, rate limit persistente y registro de interacción deduplicado. Detalle en §11 y `docs/gate-vip.md`.
- **Sin implementar todavía:** la UI de administración del CRM, y la captación general (el formulario de contacto de la home sigue yendo a Web3Forms). Detalle de qué falta exactamente en `docs/arquitectura-backend.md` §7.

## 4. Stack y justificación

| Pieza | Elección | Justificación |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Ya venía como base de la plantilla; permite un único proyecto full-stack (frontend + futuras API routes) sin backend separado |
| UI | React 19 + TypeScript estricto | Coherente con Next 16; `strict: true` ya activo en `tsconfig.json` |
| Estilos | Tailwind CSS 4 + Radix UI / shadcn | Sistema de diseño ya construido sobre esta base; se conserva para no romper el lenguaje visual |
| Formularios | React Hook Form + Zod | Validación cliente/servidor coherente con los formularios de leads y el email-gate VIP |
| Gestor de paquetes | **npm** (`package-lock.json`) | Confirmado en `docs/auditoria-v2.md` como el gestor realmente usado (todos los `dev`/`build` se ejecutan con npm); se eliminó `pnpm-lock.yaml` en esta fase por ser residual |
| Lint | ESLint 9 (flat config) + `eslint-config-next@16.0.10` | Versión exacta alineada con la de Next.js instalada; sustituye al script `lint` que antes fallaba por falta de instalación |
| Tests unitarios/componentes | Vitest 4 + Testing Library + jsdom | Integración nativa con Vite/Turbopack, arranque más rápido que Jest para este tamaño de proyecto; sin necesidad de un runner de navegador real para pruebas de componentes |
| Tests E2E | `PENDIENTE` (Playwright, cuando se incorpore) | No se ha añadido en esta fase: el alcance solo pedía Vitest + Testing Library |
| CI | GitHub Actions (`npm ci` + lint + typecheck + test + build) | Sin secretos, reproducible desde cero |
| Base de datos | PostgreSQL (Supabase) + **Prisma 6.19.3** | Decisión aprobada antes de esta fase. Se descartó deliberadamente Prisma 7 (última): exige un *driver adapter* y mueve la config a `prisma.config.ts`, complejidad no justificada todavía. Ver `docs/arquitectura-backend.md` §1 |
| Seed / scripts de BD | `tsx` | Ejecuta `prisma/seed.ts` y `scripts/admin-bootstrap.ts` en TypeScript directamente, resolviendo el alias `@/*` sin pasos de compilación |
| Autenticación | **Better Auth 1.6.26** | Adaptador oficial de Prisma sobre el esquema ya creado en la Fase 2, rate limiting persistente incorporado (sin Redis) y roles vía `additionalFields` sin tabla paralela. El documento de referencia sugería Auth.js; se prefirió Better Auth por estas tres piezas nativas — detalle en `docs/autenticacion.md` §1 |

## 5. Estructura de carpetas

```
app/                  rutas (App Router): home, legal, bodas-reales, catering, robots/sitemap
app/bodas-reales/     listado + [slug]: envoltorios sobre VipLibrary/VipStory (dinámicos)
app/catering/         idem para catering — no hay componentes duplicados por sección
app/admin/login/      login público (/admin/login)
app/admin/(protected)/ layout protegido + /admin (dashboard) + /admin/usuarios (ADMIN)
app/admin/(protected)/contenidos/  CMS: listado, /nuevo, /[id] (editor), /[id]/preview + actions.ts
app/api/auth/[...all] handler de Better Auth (sign-in, sign-out, get-session, ...)
app/api/admin/users/  API ADMIN-only de ejemplo (401/403/200 probados)
app/api/leads/requests/ alta pública de solicitudes comerciales (contrato en docs/openapi.yaml)
components/           UI, secciones de home, vip/, icons/, ui/ (shadcn)
components/vip/       vip-library.tsx y vip-story.tsx (servidor, compartidos por ambas secciones),
                      vip-gate.tsx, track-vip-view.tsx, story-card.tsx, story-detail.tsx, list-header.tsx
data/                 site-content (+ mirror en inglés) y vip-stories.ts — este último ya NO lo leen
                      las rutas: se conserva solo como fuente del seed de demostración
lib/                  leads.ts (envío al endpoint propio), attribution.ts (UTMs + referrer),
                      i18n (frontend) + db.ts (cliente Prisma) + legal.ts (versión de política)
lib/notifications/    lead-request-notification.ts (aviso interno tolerante a fallos)
lib/auth.ts           configuración de Better Auth (servidor)
lib/auth-client.ts    cliente de Better Auth (React, "use client")
lib/auth/             session.ts (requireSession/requireRole/requirePermission), test-helpers.ts
lib/vip/              session.ts (cookie + getVipLead), gate-action.ts, track-action.ts, metadata.ts
lib/content/          to-story-detail.ts y to-story-card.ts (ContentEntry → props de presentación)
lib/domain/           servicios de dominio: leads, lead-requests, consents, activities, notes,
                      tasks, content, content-media, vip-sessions, interactions, scoring, audit,
                      metadata, errors
lib/security/         hash.ts (HMAC rotable), tokens.ts (token VIP), rate-limit.ts (persistente),
                      text.ts (saneado no destructivo + escape de salida)
lib/storage/          supabase.ts (cliente server-only), bucket.ts, validate-image.ts
                      (firma real de bytes), external-url.ts (anti-SSRF), object-name.ts
lib/validation/       content.ts (esquemas Zod del editor), vip-gate.ts,
                      lead-request.ts (esquema compartido cliente/servidor de la solicitud)
lib/slug.ts           sugerencia de slug (la validación real es en servidor)
middleware.ts         redirección de /admin según cookie de sesión (no autoriza; ver §9)
prisma/               schema.prisma, migrations/, seed.ts
scripts/              admin-bootstrap.ts (primer ADMIN), ensure-storage-bucket.ts (bucket privado)
project-reference/    fuente de verdad de negocio (extracción web, Instagram, arquitectura CRM, marca) — no eliminar
docs/                 documentación técnica: auditorías, modelo de datos, arquitectura de backend,
                      autenticación, cms, gate-vip, flujo-captacion, openapi.yaml (contrato HTTP)
.github/workflows/    CI (ci.yml)
eslint.config.mjs     configuración de ESLint (flat config)
vitest.config.mts     configuración de Vitest
vitest.setup.tsx      setup global de tests (jest-dom, mock de next/image, cleanup, carga de .env)
```

## 6. Instalación

```bash
npm ci          # o npm install
npm run dev
```

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run test        # Vitest (una vez) — los tests que hablan con BD necesitan .env; sin él se saltan solos
npm run test:watch  # Vitest en modo watch
npm run build        # build de producción (Turbopack, valida tipos)
```

```bash
npm run db:generate  # prisma generate — regenera el cliente tras cambiar el schema
npm run db:migrate    # prisma migrate dev — SOLO contra la base de desarrollo (nunca producción)
npm run db:seed       # ejecuta prisma/seed.ts (usuarios ficticios + 6 casos de ejemplo isDemo=true)
npm run db:studio     # prisma studio — explorador visual de la base de datos
npm run admin:bootstrap     # crea el primer usuario ADMIN (idempotente; ver §7 y docs/autenticacion.md §4)
npm run storage:bootstrap   # crea/reconcilia el bucket privado vip-content (idempotente; ver §10)
```

## 7. Variables de entorno

Ver `.env.example` (sin valores reales). Configuradas en `.env` (no versionado):

| Variable | Uso | Estado |
|---|---|---|
| `DATABASE_URL` | Prisma en runtime — pooler de Supabase, modo Transaction (puerto 6543, `pgbouncer=true`) | **En uso** desde Fase 2 |
| `DIRECT_URL` | `prisma migrate`/`db push` — pooler de Supabase, modo Session (puerto 5432; la conexión directa no resuelve en este entorno, ver `docs/arquitectura-backend.md` §2) | **En uso** desde Fase 2 |
| `SUPABASE_URL` | URL del proyecto (`porton-tfm-dev`); la usa el cliente de Storage y determina el host autorizado de `next/image` | **En uso** desde Fase 4 (host de imágenes, desde Fase 5) |
| `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY` | Clave pública del proyecto (nueva/legacy) | Provisionadas; sin uso en código (el bucket es privado y todo pasa por servidor) |
| `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Clave privilegiada, **solo servidor**: subida, borrado y firma de URLs del bucket privado. `SECRET_KEY` tiene precedencia | **En uso** desde Fase 4 (`lib/storage/supabase.ts`, protegido con `import "server-only"`). Trátese como secreto crítico |
| `RATE_LIMIT_HASH_SECRET` (+ `_PREVIOUS` opcional) | HMAC irreversible para hashear identificadores de rate limit (nunca se guarda la IP) | **En uso real** desde Fase 5 (`lib/security/rate-limit.ts`, rate limit del gate VIP) |
| `VIP_TOKEN_HASH_SECRET` (+ `_PREVIOUS` opcional) | HMAC irreversible del token de sesión VIP | **En uso** desde Fase 2; desde Fase 5 respalda la cookie de acceso real |
| `ENABLE_DEMO_CONTENT` | Si no es `"true"`, oculta de los listados públicos el `ContentEntry` con `isDemo=true` (los 6 casos migrados de `data/vip-stories.ts`) | **En uso** desde Fase 2; en `.env` de desarrollo vale `true` |
| `BETTER_AUTH_SECRET` | Firma las cookies/tokens de sesión de Better Auth (32 bytes aleatorios) | **En uso** desde Fase 3. Rotarlo invalida todas las sesiones activas |
| `BETTER_AUTH_URL` | Origen real desde el que se sirve la app; determina si la cookie de sesión se marca `Secure` y cuál es el origen de confianza | **En uso** desde Fase 3. En desarrollo, `lib/auth.ts` añade además `localhost:3000/3001` como orígenes de confianza para que el login no falle si Next arranca en otro puerto (en producción esa lista está vacía) |
| `ADMIN_BOOTSTRAP_NAME` / `_EMAIL` / `_PASSWORD` | Solo para `npm run admin:bootstrap`, una vez | **Uso puntual** — deben retirarse de `.env` inmediatamente después de crear el primer ADMIN (ver `docs/autenticacion.md` §4) |
| `SENDGRID_API_KEY` / `LEAD_NOTIFICATION_TO` | Aviso interno por email de cada solicitud comercial nueva | **Opcionales, sin configurar.** Los formularios funcionan igual sin ellas: el aviso queda como `PENDING` en `NotificationLog`. El transporte real se integra con el CRM (Fase 7) |

Todas las variables de Supabase y de hashing se mantienen sin prefijo `NEXT_PUBLIC_` porque su uso previsto es siempre server-side. Lo mismo aplica a `BETTER_AUTH_SECRET`; `BETTER_AUTH_URL` tampoco lo necesita porque el cliente de Better Auth (`lib/auth-client.ts`) usa el origen del navegador por defecto.

**Retirada en Fase 6:** `NEXT_PUBLIC_WEB3FORMS_KEY` ya no existe. Era la única variable con prefijo `NEXT_PUBLIC_` del proyecto y desapareció al sustituir el envío del navegador a Web3Forms por `POST /api/leads/requests`.

## 8. Datos y migraciones

**Implementado (Fase 2).** `prisma/schema.prisma` define 25 tablas (autenticación compatible con Better Auth, CRM, CMS, acceso VIP e interacción — detalle narrado en `docs/modelo-datos.md`, con diagrama ER). Migración inicial aplicada de verdad contra la base de desarrollo de Supabase: `prisma/migrations/20260811101614_init/`. `lib/db.ts` expone el singleton de `PrismaClient`.

`data/site-content.ts` y `data/vip-stories.ts` **siguen siendo la fuente real del frontend público** — no se han borrado ni se ha migrado ninguna página para leer de la base de datos todavía (instrucción explícita: no borrar `vip-stories.ts` hasta que la migración pública esté completa). Los 6 casos de ejemplo de `vip-stories.ts` existen *también* como `ContentEntry` (`isDemo=true`) vía `prisma/seed.ts`, como preparación para cuando el frontend público se conecte a la base de datos.

## 9. Autenticación

**Implementado (Fase 3).** Better Auth 1.6.26 sobre el esquema ya creado en la Fase 2 (`User`/`Session`/`Account`/`Verification`, sin tabla de contraseñas paralela). Detalle completo, decisiones y verificación manual/automática en `docs/autenticacion.md`; resumen:

- `/admin/login` pública; `/admin` y toda subruta exigen sesión, comprobada de verdad en servidor (`app/admin/(protected)/layout.tsx`), no solo por el `middleware.ts` (que solo redirige según si existe la cookie, sin tocar la base de datos).
- Alta pública desactivada (`emailAndPassword.disableSignUp`); contraseña mínima 12 caracteres; hash por defecto de Better Auth (scrypt); mensajes de login genéricos (mismo error exista o no la cuenta).
- Roles `ADMIN`/`SALES`/`CONTENT` vía `requireSession`/`requireRole`/`requirePermission` (`lib/auth/session.ts`), usados en Route Handlers (`app/api/admin/users/route.ts`) y Server Actions (`app/admin/(protected)/usuarios/actions.ts`).
- Rate limit persistente en base de datos (tabla `rateLimit`), CSRF/validación de origen intacta (no desactivada), cookies `HttpOnly`/`SameSite=Lax`/`Secure` en producción — todo comportamiento por defecto de Better Auth, verificado con peticiones reales (`docs/autenticacion.md` §5–§6).
- Primer usuario ADMIN vía `npm run admin:bootstrap` (idempotente, no usa el endpoint público de alta).
- `components/admin-access.tsx` (botón discreto) navega a `/admin/login` o `/admin` según haya sesión (`authClient.useSession()`); ya no es un placeholder.
- `/admin/usuarios` (ADMIN) es la única pantalla de administración construida en esta fase — listar usuarios y cambiar su rol. CRM y CMS (§10–§11) siguen sin UI de administración: no era alcance de esta fase.

## 10. CMS

**Implementado (Fase 4).** CMS privado para las fichas de bodas reales y catering. Detalle completo en `docs/cms.md`; resumen:

- **Rutas** (todas exigen `cms:access` = ADMIN o CONTENT, validado en la página *y* en cada Server Action): `/admin/contenidos` (listado), `/admin/contenidos/nuevo`, `/admin/contenidos/[id]` (editor), `/admin/contenidos/[id]/preview`.
- **Listado:** pestañas (Todo/Bodas reales/Catering/Borradores/Publicados/Archivados), búsqueda por título/slug/espacio, filtros por tipo/estado/demo/destacado/fecha, paginación server-side y acciones de editar, duplicar como borrador, previsualizar, publicar, despublicar y archivar. **No hay "eliminar"**: una ficha publicada no se borra físicamente desde la UI.
- **Editor:** todos los campos que muestra `StoryDetail`, en el mismo orden (tipo, slug, fecha/temporada/espacio, títulos ES obligatorio / EN opcional, introducción, media, decoración, photocall, minuta, cronología, momentos, proveedores, tiempo y solución, testimonio, presupuesto, CTA, destacado/orden, isDemo y SEO básico compatible con `noindex`). Estados *Guardando/Guardado/Error/Cambios sin guardar*.
- **Workflow:** toda ficha nace `DRAFT`; publicar exige título, slug, traducción española, hero y `alt` de la hero (y `alt` en el resto de imágenes), y la UI dice exactamente qué falta; publish/unpublish/archive son transaccionales con su `AuditEvent`; archivar pide confirmación; las sobrescrituras concurrentes se detectan por `updatedAt` y se rechazan en vez de pisar el trabajo ajeno; publicar/despublicar revalida las rutas públicas afectadas.
- **Media:** bucket **privado** `vip-content` en Supabase Storage (`npm run storage:bootstrap`). La clave privilegiada nunca sale del servidor (`import "server-only"`). Se valida tamaño (**máximo 10 MB por imagen**), extensión, MIME y **la firma real de bytes**, además de las dimensiones leídas de la cabecera; los nombres de objeto los genera el servidor (UUID), nunca el usuario; las URLs son firmadas y temporales; el borrado va por Storage API y **no borra un objeto todavía referenciado** por otra ficha (caso real: duplicar como borrador comparte los objetos); los vídeos/Reels externos exigen `https`, host de una lista explícita, miniatura, y pasan un filtro anti-SSRF.
- **Auditoría:** `content.create/update/publish/unpublish/archive/duplicate` y `media.upload/delete`, con metadatos limitados a identificadores y datos técnicos — nunca cuerpos de contenido ni URLs firmadas.
- **Ejemplos:** los 6 casos de `data/vip-stories.ts` viven también como `ContentEntry` con `isDemo=true` (seed idempotente), conservando la etiqueta "Ejemplo ilustrativo" y ocultos en producción salvo `ENABLE_DEMO_CONTENT=true`. Su **equivalencia con la fuente estática está probada** campo por campo (`lib/content/seed-equivalence.test.ts`), que es la condición para poder retirarla.
- **Conectado a las rutas públicas en la Fase 5** con `listPublishedContent`/`getPublishedContentBySlug` y el mapeador `lib/content/to-story-detail.ts`, que es el mismo que usa la preview del panel. Desde la Fase 6, ese mapeador también propaga el id de la ficha al CTA para atribuir la solicitud comercial (§11).

## 11. Captación y CRM

- **Gate VIP (Fase 5): captación real.** El acceso a las bibliotecas de bodas reales y catering pide el email una sola vez y lo persiste como `Lead` con sus `ConsentEvent` (privacidad obligatoria y marketing separado y opcional), `LeadActivity` y `ContentInteraction`. Todo en una transacción; si falla, no se concede acceso. Detalle completo en `docs/gate-vip.md`.
- **Riesgo crítico resuelto.** El gate ya no es client-side: valida la sesión **antes** de consultar cualquier ficha, así que sin acceso no hay contenido en el HTML ni en el payload RSC. Verificado en el servidor real y con un test que espía la capa de datos para comprobar que no se llama (`components/vip/access-boundary.test.tsx`). Las rutas ya no son SSG y no se pregeneran slugs.
- **Formularios públicos con API propia (Fase 6).** `POST /api/leads/requests` (`app/api/leads/requests/route.ts`) es el único camino de alta de una solicitud comercial. La interfaz nunca habla con Prisma: `components/sections/contact.tsx` valida con el esquema compartido y envía a través de `lib/leads.ts`. Detalle completo en `docs/flujo-captacion.md` y contrato HTTP en `docs/openapi.yaml`.
- **Campos de la solicitud.** Contacto (nombre, apellidos, email, teléfono opcional) y solicitud (tipo de evento, fecha y número de invitados opcionales, espacio de interés, presupuesto orientativo opcional, asunto, mensaje). En eventos corporativos (`CORPORATE_EVENT`, `CONGRESS`) aparecen además empresa —**obligatoria**—, cargo y necesidades audiovisuales; con cualquier otro tipo de evento esos tres campos se descartan en servidor y no llegan al CRM. Criterio: se exige la empresa porque es el dato que permite cualificar la solicitud, no el cargo ni una descripción técnica.
- **Vocabulario estable.** El tipo de evento se guarda como código (`WEDDING`, `CORPORATE_EVENT`, …), no como etiqueta traducida, para que "Boda" y "Wedding" agrupen igual en el CRM; las etiquetas visibles viven en `data/site-content.ts` y su espejo en inglés. Los espacios usan el mismo slug con el que la web los publica, y un test comprueba que las dos listas no se desvíen.
- **Transacción única.** `createLeadRequest` crea o actualiza el `Lead`, **crea siempre una `LeadRequest` nueva** (nunca actualiza una anterior), registra el `ConsentEvent` de privacidad —y el de marketing solo si se concede— y anota la `LeadActivity` `FORM_SUBMITTED`. El recálculo de score y el aviso por email van después del commit, porque son derivados y no deben alargar ni condicionar la transacción.
- **Atribución.** `Lead.firstSource` se escribe solo al crear el Lead (first touch) y `lastSource` en cada solicitud (last touch). Cada `LeadRequest` conserva su propia atribución completa: `sourcePage`, `sourceForm`, `sourceContentId`, `referrer` y las cinco UTMs.
- **CTA de ficha.** "Quiero una boda así" / "Quiero un catering así" enlaza a `/?tipo=<CÓDIGO>&ficha=<id>#contacto`. El formulario preselecciona el tipo de evento, sugiere el asunto con el propio texto del botón y envía la ficha como `sourceContentId`. El servidor no se lo cree: verifica que corresponde a una `ContentEntry` publicada y, si no, descarta el origen pero **guarda la solicitud igual**.
- **Consentimientos.** Privacidad obligatoria con enlace a la política; marketing separado, opcional y desmarcado de origen. La `policyVersion` la valida el servidor contra la vigente (409 si no coincide, para no registrar un consentimiento sobre un texto que ya cambió). Dejar la casilla de marketing sin marcar **no** registra un `granted=false`: no sería una petición de baja y revocaría un consentimiento dado antes por otra vía.
- **Antispam.** Honeypot (responde 202 indistinguible de un éxito y no guarda nada), tiempo mínimo de formulario de 3 s (error recuperable), rate limit persistente de 5 envíos/15 min por IP y 3/60 min por email —con la clave siempre hasheada—, límite de cuerpo de 32 KiB, validación de mismo origen e idempotencia por `submissionId`. Sin CAPTCHA: descartado mientras no haya abuso demostrado.
- **Doble envío.** El formulario genera una clave de idempotencia por intento: se renueva tras un envío correcto y se conserva tras un error, de modo que un reintento sobre una petición que sí llegó a guardarse no crea una solicitud duplicada. La garantía real es el índice único `LeadRequest.submissionId`.
- **Estados de la interfaz.** *Enviando*, *éxito* y *error* con mensajes bilingües; la región de resultado es `aria-live` y recibe el foco al responder el servidor. Un error **no borra lo escrito**. El mensaje de éxito confirma el registro y que habrá contacto, sin prometer plazos que nadie ha aprobado.
- **Aviso por email.** `lib/notifications/lead-request-notification.ts` se invoca tras el commit y sin `await`, y no puede hacer fallar un envío: sin `SENDGRID_API_KEY`/`LEAD_NOTIFICATION_TO` queda como `PENDING` en `NotificationLog`; si falla, como `FAILED`. El transporte real se integra con el CRM.
- **Gate VIP (Fase 5).** Sigue siendo un flujo distinto: captura un email para dar acceso a contenido, no una petición de presupuesto. Comparte el `Lead` (mismo email normalizado) pero no genera `LeadRequest`.
- **Implementado en la capa de dominio (Fase 2, `lib/domain/`):** modelo `Lead`/`LeadRequest` (un Lead puede tener varias LeadRequest; nunca se sobrescribe una anterior), consentimientos inmutables, actividades, notas, tareas de seguimiento, pipeline con máquina de estados validada (`changeLeadRequestStatus`), scoring configurable (`ScoringRule` + `recalculateLeadScore`), sesiones VIP con token hasheado, e interacciones de contenido. Todo probado contra la base de datos real de desarrollo (§13).
- **`PENDIENTE`:** UI de `/admin` para trabajar el pipeline/CRM (bandeja de solicitudes, cambio de estado, notas, tareas) y transporte real de correo.

## 12. Seguridad y privacidad

- Ningún secreto en archivos versionables: `.env` está excluido por `.gitignore` (`.env*`, con excepción de `.env.example`, sin valores reales). Verificado con `git check-ignore`.
- Consentimiento de privacidad y de marketing son campos separados en toda la web (formulario comercial y gate VIP) y se persisten como `ConsentEvent` inmutable — una revocación es un evento nuevo, nunca un `UPDATE`.
- **Nuevo en Fase 2:** hash HMAC-SHA256 con rotación de clave (`lib/security/hash.ts`) para identificadores de rate limit y para el token de sesión VIP — nunca se guarda la IP ni el token en claro. `sanitizeMetadata` (`lib/domain/metadata.ts`) descarta contraseñas/tokens/IP/user-agent y trunca strings antes de guardar `LeadActivity.metadata`/`AuditEvent.metadata`. `anonymizeLead` es transaccional y está probada. Detalle en `docs/arquitectura-backend.md` §4.
- **Nuevo en Fase 5 (gate VIP):** la autorización vive en una cookie `HttpOnly` respaldada por `VipAccessSession` en base de datos, no en `localStorage`. La cookie contiene **solo el token**, nunca el email ni el id del lead; en base de datos solo su HMAC, verificado con comparación de tiempo constante. Sin sesión válida no se consulta ni se serializa ninguna ficha. El gate no se puede cerrar ni saltar (se eliminó el botón de "saltar verificación"). Rate limit persistente de 5 intentos/10 min por IP, con la IP siempre hasheada. Consentimientos de privacidad y marketing separados e inmutables, con la versión de la política registrada. El mensaje de error es idéntico exista o no el email. Detalle en `docs/gate-vip.md` §3–§5.
- **Nuevo en Fase 3:** acceso administrativo real con Better Auth — sesiones `HttpOnly`/firmadas, rate limit persistente, CSRF/origen sin desactivar, alta pública rechazada, mensajes de login sin enumeración de usuarios, roles verificados en servidor en cada Route Handler/Server Action privada (nunca solo en el middleware). Detalle y verificación en `docs/autenticacion.md` §5–§6.
- **Nuevo en Fase 4 (media y CMS):** el bucket `vip-content` es **privado** y la clave privilegiada de Supabase no puede llegar al navegador (`import "server-only"` hace fallar el build si se importa desde un componente cliente). Las imágenes se validan por su **firma real de bytes**, no por extensión ni por el MIME declarado (un `.exe` renombrado a `.png`, o un JPEG declarado como PNG, se rechazan). Los nombres de objeto los genera el servidor (UUID), nunca el usuario. Las URLs son firmadas y temporales (10 min) y no se registran en auditoría. Las URLs externas pasan un filtro **anti-SSRF** (loopback, redes privadas, `169.254.169.254`, `.internal`/`.local`) y **anti-XSS** (solo `https:`). El CTA de una ficha solo admite rutas internas. Detalle en `docs/cms.md` §5.
- **Nuevo en Fase 6 (formularios públicos):** el endpoint de solicitudes valida en servidor con el mismo esquema que el formulario, no se fía de ningún campo del cliente (la versión de la política y la ficha de origen se comprueban contra el servidor y la base de datos) y responde con **códigos de error, no con textos**, sin filtrar nunca los valores recibidos: en un error de validación solo viaja la lista de nombres de campo. Un fallo de escritura devuelve un `persistence-failed` genérico y el motivo real queda solo en el log del servidor. El texto libre **no se transforma al guardarlo** (el saneado es de salida: JSX escapa en la interfaz y `escapeHtml` en el correo); lo único que se elimina antes de persistir son caracteres de control, porque PostgreSQL rechaza el byte NUL. Las claves de rate limit —IP y email— se guardan hasheadas con HMAC, nunca en claro. Detalle en `docs/flujo-captacion.md` §5–§9.
- Vulnerabilidades conocidas en dependencias (`npm audit`, heredadas de `next@16.0.10` → `postcss`/`sharp`): 3 de severidad alta, con corrección disponible únicamente subiendo a `next@16.3.0` (fuera del rango declarado en `package.json`). No se ha aplicado; queda como decisión pendiente para el cliente/equipo.
- Detalle completo de riesgos en `docs/auditoria-v2.md` y `docs/arquitectura-backend.md`.

## 13. Pruebas

| Tipo | Herramienta | Estado |
|---|---|---|
| Tipos | `tsc --noEmit` (script `typecheck`) | Verde, ejecutado en cada build |
| Lint | ESLint 9 + `eslint-config-next` (script `lint`) | Verde (0 errores, 0 warnings) |
| Unitarios / componentes (frontend) | Vitest + Testing Library + `user-event` (script `test`) | `StoryCard` (título, subtítulo, enlace y la etiqueta obligatoria "Ejemplo ilustrativo"), el enlace del CTA de ficha y el formulario comercial completo — ver la fila de la Fase 6 |
| Dominio/BD (`lib/domain/*.test.ts`) | Vitest contra la base de datos real de desarrollo (sin Docker/Postgres local disponible en este entorno, ver `docs/arquitectura-backend.md` §5) | 7 archivos, 20 pruebas: normalización, concurrencia al crear Lead, múltiples LeadRequest sin sobrescritura, transiciones de pipeline (válida/inválida/LOST sin motivo), consentimientos inmutables, scoring (activo/inactivo), publicación de contenido (+ conserva `publishedAt` al republicar), slug duplicado, mismo slug en dos tipos, sesión VIP (hash, revocación, token inválido), anonimización |
| Autenticación/autorización (Fase 3) | Vitest contra Better Auth real + la base de desarrollo (mismo patrón `itDb`) | 5 archivos, 23 pruebas: `requireSession`/`requireRole`/`requirePermission`, 401/403/200 en `GET /api/admin/users`, la Server Action `updateUserRoleAction` rechaza sin sesión/con rol incorrecto, alta pública rechazada, mensaje de error genérico, logout revoca la sesión en servidor, redirecciones del middleware. Detalle en `docs/autenticacion.md` §7 |
| CMS (Fase 4) | Vitest: puros para validación/SSRF/slug; contra la base real y **contra el bucket real** para dominio y media | 7 archivos, 163 pruebas: validación de imagen por firma de bytes (JPEG-como-PNG, `.exe`, SVG, PDF, tamaño, dimensiones), anti-SSRF (13 destinos internos), slug, esquemas Zod, permisos por rol en las Server Actions (SALES rechazado en crear/publicar/archivar/duplicar/subir), publicación incompleta, orden y paginación, rutas revalidadas, subida y borrado reales en Storage, objeto compartido no borrado, auditoría sin datos sensibles, y equivalencia de los 6 ejemplos con la fuente estática. Detalle en `docs/cms.md` |
| Gate VIP y publicación dinámica (**nuevo en Fase 5**) | Vitest contra la base real, más tests del límite de acceso que espían la capa de datos | 9 archivos, 103 pruebas: gate muestra sin sesión y no consulta contenido ni firma URLs, slug directo protegido, cookie manipulada/caducada/revocada (y el hash no sirve como token), privacidad obligatoria, marketing opcional, honeypot, `returnPath` externo rechazado, no sobrescribir datos mejores de un Lead, mismo resultado exista o no el email, rate limit persistente (con IP hasheada, ventana e incremento atómico), fallo de base de datos no desbloquea, borradores y archivados invisibles, orden por destacado, interacción por categoría con deduplicación, noindex y sitemap sin slugs VIP. Detalle en `docs/gate-vip.md` §11 |
| Formularios públicos y solicitudes comerciales (**nuevo en Fase 6**) | Vitest: puros para el esquema compartido, el saneado de texto y el enlace del CTA; Testing Library + `user-event` para el formulario; contra la base real para el endpoint | 7 archivos, 91 pruebas: solicitud válida completa (Lead + LeadRequest + consentimiento + actividad), mismo email con dos solicitudes conserva las dos, first touch conservado y last touch actualizado, privacidad rechazada sin guardar nada, marketing en false sin evento de marketing y **sin revocar** uno anterior, versión de política caducada (409), fecha pasada / día inexistente / fecha lejana, invitados fuera de rango, payload de 64 KiB (413), JSON inválido, content-type y origen ajeno, honeypot (202 sin guardar), tiempo mínimo, rate limit por IP, doble clic concurrente y reintento con la misma clave (una sola solicitud), UTMs completas y `sourceContentId` verificado (ficha inexistente y borrador descartados), fallo de persistencia (503 genérico, sin filtrar el error interno ni avisar por email), aviso con y sin proveedor configurado, y que los errores no revelen los valores enviados. En el formulario: mensajes de validación traducidos, campos de empresa que aparecen solo en un evento corporativo y empresa exigida, honeypot fuera del alcance de teclado y de lectores de pantalla, región `aria-live` que recibe el foco al responder, datos conservados tras un error y limpiados tras un éxito, reutilización de la clave de idempotencia tras un fallo, y atribución `vip-story-cta` + `sourceContentId` cuando se llega desde el CTA de una ficha. Detalle en `docs/flujo-captacion.md` |
| End-to-end | `PENDIENTE` (Playwright, cuando se incorpore) | No añadido todavía. Las verificaciones de las Fases 3, 4 y 6 se hicieron con peticiones HTTP reales (`curl`) contra el servidor de desarrollo, no en un navegador — ver §16 |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | `npm ci` → lint → typecheck → test → build, sin secretos. Los tests de dominio/BD se saltan solos en CI (`itDb`, condicionado a `DATABASE_URL`) y se ejecutan de verdad en local |

## 14. Despliegue

`PENDIENTE`. No se ha desplegado el proyecto en ningún entorno. La configuración de imágenes de Next (`next/image` con optimización activada, ver §16) es compatible con Vercel o con un servidor Node propio; la decisión de plataforma queda pendiente.

## 15. Uso de IA

Este proyecto se desarrolla con Claude Code como asistente de desarrollo full-stack, siguiendo un flujo de prompts secuenciales documentado en `project-reference/docs/02-prompts-claude-code.md` y las reglas de trabajo fijadas en `CLAUDE.md` (fuente de verdad basada en código real, sin datos de negocio inventados, sin commits/despliegues sin petición explícita, documentación obligatoria por fase). Cada fase se audita y valida con comandos reales (lint/typecheck/test/build) antes de considerarse cerrada; los resultados se registran en el historial de este README (§18) y en `docs/`.

## 16. Limitaciones conocidas

- Los **tramos de presupuesto** del formulario (`hasta-10000`, `10000-20000`, `20000-35000`, `mas-35000`, `por-definir`) son una propuesta de trabajo, no tarifas de la finca: pendientes de confirmación del cliente antes de producción (marcado con `TODO(negocio)` en `lib/validation/lead-request.ts`).
- El apartado 5 de la **política de privacidad** describe el tratamiento técnico real tras retirar Web3Forms, pero está marcado como **pendiente de revisión jurídica**: la redacción legal definitiva (identificación del encargado del tratamiento, contrato de encargo y transferencias internacionales si las hubiera) la tiene que validar un profesional.
- El **tiempo mínimo de formulario** se calcula con un valor que envía el cliente (`formElapsedMs`), así que es falsificable. Es un filtro de automatismos ingenuos que se suma al honeypot y al rate limit, no una defensa criptográfica; documentado como tal en `lib/validation/lead-request.ts`.
- El **honeypot** responde con un éxito aparente y descarta el envío. Si un gestor de contraseñas o una extensión rellenara el campo oculto, esa persona perdería su mensaje sin saberlo. Es el compromiso habitual de la técnica, asumido a conciencia.
- El **aviso interno por email no tiene transporte todavía**: sin `SENDGRID_API_KEY`/`LEAD_NOTIFICATION_TO` el aviso queda como `PENDING` en `NotificationLog`, y con esas variables puestas falla y queda como `FAILED`. En ninguno de los dos casos afecta a la solicitud guardada. Se integra con el CRM (Fase 7).
- Las bibliotecas VIP son `force-dynamic`: cada visita consulta la base de datos y actualiza `lastUsedAt` de la sesión. Es lo que permite que publicar se vea al instante, pero significa que estas rutas no se sirven desde caché estática. Con el volumen previsto (una finca, no un medio de comunicación) es la decisión correcta; si el tráfico creciera mucho habría que introducir caché por sesión.
- Las URLs firmadas de Supabase duran una hora, así que `next/image` reoptimiza cada imagen una vez por hora como máximo. Aceptable, pero no es gratis; documentado en `docs/gate-vip.md` §6.
- La UI de administración del **CRM** no existe todavía: `/admin/usuarios` y `/admin/contenidos` son las pantallas reales; el pipeline de leads sigue sin interfaz.
- Las verificaciones de las Fases 3, 4 y 6 se hicieron con peticiones HTTP reales (`curl`) y tests automatizados contra servicios reales (Better Auth, base de datos y bucket de Storage), pero **no en un navegador** (sin herramienta de automatización de navegador disponible en este entorno): no se ha comprobado visualmente el arrastre de orden de la media, los estados de carga del editor ni el formulario de login. Del formulario comercial sí se prueban en jsdom el movimiento de foco al resultado y los atributos de la región `aria-live`, pero **no se ha escuchado con un lector de pantalla real**, que es lo único que confirma cómo se anuncia. Ver `docs/autenticacion.md` §6.
- El editor no permite **añadir** vídeos/Reels externos desde la UI: el servicio y su validación están implementados y probados, pero el formulario solo sube imágenes. La media externa existente sí se lista, ordena y borra. Ver `docs/cms.md` §10.
- Las imágenes se guardan tal cual (con el límite de 10 MB): no hay recorte, redimensionado ni generación de miniaturas para vídeos externos.
- `middleware.ts` genera un aviso de obsolescencia en el build de Next 16 (`"middleware" file convention is deprecated, use "proxy" instead`) — sigue siendo totalmente funcional (confirmado en build y en las pruebas). No se ha renombrado a `proxy.ts` en esta fase por no tener confirmada la convención exacta de exportación de esa nueva API sobre un componente de seguridad; revisar en una fase futura de actualización de Next.
- Los 3 usuarios de `prisma/seed.ts` (Fase 2) siguen sin credenciales de acceso: son datos de demostración del CRM, no cuentas para iniciar sesión. El primer ADMIN operativo se crea por separado con `npm run admin:bootstrap` (§9).
- Las pruebas de dominio y de autenticación que usan base de datos corren contra la base de desarrollo real de Supabase, no contra una base aislada (no hay Docker/Postgres local disponible en este entorno). Limitación documentada, no oculta — ver `docs/arquitectura-backend.md` §5.
- Se usa Prisma 6 en vez de la versión 7 (última) por una razón concreta de arquitectura (adapters obligatorios), no por desconocimiento — ver `docs/arquitectura-backend.md` §1. Revisar en una fase futura.
- El host de conexión directa de Supabase no resuelve en este entorno (probable IPv6-only); se usa el *pooler* en modo Session como alternativa para migraciones — ver `docs/arquitectura-backend.md` §2.
- Traducción al inglés limitada a navegación, home, contacto y legal-links; las fichas VIP y el texto completo de las páginas legales no están traducidos.
- Contenido pendiente de verificación con el cliente antes de producción (marcado explícitamente en el código):
  - `public/images/porton/02-salon-celebraciones.jpg` lleva marca de agua de fotógrafo externo sin derechos de uso confirmados.
  - Teléfono/código postal del aviso legal original inconsistente con el resto de la web original.
  - Ficha de Bodas.net pendiente de confirmación.
  - CIF/NIF y datos registrales en el aviso legal (`[PENDIENTE: ...]`).
- 3 vulnerabilidades de severidad alta en dependencias transitivas de `next@16.0.10` (`postcss`, `sharp`), corregibles solo subiendo a `next@16.3.0`; no aplicado en esta fase (ver §12).
- Sin pruebas end-to-end todavía (Playwright no incorporado).
- Sin despliegue en ningún entorno.

## 17. Roadmap

1. ~~`prisma/schema.prisma` + `lib/db.ts` (cliente Prisma) + primera migración contra Supabase.~~ **Hecho (Fase 2).**
2. ~~Better Auth (`lib/auth.ts`, `app/api/auth/[...all]/route.ts`, `middleware.ts`) para `/admin`, registro público desactivado.~~ **Hecho (Fase 3).**
3. ~~UI del CMS de contenido en `/admin/contenidos` + media en Supabase Storage (bucket privado).~~ **Hecho (Fase 4).**
4. ~~Conectar `/bodas-reales` y `/catering` a `listPublishedContent`/`getPublishedContentBySlug`.~~ **Hecho (Fase 5).**
5. ~~Sustituir el `EmailGate` client-side por acceso validado en servidor con cookie `HttpOnly`.~~ **Hecho (Fase 5).**
6. ~~Route Handler del formulario de contacto general que llame a `createLeadRequest`, con rate limit persistente y honeypot, sustituyendo la llamada directa a Web3Forms.~~ **Hecho (Fase 6).**
7. UI de `/admin` para el CRM: dashboard, pipeline Kanban/tabla y ficha 360º del lead. Los servicios de dominio, los roles y el alta desde la web ya existen (Fases 2, 3 y 6); solo falta la interfaz. Incluye el transporte real del aviso por email.
8. Completar la media del CMS: añadir vídeos/Reels externos desde el editor y valorar redimensionado/miniaturas (ver §16).
9. Tests end-to-end con Playwright, incluyendo el flujo completo del gate en un navegador real (pendiente desde la Fase 3, ver §16).
10. Verificación del email del gate por correo, si se decide exigirla: la arquitectura ya está preparada (`docs/gate-vip.md` §3).
11. Pasada de SEO/rendimiento/accesibilidad con métricas reales (Lighthouse) y despliegue.

## 18. Historial de fases

### Fase 0 — Auditoría local y contrato de trabajo (2026-08-11)

Auditoría no destructiva del repositorio real, sin instalar dependencias ni tocar código de producto. Se verificaron uno por uno los hechos del enunciado (stack, rutas VIP, `EmailGate` client-side, formulario Web3Forms, botón admin placeholder, doble lockfile, lint sin ESLint, `ignoreBuildErrors`/`images.unoptimized`, README de baseline) y se detectó un riesgo crítico no listado en el enunciado: el contenido VIP se serializa completo en el HTML estático antes de validar ningún email. Resultado: `npx tsc --noEmit` limpio, `npm run build` correcto (16 páginas), `npm run lint` fallaba por falta de instalación. Veredicto: apto para iniciar la implementación, condicionado a resolver ese riesgo como primera tarea del backend. Se creó `docs/auditoria-v2.md` y `CLAUDE.md`.

### Fase 0.1 — Credenciales de Supabase (2026-08-11)

Se recibieron y guardaron en `.env` (nunca versionado) las credenciales del proyecto Supabase `porton-tfm-dev`: conexión a PostgreSQL (pooler puerto 6543 con `pgbouncer=true` para `DATABASE_URL`, conexión directa puerto 5432 para `DIRECT_URL`), y las claves de API del proyecto (formato nuevo `sb_publishable_`/`sb_secret_` y formato legacy `anon`/`service_role`). Ninguna se ha usado todavía en código.

### Fase 1 — Baseline reproducible, calidad y README vivo (2026-08-11)

**Cambios de código:**
- Eliminado `pnpm-lock.yaml` (residual); **npm + `package-lock.json`** confirmado como único gestor.
- Instalado y configurado ESLint 9 (flat config, `eslint.config.mjs`) con `eslint-config-next@16.0.10`.
- Corregidos los 6 errores reales que expuso el lint (patrones legítimos de sincronización con sistemas externos — `localStorage`, `matchMedia`, `embla-carousel` — y una randomización cosmética contenida en un `useMemo` de deps vacías) mediante excepciones **puntuales y documentadas** en cada línea, sin desactivar ninguna regla a nivel de configuración. Corregido también un `exhaustive-deps` real en `cookie-consent.tsx` y eliminado un `eslint-disable` obsoleto en `structured-data.tsx`.
- Eliminado `components/ui/use-mobile.tsx`: duplicado exacto y sin uso de `hooks/use-mobile.ts` (el único importado realmente por `sidebar.tsx`).
- Eliminado `styles/globals.css` (y la carpeta `styles/`): residuo de la plantilla original, no importado desde ningún archivo del proyecto.
- Retirado `typescript.ignoreBuildErrors` de `next.config.mjs`: el build ahora valida tipos realmente (`Running TypeScript...` en el log de `next build`), sin que aparezca ningún error real.
- Retirado `images.unoptimized`: verificado en caliente que `next/image` optimiza correctamente (`/_next/image` responde 200) sin la bandera.
- Añadidos scripts `typecheck`, `test` y `test:watch` a `package.json`. No se añadió `test:e2e`: el alcance de esta fase no incorpora Playwright.
- Instalado Vitest + Testing Library + jsdom (`vitest.config.mts`, `vitest.setup.tsx` con mock de `next/image` y limpieza entre tests) y añadida una prueba de `components/vip/story-card.tsx` que protege la regla de negocio "todo contenido VIP de ejemplo debe mostrar la etiqueta 'Ejemplo ilustrativo'".
- Creado `.github/workflows/ci.yml` (`npm ci` → lint → typecheck → test → build), sin secretos.
- `.gitignore` ampliado con `/coverage` (artefactos de Vitest); `.env*`, `.next`, `node_modules` y `*.tsbuildinfo` ya estaban cubiertos.
- Verificado que `next/font/google` (Cormorant Garamond, DM Sans, JetBrains Mono) descarga sin problemas de red en este entorno; no ha sido necesario migrar a `next/font/local`.
- README.md reescrito con la estructura técnica completa de este documento.

**No se ha tocado:** base de datos, autenticación, CMS, CRM, contenido comercial, ni se ha hecho push o deploy.

**Validación real ejecutada (desde `node_modules` borrado):**

| Comando | Resultado |
|---|---|
| `npm ci` | Exit 0 — 573 paquetes, reproducible desde `package-lock.json` |
| `npm run lint` | Exit 0 — 0 errores, 1 warning informativo (React Hook Form `watch()`, no corregible sin cambiar de librería) |
| `npm run typecheck` | Exit 0 |
| `npm run test` | Exit 0 — 1 archivo, 2 pruebas |
| `npm run build` | Exit 0 — 16 páginas generadas, tipos validados en build (sin `ignoreBuildErrors`) |

**Limitación externa detectada (no oculta):** `npm audit` reporta 3 vulnerabilidades de severidad alta heredadas de `next@16.0.10` (`postcss`, `sharp`), corregibles solo subiendo a `next@16.3.0`. No se ha aplicado: es un cambio de versión fuera del alcance pedido en esta fase.

**Veredicto: APTO PARA AÑADIR PERSISTENCIA.** El baseline es reproducible (`npm ci` limpio), la calidad de código tiene red de seguridad real (lint + typecheck + tests en CI) y no quedan banderas que oculten errores. Condicionado, igual que en la Fase 0, a resolver el riesgo crítico del email-gate VIP como primera tarea de la persistencia/backend, y a decidir sobre la actualización de Next.js por las vulnerabilidades señaladas.

### Fase 2 — PostgreSQL, Prisma y dominio completo (2026-08-11)

**No se ha construido ninguna pantalla de administración en esta fase** (fuera de alcance explícito).

**Decisiones:**
- Prisma **6.19.3**, no la 7 (última): Prisma 7 exige un *driver adapter* y mueve `url`/`directUrl` a un `prisma.config.ts` nuevo — complejidad de arquitectura real, no justificada todavía sin autenticación ni UI de admin. Detalle y criterio de revisión en `docs/arquitectura-backend.md` §1.
- La conexión directa de Supabase (`db.<ref>.supabase.co:5432`) no resuelve en este entorno (`ENOTFOUND`; probado con un socket TCP crudo, confirmado IPv4 OK / IPv6 no disponible aquí). `DIRECT_URL` se reconfiguró para usar el mismo *pooler* que `DATABASE_URL` pero en modo **Session** (puerto 5432, sin `pgbouncer=true`), la alternativa que documenta Supabase para este caso. Detalle en `docs/arquitectura-backend.md` §2.
- Sin Docker/Postgres local disponible (`docker ps` falla: el daemon no está en marcha). Los tests de dominio que necesitan base de datos corren contra la propia base de desarrollo (`porton-tfm-dev`), con limpieza automática (`afterEach`) y claves únicas por test; se saltan solos en CI (`itDb`, sin `DATABASE_URL`). Limitación documentada, no oculta.
- No se ha borrado `data/vip-stories.ts` (instrucción explícita): el frontend público sigue leyéndolo; los 6 casos también existen ahora como `ContentEntry` (`isDemo=true`) para cuando se conecte el frontend a la base de datos.

**Cambios de código:**
- `prisma/schema.prisma`: 25 tablas — autenticación compatible con Better Auth (`User`/`Session`/`Account`/`Verification`, sin tabla de contraseñas paralela), CRM (`Lead`, `LeadRequest`, `ConsentEvent`, `LeadActivity`, `LeadNote`, `FollowUpTask`, `Tag`/`LeadTag`, `ScoringRule`, `NotificationLog`, `AuditEvent`), CMS (`ContentEntry` + `ContentTranslation`/`ContentMedia`/`ContentProvider`/`ContentMenuSection`+`Item`/`ContentTimelineItem`/`ContentHighlight`) y acceso (`VipAccessSession`, `ContentInteraction`). Índices y cascadas detallados en `docs/modelo-datos.md`.
- `prisma/migrations/20260811101614_init/`: primera migración, aplicada de verdad contra la base de desarrollo.
- `lib/db.ts`: singleton de `PrismaClient`.
- `lib/security/hash.ts` + `tokens.ts`: HMAC-SHA256 con rotación de clave para rate limit y tokens VIP; verificación por búsqueda indexada (no escaneo de tabla).
- `lib/domain/`: `normalize.ts`, `metadata.ts`, `errors.ts`, `leads.ts`, `lead-requests.ts`, `consents.ts`, `activities.ts`, `notes.ts`, `tasks.ts`, `content.ts`, `vip-sessions.ts`, `interactions.ts`, `scoring.ts`, `audit.ts` — servicios tipados para cada operación pedida, con transacciones explícitas donde la atomicidad importa.
- `prisma/seed.ts` (+ script `db:seed`, `tsx` como dependencia): 3 usuarios ficticios con rol, 8 `ScoringRule` iniciales, y los 6 casos de `data/vip-stories.ts` migrados a `ContentEntry`. Idempotente (omite lo que ya existe).
- `.env`/`.env.example`: añadidas `RATE_LIMIT_HASH_SECRET(_PREVIOUS)`, `VIP_TOKEN_HASH_SECRET(_PREVIOUS)`, `ENABLE_DEMO_CONTENT`; `DIRECT_URL` reapuntada al pooler en modo Session.
- `docs/modelo-datos.md` (con diagrama Mermaid ER) y `docs/arquitectura-backend.md` (nuevos).
- 8 archivos de test nuevos en `lib/domain/` (20 pruebas contra la base real + 3 de normalización pura), más la carga de `.env` en `vitest.setup.tsx`.

**Validación real ejecutada:**

| Comando | Resultado |
|---|---|
| `npx prisma format` | Exit 0 |
| `npx prisma validate` | Exit 0 — *"The schema ... is valid"* |
| `npx prisma generate` | Exit 0 |
| `npx prisma migrate status` | *"Database schema is up to date!"* — sin drift |
| `npm run lint` | Exit 0 — 0 errores, 1 warning informativo (igual que en Fase 1) |
| `npm run typecheck` | Exit 0 |
| `npm run test` | Exit 0 — **8 archivos, 22 pruebas** (los 20 nuevos de dominio corrieron de verdad contra Supabase, no se saltaron: había `.env`) |
| `npm run build` | Exit 0 — mismas 16 páginas que en Fase 1 (el frontend público todavía no importa nada de `lib/domain`) |
| Verificación de limpieza post-test | 0 leads y 0 `ContentEntry` de prueba residuales en la base real |

**Riesgos que se mantienen (no resueltos en esta fase, no es su alcance):** el email-gate VIP público sigue sin validación server-side — ahora existe el servicio para corregirlo, pero el frontend no lo usa todavía. Las 3 vulnerabilidades de `npm audit` heredadas de `next@16.0.10` siguen sin resolver.

**Veredicto: APTO PARA AÑADIR AUTENTICACIÓN.** El modelo de datos y la capa de dominio están completos, probados contra una base de datos real (no simulada) y documentados. Condicionado a: decidir cuándo revisar la migración a Prisma 7, y a que la fase de autenticación conecte finalmente el `EmailGate` público al servicio `verifyVipAccessSession` ya existente en vez de dejarlo como mejora futura otra vez.

### Fase 3 — Autenticación, roles y botón discreto (2026-08-11)

**Decisiones:**
- Better Auth 1.6.26 en vez de Auth.js (sugerido en `project-reference/docs/03-arquitectura-crm-leads.md`): adaptador oficial de Prisma, rate limiting persistente incorporado y roles vía `additionalFields`, las tres piezas nativas sobre el esquema ya creado en la Fase 2. Detalle en `docs/autenticacion.md` §1.
- `role` se expone como `user.additionalFields` con `input: false`: ningún usuario puede fijar su propio rol por ningún endpoint de Better Auth; solo cambia vía la Server Action `updateUserRoleAction`, protegida con `requireRole(["ADMIN"])`.
- Primer ADMIN vía `scripts/admin-bootstrap.ts`, que reproduce con la API interna documentada de Better Auth (`auth.$context.internalAdapter`, `auth.$context.password`) los mismos pasos que usa internamente el endpoint de alta — no se rodea `disableSignUp` con nada inventado. Detalle en `docs/autenticacion.md` §4.
- Middleware: solo redirige según la presencia de la cookie de sesión (comprobación barata, sin BD); la autorización real vuelve a comprobarse siempre en el layout protegido y en cada Route Handler/Server Action, tal como pedía el enunciado.
- No se ha construido UI de administración para CRM/CMS en esta fase (fuera de alcance): la única pantalla real es `/admin/usuarios` (ADMIN), necesaria para poder demostrar 401/403 por rol con una funcionalidad genuina en vez de una ruta de prueba desechable.

**Cambios de código:**
- `prisma/schema.prisma`: nuevo modelo `RateLimit` (tabla `rateLimit`, migración `20260811120036_add_rate_limit_table`) para el rate limit persistente de Better Auth.
- `lib/auth.ts` (configuración de Better Auth: adaptador de Prisma, `emailAndPassword` con alta desactivada y contraseña mínima 12, `rateLimit` con almacenamiento en base de datos, `role` como `additionalFields` no editable por el usuario, plugin `nextCookies()`), `lib/auth-client.ts` (cliente React), `app/api/auth/[...all]/route.ts` (handler).
- `lib/auth/session.ts`: `getSessionUser`/`requireSession`/`requireRole`/`requirePermission`, con `UnauthenticatedError`/`ForbiddenError` tipados y un mapa fijo de permisos por rol.
- `middleware.ts`: redirección de `/admin`↔`/admin/login` según la cookie, más `Cache-Control: no-store` en toda respuesta de `/admin`.
- `app/admin/login/` (página pública + formulario con mensaje de error genérico), `app/admin/(protected)/layout.tsx` (guarda de sesión real + navegación por rol + botón de cierre de sesión), `app/admin/(protected)/page.tsx` (dashboard mínimo personalizado por rol), `app/admin/(protected)/usuarios/` (listado ADMIN-only + `updateUserRoleAction`), `app/api/admin/users/route.ts` (API ADMIN-only).
- `components/admin-access.tsx`: eliminado el diálogo ficticio y el estado de contraseña local; ahora navega a `/admin/login` o `/admin` según `authClient.useSession()`. Recortado `adminAccessContent` en `data/site-content.ts`/`.en.ts` a solo el tooltip (los campos del diálogo ya no se usan).
- `scripts/admin-bootstrap.ts` + script `admin:bootstrap`.
- `.env`/`.env.example`: añadidas `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_BOOTSTRAP_NAME`/`_EMAIL`/`_PASSWORD`.
- `docs/autenticacion.md` (nuevo).
- 5 archivos de test nuevos (23 pruebas): `lib/auth/session.test.ts`, `lib/auth/auth-flow.test.ts`, `app/api/admin/users/route.test.ts`, `app/admin/(protected)/usuarios/actions.test.ts`, `middleware.test.ts`. Helpers compartidos en `lib/auth/test-helpers.ts` (crea usuarios con cuenta "credential" real y firma sesiones a través del handler real de Better Auth, con una IP simulada distinta por sign-in para no chocar con el rate limit real entre tests).

**Verificación manual end-to-end (servidor de desarrollo real, puerto 3001, antes de escribir los tests):** login con el ADMIN creado por `admin:bootstrap` → cookie de sesión → `/admin` (200) → `/api/admin/users` (200, datos reales); `/api/admin/users` sin cookie (401) y con sesión `SALES` (403); `/admin/usuarios` con sesión `SALES` muestra "Acceso no autorizado" sin filtrar datos; alta pública rechazada (`EMAIL_PASSWORD_SIGN_UP_DISABLED`); contraseña incorrecta y email inexistente devuelven el mismo error; 4 intentos de login en <10s → los dos últimos `429` (tabla `rateLimit` con filas reales); `sign-out` sin `Origin` → `403` (protección de origen activa), con `Origin` correcto → `200` y la fila de `Session` desaparece de la base de datos. Detalle completo en `docs/autenticacion.md` §6. El usuario de prueba `SALES` creado solo para esta verificación manual se eliminó de la base de desarrollo al terminar.

**Validación real ejecutada:**

| Comando | Resultado |
|---|---|
| `npx prisma format` / `validate` | Exit 0 |
| `npx prisma migrate dev --name add_rate_limit_table` | Exit 0 — migración aplicada contra `porton-tfm-dev` |
| `npx prisma generate` | Exit 0 (tras detener el servidor de desarrollo, que bloqueaba el binario en Windows) |
| `npm run admin:bootstrap` (1ª vez) | Usuario ADMIN creado |
| `npm run admin:bootstrap` (2ª y 3ª vez) | "Ya existe... no se sobrescribe" — idempotencia confirmada |
| `npm run lint` | Exit 0 — 0 errores, 1 warning informativo preexistente (igual que Fases 1 y 2) |
| `npm run typecheck` | Exit 0 |
| `npm run test` | Exit 0 — **13 archivos, 45 pruebas** (22 de Fases 1–2 + 23 nuevas de autenticación, todas ejecutadas de verdad contra Better Auth y la base real) |
| `npm run build` | Exit 0 — nuevas rutas registradas: `/admin` (ƒ), `/admin/login` (ƒ), `/admin/usuarios` (ƒ), `/api/admin/users` (ƒ), `/api/auth/[...all]` (ƒ), Proxy/Middleware activo |

**Aviso no bloqueante detectado en el build:** Next 16 marca `middleware.ts` como convención obsoleta a favor de `proxy.ts`. Sigue siendo totalmente funcional (confirmado en build y pruebas); no se ha migrado por no tener confirmada la convención de exportación exacta de la nueva API sobre un componente de seguridad — ver §16.

**Riesgos que se mantienen (no resueltos en esta fase, no es su alcance):** el email-gate VIP público sigue sin validación server-side (§11). Las 3 vulnerabilidades de `npm audit` heredadas de `next@16.0.10` siguen sin resolver. La UI de administración de CRM/CMS sigue sin construir.

**Veredicto: APTO PARA CONSTRUIR EL CMS.** La autenticación es real (Better Auth, no un placeholder), verificada con peticiones HTTP reales y con tests automatizados: sesión exigida en servidor en cada capa (middleware, layout, Route Handler, Server Action), roles aplicados de forma consistente, alta pública rechazada, rate limit persistente activo, CSRF/origen intacto, logout revoca la sesión de verdad. Condicionado, igual que en fases anteriores, a que la fase del CMS conecte finalmente el frontend público a los servicios de dominio ya existentes en vez de acumular más funcionalidad en paralelo a `data/vip-stories.ts`.

### Fase 4 — CMS de Bodas Reales y Catering (2026-08-11)

**Alcance:** CMS privado sobre el modelo `ContentEntry` ya existente. Las rutas públicas no se han alterado (solo se adaptó `StoryDetail` para poder previsualizar borradores, ver más abajo).

**Fallo real encontrado por las propias pruebas.** El test de equivalencia con la fuente estática (obligatorio en esta fase antes de poder retirarla) destapó que la galería pública mostraba 9 imágenes donde la fuente tiene 6: el seed crea las imágenes de proveedor como filas de `ContentMedia` de la misma ficha y no existía forma de distinguir el papel de cada archivo. Se corrigió en el modelo, no en el test: nueva columna `ContentMedia.inGallery` (migración `20260811223102_content_media_in_gallery`, **con corrección de datos** para las 25 filas ya sembradas) y casilla *"En la galería"* en el editor. Verificado después en el servidor real: 7 archivos en galería (1 hero + 6) y 6 de proveedores excluidos, exactamente como la fuente estática.

**Decisiones:**
- **Colecciones reescritas, media no.** Minuta, cronología, momentos y proveedores se borran e insertan dentro de la transacción de guardado (son listas ordenadas que el editor envía completas y no tienen identidad que preservar). La media **no** se reescribe porque sus filas apuntan a objetos del bucket: del formulario solo se aplican orden, `alt`, `caption`, `inGallery` y la hero. Subir y borrar son operaciones inmediatas aparte.
- **Concurrencia por `updatedAt`** (la opción que permitía el enunciado): `UPDATE ... WHERE id = ? AND updatedAt = ?`; si no actualiza ninguna fila, `ConcurrentUpdateError`. Se prefirió a una columna `version` nueva por no añadir estado que Prisma ya mantiene.
- **Dimensiones de imagen leídas a mano** (PNG/JPEG/WebP) en vez de con `sharp`: `sharp` ya arrastra vulnerabilidades conocidas en este proyecto (§12) y leer una cabecera no requiere decodificar el bitmap.
- **`import "server-only"`** en el cliente de Storage, para que la clave privilegiada no pueda acabar en el bundle del navegador. Requiere el paquete `server-only` instalado (el bundler de Next lo resuelve por alias, pero Vitest y `tsx` necesitan el real) y un alias en `vitest.config.mts` a su módulo vacío, porque el paquete lanza a propósito fuera de la capa servidor de Next.
- **`StoryDetail` se hizo tolerante a fichas incompletas** (cada sección se oculta si está vacía). Era necesario para previsualizar borradores y `VipStory` sigue siendo asignable al tipo nuevo, así que las páginas públicas no cambian.
- **`storage:bootstrap` reconcilia límites** en vez de negarse a tocar un bucket existente: el bucket estaba creado a mano en el panel, sin límite de tamaño ni de MIME. Endurecerlos es siempre seguro y son la segunda barrera detrás de la validación de aplicación.

**Cambios de código (nuevo):** `app/admin/(protected)/contenidos/` (listado + filtros + acciones por fila, `/nuevo`, editor con panel de media, `/[id]/preview`, `actions.ts`); `lib/storage/` (`supabase.ts`, `bucket.ts`, `validate-image.ts`, `external-url.ts`, `object-name.ts`); `lib/domain/content-media.ts`; `lib/validation/content.ts`; `lib/content/to-story-detail.ts`; `lib/slug.ts`; `scripts/ensure-storage-bucket.ts` (+ script `storage:bootstrap`); `docs/cms.md`; 7 archivos de test.

**Cambios de código (modificado):** `prisma/schema.prisma` (campos `intro`/`seoTitle`/`seoDescription` localizados, `ctaLabel`/`ctaHref`/`seoNoindex`, metadatos reales de media, `thumbnailUrl`, `inGallery`, índice por `storagePath`) + 2 migraciones; `lib/domain/content.ts` (listado con filtros y paginación, `saveContentEntry` con concurrencia, duplicado, requisitos de publicación, auditoría en todas las operaciones); `lib/domain/errors.ts`; `components/vip/story-detail.tsx`; `prisma/seed.ts`; `app/admin/(protected)/layout.tsx`; `vitest.config.mts`; `package.json`.

**Verificación manual end-to-end (servidor real, puerto 3001):** `/admin/contenidos` anónimo → `307` a `/admin/login` con `Cache-Control: no-store`; con sesión ADMIN se listan las fichas reales; `<meta name="robots" content="noindex, nofollow, nocache">` presente; el editor renderiza todas las secciones (minuta, cronología, momentos, proveedores, presupuesto, publicación y SEO, "En la galería"); la preview muestra el diseño público con la etiqueta "Ejemplo ilustrativo"; la preview anónima redirige sin exponer contenido; búsqueda `?q=laura` devuelve la ficha y la pestaña *Archivados* devuelve el estado vacío; conteo de galería correcto (6, no 9).

**Validación real ejecutada:**

| Comando | Resultado |
|---|---|
| `npx prisma migrate dev` (×2) | Exit 0 — `cms_content_fields` y `content_media_in_gallery` aplicadas |
| `npx prisma migrate status` | *"Database schema is up to date!"* — 4 migraciones, sin drift |
| `npm run storage:bootstrap` (×3) | Reconcilia límites la 1ª vez; "no se modifica nada" después — idempotencia confirmada |
| `npm run db:seed` (×2, incluida una re-siembra tras borrar una ficha) | Idempotente; la ficha recreada vuelve a pasar el test de equivalencia |
| `npm run lint` | Exit 0 — 0 errores, 1 warning informativo preexistente |
| `npm run typecheck` | Exit 0 |
| `npm run test` | Exit 0 — **21 archivos, 208 pruebas** (163 nuevas de esta fase; las de Storage se ejecutaron de verdad contra el bucket real, verificado con `--reporter=verbose`) |
| `npm run build` | Exit 0 — 4 rutas nuevas registradas: `/admin/contenidos`, `/admin/contenidos/nuevo`, `/admin/contenidos/[id]`, `/admin/contenidos/[id]/preview` |

**Ajuste necesario en un test de la Fase 2:** `content.test.ts` publicaba una ficha sin hero, que ahora es un requisito. El test se corrigió añadiendo la hero (su intención —conservar `publishedAt` al republicar— sigue intacta). También se subió `testTimeout` de Vitest a 30 s: dos tests que encadenan varias operaciones superaban los 5 s por defecto solo por latencia del pooler de Supabase, sin nada mal.

**Riesgos que se mantienen:** el email-gate VIP público sigue sin validación server-side (§11). Las 3 vulnerabilidades de `npm audit` heredadas de `next@16.0.10` siguen sin resolver. `middleware.ts` sigue marcado como convención obsoleta por Next 16 (aviso, no error).

**Veredicto (Fase 4): APTO PARA CONECTAR LAS SECCIONES PÚBLICAS.** El CMS es funcional de extremo a extremo: se crea, edita, previsualiza, publica, despublica, archiva y duplica contenido real, con media en un bucket privado validada por sus bytes reales, permisos verificados en servidor en cada acción, auditoría completa sin datos sensibles y detección de sobrescrituras concurrentes. La equivalencia entre `data/vip-stories.ts` y `ContentEntry` está probada campo por campo, que era la condición para retirar la fuente estática. Condicionado a dos cosas al conectar las rutas públicas: (1) hacerlo reutilizando `lib/content/to-story-detail.ts` en vez de escribir un segundo mapeador, y (2) resolver en esa misma fase el riesgo crítico del `EmailGate`, porque servir el contenido desde base de datos sin arreglar el gate volvería a exponer fichas completas en el HTML. **Ambas condiciones se cumplieron en la Fase 5.**

### Fase 5 — Publicación dinámica y gate de correo real (2026-08-12)

**Cierra el riesgo crítico abierto desde la Fase 0.** El contenido VIP ya no se serializa en el HTML antes de validar el acceso.

**Retirado:** `lib/vip-access.ts` (autorización en `localStorage`), `components/vip/email-gate.tsx` (renderizaba el contenido desenfocado **detrás** del diálogo, así que ya estaba en el HTML), el botón "Saltar verificación", el envío del email del gate por Web3Forms, los textos `vipGateContent`/`vipGateContentEn` (mezclaban privacidad y marketing en una casilla) y `generateStaticParams` de las rutas `[slug]`. `data/vip-stories.ts` **se conserva** como fuente del seed de demostración, ya no como fuente de producción — retirarlo de las rutas es seguro porque su equivalencia con la base de datos está probada desde la Fase 4.

**Decisiones:**
- **El gate es la página, no un diálogo.** Por eso no se puede cerrar ni saltar, y por eso no hay contenido detrás: cuando el gate se renderiza, el servidor no ha consultado ninguna ficha.
- **El orden de las operaciones es la garantía**, no una comprobación añadida: `getVipLead()` → si no hay sesión, `return <VipGate/>` → solo entonces consultar y firmar URLs. Se comprueba con un test que espía `listPublishedContent`/`resolveMediaUrls` y verifica que **no se llaman** (`components/vip/access-boundary.test.tsx`), en vez de buscar cadenas en el HTML: un test sobre el HTML podría pasar por casualidad.
- **La metadata no consulta la base de datos.** Construir el `<title>` desde la ficha obligaría a leerla antes de validar el acceso. Se usa un título genérico de sección; el slug aparece solo en el canonical, y eso no revela nada porque es la URL que el visitante ha pedido.
- **Tabla de rate limit propia** (`RateLimitCounter`) en vez de la de Better Auth, para no depender de su lógica interna de purga ni de su formato de clave. Incremento atómico con `updateMany` condicionado a `count < max` y a la misma ventana, así que dos peticiones simultáneas no pueden pasar ambas.
- **Marketing solo se registra si se marca.** No se guarda un `granted=false` por una casilla que se dejó como estaba: eso es la ausencia de una decisión, no una decisión.
- **`upsert` explícito en `grantVipAccess`**: la rama de actualización solo escribe `lastSource` y `lastActivityAt`, sin mencionar `firstName`/`lastName`/`phone`. Así un Lead que ya venía del formulario de contacto no pierde sus datos, y no depende de la semántica de `undefined` de Prisma. Probado.
- **URLs firmadas de 1 hora en público** frente a 10 minutos en el panel: `next/image` cachea por URL completa, así que rotar la firma cada pocos minutos reoptimizaría la misma foto constantemente.
- **`next/image` autoriza solo `/storage/v1/object/sign/**`** del host derivado de `SUPABASE_URL`, no `/**`: eso permitiría proxyar cualquier archivo del proyecto a través del optimizador.
- **El registro de vistas se dispara desde el cliente al montar**, no en el render de servidor (un render puede repetirse, y un prefetch no es una visita), con deduplicación de 30 minutos en servidor como garantía real.
- **Un solo par de componentes para ambas secciones** (`VipLibrary`, `VipStory`): las cuatro rutas son envoltorios de cuatro líneas.

**Cambios de código (nuevo):** `lib/vip/` (`session.ts`, `gate-action.ts`, `track-action.ts`, `metadata.ts`); `lib/domain/vip-access.ts`; `lib/security/rate-limit.ts`; `lib/validation/vip-gate.ts`; `lib/content/to-story-card.ts`; `lib/legal.ts`; `components/vip/` (`vip-gate.tsx`, `vip-library.tsx`, `vip-story.tsx`, `track-vip-view.tsx`, `vip-empty-library.tsx`); `docs/gate-vip.md`; 9 archivos de test.

**Cambios de código (modificado):** `prisma/schema.prisma` (+ migración `app_rate_limit_counter`); las 4 rutas públicas (ahora `force-dynamic`, sin datos estáticos); `components/vip/story-card.tsx` (desacoplado de Prisma, badge bilingüe); `lib/domain/content.ts` (orden por destacado, solo la hero en el listado); `lib/domain/content-media.ts` (TTL configurable); `lib/domain/interactions.ts` (`recordContentViewOnce`); `next.config.mjs`; `app/sitemap.ts`; `data/vip-stories.ts`.

**Verificación manual end-to-end (servidor real):**

| Comprobación | Resultado |
|---|---|
| `/bodas-reales` sin cookie | Gate visible; **0 apariciones** de "Laura", "Marcos", "Elena", "Judith", "carrillera", "Floristería", "8500" y "laura-y-marcos" en el HTML |
| `/bodas-reales/laura-y-marcos` sin cookie | Gate; el título real "Laura & Marcos" aparece **0 veces** (las 9 coincidencias de "laura" son el slug de la URL: router state, canonical y `returnPath`) |
| Con sesión válida | Las 3 fichas de bodas y las 3 de catering, con la etiqueta "Ejemplo ilustrativo"; galería con 12 miniaturas, igual que la fuente estática |
| Una sesión desbloquea ambas bibliotecas | Confirmado (`/catering` renderiza sus 3 tarjetas con la misma cookie) |
| Cookie inventada | Gate |
| Cookie con el `tokenHash` de la base de datos | Gate (el hash no sirve como token) |
| Sesión revocada en base de datos | Gate |
| `robots` en biblioteca y ficha | `noindex, follow` |

**Validación real ejecutada:**

| Comando | Resultado |
|---|---|
| `npx prisma migrate dev --name app_rate_limit_counter` | Exit 0 — aplicada contra `porton-tfm-dev` |
| `npm run lint` | Exit 0 — **0 errores y 0 warnings** (el único warning que quedaba estaba en el `email-gate.tsx` retirado) |
| `npm run typecheck` | Exit 0 |
| `npm run test` | Exit 0 — **30 archivos, 311 pruebas** (103 nuevas de esta fase) |
| `npm run build` | Exit 0 — las 4 rutas VIP pasan a dinámicas (ƒ) y desaparecen los 6 slugs pregenerados |

**Incidencia de entorno (no del código):** el servidor de desarrollo dio un `500` con un panic de Turbopack (`Failed to write app endpoint /bodas-reales/page`) por una caché `.next` corrupta, tras haber matado el proceso y ejecutado un build encima. Se resolvió borrando `.next`. El build de producción nunca falló.

**Riesgos que se mantienen:** el formulario de contacto de la home sigue en Web3Forms (alcance de la fase siguiente). Las 3 vulnerabilidades de `npm audit` heredadas de `next@16.0.10` siguen sin resolver. `middleware.ts` sigue marcado como convención obsoleta por Next 16 (aviso, no error). Sin pruebas E2E en navegador.

### Fase 5.1 — Cuenta de administración real y orígenes de confianza en desarrollo (2026-08-12)

Ajuste operativo posterior al cierre de la Fase 5, sin cambios de alcance funcional.

**Fallo real encontrado al usar el panel:** el login devolvía "Email o contraseña incorrectos" en el navegador. La causa no era la contraseña: Better Auth respondía `403 INVALID_ORIGIN` porque `BETTER_AUTH_URL` apuntaba a `localhost:3001` y Next había arrancado en el `3000` (el proyecto que ocupaba ese puerto ya no estaba en marcha). El mensaje genérico del formulario —correcto por diseño, para no enumerar usuarios— ocultaba que el problema era de configuración.

- **Corregido en `lib/auth.ts`** con `trustedOrigins`: en desarrollo se aceptan `localhost` y `127.0.0.1` en los puertos 3000 y 3001, así que el login deja de depender de en qué puerto arranque Next. **En producción la lista queda vacía** y el único origen válido sigue siendo el dominio de `BETTER_AUTH_URL`; no se ha relajado nada del comportamiento de producción.
- **Cuenta de administración real** creada con `npm run admin:bootstrap` para la dirección personal del responsable del proyecto, con rol `ADMIN`. Ni la dirección ni la contraseña se anotan aquí: son datos personales y credenciales, y este archivo está versionado. Las variables `ADMIN_BOOTSTRAP_*` se retiraron de `.env` inmediatamente después, como indica el propio script.
- **Se retiraron las credenciales de la cuenta de pruebas** `admin.bootstrap@portondelacondesa.dev` (se borró su `Account` del proveedor `credential` y sus 2 sesiones abiertas). Comprobado: de los 5 usuarios de la base, **solo uno puede iniciar sesión**; los 3 del seed nunca tuvieron credenciales (son datos de demostración del CRM, no cuentas de acceso).
- **Nota sobre la contraseña:** la propuesta inicial tenía 8 caracteres, por debajo del mínimo de 12 que fija el propio Prompt 3. Se acordó alargarla en vez de rebajar el mínimo, así que `minPasswordLength: 12` **sigue intacto**.

**Validación:** `npm run lint` (0 errores, 0 warnings), `npm run typecheck` (exit 0), `npm run test` (30 archivos, 311 pruebas), y verificación real contra el servidor: login `200` con cookie de sesión, `/admin`, `/admin/contenidos` y `/admin/usuarios` en `200` con el nombre y el rol correctos, y la cuenta antigua rechazada con `INVALID_EMAIL_OR_PASSWORD`.

**Veredicto: APTO PARA CONECTAR LA CAPTACIÓN GENERAL.** El contenido público se sirve desde el CMS con publicación inmediata, y el acceso está protegido de verdad en servidor: sin sesión no se consulta ni se serializa ninguna ficha (comprobado espiando la capa de datos, no leyendo el HTML), la autorización no depende del navegador, la cookie no contiene datos personales, el token solo existe hasheado, y un fallo de persistencia no concede acceso. La captación del gate ya alimenta el CRM con Lead, consentimientos separados, actividad e interacción. Condicionado a que la fase de captación general reutilice las piezas ya construidas —`consumeRateLimit` para el rate limit y el patrón de honeypot y consentimientos separados del gate— en vez de crear un segundo mecanismo en paralelo.

### Fase 5.2 — Acceso al panel en la cabecera (2026-08-12)

Ajuste de interfaz a petición del cliente, sin cambios funcionales ni de seguridad.

- El acceso a `/admin/login` pasó de botón flotante en `app/layout.tsx` a un engranaje en la parte superior derecha del menú (`components/header.tsx`). **Se movió, no se duplicó**: sigue habiendo un único punto de entrada, como fijaba el Prompt 3. En móvil aparece dentro del menú desplegable para que no quede fuera de alcance.
- Se retiró el CTA "Solicita información" de la barra superior de escritorio. Sigue disponible en el menú móvil y en la home.
- Acabado discreto: en reposo, icono en el gris del menú sobre un lavado verde muy tenue; al pasar por encima, verde de marca, sombra suave y giro de 90°. Mantiene tooltip bilingüe, `aria-label` y anillo de foco.

**Validación:** `npm run lint` (0 errores, 0 warnings), `npm run typecheck` (exit 0) y comprobación de las clases renderizadas en el servidor de desarrollo.

### Fase 6 — Formularios públicos y solicitudes comerciales (2026-08-12)

Sustitución de Web3Forms por API propia y conexión de todos los formularios y CTA públicos al dominio `Lead`/`LeadRequest`.

**Endpoint.** `POST /api/leads/requests` (`app/api/leads/requests/route.ts`) es el único camino de alta. La interfaz nunca habla con Prisma. Las comprobaciones van de lo barato a lo caro para que un bot no consuma consultas: mismo origen → content-type → tamaño de cuerpo (32 KiB) → esquema → versión de política → honeypot → tiempo mínimo → rate limit → verificación de la ficha de origen → transacción.

**Esquemas compartidos de verdad.** `lib/validation/lead-request.ts` define las reglas una sola vez: `leadRequestFormSchema` es lo que valida el formulario y `leadRequestSchema` lo mismo más los campos de transporte. Para que un único esquema sirva a los dos lados, **solo valida, no transforma** (más allá de recortar espacios), y la conversión a los tipos del dominio es un paso explícito y posterior, `normalizeLeadRequest`. El formulario reutiliza ese esquema y solo sustituye los mensajes por su traducción según el nombre del campo, así no hay dos juegos de reglas que puedan desalinearse.

**Transacción única** en `createLeadRequest`: Lead (upsert por email normalizado) + `LeadRequest` **siempre nueva** + `ConsentEvent` PRIVACY (+ MARKETING solo si se concede) + `LeadActivity` `FORM_SUBMITTED`. `recordConsent` acepta ahora un cliente de transacción para poder anotarse en el mismo commit. El score y el aviso por email quedan fuera, después del commit, porque son derivados.

**Idempotencia real.** Nueva columna `LeadRequest.submissionId` con índice único (migración `20260812120000_lead_request_submission_id`). El formulario genera una clave por intento: la renueva tras un envío correcto y la conserva tras un error, de modo que un reintento sobre una petición que sí se guardó devuelve 200 `duplicate: true` en vez de crear una solicitud repetida. Si dos peticiones simultáneas esquivan la comprobación previa, una gana el insert y la otra resuelve el `P2002` devolviendo la fila existente. Probado con dos envíos concurrentes reales.

**Vocabulario estable.** El tipo de evento se guarda como código (`WEDDING`, `CORPORATE_EVENT`, …) y no como etiqueta traducida: `data/site-content.ts` pasó de `eventTypes` (array de textos) a `eventTypeLabels` (mapa por código), con espejo en inglés. Los espacios usan el mismo slug que publica la web y un test comprueba que las dos listas no se desvíen.

**Campos nuevos en el formulario,** con el diseño intacto (mismos campos subrayados, misma retícula): espacio de interés, presupuesto orientativo, asunto y, solo en eventos corporativos, empresa —obligatoria—, cargo y necesidades audiovisuales. Fecha y número de invitados pasaron a opcionales, como pedía el enunciado. Los tres campos corporativos se descartan en servidor si el evento no lo es.

**Atribución.** `lib/attribution.ts` añade `utmTerm` y devuelve la ruta interna en lugar de la URL completa. `Lead.firstSource` solo se escribe al crear el Lead (first touch) y `lastSource` en cada solicitud (last touch); cada `LeadRequest` guarda su propia atribución completa. El CTA de una ficha enlaza a `/?tipo=<CÓDIGO>&ficha=<id>#contacto`, y el servidor verifica que el id corresponde a una `ContentEntry` publicada: si no, descarta el origen pero **guarda la solicitud igual**.

**Decisión de consentimiento que conviene destacar:** una casilla de marketing sin marcar **no** registra un `granted=false`. Si lo hiciera, alguien que concedió marketing en el gate VIP y luego rellena el formulario sin marcarla vería revocado su consentimiento, y dejar una casilla vacía no es una petición de baja. Hay un test específico para esto.

**Texto libre.** No se transforma al guardarlo (`lib/security/text.ts`): la defensa es de salida —JSX escapa en la interfaz, `escapeHtml` en el correo— y lo único que se elimina antes de persistir son caracteres de control, porque PostgreSQL rechaza el byte NUL.

**Aviso interno.** `lib/notifications/lead-request-notification.ts` se invoca tras el commit y sin `await`, y no puede hacer fallar un envío: sin proveedor configurado queda `PENDING` en `NotificationLog`; con las variables puestas pero sin transporte, `FAILED`. En ninguno de los dos casos toca lo guardado.

**Retirada de Web3Forms.** Eliminada la llamada del navegador a `api.web3forms.com`, el estado `not-configured` del formulario y la variable `NEXT_PUBLIC_WEB3FORMS_KEY` de `.env.example` y también del `.env` local, para no dejar una credencial de terceros sin uso (era la única variable `NEXT_PUBLIC_` del proyecto; si volviera a hacer falta, se recupera desde la cuenta de web3forms.com). El apartado 5 de la política de privacidad ya no afirma que Web3Forms procese los datos; describe el tratamiento técnico real y queda marcado como **pendiente de revisión jurídica** — no se ha redactado texto legal definitivo.

**Contratos y documentación.** Nuevos `docs/openapi.yaml` (contrato completo con payloads, respuestas y errores, sin PII en ningún ejemplo) y `docs/flujo-captacion.md`. README actualizado en estado, estructura, variables, captación, seguridad, pruebas, limitaciones y roadmap. Se corrigieron además dos afirmaciones del README que ya eran falsas (rate limiting "sin conectar" y Storage "sin usar").

**Archivos modificados o creados:** `prisma/schema.prisma`, `prisma/migrations/20260812120000_lead_request_submission_id/`, `lib/validation/lead-request.ts` (nuevo), `lib/security/text.ts` (nuevo), `lib/notifications/lead-request-notification.ts` (nuevo), `app/api/leads/requests/route.ts` (nuevo), `lib/domain/lead-requests.ts`, `lib/domain/consents.ts`, `lib/leads.ts`, `lib/attribution.ts`, `components/sections/contact.tsx`, `components/vip/story-detail.tsx`, `lib/content/to-story-detail.ts`, `data/site-content.ts`, `data/site-content.en.ts`, `app/politica-privacidad/page.tsx`, `.env.example`, `package.json` (`@testing-library/user-event` como dependencia de desarrollo, necesaria para poder abrir los desplegables de Radix en los tests del formulario), `docs/openapi.yaml` (nuevo), `docs/flujo-captacion.md` (nuevo), `README.md`, y 7 archivos de pruebas nuevos.

**Validación (comandos y resultados reales):**

| Comando | Resultado |
|---|---|
| `npx prisma migrate deploy` | 6 migraciones, `20260812120000_lead_request_submission_id` aplicada |
| `npm run lint` | exit 0 — 0 errores, 0 warnings |
| `npm run typecheck` | exit 0 |
| `npm test` | 37 archivos, **402 pruebas**, todas verdes (91 nuevas en esta fase) |
| `npm run build` | correcto, 8 páginas estáticas; `/api/leads/requests` como ruta dinámica y la home **sigue siendo estática** |
| Verificación E2E por HTTP contra `npm run dev` | **23/23 comprobaciones** |

La verificación end-to-end se hizo con peticiones HTTP reales contra el servidor de desarrollo y comprobando después el estado en base de datos: la home responde 200 con los campos nuevos y sin ninguna mención a Web3Forms; envío válido 201; reenvío con la misma clave 200 y `duplicate: true`; honeypot 202 sin crear Lead; sin privacidad 400 señalando `privacyConsent`; origen ajeno 403; política caducada 409; y en base de datos un único Lead con una única LeadRequest, `firstSource` conservado, los dos consentimientos por separado, la actividad `FORM_SUBMITTED`, el aviso en `NotificationLog`, el mensaje guardado sin transformar, las UTMs, y fecha e invitados con los tipos correctos.

**Pendiente / no incluido:** pruebas end-to-end en un navegador real (Playwright sigue sin incorporarse; no hay automatización de navegador en este entorno). El movimiento de foco y los atributos de la región `aria-live` sí se prueban en jsdom, pero no se han escuchado con un lector de pantalla real. Quedan también el transporte real del aviso por email, la confirmación de negocio de los tramos de presupuesto y la redacción jurídica definitiva del apartado 5 de la política de privacidad.

**Veredicto: APTO PARA CONSTRUIR EL CRM.** La captación general ya alimenta el modelo con datos reales y trazables: cada envío deja una `LeadRequest` propia sin sobrescribir el historial, con su base legal registrada y su atribución completa —incluida la ficha de origen cuando viene de un CTA—, y la persona no se duplica. La validación es de servidor con vocabulario cerrado, los errores no filtran los valores enviados ni el detalle interno de un fallo, el antispam reutiliza el rate limit persistente y el patrón de honeypot ya construidos para el gate en vez de crear un mecanismo paralelo, y el doble envío está resuelto en la base de datos y no solo en el botón. El CRM puede construirse encima sin tener que rehacer el alta.
