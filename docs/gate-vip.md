# Publicación dinámica y gate de correo — Fase 5

Fecha: 2026-08-12. Conecta las rutas públicas de bodas reales y catering al CMS
de la Fase 4 y sustituye el gate provisional (`localStorage` + Web3Forms) por
acceso protegido en servidor.

## 1. Qué se ha retirado

| Retirado | Por qué |
|---|---|
| `lib/vip-access.ts` | La autorización vivía en `localStorage`: cualquiera podía escribir la clave desde la consola del navegador. |
| `components/vip/email-gate.tsx` | Renderizaba el contenido protegido **desenfocado detrás del diálogo**, así que la ficha completa ya estaba en el HTML. |
| Botón "Saltar verificación" | Permitía cerrar el gate sin dejar el email. |
| Envío del email por Web3Forms | El email se enviaba por correo a un buzón, no se persistía como `Lead`. |
| `vipGateContent` / `vipGateContentEn` en `data/vip-stories.ts` | Mezclaban privacidad y marketing en una sola casilla. Los textos nuevos están en `components/vip/vip-gate.tsx`. |
| `generateStaticParams` de las rutas `[slug]` | La lista de slugs la decide el CMS; pregenerarla daba una lista congelada en el build. |
| Import de `data/vip-stories.ts` en las 4 rutas | Ahora leen de `ContentEntry`. El archivo **sigue existiendo** como fuente del seed de demostración (ver §8). |

## 2. Rutas y flujo de renderizado

Las cuatro rutas (`/bodas-reales`, `/bodas-reales/[slug]`, `/catering`,
`/catering/[slug]`) son `force-dynamic`: dependen de la cookie de acceso, y eso
mismo hace que publicar o despublicar en el CMS se vea **de inmediato**, sin
esperar a que caduque ninguna caché.

Cada ruta es un envoltorio de cuatro líneas sobre un componente de servidor
compartido — no hay una versión para bodas y otra para catering:

- `components/vip/vip-library.tsx` — listado
- `components/vip/vip-story.tsx` — ficha

**El orden dentro de esos componentes es la garantía de seguridad:**

```
1. getVipLead()          ← resuelve la sesión
2. si no hay sesión  →   return <VipGate/>     (aquí termina: no se consulta nada)
3. listPublishedContent / getPublishedContentBySlug
4. resolveMediaUrls      ← se firman las URLs
5. adaptar a props planas y renderizar
```

No se consulta ni se serializa ninguna ficha antes del paso 2. No es una
afirmación de diseño: `components/vip/access-boundary.test.tsx` espía la capa
de datos y comprueba que **no se llama** cuando no hay sesión.

### Contenido

- Solo `ContentEntry` con `status = PUBLISHED` y del tipo correcto. Un `DRAFT` o un `ARCHIVED` devuelve 404 aunque el visitante tenga acceso y conozca el slug.
- Orden: `featured desc`, `sortOrder asc`, `publishedAt desc`.
- La preview de borradores existe **solo** en `/admin/contenidos/[id]/preview`, protegida por rol (Fase 4).
- `isDemo` se conserva y arrastra la etiqueta "Ejemplo ilustrativo" en tarjeta y ficha, en español e inglés.

### Desacoplamiento del ORM

`StoryCard`, `StoryDetail` y `VipListHeader` se conservan tal cual y **no
conocen Prisma**: reciben tipos planos (`StoryCardData`, `StoryDetailData`) que
producen dos adaptadores, `lib/content/to-story-card.ts` y
`lib/content/to-story-detail.ts`. Beneficio concreto: los tests de esos
componentes no necesitan base de datos, y cambiar de ORM no toca la capa
visual.

## 3. El gate

Aparece en cualquiera de las cuatro rutas cuando no hay `VipAccessSession`
válida. **No es un diálogo**: es lo que la página devuelve, así que no se puede
cerrar, saltar ni esquivar, y no hay contenido detrás.

Formulario (`components/vip/vip-gate.tsx`):

- Email.
- Aceptación de privacidad **obligatoria**, con enlace a la política.
- Marketing **separado, opcional y desmarcado** por defecto.
- Honeypot (`website`) fuera del flujo de teclado y de los lectores de pantalla.
- Atribución (UTM + referrer) y categoría de entrada (`section`).
- Textos en español e inglés siguiendo el selector de idioma actual; estados *Accediendo…* y errores con `role="alert"` y `aria-describedby`.
- El email escrito **se conserva** tras un error: es estado del formulario y ningún camino de error lo limpia.

### Flujo en servidor (`lib/vip/gate-action.ts`)

1. Valida el payload con Zod (`lib/validation/vip-gate.ts`).
2. Aplica rate limit persistente: **5 intentos / 10 minutos por IP**.
3. Normaliza el email.
4. Crea o recupera el `Lead` **sin sobrescribir datos mejores**.
5. Registra `ConsentEvent` de privacidad y, si se marcó, otro de marketing.
6. Registra `LeadActivity` (`VIP_ACCESSED`) y `ContentInteraction` (`GATE_GRANTED`) de la sección de entrada.
7. Genera un token aleatorio de 32 bytes.
8. Guarda **solo** su HMAC.
9. Entrega la cookie.
10. Revalida ambas bibliotecas y la ruta de retorno; el cliente hace `router.refresh()`.

Los pasos 4–8 ocurren en **una única transacción** (`grantVipAccess`,
`lib/domain/vip-access.ts`). La cookie se entrega solo después del commit: si
algo falla, no queda nada a medias y el visitante vuelve a ver el gate. El
recálculo de scoring va fuera de la transacción para no alargar el bloqueo, y
su fallo no revierte un acceso ya concedido.

**"Sin sobrescribir datos mejores"** es explícito, no accidental: el `upsert`
solo escribe `lastSource` y `lastActivityAt` en la rama de actualización. No
menciona `firstName`, `lastName` ni `phone`, así que un `Lead` que ya venía del
formulario de contacto con nombre y teléfono no los pierde. Probado.

**Marketing:** solo se crea el `ConsentEvent` cuando la casilla está marcada.
No se guarda un `granted=false` por una casilla que simplemente se dejó como
estaba: eso no es una decisión del usuario, es la ausencia de una.

### Sin magic link

Decisión del enunciado: el acceso es inmediato tras capturar y persistir el
email. La arquitectura queda preparada para añadir verificación por correo sin
rehacer nada — `Verification` ya existe en el esquema (Fase 2) y
`VipAccessSession` ya es un token hasheado con caducidad, de modo que una
futura confirmación por email solo tendría que crear la sesión al hacer clic en
el enlace en vez de al enviar el formulario.

## 4. Sesión y cookie

`lib/vip/session.ts`:

| Aspecto | Valor | Motivo |
|---|---|---|
| Nombre | `porton_vip_access` | — |
| Contenido | **solo el token** | Ni email, ni id de lead, ni nada personal. |
| `HttpOnly` | sí | JavaScript de la página no puede leerla. |
| `Secure` | en producción o si `BETTER_AUTH_URL` es `https` | En desarrollo sobre http una cookie Secure no se guardaría y el gate sería inusable. |
| `SameSite` | `lax` | `strict` rompería el acceso al llegar desde un enlace externo (campañas, redes), que es el caso de uso real. |
| `path` | `/` | La sesión desbloquea las dos bibliotecas. |
| Caducidad | 30 días | Coincide con el TTL de `VipAccessSession`. |

`getVipLead()` está envuelto en `cache()` de React: varias llamadas dentro del
mismo render (página, layout) comparten una sola verificación y una sola
actualización de `lastUsedAt`.

**Protección real, verificada:** un token inexistente, caducado o revocado
devuelve el gate. Ni siquiera el hash almacenado sirve como token — probado
explícitamente, porque es el escenario "alguien ha volcado la tabla". La
comparación de hashes usa `timingSafeEqual` (`lib/security/hash.ts`, Fase 2),
y la búsqueda es indexada por `tokenHash`, no un escaneo.

Un fallo de base de datos al verificar devuelve `null`, es decir: gate. Nunca
concede acceso "por si acaso".

## 5. Rate limit persistente

Tabla propia `RateLimitCounter` (`lib/security/rate-limit.ts`), no la de Better
Auth, para no depender de su lógica interna de purga ni de su formato de clave.
Apta para serverless: el contador vive en base de datos, no en memoria.

La clave se guarda **siempre hasheada** con HMAC irreversible: la tabla nunca
contiene una IP en claro. Probado.

El incremento es atómico: se hace con un `updateMany` condicionado a
`count < max` y a la misma ventana, así que dos peticiones simultáneas no
pueden pasar ambas leyendo el mismo valor previo. La purga de contadores viejos
es oportunista (se lanza desde el propio flujo del gate) y sus fallos se
ignoran: una purga que falla no debe tumbar la petición de un visitante.

## 6. Media

- Las URLs firmadas se generan **después** de validar el acceso, en el paso 4 del flujo de renderizado.
- Nunca se guardan en base de datos ni se registran en auditoría (ya era así en la Fase 4).
- TTL de **1 hora** en las páginas públicas, frente a 10 minutos en el panel: `next/image` cachea la imagen optimizada por URL completa, así que rotar la firma cada pocos minutos obligaría a reoptimizar la misma foto constantemente. Una hora limita ese trabajo sin que un enlace filtrado quede utilizable indefinidamente.
- Se firma **toda la lista en una sola llamada**, no una por archivo.
- `next.config.mjs` autoriza en `images.remotePatterns` únicamente el host derivado de `SUPABASE_URL` y solo la ruta `/storage/v1/object/sign/**`. No se autoriza `/**` del host: eso permitiría proxyar cualquier archivo del proyecto de Supabase a través del optimizador de imágenes.

## 7. SEO

- Bibliotecas y fichas: `index: false, follow: true` mientras **todo** el contenido esté detrás del email. Indexar una página que un buscador solo puede ver como formulario no aporta nada y genera resultados engañosos.
- `sitemap.ts` no incluye las bibliotecas ni ningún slug VIP: publicar los slugs revelaría qué fichas existen sin que nadie haya dejado su email.
- Canonical correcto en las cuatro rutas (`/bodas-reales`, `/bodas-reales/<slug>`, y equivalentes de catering).
- `/admin` y la preview siguen con `noindex, nofollow, nocache` (Fases 3 y 4).
- **La metadata no consulta la base de datos.** Construir el título desde la ficha obligaría a leerla antes de validar el acceso y el `<title>` real acabaría en el HTML de alguien que no ha entrado. Se usa un título genérico de sección; el slug sí aparece en el canonical, pero eso no revela nada nuevo: es la URL que el visitante ha pedido.
- La imagen de Open Graph es un **asset público** del proyecto, nunca una URL firmada: una tarjeta de red social tiene que poder cargarla sin sesión, y una firma temporal caducaría.

## 8. Interacción posterior

`components/vip/track-vip-view.tsx` dispara `SECTION_VIEWED` (listado) o
`CONTENT_VIEWED` (ficha) una vez por montaje, desde el cliente. No se hace
durante el render en servidor a propósito: un render puede repetirse sin que
haya una visita nueva, y un prefetch de Next no debería contar como vista.

La deduplicación real está en servidor: `recordContentViewOnce`
(`lib/domain/interactions.ts`) no registra una vista si ya hay una idéntica en
los últimos **30 minutos**. Recargar tres veces en un minuto no son tres
visitas; volver al día siguiente sí. El listado y la ficha se cuentan por
separado, igual que dos fichas distintas y las dos secciones.

Sin sesión válida la acción no registra nada: no se puede usar para escribir
interacciones de un lead ajeno.

## 9. La fuente estática

`data/vip-stories.ts` **ya no la leen las rutas**, pero sigue en el repositorio
como fuente del seed de demostración (`prisma/seed.ts`), que es exactamente lo
que pedía el enunciado: "conserva el seed como fuente de demo, no el array como
fuente de producción".

La retirada de las rutas es segura porque la equivalencia de datos está probada
desde la Fase 4 (`lib/content/seed-equivalence.test.ts`): los 6 casos
sembrados coinciden campo por campo con el array, y también al pasar por el
mapeador que alimenta a `StoryDetail`.

## 10. Variables de entorno

No hay ninguna nueva en esta fase. Se empiezan a usar de verdad:

- `RATE_LIMIT_HASH_SECRET` (+ `_PREVIOUS`) — preparada en la Fase 2, **ahora en uso** por el rate limit del gate.
- `VIP_TOKEN_HASH_SECRET` (+ `_PREVIOUS`) — ya se usaba; ahora respalda la cookie real.
- `SUPABASE_URL` — además del cliente de Storage, ahora determina el host autorizado de `next/image`.

## 11. Pruebas

| Escenario del enunciado | Dónde |
|---|---|
| Primera entrada muestra gate | `components/vip/access-boundary.test.tsx` |
| Privacidad obligatoria | `lib/vip/gate-action.test.ts`, `lib/validation/vip-gate.test.ts` |
| Marketing opcional | `lib/vip/gate-action.test.ts` (con y sin marcar) |
| Acceso válido desbloquea ambas secciones | `lib/vip/gate-action.test.ts` (revalida las dos), verificado también en vivo |
| Slug directo protegido | `components/vip/access-boundary.test.tsx` |
| Cookie manipulada / expirada / revocada | `lib/vip/session.test.ts` (+ el hash como token) |
| Contenido no aparece antes de acceso | `components/vip/access-boundary.test.tsx` (espía la capa de datos) |
| Interacción por categoría | `lib/domain/interactions.test.ts` |
| Contenido draft no visible | `lib/content/published-content.test.ts` |
| URL firmada solo tras acceso | `components/vip/access-boundary.test.tsx` |
| Fallo de base de datos no desbloquea | `lib/vip/gate-failure.test.ts` |
| Honeypot | `lib/vip/gate-action.test.ts`, `lib/validation/vip-gate.test.ts` |
| Rate limit persistente | `lib/security/rate-limit.test.ts`, `lib/vip/gate-action.test.ts` |

## 12. Qué no incluye esta fase

- **Sin pruebas end-to-end en navegador** (Playwright sigue sin incorporarse; no hay automatización de navegador en este entorno). La verificación se hizo con peticiones HTTP reales y tests contra base de datos y bucket reales.
- El formulario de contacto general **sigue enviando a Web3Forms**: esta fase sustituye el gate VIP, no la captación general. Es lo que abre la fase siguiente.
- Sin verificación del email por correo (decisión explícita del enunciado, §3).
