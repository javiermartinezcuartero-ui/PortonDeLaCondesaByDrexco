# Publicación del repositorio en GitHub

Qué hay que comprobar antes de que este repositorio pase a público, qué está ya
comprobado de forma automática, y qué hacer si aparece un secreto.

**Estado: publicado.** El repositorio existe en GitHub, su historial está
subido (`origin/main`) y la visibilidad ya se cambió a público — decisión y
acción manual de Javier.

Un detalle que conviene tener claro antes de seguir: los commits del historial
—Fases 1 a 6— **ya están en GitHub**. Si hubiera un secreto ahí, ya estaría
expuesto a quien tenga acceso al repositorio privado, y hacerlo público solo
ampliaría la audiencia. Por eso el escaneo del historial se hace ahora y no
después.

---

## 1. Estado de las comprobaciones

Ejecutado el 13 de agosto de 2026. Todas las salidas son reales.

| # | Comprobación | Cómo | Resultado |
|---|---|---|---|
| 1 | Ningún `.env` versionable | `git ls-files --cached --others --exclude-standard \| grep '\.env'` | Solo `.env.example` y `.env.e2e.example`, los dos sin valores |
| 2 | `.env` y `.env.e2e` reales ignorados | `git check-ignore .env .env.e2e` | Los dos ignorados |
| 3 | `.gitignore` seguro | revisión manual + §2 | Ampliado en esta fase: volcados, copias, exportaciones, subidas, `.vercel` |
| 4 | Sin volcados ni exportaciones | búsqueda por extensión en el árbol versionable | Ninguno. Los únicos `.sql` son las 9 migraciones de Prisma |
| 5 | Sin subidas reales de imágenes | `public/` revisado archivo a archivo | 23 archivos, todos de marca o de la plantilla. Las imágenes del CMS viven en el bucket privado |
| 6 | Sin datos personales de particulares | §3 | Ninguno. Ver el detalle, incluido lo que sí hay |
| 7 | Secretos en el **árbol** | `npm test` → `lib/security/secrets-scan.test.ts` | 8 pruebas verdes, 11 patrones, 0 hallazgos |
| 8 | Secretos en el **historial** | `npm run secrets:history` | 5 commits, 288 versiones de archivo, 0 hallazgos |
| 9 | CI verde | simulación del entorno del runner (sin `.env`) | 329 pruebas pasan, 325 se saltan solas, exit 0 |
| 10 | LICENSE | — | MIT, decisión de Javier. Ver §6 |
| 11 | NOTICE | `NOTICE` en la raíz | Escrito: marca, fotografías, textos y tipografías fuera de cualquier licencia de software |
| 12 | CONTRIBUTING | `CONTRIBUTING.md` | Escrito |
| 13 | Plantilla de release/tag | `.github/RELEASE_TEMPLATE.md` | Escrita |

---

## 2. `.gitignore`

La regla de los `.env` está escrita **en negativo** a propósito:

```gitignore
.env*
!.env.example
!.env.e2e.example
```

Se ignora todo lo que empiece por `.env` y se reabren una a una las plantillas
sin valores. Al contrario —listar `.env`, `.env.local`, `.env.production`— una
variante nueva quedaría versionable por omisión, y así es exactamente como se
filtran las credenciales: alguien crea `.env.staging` y el patrón no lo cubría.

Ampliado en esta fase con volcados (`*.dump`, `*.bak`, `*.sqlite`, `/dumps/`,
`/backups/`, `/exports/`), subidas locales (`/uploads/`, `/public/uploads/`),
`.vercel`, y la basura habitual de sistema y editores.

**`*.sql` no se ignora, y es deliberado:** las migraciones de Prisma son
archivos `.sql` y tienen que estar versionadas. Un volcado de base de datos
también es `.sql`, así que aquí el filtro no puede ser la extensión —hay una
comprobación de que las 9 migraciones siguen versionadas tras el cambio— y la
regla real es la de arriba: los volcados van a `/dumps/` o `/backups/`, que sí
están ignorados. Si alguien deja un `volcado.sql` en la raíz, `git status` lo
mostrará y lo verá; eso es preferible a un patrón que se lleve por delante las
migraciones sin avisar.

---

## 3. Datos personales

Revisado el árbol versionable completo buscando correos, teléfonos y
identificadores personales.

**No hay datos personales de particulares.** Lo que sí hay, y por qué es
correcto que esté:

| Qué | Dónde | Por qué puede publicarse |
|---|---|---|
| Correo, teléfono, dirección y coordenadas de la finca | `data/site-content.ts`, textos legales | Datos de contacto de un negocio, publicados por él mismo en su propia web. Son el contenido del sitio |
| `@elportondelacondesa` | `project-reference/` | Cuenta oficial del negocio en Instagram, pública |
| Nombres de las 6 fichas de ejemplo ("Laura & Marcos", …) | `data/vip-stories.ts` | **Ficticios**, declarado en la cabecera del archivo: nombres, proveedores, menús, precios y testimonios inventados. La interfaz los etiqueta "Ejemplo ilustrativo" |
| `laura.ejemplo@gmail.com` | `lib/domain/normalize.test.ts` | Una sola prueba de normalización de correo. Necesita el dominio `gmail.com` real porque lo que comprueba es precisamente cómo se normaliza; el buzón es inventado |
| Correos de la demostración | `scripts/demo-seed.ts` | Dominio `.test`, reservado por la RFC 2606 para documentación. No puede coincidir con el buzón de nadie |
| IPs de las pruebas E2E | `e2e/helpers.ts` | Rango `198.18.0.0/15`, reservado por la RFC 2544 para pruebas |

Los datos personales reales que el sistema tratará —los de los contactos
captados— viven **solo** en la base de datos, nunca en el repositorio. La
exportación del CRM produce un CSV con datos personales: por eso `/exports/`
está en `.gitignore`.

---

## 4. Escaneo de secretos: los dos escáneres

Son dos estados distintos y hacen falta los dos.

### El árbol de trabajo

`lib/security/secrets-scan.test.ts`, dentro de `npm test`. Pregunta a git qué
está versionado o sin ignorar —exactamente el conjunto que puede acabar
publicado— y busca los 11 patrones. Un `.env` lleno de claves reales no es un
problema mientras esté ignorado; el problema es lo que sale del repositorio.

Ya evitó una fuga real: en la Fase 6 el README llegó a contener la contraseña de
administración en claro.

### El historial

`npm run secrets:history` (`scripts/secrets-scan-history.ts`). Recorre todas las
versiones de todos los archivos de todos los commits alcanzables desde cualquier
referencia, deduplicando por contenido.

Hace falta porque **limpiar el árbol no limpia el historial**. Un secreto
añadido en un commit y borrado en el siguiente sigue estando en el primero, y en
GitHub el commit anterior sigue siendo consultable por su URL para siempre. El
escáner del árbol diría que todo está bien.

También revisa los mensajes de commit, donde de vez en cuando alguien pega una
cadena de conexión.

Los dos comparten la lista de patrones y de excepciones
(`lib/security/secret-patterns.ts`). Estaban duplicados y eso garantizaba que
antes o después se desviaran.

En CI el paso necesita `fetch-depth: 0`: con el clon superficial que
`actions/checkout` hace por defecto solo vería el último commit y pasaría
siempre.

### Salida real

```
Commits revisados:      5
Versiones de archivo:   288 (deduplicadas por contenido)
Patrones aplicados:     9
Excepciones conocidas:  1
  - project-reference/data/image-manifest.json: secreto hexadecimal de 64 caracteres

Historial limpio: ningún secreto en ninguna versión de ningún archivo.
```

Esa excepción es la prueba de que el escáner funciona de verdad: detectó los
checksums SHA-256 del manifiesto de imágenes —64 caracteres hexadecimales, la
misma forma que un secreto— y los clasificó como falso positivo conocido. Si la
detección estuviera rota, esa línea no aparecería.

### Los 11 patrones

Clave secreta y clave publicable de Supabase (formato nuevo), JWT de Supabase
(`anon`/`service_role`), clave de API de SendGrid, cadena de conexión de
PostgreSQL con credenciales (de la forma `postgresql://usuario:contraseña@host`),
secreto hexadecimal de 64 caracteres (el formato de `BETTER_AUTH_SECRET`,
`RATE_LIMIT_HASH_SECRET` y `VIP_TOKEN_HASH_SECRET`), clave privada PEM, token de
GitHub y clave de acceso de AWS.

Cada excepción de la lista lleva su motivo escrito, y hay una prueba que
comprueba que lo lleva: una excepción sin explicación es un agujero con permiso,
porque al cabo de dos fases nadie recuerda si era un falso positivo o una fuga
que se toleró.

---

## 5. Si aparece un secreto

**No se reescribe el historial automáticamente.** Ni este proyecto ni ninguna
herramienta debe hacerlo sin que una persona decida: reescribir cambia el SHA de
todos los commits posteriores, invalida los clones existentes y rompe cualquier
enlace ya enviado a un tribunal.

El orden importa, y el primer paso no es Git:

### 1. Rotar la credencial. Siempre, y primero

Dala por comprometida. No importa si el repositorio era privado, si el commit es
de hace meses o si nadie más tiene acceso: una credencial que ha estado en un
repositorio ya no es secreta.

| Credencial | Dónde se rota |
|---|---|
| Claves de Supabase | Panel de Supabase → Settings → API → rotar. Actualizar `SUPABASE_SECRET_KEY` en Vercel |
| Contraseña de PostgreSQL | Panel de Supabase → Settings → Database → cambiar. Actualizar `DATABASE_URL` y `DIRECT_URL` |
| `BETTER_AUTH_SECRET` | Generar 32 bytes nuevos. **Invalida todas las sesiones activas**: el equipo tendrá que volver a entrar |
| `RATE_LIMIT_HASH_SECRET`, `VIP_TOKEN_HASH_SECRET` | Generar nuevo y poner el anterior en `_PREVIOUS`, que existe para esto: la rotación no invalida lo ya hasheado de golpe |
| `SENDGRID_API_KEY` | Panel de SendGrid → API Keys → borrar y crear |

### 2. Comprobar si se ha usado

Antes de dar el incidente por cerrado: registros de acceso de Supabase, actividad
de la API de SendGrid, y `AuditEvent` de la propia aplicación.

### 3. Solo entonces, decidir sobre el historial

Tres opciones, de menos a más agresiva:

**a) No tocar el historial.** Rotada la credencial, la que está en el historial
ya no abre nada. Es lo razonable cuando el repositorio no ha sido público y la
credencial era de desarrollo. Se documenta la decisión y se sigue.

**b) Reescribir el historial** con `git filter-repo` (no `filter-branch`, que
está obsoleto y es más fácil de usar mal):

```bash
git filter-repo --path <ruta/del/archivo> --invert-paths
# o, para una cadena concreta:
git filter-repo --replace-text expresiones.txt
```

Después hace falta un `push --force`, avisar a todo el que tenga un clon, y
tener presente que GitHub conserva los objetos alcanzables por *pull requests*
hasta que se le pide borrarlos por soporte. Con un solo colaborador y sin PR
abiertos, esto último no aplica.

**c) Empezar un repositorio nuevo** y archivar el anterior. Es la única forma de
tener garantía absoluta, al precio de perder el historial.

### 4. Añadir el patrón al escáner

Si el secreto no lo detectaron los 11 patrones, el escáner tenía un hueco. Se
añade a `lib/security/secret-patterns.ts` con su prueba, para que la próxima vez
lo pare `npm test` en lugar de una revisión manual.

---

## 6. Licencia: MIT

**Decidida en la Fase 13.** El archivo `LICENSE` está en la raíz con el texto
íntegro de la MIT, a nombre de Javier Martínez y con fecha 2026.

Es la opción habitual en una entrega académica: permisiva, de una página, y
permite a cualquiera leer, citar y reutilizar el código conservando la autoría.
Frente a Apache 2.0 —también permisiva, pero con concesión expresa de patentes y
obligación de declarar modificaciones— pesó que este proyecto no tiene patentes
que conceder y que la brevedad importa cuando el lector es un tribunal.

**La advertencia del punto 1 de más abajo se aplicó al escribir el archivo:** los
dos últimos párrafos del `LICENSE`, en inglés y en español, dicen expresamente
que la licencia cubre el código fuente y no la marca, el logotipo, las
fotografías ni los textos del negocio, y remiten a `NOTICE`. Sin eso, quien lea
"MIT" asumiría que cubre el repositorio entero.

Las opciones que se valoraron, con lo que implica cada una:

| Opción | Qué permite | Cuándo tiene sentido |
|---|---|---|
| **Sin LICENSE** | Leer y evaluar. Nada más | Entrega académica de un proyecto con un cliente real detrás. Es la opción por defecto y la más conservadora |
| **MIT** ← *elegida* | Todo, incluido uso comercial, con solo conservar el aviso de copyright | Se quiere que el código sirva de portfolio reutilizable |
| **Apache 2.0** | Como MIT, más concesión expresa de patentes y obligación de señalar cambios | Igual que MIT pero con más protección para el autor |
| **AGPL 3.0** | Uso libre, pero quien lo despliegue como servicio debe publicar su código | Se quiere evitar que alguien monte un SaaS cerrado con esto |
| **Propietaria** | Lo que diga el texto | Si el cliente considera el CRM parte de su ventaja competitiva |

Tres cosas que conviene tener presentes al decidir:

1. **La licencia del código no alcanza al contenido.** Marca, logotipos,
   fotografías y textos de El Portón de la Condesa quedan fuera de cualquier
   licencia abierta. Eso ya está escrito en `NOTICE` y hay que dejarlo dicho
   también en el propio LICENSE si se añade uno permisivo, porque quien lea
   "MIT" asumirá que cubre el repositorio entero.
2. **Puede que el código no sea solo tuyo para licenciarlo.** Si hay un contrato
   con el cliente que cede la titularidad del desarrollo, la decisión es suya.
   Conviene comprobarlo antes de publicar una licencia abierta.
3. **Añadir una licencia es fácil; retirarla, no.** Quien haya clonado el
   repositorio conserva los derechos que la licencia le dio en ese momento.

Hecho: `LICENSE` creado, referenciado en README §Licencia y con el párrafo que
remite a `NOTICE`. **Confirmado por Javier:** la decisión de licenciar como MIT
es suya y es la apropiada para la presentación del máster. El punto 3 sigue
vigente como aviso general: quien clone el repositorio a partir de ahora
conserva los derechos que la MIT le da, aunque se cambie después.

---

## 7. Pasos manuales de la publicación

Ninguno lo hace este proyecto. Todos son de Javier.

1. ~~Decidir la licencia~~ (§6) — **hecho:** MIT.
2. ~~Revisar `NOTICE` con el cliente~~ — **hecho:** Javier confirma que tiene
   permiso de uso de la fotografía con marca de agua de
   `public/images/porton/02-salon-celebraciones.jpg`.
3. ~~Comprobar la titularidad del código~~ — **hecho.**
4. **Ejecutar las comprobaciones** de §1 una última vez sobre el commit que se
   vaya a entregar:

   ```bash
   npm ci && npm run lint && npm run typecheck && npm test && npm run build
   npm run secrets:history
   ```

5. **Confirmar que CI está verde** en ese commit, en la pestaña Actions.
6. ~~Cambiar la visibilidad~~ — **hecho:** el repositorio ya es público.
7. **Rellenar la descripción y los temas** del repositorio, y enlazar la
   aplicación desplegada si existe.
8. **Crear el tag y la release** con `.github/RELEASE_TEMPLATE.md`.
9. **Comprobarlo en incógnito**: abrir la URL del repositorio sin sesión de
   GitHub y verificar que el README se lee bien y que ningún enlace lleva a un
   404 ni a un recurso privado. Anotarlo en
   `docs/checklist-entrega-tfm.md`.

Una advertencia sobre el orden: **cambiar la visibilidad es fácil de revertir en
GitHub, pero no en Internet.** Entre el momento en que el repositorio es público
y el momento en que se vuelve a privado, cualquiera puede haberlo clonado, y los
rastreadores de credenciales que vigilan GitHub actúan en segundos. Por eso todo
lo demás va antes.
