# CRM: pipeline, tareas y analítica

Panel comercial dentro de `/admin`. Amplía el README §CRM, pipeline, tareas e informes y reutiliza la
autenticación de [`autenticacion.md`](autenticacion.md) y la captación de
[`flujo-captacion.md`](flujo-captacion.md).

## 1. Rutas y permisos

Las rutas son las de siempre; **los rótulos de la interfaz cambiaron en la Fase 21**
a lenguaje de negocio. Renombrar las carpetas habría roto marcadores,
`revalidatePath` y los escenarios E2E sin cambiar nada en pantalla.

| Ruta | Rótulo en el panel | Permiso | Roles |
|---|---|---|---|
| `/admin` | Estatus Plataforma | `crm:access` | ADMIN, SALES |
| `/admin/contactos` · `/admin/contactos/[id]` | Captaciones | `crm:access` | ADMIN, SALES |
| `/admin/solicitudes` · `/admin/solicitudes/[id]` | Solicitudes Formulario | `crm:access` | ADMIN, SALES |
| `/admin/pipeline` | Seguimiento clientes | `crm:access` | ADMIN, SALES |
| `/admin/tareas` | Acciones | `crm:access` | ADMIN, SALES |
| `/admin/contenidos/**` | Contenidos Biblioteca | `cms:access` | ADMIN, CONTENT |
| `/admin/informes` | Informes captación | `crm:access` | ADMIN, SALES |
| `/admin/configuracion` | Puntuación Visitantes | `settings:manage` | ADMIN |
| `/admin/usuarios` | `users:manage` | ADMIN |
| `GET /api/admin/crm/export` | `crm:export` | ADMIN |

`/admin` es la única ruta con dos caras: con `crm:access` muestra las métricas
del CRM, y sin él (un usuario CONTENT) muestra un punto de partida con acceso a
Contenidos. No una pantalla vacía ni un error.

## 2. Cómo se protege cada apartado

Tres capas, y solo la tercera protege de verdad:

1. **La navegación** (`layout.tsx`) filtra los enlaces con `roleHasPermission`.
   Es cortesía de interfaz: un apartado que no se puede usar no se enseña.
2. **El middleware** redirige `/admin/**` si falta la cookie de sesión. Es una
   comprobación barata que no toca la base de datos y **no autoriza nada**.
3. **Cada página, Server Action y Route Handler** vuelve a resolver la sesión
   contra la base de datos y a comprobar el permiso. Esta es la autorización.

Las guardas de página viven en `app/admin/(protected)/guards.ts` y traducen el
fallo a la respuesta correcta:

- **sin sesión** → redirección a `/admin/login`;
- **con sesión y sin permiso** → **404, no 403**. Un 403 confirma que el apartado
  existe; un 404 no dice nada, y es coherente con haber ocultado el enlace.

Las Server Actions no pueden usar ese camino (no devuelven una página), así que
devuelven `{ ok: false, errors }` y **no tocan la base de datos**. Hay pruebas que
invocan cada acción con la sesión equivocada y comprueban que nada cambió: una
Server Action es un endpoint, y esconder un botón no la protege.

## 3. Estatus Plataforma (`/admin`)

Métricas en `lib/domain/metrics.ts`, todas con `count`/`groupBy`/`aggregate`
agregados en la base de datos.

| Métrica | Cómo se calcula |
|---|---|
| Interesados por la biblioteca | Contactos distintos con una interacción `GATE_GRANTED` |
| Solicitudes sin trabajar | `LeadRequest` en fase `CONTACT` |
| Tiempo al primer contacto | Media de horas entre el alta y el primer paso a `PRESENTATION`, leído del historial real de `LeadActivity`. Acepta también el nombre anterior (`CONTACTED`) porque el histórico no se reescribió al reducir las fases |
| Reparto por fase | `groupBy` sobre las cinco fases, dibujado como anillo |
| Conversión | `CLIENT / (CLIENT + LOST)` — **sobre cerradas**, no sobre el total |
| Acciones | Vencidas, próximos 7 días y «más adelante», como partición real: «pendientes en total» incluye a las dos primeras, así que se resta |
| Origen y campaña | `groupBy` de las UTMs de las solicitudes |
| Contenido más consultado | `groupBy` de `CONTENT_VIEWED` por ficha |
| Embudo | gate → consulta de ficha → solicitud |
| Últimos movimientos | Últimas `LeadActivity` con su contacto |

### Datos vacíos: nunca una métrica engañosa

Un ratio sin denominador devuelve `null`, no `0 %`. Un 0 % afirma que nadie
convierte; un `null` dice que todavía no hay datos, y son cosas distintas para
quien decide. Cada ratio viaja con su denominador (`{ numerator, denominator,
percentage }`) y la interfaz lo muestra: "3 de 4 solicitudes cerradas", no un 75 %
suelto. Lo mismo con las medias, que llevan su `sampleSize`.

La conversión se calcula **sobre cerradas** a propósito: mientras una solicitud
sigue viva no cuenta ni a favor ni en contra. Dividir los ganados entre el total
haría que abrir solicitudes nuevas empeorara la métrica.

### El embudo solo cuenta el paso anterior

Cada escalón cuenta contactos distintos **que vienen del escalón anterior**:
alguien que envía una solicitud sin haber pasado por el gate no infla el último
paso. Es la única parte del módulo que trae listas de identificadores (hacen falta
las intersecciones); está acotada a un identificador por contacto.

## 4. Captaciones (`/admin/contactos`)

Listado con paginación en servidor (25 por página) y filtros por origen,
etiqueta, puntuación mínima, tipo de interacción, consentimiento de marketing y
fechas de alta. Todos los filtros viajan en la URL, así que una vista filtrada se
puede compartir o guardar; los formularios son `<form method="get">` y funcionan
sin JavaScript.

**Búsqueda por dato normalizado.** El email y el teléfono se buscan contra las
columnas normalizadas, que es como se guardan: buscar `600 11 22 33` encuentra al
contacto guardado como `+34600112233` porque el término pasa por el mismo
normalizador. El nombre se busca sin distinguir mayúsculas, porque no tiene forma
canónica.

**Ficha 360º** (`/admin/contactos/[id]`): datos de contacto con enlaces
mailto/tel/WhatsApp, consentimientos con su versión de política, solicitudes,
contenido consultado, historial, notas y tareas. Las colecciones llevan tope: una
ficha es una pantalla, no el archivo histórico completo.

## 5. Solicitudes Formulario (`/admin/solicitudes`)

Listado paginado con filtros por estado, prioridad, tipo de evento, espacio,
responsable (incluido "sin asignar"), origen, campaña, ficha de origen, rango de
invitados y fechas.

**Orden seguro.** El parámetro de orden llega por URL, así que se resuelve contra
una lista blanca cerrada (`REQUEST_SORTS`) y no se pasa nunca a Prisma tal cual.
Lo que no está en esa lista cae al orden predeterminado. Además, todo orden lleva
`id` como segundo criterio: sin él, dos filas con el mismo valor podrían cambiar
de página entre consultas y aparecer dos veces.

**El detalle no reescribe a la persona.** Se editan los campos de gestión
(prioridad, responsable, próxima acción, espacio, presupuesto). El asunto y el
mensaje que escribió quien envió el formulario **no se tocan**: son su testimonio.

**Aviso de posibles coincidencias.** Se muestran contactos con el mismo teléfono
normalizado o el mismo nombre y apellidos. Es solo un aviso: **no se fusiona
nada**. Decidir qué consentimiento y qué historial sobreviven a una fusión no es
algo que deba resolver una coincidencia de datos, y las solicitudes no se unen
nunca.

**Archivar no borra.** Una solicitud archivada desaparece de listados y tablero
pero sigue en la ficha del contacto y en la base de datos.

## 6. Seguimiento clientes (`/admin/pipeline`)

**Cinco fases desde la Fase 21: Contacto, Presentación, Propuesta, Cliente y
Perdida.** Antes eran nueve estados, y la reducción se hizo en el enumerado de la
base de datos —con migración— y no agrupando estados al pintar: el mismo campo lo
leen los informes, la exportación a Excel y el historial de cada persona, así que
dos vocabularios habrían dado dos respuestas a la misma pregunta.

**Solo tablero, y se mueve arrastrando** (Fase 20). La vista de tabla en
`?vista=tabla` y el desplegable «Mover a» se retiraron a petición del titular.
Esto **revierte** la decisión anterior, cuyo motivo era bueno: un tablero con
arrastre accesible exige alternativa de teclado, anuncios en vivo y manejo del
foco. Se implementó con esa alternativa en lugar de perderla:

- Cada tarjeta es enfocable con `Tab`.
- Con la tarjeta enfocada, `Ctrl`/`Cmd` más flecha izquierda o derecha la mueve a
  la fase válida anterior o siguiente. No ocupa un píxel de pantalla, que era la
  objeción al desplegable.
- Cada movimiento —arrastrado o por teclado— se anuncia en una región `aria-live`.
- Durante el arrastre solo se marcan como destino las columnas que la máquina de
  estados acepta, y las demás se atenúan.

La máquina de estados (`ALLOWED_TRANSITIONS` en `lib/domain/lead-requests.ts`):
`CLIENT` es terminal, `LOST` se reabre a `CONTACT`, y **se permite un paso hacia
atrás** (Presentación a Contacto, Propuesta a Presentación). Ese paso atrás no
existía con nueve estados porque `NURTURING` hacía de aparcamiento; sin él,
deshacer un arrastre equivocado obligaría a dar la solicitud por perdida y
reabrirla, con dos movimientos falsos en el historial.

Que una columna se pinte no es la garantía: **el servidor lo vuelve a comprobar**.
Hay una prueba que intenta ir de `CONTACT` a `CLIENT` con sesión ADMIN y verifica
que se rechaza.

Cada cambio de estado escribe, **en la misma transacción**, la `LeadActivity`
`STATUS_CHANGED` y un `AuditEvent`. No puede quedar una solicitud movida sin
rastro de quién la movió, ni un rastro de un movimiento que no ocurrió.

**`LOST` exige motivo**, y se exige dos veces: en el esquema Zod de la acción y
otra vez en el dominio. Marcar una solicitud como perdida sin decir por qué
destruye la única información útil de esa pérdida. El motivo se guarda en la
solicitud; en la auditoría solo va su longitud, para no duplicar texto libre.

## 7. Acciones (`/admin/tareas`)

Crear, asignar, editar, completar y cancelar. Cuelgan de un `Lead` y opcionalmente
se refieren a una `LeadRequest` concreta (el enlace queda en la actividad, de modo
que aparece en el historial de esa solicitud).

**La pantalla es una tabla que se edita en la propia celda** (Fase 21), sin las seis
pestañas de filtro que tenía. Cada campo guarda al modificarlo: el texto al salir
del campo o con Intro —guardar al teclear sería una petición por letra—, y los
desplegables y la fecha al cambiar. Cada cambio envía **la fila completa**, porque
el dominio valida la tarea entera; una acción por campo exigiría cuatro
validaciones parciales del mismo objeto.

Una acción cerrada se pinta como texto y no como desplegable, porque
`updateFollowUpTask` la rechaza: ofrecer un control que el servidor va a rechazar es
peor que no ofrecerlo. El estado de cada guardado se ve en la última columna y se
anuncia en una región `aria-live`, porque una tabla que guarda sola no da ninguna
otra señal.

El parámetro `vista` (mías, vencidas, hoy, semana, cerradas, todas) **sigue
funcionando sin interfaz que lo genere**: los anillos de Estatus Plataforma enlazan
aquí acotados, y cuando llega acotado se dice en una línea con salida a la vista
completa. `countTasksByView` se retiró con las pestañas: eran seis `count` por carga
de pantalla para poner un número entre paréntesis.

- **Completar registra actividad** en el historial del contacto: es trabajo
  comercial hecho y tiene que verse en el timeline, no solo en la lista de tareas.
- **Cancelar no borra.** Conserva la fila, su autor y su fecha; solo cambia de
  estado, y no se le inventa una fecha de finalización. El CRM tiene que poder
  responder a "¿qué se decidió no hacer y cuándo?".
- Una tarea cerrada no se reabre ni se edita.
- Una tarea no puede ligarse a una solicitud de otro contacto.

## 8. Notas

Internas: no se muestran a la persona y **no salen en la exportación salvo que se
pidan explícitamente**.

Se guardan como texto plano y se renderizan interpolándolas en JSX, que escapa por
sí solo. **No hay `dangerouslySetInnerHTML` en ninguna parte del CRM**: una nota
con `<script>` se lee como texto, que es lo que es. Límite de 4.000 caracteres.

Editar una nota se audita (autor, longitud anterior y nueva, nunca el cuerpo). Una
nota es la versión que alguien del equipo dio de una conversación; si se puede
cambiar sin rastro, deja de ser fiable.

## 9. Informes captación (`/admin/informes`)

Adquisición por `source`/`medium`/`campaign`/`content`, captación por biblioteca
(bodas reales / catering), fichas más consultadas, ratio de visitante identificado
a solicitud, pipeline del periodo, tiempos de respuesta y puntuación media. Con
filtro de fechas en la URL.

Las mismas reglas de datos vacíos del §3: cada sección con datos insuficientes dice
"no hay datos en este periodo" en lugar de pintar ceros.

## 10. Puntuación Visitantes (`/admin/configuracion`)

Pesos configurables en `scoring_rule`, editables solo por ADMIN desde
`/admin/configuracion` y con `AuditEvent` en cada cambio.

| Hito | Clave | Puntos |
|---|---|---|
| Acceso concedido por el gate | `VIP_ACCESS` | 10 |
| Teléfono informado | `PHONE_PROVIDED` | 10 |
| Fecha del evento informada | `EVENT_DATE_PROVIDED` | 10 |
| Invitados informados | `GUEST_COUNT_PROVIDED` | 10 |
| Tres o más fichas distintas consultadas | `CONTENT_VIEWED_3PLUS` | 10 (una sola vez) |
| Formulario enviado | `FORM_SUBMITTED` | 15 |
| Solicitud de visita | `VISIT_REQUESTED` | 25 |
| Descarga de dossier | `DOSSIER_DOWNLOAD` | 15 |

`DOSSIER_DOWNLOAD` no estaba en el enunciado de esta fase; existe desde la Fase 2
y se conserva.

**Idempotente por construcción.** `recalculateLeadScore` **recalcula desde cero**
leyendo el historial, no acumula sumando. De ahí que:

- el mismo hito no pueda contar dos veces: dos solicitudes siguen siendo un único
  "ha enviado un formulario", y recargar una ficha tres veces no la convierte en
  tres fichas distintas;
- un cambio de pesos se refleje en cada contacto en su siguiente movimiento, sin
  migraciones ni scripts.

Cambiar un peso no recalcula toda la base al instante: recorrer miles de contactos
dentro de una petición web sería peor que la ligera desactualización que esto deja.
Cada ficha tiene un botón para recalcular al momento.

## 11. Exportación a Excel

`GET /api/admin/crm/export?conjunto=contactos|solicitudes`, solo ADMIN
(`crm:export`). Devuelve un `.xlsx` generado con `exceljs`. Es un Route Handler
porque devuelve un archivo con sus cabeceras.

Es la salida más peligrosa del proyecto: sale del control de acceso de la
aplicación, se reenvía y se abre en un equipo cualquiera. De ahí:

- **Permiso propio.** Consultar el CRM (`crm:access`, que incluye SALES) no
  implica poder exportarlo. Probado: SALES recibe 403.
- **Lista blanca de columnas.** No se serializa una fila de Prisma; cada columna se
  declara a mano. Así una columna nueva del esquema —un hash, un token, una clave
  interna— no aparece por descuido. Probado: `submissionId` no sale.
- **La inyección de fórmulas dejó de ser posible al pasar de CSV a `.xlsx`**
  (Fase 20), y conviene entender por qué el problema desapareció en lugar de
  quedar saneado. En CSV, un valor que empiece por `=`, `+`, `-` o `@` lo
  interpreta Excel como fórmula al abrir el archivo, así que alguien podía
  escribir `=HYPERLINK(...)` en el asunto del formulario público y atacar a quien
  lo abriera; había que prefijar un apóstrofo en la primera posición de la celda.
  En `.xlsx` **la celda declara su tipo**: una cadena es una cadena aunque empiece
  por `=`. La prueba que antes verificaba que el valor se retocaba ahora verifica
  que llega íntegro.
- **Tipos reales.** Las fechas van como fechas y los números como números, así que
  se ordenan y se suman sin convertir columnas a mano. El BOM y el `;` que hacían
  falta en CSV para que Excel no rompiera los acentos dejaron de tener sentido.
- **Encabezado en negrita y fila fija**, y filtro automático solo cuando hay filas.
- **Mismos filtros que la pantalla**, parseados con los mismos validadores.
- **`Cache-Control: no-store`.**
- **Un `AuditEvent` por exportación** con quién, cuántas filas y qué filtros. El
  término de búsqueda **no** se guarda: puede ser el email de una persona.
- **Notas solo a petición** (`&notas=si`), y esa decisión queda en la auditoría.
- Tope de 5.000 filas por exportación.

La prueba **abre el libro descargado** con un lector independiente en vez de buscar
cadenas en el cuerpo de la respuesta, y no es un capricho: un `.xlsx` es un ZIP, así
que un `expect(texto).not.toContain("clave-interna")` sobre los bytes crudos pasaría
siempre, incluso si el dato estuviera dentro. Las comprobaciones de «esto no debe
salir» son justo las que no pueden depender de eso.

## 12. Rendimiento y datos personales

- **Nada se carga entero en cliente.** Todos los listados paginan en servidor y
  las métricas son agregados. Los componentes cliente reciben solo lo que pintan.
- **`no-store` en todo `/admin`** (lo pone el middleware) y también en la descarga
  de Excel. Ninguna página con datos personales se queda en una caché intermedia.
- **`noindex, nofollow, nocache`** en el layout del panel.
- **Índices** ya existentes que sostienen estas consultas: `lead(lifecycle)`,
  `lead(lastActivityAt)`, `lead_request(status, ownerId, nextActionAt)`,
  `lead_request(createdAt)`, `lead_request(leadId)`,
  `lead_request(utmSource, utmMedium, utmCampaign)`,
  `content_interaction(leadId, createdAt)` y
  `content_interaction(contentEntryId, createdAt)`.
- **Logs sin PII.** Ni las acciones ni el endpoint registran emails, teléfonos ni
  cuerpos; la auditoría guarda identificadores, estados y longitudes.
- **Estados de vacío, carga y error** en cada pantalla: los listados dicen que no
  hay coincidencias, los formularios muestran el error que devuelve el servidor y
  los botones se deshabilitan mientras la acción está en vuelo.

## 13. Accesibilidad y responsive

- Formularios de filtro con `<label>` asociado a cada campo y envío por GET.
- Tablas con `<caption>` en `sr-only` y `<th scope="col">`.
- Pastillas de periodo y de sección con `aria-current="page"`; secciones con
  `aria-labelledby`.
- Errores de acción en un `role="alert"`; el estado de guardado en `aria-live`.
- **El tablero se arrastra pero también se opera con teclado:** con una tarjeta
  enfocada, `Ctrl`/`Cmd` más flecha la mueve a la fase válida anterior o siguiente,
  y cada movimiento se anuncia. La instrucción está en la página, visible solo al
  recibir el foco.
- **Los iconos de acción llevan `title` y `aria-label`, con el título de la ficha
  dentro**: con seis filas hay seis botones «Editar», y sin el título son
  indistinguibles al navegar por controles.
- El bloque de filtros plegable es un `<details>` nativo: el rol y el estado
  expandido los da el navegador.
- **Las gráficas llevan `aria-hidden` y el dato va en la leyenda**, que es texto
  real con su cifra y su porcentaje. Un anillo no se puede leer en voz alta.
- Los listados anchos van en un contenedor con `overflow-x-auto`; el tablero se
  desplaza en horizontal sin romper la página. Comprobado sin desbordamiento
  horizontal en 360, 390, 768, 1024 y 1440 px.

**No verificado:** la revisión con un lector de pantalla real y en dispositivos
físicos queda pendiente (ver README §Limitaciones conocidas). Lo que sí se
comprueba en un navegador de verdad es la estructura: nombres accesibles, regiones
`aria-live`, contraste medido sobre los píxeles y ausencia de desbordes.
