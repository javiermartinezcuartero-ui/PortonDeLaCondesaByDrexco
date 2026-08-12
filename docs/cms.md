# CMS de Bodas Reales y Catering — Fase 4

Fecha: 2026-08-11. Construido sobre el modelo `ContentEntry` de la Fase 2
(`docs/modelo-datos.md`) y la autenticación por roles de la Fase 3
(`docs/autenticacion.md`). **No se han conectado todavía las rutas públicas**:
siguen leyendo `data/vip-stories.ts` (ver §8).

## 1. Rutas y permisos

Todas viven bajo `/admin`, así que las protege el middleware (redirección), el
layout protegido (sesión real contra base de datos) y además
`requirePermission("cms:access")` en cada página y Server Action.
`cms:access` = **ADMIN o CONTENT**; `SALES` no gestiona contenido.

| Ruta | Qué hace |
|---|---|
| `/admin/contenidos` | Listado con pestañas, búsqueda, filtros, paginación y acciones por fila |
| `/admin/contenidos/nuevo` | Crea una ficha nueva (tipo + título + slug). Nace siempre `DRAFT` |
| `/admin/contenidos/[id]` | Editor completo |
| `/admin/contenidos/[id]/preview` | Previsualización con el diseño público real, incluidos borradores |

Cada Server Action (`app/admin/(protected)/contenidos/actions.ts`) revalida el
permiso por su cuenta: no confía en que se haya pasado por la página.

## 2. Listado

- **Pestañas:** Todo · Bodas reales · Catering · Borradores · Publicados · Archivados. La pestaña fija tipo o estado; los filtros explícitos tienen prioridad sobre ella.
- **Búsqueda** por título (cualquier idioma), slug y espacio, sin distinguir mayúsculas.
- **Filtros** por tipo, estado, demo, destacado y rango de fecha del evento.
- **Paginación server-side** (`listContentEntriesForAdmin`, 10 por página): la consulta usa `skip`/`take` y un `count`; nunca se carga la tabla completa.
- Los filtros viven en la query string (`ContentFilters` escribe la URL y el Server Component vuelve a consultar), así que una vista filtrada es compartible por enlace.
- **Acciones por fila:** editar, previsualizar, duplicar como borrador, publicar/despublicar y archivar.

**No existe "eliminar".** Es un requisito explícito: una ficha publicada no se
borra físicamente desde la UI. El camino es despublicar y archivar, que
conserva la trazabilidad y la auditoría. `ContentEntry` solo se borra desde la
base de datos (o en la limpieza de los tests).

## 3. Editor — campos

El orden y los campos replican lo que ya muestra
`components/vip/story-detail.tsx`, para que lo que se edita se corresponda con
lo que se ve:

tipo · slug · fecha/temporada/espacio · título/subtítulo/introducción (ES
obligatorio, EN opcional) · fotos y vídeos · decoración · photocall · minuta por
pases e ítems · cronología · momentos especiales · proveedores · tiempo y
solución del equipo · testimonio · presupuesto (opcional) · CTA ·
destacado/orden · isDemo · SEO básico.

Notas de diseño:

- **Los campos no aplicables se pueden dejar vacíos** y no se inventa contenido para rellenarlos: `StoryDetail` oculta cada sección vacía en vez de mostrar un hueco (se adaptó en esta fase para tolerar fichas incompletas, requisito de la preview de borradores).
- **`intro`, `seoTitle` y `seoDescription` son localizados** (viven en `ContentTranslation`, junto a título y subtítulo). `decor`, `photocall`, `weather`, etc. no lo son: siguen en `ContentEntry` como en la Fase 2.
- **El CTA solo acepta rutas internas** (`/#contacto`): `internalHrefSchema` rechaza URLs externas y `//host`, para que una ficha no pueda llevar al visitante fuera del sitio.
- **SEO compatible con noindex:** `seoNoindex` (por defecto `true`, porque hoy todo el contenido es de ejemplo) es independiente de los campos SEO, que se guardan igual. Marcar noindex no borra el trabajo de SEO.
- **Estados de guardado:** *Guardando…*, *Guardado*, *Error al guardar* y *Cambios sin guardar*. Lo último se calcula comparando el estado del formulario con una instantánea de lo último guardado (`JSON.stringify`), no marcando cada campo a mano.

## 4. Workflow y concurrencia

- Toda ficha nueva empieza en `DRAFT` (valor por defecto del esquema).
- **Slug sugerido y editable:** `slugify` (`lib/slug.ts`) lo propone desde el título; `slugSchema` lo valida **en servidor** (minúsculas, números, guiones simples) y `isSlugAvailable` comprueba la unicidad por tipo. Dos tipos distintos pueden compartir slug (`@@unique([type, slug])`).
- **Publicar exige** título, slug, traducción española, imagen hero y `alt` de la hero. `getMissingPublicationRequirements` devuelve la lista de lo que falta en lenguaje natural, y la UI la muestra en vez de un "no se puede publicar" opaco. También exige `alt` en el resto de archivos: *alt obligatorio para imágenes publicadas*, no solo para la hero.
- **Publish/unpublish/archive son transaccionales e incluyen su `AuditEvent`** en la misma transacción: no puede quedar una publicación sin registrar.
- **Republicar conserva la `publishedAt` original** y limpia `archivedAt`.
- **Archivar pide confirmación** en la UI (retira la ficha de la web pública).
- **Sobrescrituras concurrentes:** el editor envía el `updatedAt` que tenía la ficha al cargarse; `saveContentEntry` hace el `UPDATE` con `where: { id, updatedAt: expected }` y, si no actualiza ninguna fila, lanza `ConcurrentUpdateError` en vez de sobrescribir el trabajo ajeno. Probado (`content-cms.test.ts`): tras el conflicto, la versión de la otra persona sigue intacta.
- **Revalidación:** publicar, despublicar y archivar revalidan `/bodas-reales` o `/catering` y la ruta de la ficha; guardar solo revalida las rutas públicas si la ficha ya está publicada.

### Colecciones: reescritura frente a reconciliación

Minuta, cronología, momentos y proveedores se **reescriben** (borrar + insertar)
dentro de la transacción de guardado. Son listas ordenadas que el editor envía
completas y no tienen identidad propia que preservar; reconciliar por id no
aportaría nada. La **media no se reescribe**: sus filas apuntan a objetos del
bucket, así que del formulario solo se aplican orden, `alt`, `caption`,
`inGallery` y cuál es la hero. Subir y borrar archivos son operaciones
inmediatas aparte.

Los `updateMany`/`create` de media y proveedores filtran siempre por
`contentEntryId`, de modo que un id enviado desde el cliente que pertenezca a
otra ficha no puede modificarla (probado explícitamente).

## 5. Media en Supabase Storage

- **Bucket privado `vip-content`.** Se provisiona con `npm run storage:bootstrap` (idempotente): lo crea privado con límite de 10 MB y `image/jpeg`/`png`/`webp`, y si ya existe reconcilia esos límites — endurecerlos siempre es seguro y son la segunda barrera detrás de la validación de aplicación.
- **La clave privilegiada nunca sale del servidor.** `lib/storage/supabase.ts` empieza con `import "server-only"`: si alguien importa el cliente desde un componente cliente, el build falla en vez de filtrar la clave al bundle. Precedencia: `SUPABASE_SECRET_KEY`, y `SUPABASE_SERVICE_ROLE_KEY` como alternativa.
- **Nada de subir o borrar sin rol.** Las tres acciones de media pasan por `requirePermission("cms:access")`.

### Validación de la imagen (`lib/storage/validate-image.ts`)

Se valida sobre los **bytes reales**, no sobre lo que declara el navegador
(`File.type` y `File.name` son datos del cliente y se pueden falsear). En este
orden: tamaño → extensión declarada → MIME declarado → **firma real de bytes**
coherente con ese MIME → dimensiones reales leídas de la cabecera del formato.

- **Límite documentado: 10 MB por imagen** (`MAX_IMAGE_BYTES`). También se corta antes de leer el archivo en memoria, usando `File.size`.
- Dimensiones entre 200 px y 8000 px por lado.
- Las cabeceras de PNG, JPEG (recorriendo marcadores hasta el SOF) y WebP (VP8/VP8L/VP8X) se leen a mano en vez de con `sharp`: `sharp` ya arrastra vulnerabilidades conocidas en este proyecto (README §12) y para leer una cabecera no hace falta decodificar el bitmap.
- Casos probados que una comprobación por extensión dejaría pasar: JPEG declarado como PNG, `.exe` renombrado a `.png`, SVG (que puede llevar scripts), PDF.

### Nombres de objeto

Los genera el servidor: `<contentEntryId>/<uuid v4><extensión validada>`
(`lib/storage/object-name.ts`). El nombre aportado por el usuario **no se usa
ni saneado** — evita colisiones, `../`, caracteres de control, nombres
reservados de Windows y filtrar el nombre original. La extensión sale del
resultado de `validateImage`, de un conjunto cerrado.

Si la escritura en base de datos falla después de subir, el objeto se elimina
del bucket para no dejar huérfanos.

### URLs firmadas

`resolveMediaUrls` firma los objetos del bucket privado en servidor, con
validez de 10 minutos, y devuelve tal cual las URLs de media externa. Las URLs
firmadas **nunca** se registran en auditoría ni se guardan en base de datos.

### Borrado y objetos compartidos

`deleteContentMedia` borra el objeto **por Storage API, nunca por SQL**, y solo
si ninguna otra fila `ContentMedia` apunta al mismo `storagePath`. El escenario
real es "duplicar como borrador": la copia reutiliza los mismos objetos del
bucket en vez de duplicarlos, así que borrar media de la copia no debe dejar a
la original sin imágenes. Si Storage falla, se aborta **antes** de tocar la
base de datos: es preferible una fila con su objeto que una fila borrada y un
objeto huérfano.

### Vídeos y Reels externos

Se guardan como URL externa validada **más miniatura obligatoria** (un vídeo
sin miniatura no se puede mostrar en la galería). `validateVideoUrl` exige
`https://`, un host de una lista explícita (YouTube, Vimeo, Instagram) y pasa
el filtro anti-SSRF.

### Anti-SSRF y anti-XSS (`lib/storage/external-url.ts`)

El servidor no descarga estas URLs hoy, pero se validan en el punto de entrada
y no cuando se usen:

- Solo `https:`. Se rechazan `javascript:`, `data:`, `vbscript:`, `file:` y `http:`.
- Se rechazan credenciales incrustadas (`https://user:pass@host`).
- Se rechazan destinos internos: `localhost`, `*.internal`, `*.local`, loopback IPv4/IPv6, `169.254.169.254` (metadatos de cloud), `10/8`, `172.16–31/12`, `192.168/16`, CGNAT `100.64/10`, `0.0.0.0`, link-local IPv6 y multicast.

### `inGallery`: qué archivo aparece en la galería

Un fallo que **detectó el test de equivalencia** (§8): el seed crea las
imágenes de proveedor como filas de `ContentMedia` de la misma ficha, así que
la galería las mostraba duplicadas (9 miniaturas en vez de 6). No existía forma
de distinguir el papel de cada archivo. Se añadió `ContentMedia.inGallery`
(migración `20260811223102_content_media_in_gallery`, que incluye la corrección
de datos de las fichas ya sembradas) y en el editor es la casilla *"En la
galería"*.

## 6. Auditoría

`AuditEvent` registra `content.create`, `content.update`, `content.publish`,
`content.unpublish`, `content.archive`, `content.duplicate`, `media.upload` y
`media.delete`.

Los metadatos son **solo identificadores, contadores y datos técnicos**: tipo,
slug, estado anterior, número de archivos/proveedores/pases, MIME, tamaño y
dimensiones. Nunca el cuerpo del contenido, ni la ruta del objeto, ni una URL
firmada. Además todo pasa por `sanitizeMetadata` (Fase 2) cuando se escribe vía
`recordAuditEvent`. Probado: el `AuditEvent` de creación no contiene el título
de la ficha, y el de subida no contiene el `storagePath`.

## 7. Seed de los ejemplos

`prisma/seed.ts` importa `weddingStories` y `cateringStories` a `ContentEntry`
con `isDemo=true` y `status=PUBLISHED`. Es **idempotente**: si el slug ya
existe para ese tipo, lo omite (verificado ejecutándolo varias veces).

`isDemo` mantiene la etiqueta visual **"Ejemplo ilustrativo"** en la ficha y en
el listado del panel, y `listPublishedContent` los oculta en producción salvo
`ENABLE_DEMO_CONTENT=true`. Los nombres, proveedores, opiniones y precios
ficticios nunca se presentan como reales: la etiqueta va en la propia ficha y
el pie del presupuesto dice explícitamente que es una cifra de ejemplo.

## 8. Equivalencia con la fuente estática

`lib/content/seed-equivalence.test.ts` compara los 6 casos sembrados contra
`data/vip-stories.ts`, campo por campo (textos, temporada, espacio, decoración,
photocall, tiempo, solución, testimonio, presupuesto, minuta con su orden,
cronología, momentos, proveedores, hero) **y además** el resultado de pasar por
`toStoryDetailData`, que es lo que recibiría `StoryDetail` desde la base de
datos.

Esto es la condición explícita para poder retirar la fuente estática: mientras
este test no estuviera en verde, borrar `data/vip-stories.ts` sería asumir sin
comprobar que la migración fue fiel. **La fuente estática sigue en su sitio** y
las rutas públicas siguen leyéndola; conectarlas es la fase siguiente.

`lib/content/to-story-detail.ts` es el mapeador `ContentEntry` →
`StoryDetailData`. Se usa hoy solo en la preview, pero no tiene nada específico
del panel: está escrito para que las rutas públicas lo reutilicen sin cambios.

## 9. Operación

```bash
npm run storage:bootstrap   # crea/reconcilia el bucket privado vip-content
npm run db:seed             # siembra los 6 casos de ejemplo (idempotente)
```

Para publicar una ficha nueva: `/admin/contenidos/nuevo` → rellenar el editor →
subir la hero y marcar su `alt` → *Guardar* → *Publicar*. Si el botón de
publicar está deshabilitado, el aviso sobre el formulario dice exactamente qué
falta.

## 10. Qué no incluye esta fase

- Las rutas públicas (`/bodas-reales`, `/catering`) no leen todavía de `ContentEntry` (§8).
- El editor no permite **añadir** vídeos/Reels externos desde la UI: el servicio (`addExternalMedia`) y su validación están implementados y probados, pero el formulario solo sube imágenes. La media externa existente (la del seed) sí se lista, ordena y borra.
- No hay recorte ni redimensionado de imágenes: se guardan tal cual, con el límite de 10 MB.
- No se genera miniatura automáticamente para un vídeo externo: hay que aportar su URL.
