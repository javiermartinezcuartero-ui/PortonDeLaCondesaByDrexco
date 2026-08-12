# Auditoría v2 — Contrato técnico previo al backend

Fecha: 2026-08-11
Alcance: auditoría no destructiva del repositorio real. No se ha creado base de datos, autenticación, CMS ni CRM en esta fase. No se ha instalado ninguna dependencia nueva. No se ha hecho commit, push, cambio de visibilidad ni deploy.

## 1. Hechos verificados

Todos los hechos siguientes se han comprobado leyendo el código real del repositorio (no se asume nada del enunciado sin confirmarlo).

| # | Hecho | Estado verificado | Evidencia |
|---|---|---|---|
| 1 | Next.js 16 con App Router, React 19, TypeScript, Tailwind 4 | **Confirmado** | `package.json`: `next@16.0.10`, `react@19.2.0`; `tsconfig.json` con `strict: true`; `tailwindcss@^4.1.9` + `@tailwindcss/postcss` |
| 2 | Rutas de Bodas Reales y Catering, incluidas `[slug]` | **Confirmado** | `app/bodas-reales/page.tsx`, `app/bodas-reales/[slug]/page.tsx`, `app/catering/page.tsx`, `app/catering/[slug]/page.tsx`, con `generateStaticParams` y `generateMetadata` |
| 3 | `data/vip-stories.ts` como fuente estática provisional | **Confirmado** | 3 `weddingStories` + 3 `cateringStories`, cada una con `isExample: true`; cabecera del archivo declara explícitamente que es contenido ilustrativo |
| 4 | `EmailGate` basado en `localStorage`/Web3Forms con salto de desarrollo | **Confirmado** | `lib/vip-access.ts` usa `window.localStorage`; `components/vip/email-gate.tsx` tiene botón "saltar" (`skipped`) marcado `TODO(pre-producción)` |
| 5 | Formulario general basado en Web3Forms | **Confirmado** | `lib/leads.ts` hace `fetch("https://api.web3forms.com/submit")`; sin `NEXT_PUBLIC_WEB3FORMS_KEY` devuelve `{ ok: false, reason: "not-configured" }` en vez de simular éxito |
| 6 | Botón discreto de administración `components/admin-access.tsx` | **Confirmado** | Botón flotante con `Settings` + tooltip "Zona Admin"; el submit solo marca `showMessage = true` (comentario `TODO(admin-backend)`); no valida contraseña real |
| 7 | `package-lock.json` y `pnpm-lock.yaml` coexisten | **Confirmado** | Ambos ficheros presentes en la raíz |
| 8 | Script de lint sin ESLint instalado | **Confirmado** | `npm run lint` → `"eslint" no se reconoce como un comando interno o externo...` (exit code 1). No existe `eslint.config.*` ni `.eslintrc*` en la raíz |
| 9 | `ignoreBuildErrors` e imágenes sin optimización en `next.config.mjs` | **Confirmado** | `typescript.ignoreBuildErrors: true`, `images.unoptimized: true` |
| 10 | README todavía de baseline | **Parcialmente superado** | El README actual ya no es el de la plantilla demo, pero seguía describiendo un estado "Baseline preparado" sin reflejar el frontend real ya construido. Se ha actualizado en esta fase (ver §6) |

### Hechos adicionales detectados durante la auditoría (no listados en el enunciado, relevantes para decidir el backend)

- **El `EmailGate` no protege nada en el servidor.** Es un componente `"use client"` que renderiza siempre `children` (la ficha VIP completa) y solo aplica un `blur-sm` + `pointer-events-none` en el navegador cuando no hay acceso. Se ha verificado con `next build`: las páginas `/bodas-reales/[slug]` y `/catering/[slug]` se generan como **SSG estático** y el HTML resultante contiene el objeto `VipStory` completo (proveedores, menú, presupuesto, testimonio) serializado en texto plano dentro del payload RSC (`self.__next_f.push(...)`), antes de cualquier validación de email. Cualquier visitante puede leer el contenido "protegido" con "ver código fuente" o `curl`, sin enviar nunca un email. Esto contradice directamente la arquitectura objetivo aprobada ("el contenido VIP no se consulta, renderiza ni serializa antes de validar una sesión de acceso en servidor") y es la brecha de seguridad más relevante detectada.
- El acceso VIP se concede y se comprueba únicamente vía `localStorage` (`porton-vip-access-bodas-reales` / `-catering`), manipulable libremente desde las DevTools del navegador.
- Las páginas VIP están en `robots: { index: false, follow: true }` (no indexables), pero siguen siendo públicamente accesibles y crawleables por cualquier bot que siga el enlace.
- No existe ningún backend, base de datos, autenticación ni API todavía. Todo el "envío" de formularios (contacto y captura VIP) va directo al navegador → Web3Forms, sin paso por servidor propio.
- El registro público de usuarios no existe (no hay sistema de autenticación en absoluto), por lo que el requisito "el registro administrativo público permanece desactivado" se cumple trivialmente por ausencia, no por diseño explícito.
- `CLAUDE.md` ya existía en la raíz (creado en la fase anterior) con exactamente las reglas de trabajo del contrato de esta fase; no ha sido necesario modificarlo.
- No existe `AGENTS.md`.
- `.env` existe (con `NEXT_PUBLIC_WEB3FORMS_KEY` real) y está correctamente excluido por `.gitignore` (`.env*` con excepción de `!.env.example`). No se ha detectado ningún secreto en archivos versionables.
- `node_modules` ya existía (no ha sido necesario reinstalar). `npm` es el gestor efectivamente usado (`node_modules/.bin` generado por npm); `pnpm-lock.yaml` está desactualizado respecto a los últimos cambios de `package-lock.json` (mismo tamaño de fichero, distinta fecha) y debe tratarse como residual.
- `data/site-content.en.ts` traduce navegación, secciones de home, contacto y legal-links, pero **no** traduce las fichas VIP (`data/vip-stories.ts`) ni el contenido de las páginas legales — límite de alcance ya documentado en el propio código.

## 2. Comprobaciones ejecutadas (no destructivas)

| Comprobación | Comando | Resultado real |
|---|---|---|
| Versión de Node | `node --version` | `v24.14.0` |
| Versión de npm | `npm --version` | `11.14.1` |
| Instalación reproducible | *(omitida)* | `node_modules` ya existía; no era necesario reinstalar y no se ha forzado para no alterar el entorno de trabajo activo |
| Typecheck | `npx tsc --noEmit` | **Exit 0**, sin errores |
| Lint | `npm run lint` (`eslint .`) | **Exit 1** — `eslint` no está instalado (no hay binario en `node_modules/.bin`, ni config en la raíz). Fallo de configuración/dependencia ausente, no del código |
| Build de producción | `npm run build` | **Exit 0.** Turbopack compila en 3.7 s; genera 16 páginas (home, legal ×3, `/bodas-reales` + 3 `[slug]` SSG, `/catering` + 3 `[slug]` SSG, `robots.txt`, `sitemap.xml`). El propio log de Next confirma `Skipping validation of types` durante el build, es decir: el build **no** valida TypeScript (por `ignoreBuildErrors: true`); la garantía de tipos depende exclusivamente del `tsc --noEmit` manual |
| Servidor dev tras el build | `curl http://localhost:3001/` | `HTTP 200` — el servidor de desarrollo activo no se vio afectado por ejecutar `next build` en paralelo |

No se ha ejecutado ninguna prueba automatizada (`test`/`vitest`/`playwright`) porque **no existe ningún script ni configuración de tests en el proyecto** — ausencia de herramienta, no fallo del código.

## 3. Árbol funcional del proyecto

```
app/
  layout.tsx                 → metadata global, JSON-LD LocalBusiness, LocaleProvider, Header/Footer/WhatsApp/Admin/Cookies
  page.tsx                   → Home: Hero → Vision → Philosophy → Experience → Spaces → Dishes → Contact
  robots.ts / sitemap.ts     → metadata routes (App Router)
  aviso-legal/page.tsx
  politica-privacidad/page.tsx
  politica-cookies/page.tsx
  bodas-reales/page.tsx            → listado (teaser, sin gate)
  bodas-reales/[slug]/page.tsx     → ficha completa (EmailGate client-side)
  catering/page.tsx                → listado (teaser, sin gate)
  catering/[slug]/page.tsx         → ficha completa (EmailGate client-side)

components/
  header.tsx, footer.tsx           → navegación + i18n ES/EN
  whatsapp-button.tsx, admin-access.tsx, cookie-consent.tsx
  sections/{hero,vision,philosophy,experience,spaces,dishes,contact}.tsx
  vip/{email-gate,story-card,story-detail,list-header}.tsx
  icons/{instagram,facebook,bodas-net}-icon.tsx
  structured-data.tsx              → JSON-LD LocalBusiness/EventVenue
  ui/*                             → shadcn/Radix (sin cambios funcionales)

data/
  site-content.ts / site-content.en.ts   → capa de contenido central (marca, nav, secciones home, contacto, legal)
  vip-stories.ts                          → 6 fichas VIP de ejemplo (weddingStories + cateringStories)

lib/
  leads.ts        → submitLead() → Web3Forms
  vip-access.ts   → hasVipAccess/grantVipAccess (localStorage) + submitVipEmail() → Web3Forms
  attribution.ts  → getAttribution() (UTMs + referrer, solo cliente)
  i18n.tsx        → LocaleProvider/useLocale (localStorage)

project-reference/   → fuente de verdad de negocio (no tocar): extracción web, investigación Instagram,
                        arquitectura CRM objetivo, assets de marca, imágenes originales
```

### Rutas reales

| Ruta | Tipo | Gate/Protección |
|---|---|---|
| `/` | Estática | Ninguna (pública) |
| `/bodas-reales` | Estática | Ninguna (teaser público) |
| `/bodas-reales/[slug]` | SSG (3 slugs) | **Solo visual**, client-side, sin efecto real (ver §1) |
| `/catering` | Estática | Ninguna (teaser público) |
| `/catering/[slug]` | SSG (3 slugs) | **Solo visual**, client-side, sin efecto real (ver §1) |
| `/aviso-legal`, `/politica-privacidad`, `/politica-cookies` | Estática | Ninguna, `noindex` |
| `/robots.txt`, `/sitemap.xml` | Metadata route | — |

No existe `/admin` como ruta real; solo un botón flotante (`AdminAccess`) con un modal placeholder sin backend.

## 4. Mapa de componentes a conservar

Todos los componentes de `components/` están en uso o son parte del sistema UI genérico (shadcn) reutilizable; no se ha detectado ningún componente residual de la plantilla demo original. `components/sections/spaces.tsx` es el antiguo `ProjectsSection` de la plantilla, ya reconvertido y montado en `app/page.tsx`.

## 5. Formularios y CTAs (para atribución futura de leads)

| Origen | Componente | Campos | `sourcePage`/`sourceForm` propuesto |
|---|---|---|---|
| Formulario general | `components/sections/contact.tsx` | nombre, apellidos, email, teléfono, tipo de evento, fecha, invitados, mensaje, `privacyConsent`, `marketingConsent` opcional + `attribution` (UTMs, `landingUrl`, `referrer`) | `sourcePage: "home"`, `sourceForm: "contact"` |
| Captura de email VIP — Bodas reales | `components/vip/email-gate.tsx` (`gateKey="bodas-reales"`) | email, consentimiento | `sourcePage: "bodas-reales/[slug]"`, `sourceForm: "vip-gate"`, `sourceContentId: story.slug`, `sourceContentType: "REAL_WEDDING"` |
| Captura de email VIP — Catering | idem (`gateKey="catering"`) | email, consentimiento | `sourceContentType: "CATERING_EVENT"` |
| WhatsApp flotante | `components/whatsapp-button.tsx` | — (enlace directo, no genera lead en frontend) | sin registro de origen todavía |

`lib/attribution.ts` ya captura `utmSource/Medium/Campaign/Content`, `landingUrl` y `referrer` en cliente; falta el `sourceContentId`/`sourceContentType` explícito para las fichas VIP y el registro server-side de cualquiera de estos eventos.

## 6. Documentación actualizada

- `README.md`: reescrito para reflejar el estado real del frontend, funcionalidades presentes, piezas provisionales, arquitectura objetivo aprobada, variables de entorno, comandos, y una entrada de historial para esta Fase 0.
- `CLAUDE.md`: ya contenía las reglas de esta fase (creado previamente); no requería cambios.
- Este documento (`docs/auditoria-v2.md`) es nuevo.

## 7. Riesgos

### Riesgo crítico
- **Exposición completa del contenido VIP sin gate server-side** (ver §1). Cualquier implementación de backend que se apoye en el `EmailGate` actual sin sustituirlo no cumple la arquitectura aprobada. Debe ser la primera pieza que se corrija al construir el backend: servir el contenido VIP desde una ruta server-side (Route Handler / Server Action) que solo devuelva los datos tras validar una cookie de sesión `HttpOnly`, y dejar de pasar el `VipStory` completo como prop a un componente cliente sin más control.

### Riesgos altos
- `ignoreBuildErrors: true` permite que el build de producción tenga éxito aunque existan errores de tipos reales; hoy `tsc --noEmit` está limpio, pero cualquier regresión de tipos pasará desapercibida en CI/build hasta que se desactive esta bandera.
- `images.unoptimized: true` desactiva la optimización de `next/image`; aceptable para el frontend estático actual, pero debe revisarse antes de producción por peso de página y Core Web Vitals.
- Dos lockfiles (`package-lock.json` + `pnpm-lock.yaml`) conviven; riesgo de que un desarrollador use `pnpm install` y genere un árbol de dependencias distinto al validado. Debe fijarse un único gestor antes de tocar backend (ver §9, npm).
- Ausencia total de ESLint instalado pese a existir el script `lint`; no hay red de seguridad de calidad de código más allá de TypeScript.
- Datos personales reales del propietario (email, teléfono, WhatsApp) están hardcodeados en `data/site-content.ts`; correcto como dato de negocio público (ya se muestran en la web), pero deben tratarse con cuidado si en el futuro se generalizan patrones de "no incluir datos personales en archivos versionables" a nuevas features.

### Riesgos medios / deuda ya señalada en el propio código
- `public/images/porton/02-salon-celebraciones.jpg` lleva marca de agua de fotógrafo externo sin derechos confirmados (`TODO(derechos-imagen)` en `data/site-content.ts`).
- Teléfono/código postal del aviso legal original inconsistentes con el resto de la web (`TODO` en `data/site-content.ts`).
- Ficha de Bodas.net pendiente de confirmación por el cliente (`TODO` en `data/site-content.ts`).
- CIF/NIF y datos registrales en `app/aviso-legal/page.tsx` son placeholder explícito (`[PENDIENTE: ...]`).
- Botón "saltar verificación" del `EmailGate` es una facilidad de desarrollo que debe eliminarse antes de producción (`TODO(pre-producción)`).
- Fichas VIP y páginas legales no traducidas al inglés (alcance ya documentado, no bloqueante).

## 8. Deuda técnica

1. Migrar `Bodas`, `Gastronomía` y `Celebraciones` de anclas (`/#...`) a rutas propias cuando exista contenido para ello (`TODO` ya en `data/site-content.ts`).
2. Sustituir el envío de leads/VIP "directo a Web3Forms desde el cliente" por un endpoint propio (`TODO(leads-api)` ya en `lib/leads.ts`), necesario en cuanto exista backend, para poder aplicar rate limit, honeypot, deduplicación y persistencia real.
3. Sustituir `components/admin-access.tsx` (placeholder) por autenticación real con Better Auth.
4. Sustituir `lib/vip-access.ts` (localStorage) por sesión server-side con cookie `HttpOnly`.
5. Unificar gestor de paquetes (eliminar `pnpm-lock.yaml` o `package-lock.json`, no ambos).
6. Instalar y configurar ESLint (flat config, compatible con Next 16 + React 19) para que el script `lint` sea funcional.

## 9. Gestor de paquetes

**Decisión: `npm` + `package-lock.json`.** No hay evidencia de que el proyecto se gestione con pnpm en el flujo real: todos los servidores de desarrollo y builds ejecutados en las fases anteriores (incluidos los de esta auditoría) se han lanzado con `npm run dev` / `npm run build`, y `node_modules/.bin` está poblado por npm. `pnpm-lock.yaml` es un residuo que debería eliminarse en una fase de limpieza explícita (no se ha tocado en esta auditoría por regla de "no borrar archivos existentes" sin petición).

## 10. Archivos previstos para la implementación del backend (no creados en esta fase)

Basado en las decisiones de arquitectura ya aprobadas (PostgreSQL + Prisma, Supabase, Better Auth, CMS de `ContentEntry`, CRM con `Lead`/`LeadRequest`):

- `prisma/schema.prisma` — modelos `User`, `Lead`, `LeadRequest`, `Consent`, `Activity`, `VipAccessToken`, `Tag`, `LeadTag`, `ContentEntry`.
- `lib/db.ts` — cliente Prisma singleton.
- `lib/auth.ts` + `app/api/auth/[...all]/route.ts` — configuración y handler de Better Auth (email/contraseña, registro público desactivado).
- `middleware.ts` — protección de `/admin/*` y validación de sesión VIP.
- `app/api/leads/route.ts` — endpoint server-side para el formulario general (sustituye la llamada directa a Web3Forms desde el cliente).
- `app/api/vip-access/route.ts` (o Server Action equivalente) — emisión de cookie de sesión VIP tras validar email, y endpoint que sirve el `ContentEntry` completo solo con sesión válida.
- `app/admin/**` — dashboard, autenticación, gestión de `ContentEntry` y CRM.
- `data/vip-stories.ts` → migración progresiva a `ContentEntry` en base de datos (mantener como fallback/seed).
- `.env` — nuevas variables: `DATABASE_URL`, `DIRECT_URL` (Supabase), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, credenciales de Supabase Storage.
- `README.md` — sección de arquitectura/variables de entorno ampliada en cada fase siguiente.

## 11. Criterios de aceptación para iniciar la implementación

1. El repositorio compila (`npm run build`) y pasa `tsc --noEmit` antes de cada fase — **cumplido hoy**.
2. Ningún secreto real en archivos versionables — **cumplido hoy** (verificado en fase anterior y re-confirmado).
3. El gestor de paquetes queda fijado a npm antes de instalar Prisma/Better Auth — **pendiente de decisión explícita del cliente para borrar `pnpm-lock.yaml`** (propuesto en §9, no ejecutado).
4. El diseño, tipografías, responsive y animaciones del frontend actual no se ven alterados por la introducción del backend — a verificar en cada fase posterior.
5. Antes de dar por buena cualquier iteración del `EmailGate` real, debe repetirse la comprobación de esta auditoría (`grep` sobre el HTML/RSC generado) para confirmar que el contenido VIP ya no viaja al cliente sin sesión validada.

## 12. Bloqueadores reales

- No hay credenciales de Supabase (URL/claves) todavía, por lo que no puede provisionarse la base de datos real hasta que el cliente las facilite o se cree el proyecto Supabase.
- No hay decisión explícita para eliminar `pnpm-lock.yaml` (solo propuesta); se mantiene por regla de no borrar sin petición.
- No hay ningún bloqueador de código, build o tipos: todo lo anterior son decisiones/credenciales pendientes, no errores.

## 13. Veredicto

**APTO PARA INICIAR LA IMPLEMENTACIÓN**, condicionado a:
- resolver el riesgo crítico del `EmailGate` como primera tarea del backend (no como mejora posterior);
- decisión del cliente sobre `pnpm-lock.yaml` y credenciales de Supabase antes de instalar dependencias nuevas.

No se marca ninguna parte del backend como implementada.
