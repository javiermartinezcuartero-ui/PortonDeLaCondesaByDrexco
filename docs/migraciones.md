# Migraciones de base de datos

Las diez migraciones del proyecto, en orden, qué hace cada una y cómo se corrige
un despliegue que sale mal. Amplía el README §Prisma y migraciones.

---

## 1. Orden y contenido

Prisma aplica las migraciones por el orden alfabético de sus carpetas, que empiezan
por marca de tiempo. **Ese orden es el único válido**: hay dependencias reales entre
ellas y saltarse una deja el esquema inconsistente.

| # | Carpeta | Qué hace | Destructiva |
|---|---|---|---|
| 1 | `20260811101614_init` | Esquema completo: 25 tablas, 14 tipos enumerados, 33 índices | No (creación) |
| 2 | `20260811120036_add_rate_limit_table` | Tabla del limitador de Better Auth | No |
| 3 | `20260811125648_cms_content_fields` | Campos del CMS en `content_entry` y su índice | No (columnas nuevas) |
| 4 | `20260811223102_content_media_in_gallery` | `content_media.inGallery` + corrección de datos | No (ver §2) |
| 5 | `20260812073315_app_rate_limit_counter` | Tabla del limitador propio de la aplicación | No |
| 6 | `20260812120000_lead_request_submission_id` | `lead_request.submissionId` + índice único | No |
| 7 | `20260812210000_notification_status_values` | Dos valores nuevos en `NotificationStatus` | No |
| 8 | `20260812210100_notification_log_fields` | `provider`, `recipients`, `leadId` opcional + corrección | No (ver §2) |
| 9 | `20260813205449_add_metrics_indexes` | Tres índices que faltaban (auditoría final) | No |
| 10 | `20260814120000_pipeline_cinco_fases` | `LeadRequestStatus` de nueve valores a cinco | **Sí** (ver abajo) |

**Ninguna migración borra una tabla ni una columna.** No hay ningún `DROP TABLE` ni
`DROP COLUMN` en el historial.

**La 10 sí es destructiva, y conviene entender exactamente qué destruye.** PostgreSQL
no sabe quitar valores de un tipo enumerado: la única vía es crear un tipo nuevo,
convertir la columna con un `CASE` y borrar el viejo, así que esa migración contiene
un `DROP TYPE "LeadRequestStatus"`. Lo que se pierde no es el tipo —se vuelve a crear
con el mismo nombre— sino **información**: `CONTACTED`, `QUALIFIED` y
`VISIT_SCHEDULED` caen los tres en `PRESENTATION`, y nada guarda cuál era cada uno.
**Copia antes de aplicarla en un entorno con historial.**

Lo que la 10 no toca es la pista de auditoría: `lead_activity` y `audit_event`
conservan las transiciones con el vocabulario de su día. Reescribir un registro de
auditoría para que diga lo que no dijo es falsearlo; en su lugar, los lectores
aceptan los dos vocabularios (`LEGACY_STATUS_LABEL` en `lib/crm/labels.ts` y el
filtro de `averageHoursToFirstContact` en `lib/domain/metrics.ts`).

Lo más cerca de un cambio irreversible que hay entre las nueve primeras es el
`ALTER COLUMN "leadId" DROP NOT NULL` de la 8, que **amplía** lo que la columna
admite: aplicarla no puede perder datos.

Verificado a mano: las diez se aplican en orden sobre una base virgen sin ningún
error (`npm run e2e:db:reset && npm run e2e:db:migrate`).

### Por qué 7 y 8 están separadas

PostgreSQL no permite **usar** un valor de enum en la misma transacción en que se
añadió. La migración 8 escribe `'SKIPPED_CONFIG'` en una corrección de datos, y ese
valor lo añade la 7. Juntas fallarían. Está explicado dentro del propio SQL para que
nadie las "simplifique" en una sola.

---

## 2. Las dos correcciones de datos

Dos migraciones incluyen un `UPDATE`. No cambian estructura, ajustan filas que ya
existían y que la estructura nueva permite clasificar mejor:

- **4 (`content_media_in_gallery`)**: marca `inGallery = false` en las imágenes que
  solo ilustran a un proveedor. Antes de esa columna no había forma de
  distinguirlas, así que las fichas ya sembradas mostraban esas fotos duplicadas
  dentro de la galería pública.
- **8 (`notification_log_fields`)**: reetiqueta como `SKIPPED_CONFIG` los avisos que
  estaban en `PENDING`. En la fase anterior, `PENDING` significaba exactamente "no
  había proveedor de correo configurado"; ahora ese caso tiene su propio estado y
  dejarlas en `PENDING` las abandonaría en un limbo que el código ya no produce.

Las dos son **idempotentes**: volver a ejecutarlas no cambiaría nada más, porque su
`WHERE` ya no encontraría filas.

---

## 3. Aplicar en producción

**Siempre `prisma migrate deploy`.** Nunca `migrate dev`:

- `migrate dev` es interactivo y puede decidir **recrear el esquema desde cero** si
  detecta una desviación. En una base con datos reales eso es catastrófico.
- `migrate dev` además genera migraciones nuevas comparando el esquema con la base;
  no es un comando de despliegue, es un comando de desarrollo.
- `migrate deploy` solo aplica lo que ya está escrito en `prisma/migrations/`, en
  orden, sin preguntar nada, y falla en vez de improvisar.

```bash
# Con DIRECT_URL apuntando al pooler en modo Session (puerto 5432) o a la conexión
# directa: las migraciones necesitan una conexión con sesión, no el pooler en modo
# Transaction del runtime.
npx prisma migrate deploy
```

El comando es seguro de repetir: las ya aplicadas se saltan.

### Antes de una migración destructiva

Ninguna de las ocho actuales lo es, pero cuando llegue una que borre o transforme
datos, el orden es este y no otro:

1. **Copia previa.** En Supabase, `Database → Backups`; en el plan gratuito no hay
   copias automáticas, así que hay que hacer una exportación manual:
   ```bash
   pg_dump "$DIRECT_URL" --format=custom --file=copia-$(date +%F).dump
   ```
   Y **comprobar que la copia se restaura**, no solo que el archivo existe. Una
   copia sin verificar es una suposición.
2. **Exportación de lo que se va a perder**, aparte y en formato legible (CSV o
   JSON), para poder rehacerlo a mano si hace falta.
3. Aplicar en un entorno de Preview con una copia de los datos, y comprobar el
   resultado.
4. Aplicar en producción, con la aplicación en modo lectura si el cambio tarda.

---

## 4. Cuando una migración sale mal

**No hay `migrate down`.** Prisma no genera migraciones inversas, así que "rollback"
significa una de estas tres cosas, en orden de preferencia:

### a) Corrección hacia delante (lo normal)

Escribir una migración **nueva** que arregle lo que la anterior dejó mal. Es la vía
recomendada y la única que mantiene el historial coherente con lo que de verdad
pasó en la base:

```bash
# 1. Corregir prisma/schema.prisma
# 2. Crear la carpeta de la migración a mano con su SQL:
mkdir prisma/migrations/$(date +%Y%m%d%H%M%S)_corrige_lo_que_sea
# 3. Escribir migration.sql
# 4. Aplicar
npx prisma migrate deploy
```

Las migraciones de este proyecto están escritas a mano precisamente por esto:
`migrate dev` no funciona en este entorno (es interactivo) y escribir el SQL obliga
a saber qué se está haciendo.

### b) Migración marcada como aplicada sin ejecutarse

Si una migración falla a medias y la base ya está en el estado que buscaba (porque
se arregló a mano), se le dice a Prisma que la dé por buena para que no la
reintente:

```bash
npx prisma migrate resolve --applied 20260812210100_notification_log_fields
```

Y si falló y **no** se aplicó nada, se marca como revertida para poder reintentar:

```bash
npx prisma migrate resolve --rolled-back 20260812210100_notification_log_fields
```

Los dos comandos solo tocan la tabla `_prisma_migrations`: no cambian el esquema.
Usarlos sin haber comprobado el estado real de la base es como apagar una alarma
sin mirar qué la ha disparado.

### c) Restauración de la copia

Última opción, porque **pierde todo lo escrito desde la copia**. Solo cuando el
esquema quedó en un estado del que no se puede salir hacia delante:

```bash
pg_restore --clean --if-exists --dbname="$DIRECT_URL" copia-2026-08-13.dump
```

Después hay que revisar `_prisma_migrations` para que refleje lo que la base tiene
de verdad.

### En Vercel, además

Un despliegue con una migración fallida deja la aplicación nueva contra un esquema
viejo. El orden correcto de reacción es:

1. **Volver al despliegue anterior** desde el panel de Vercel (`Deployments → …→
   Promote to Production`). Es instantáneo y devuelve a la aplicación que sí
   funcionaba con ese esquema.
2. Arreglar la migración con calma.
3. Volver a desplegar.

Rehacer el despliegue con la migración aún rota solo repite el fallo.

---

## 5. Convenciones al añadir una migración

- Una carpeta por cambio, con marca de tiempo `AAAAMMDDHHMMSS_descripcion_corta`.
- SQL escrito a mano y **comentado en español**, explicando el *por qué* del cambio
  y no solo el qué. Los comentarios de las migraciones 4, 7 y 8 son el ejemplo.
- Si el cambio necesita dos pasos que PostgreSQL no admite en la misma transacción
  (añadir un valor de enum y usarlo), dos migraciones, con el motivo escrito en la
  primera.
- Actualizar `prisma/schema.prisma` en el mismo commit y comprobar con
  `npx prisma validate` que los dos concuerdan.
- Aplicarla sobre una base virgen antes de darla por buena:
  `npm run e2e:db:reset && npm run e2e:db:migrate`.
