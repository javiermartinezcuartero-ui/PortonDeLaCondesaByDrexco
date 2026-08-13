# Email transaccional

Avisos por correo del proyecto. Amplía el README §CRM, pipeline, tareas e informes y se apoya en la captación de
[`flujo-captacion.md`](flujo-captacion.md) y el CRM de [`crm.md`](crm.md).

## 1. El principio, y lo que implica

**La base de datos es la fuente de verdad. El correo es un efecto secundario.**

Guardar un lead o una solicitud no depende de que SendGrid responda. De ahí se
derivan todas las decisiones de este módulo:

- el envío ocurre **después** del commit y **después** de responder al visitante;
- ninguna función de `lib/notifications/` lanza: devuelven estado;
- un fallo de correo no borra datos, no revierte nada y **no produce un error falso**
  para quien envió el formulario;
- lo que no se pudo enviar queda registrado con un estado que dice exactamente qué
  pasó, en lugar de desaparecer.

## 2. Arquitectura

```
Route Handler / script
        │
        └─ runAfterResponse(...)          lib/notifications/after-response.ts
              │
              └─ notifyNewLeadRequest()   lib/notifications/lead-request-notification.ts
                   ├─ plantilla           lib/email/templates.ts
                   ├─ proveedor           lib/email/index.ts → resolveEmailProvider()
                   │    ├─ SendGridEmailProvider      (con credenciales)
                   │    └─ DevelopmentEmailProvider   (sin credenciales)
                   └─ registro            lib/notifications/record.ts → NotificationLog
```

La aplicación habla con la interfaz `EmailProvider` (`lib/email/provider.ts`) y
nunca con SendGrid directamente. Eso es lo que permite cambiar de proveedor —o no
tener ninguno— sin tocar el dominio ni la captación.

Dos reglas del contrato:

1. **`send` no lanza.** Devuelve siempre un resultado, incluido el fallo. Un
   proveedor que lanzara obligaría a cada llamante a envolverlo en `try/catch`, y el
   día que alguien lo olvidara un correo caído se llevaría por delante una operación
   ya guardada. Las capas de notificación ponen su propio `try/catch` de todas
   formas, por si un adaptador futuro incumple el contrato.
2. **Los estados del resultado son los de `NotificationLog`, uno a uno.** Sin
   traducción intermedia donde perder matices: lo que decide el adaptador es
   exactamente lo que queda registrado.

## 3. Envío después de responder: `after()`

`lib/notifications/after-response.ts` usa `after()` de Next.js, que es el mecanismo
correcto en Vercel: mantiene viva la invocación serverless hasta que el trabajo
termina, sin retrasar la respuesta.

La alternativa habitual —lanzar la promesa con `void` y no esperarla— parece
equivalente y no lo es: en cuanto la función devuelve la respuesta, la plataforma
puede congelarla, y el envío queda a medias **sin dejar rastro**. Ese es justo el
fallo silencioso que este proyecto no quiere.

`after()` solo funciona dentro del ámbito de una petición de Next. Fuera de él (un
script de consola, un test que invoca el Route Handler directamente) lanza, y
entonces el trabajo se ejecuta sin más: en esos contextos no hay respuesta que no
bloquear ni función que se congele. Ese respaldo está explícito en el código.

## 4. Variables

| Variable | Uso | Si falta |
|---|---|---|
| `SENDGRID_API_KEY` | Credencial del proveedor | No hay transporte: `SKIPPED_CONFIG` |
| `LEADS_FROM_EMAIL` | Remitente verificado en SendGrid | No hay transporte: `SKIPPED_CONFIG` |
| `LEADS_NOTIFICATION_TO` | Destinatarios internos, separados por comas | No se envía el aviso interno |
| `SEND_LEAD_ACKNOWLEDGEMENT` | `"true"` activa el acuse al visitante | El acuse queda desactivado |
| `NEXT_PUBLIC_SITE_URL` | Base de los enlaces al panel, sin barra final | Se usa `http://localhost:3000` |

Detalles que importan:

- **Hacen falta clave y remitente**, las dos, para considerar que hay transporte. Con
  solo la clave, SendGrid rechazaría el envío por falta de remitente verificado, así
  que tener media configuración cuenta como no tenerla.
- **Solo el valor exacto `"true"`** activa el acuse. `"1"`, `"si"` o `"TRUE"` lo dejan
  apagado: escribir a un visitante es una decisión que se toma a propósito, no algo
  que se herede de un valor mal escrito.
- `NEXT_PUBLIC_SITE_URL` es la **única** variable pública del proyecto, y lo es porque
  una URL de sitio no es un secreto. La clave de API vive tras `import "server-only"`:
  si alguien la importara desde un componente cliente, el build falla.

## 5. Los cuatro casos

### 5.1 Aviso interno de solicitud nueva — **activo**

Se dispara desde `POST /api/leads/requests` con `runAfterResponse`, solo cuando la
solicitud es nueva (un reenvío idempotente no genera un segundo aviso).

Lleva `reply_to` con el email de la persona: responder desde el correo escribe a
quien preguntó, no al buzón de avisos.

**El enlace apunta al detalle protegido del CRM y no lleva token.** Quien abra el
correo tendrá que iniciar sesión. Un enlace con token en un correo es un acceso
permanente a datos personales para cualquiera que reenvíe el mensaje, y no hace
falta para que el equipo llegue a su propio panel.

### 5.2 Acuse al visitante — **activo si `SEND_LEAD_ACKNOWLEDGEMENT=true`**

Es un correo **transaccional**: responde a una acción que la persona acaba de hacer,
así que no necesita consentimiento de marketing.

Precisamente por eso, **sin ese consentimiento el correo solo confirma la
recepción**: ni novedades, ni catálogo, ni invitación a nada. Colar contenido
promocional en un acuse es exactamente la forma de convertir una base legal
transaccional en un envío comercial no consentido. Con consentimiento concedido, el
acuse añade una línea sobre novedades y cómo dejar de recibirlas.

El consentimiento se comprueba mirando el **último** evento de `MARKETING`, no si
existe alguno concedido: el día que se registren revocaciones, la consulta ya
responde bien sin tocarla. Ante cualquier error de lectura devuelve `false`: no
saber si hay consentimiento equivale a no tenerlo.

El acuse **no** incluye enlaces al panel: el visitante no tiene nada que hacer ahí.

### 5.3 Aviso de tareas vencidas — **implementado, no automático**

`lib/notifications/overdue-tasks.ts` envía **un resumen** (no un correo por tarea) de
las tareas `PENDING` con fecha pasada, con una ventana de silencio de 20 horas para
no repetirlo.

**Nada lo ejecuta solo.** Se dispara con `npm run notify:overdue`. El proyecto no
tiene programador y esta fase no añade cola ni cron, así que decir que el aviso es
"diario" sería fingir una fiabilidad que no existe. Ver §7.

No se ha expuesto como endpoint HTTP a propósito: una ruta que envía correos sin
exigir sesión es una vía de abuso, y protegerla con un secreto compartido es una
decisión de despliegue que corresponde a la fase de endurecimiento.

### 5.4 Verificación del email de acceso VIP — **preparada, no activa**

`buildVipVerificationEmail` existe y está probada, pero **nada la invoca**. El gate
concede acceso inmediato tras capturar el email (decisión de la Fase 5, ver
[`gate-vip.md`](gate-vip.md) §3); esto es la mitad que se puede escribir y verificar
hoy sin flujo vivo.

Para activarla harían falta tres piezas que no existen:

1. una ruta que consuma el enlace, valide el token contra `Verification` y cree la
   `VipAccessSession` **solo entonces**;
2. que el gate deje de conceder acceso al enviar el formulario y pase a "revisa tu
   correo";
3. caducidad corta del enlace y límite de reenvíos.

A diferencia del enlace al CRM, este **sí** lleva token: es su único propósito, y por
eso la ruta que lo consuma tendrá que invalidarlo en el primer uso.

## 6. Estados en `NotificationLog`

| Estado | Significa | Cuándo |
|---|---|---|
| `SENT` | El proveedor aceptó el mensaje | HTTP 202 de SendGrid |
| `SKIPPED_CONFIG` | No se intentó por falta de configuración | Sin clave, sin remitente o sin destinatarios |
| `RETRY_PENDING` | Fallo transitorio; merecería reintento | Timeout, 429, 5xx, error de red |
| `FAILED` | Fallo permanente; reintentar no arreglaría nada | Otros 4xx, o excepción del adaptador |
| `PENDING` | Valor por defecto de la columna | No lo produce ningún camino del código: una fila aquí sería un fallo |

`SENT` significa que SendGrid aceptó y encoló, **no** que el correo llegara a una
bandeja. El registro no afirma más de lo que sabe.

El adaptador de desarrollo devuelve `SKIPPED_CONFIG`, no `SENT`. Si devolviera
`SENT`, el registro afirmaría que un correo salió cuando no salió, y esa mentira
sería peor que no tener correo.

### Lo que se guarda y lo que no

- **Sí:** plantilla, proveedor (`sendgrid`/`development`), estado, motivo corto del
  fallo, y destinatarios **parcialmente ocultos** (`an***a@example.test`).
- **No:** el cuerpo del mensaje, el asunto (puede llevar el texto que escribió una
  persona), la clave de API, ni la dirección completa.

El enmascarado conserva el dominio y la primera letra: es lo que permite
diagnosticar ("se intentó a un gmail, no al buzón interno") sin guardar a quién se
escribió. Con una parte local de uno o dos caracteres se oculta entera, porque no
queda nada que revelar a medias.

`leadId` es opcional en `NotificationLog` desde esta fase: el resumen de tareas
vencidas habla de varios contactos y no pertenece a ninguno.

### En desarrollo

Sin credenciales, el adaptador de desarrollo escribe una línea por consola con
plantilla, asunto, destinatarios enmascarados y tamaño del cuerpo. **No imprime el
correo completo**: el cuerpo de un aviso comercial contiene el mensaje que escribió
una persona, con su nombre y su teléfono, y un log de desarrollo se copia en
incidencias, se pega en chats y acaba en sitios que nadie previó. Para revisar cómo
queda una plantilla están sus pruebas, que sí trabajan con el HTML completo en
memoria.

## 7. Lo que esta fase **no** garantiza

**No hay entrega garantizada.** Un `RETRY_PENDING` describe un fallo que merecería
reintento; **nada lo reintenta**. Si SendGrid está caído tres minutos, ese aviso no
sale, y lo único que queda es la fila en `NotificationLog` diciéndolo.

Esto es deliberado: el enunciado de la fase pide no añadir cola externa, y montar
media cola —un reintento en memoria, un `setTimeout`— daría una sensación de
fiabilidad sin la fiabilidad. Es mejor un fallo visible que un fallo disimulado.

Para tener entrega garantizada de verdad haría falta, como evolución:

1. **Un programador** (Vercel Cron, GitHub Actions o equivalente) que ejecute un
   proceso de reintento sobre las filas en `RETRY_PENDING`, con backoff y un tope de
   intentos.
2. **Idempotencia por aviso**: hoy la única protección contra duplicados es la
   ventana de silencio del resumen. Un reintento necesitaría una clave por mensaje
   para no enviar dos veces lo mismo.
3. **El mismo programador** serviría para automatizar el resumen de tareas vencidas
   (§5.3), que hoy es manual.
4. **Webhooks de SendGrid** (`delivered`, `bounce`, `spamreport`) si se quiere saber
   qué pasó *después* de que el proveedor aceptara el mensaje. Hoy `SENT` es lo último
   que el sistema sabe.

Ninguna de las cuatro está hecha, y el código no finge que lo esté.

## 8. Pruebas

| Archivo | Cubre |
|---|---|
| `lib/email/config.test.ts` | Enmascarado (nunca devuelve la dirección completa), lectura de variables, `"true"` como único activador, parseo de destinatarios, y **selección del proveedor** con y sin credenciales |
| `lib/email/sendgrid.test.ts` | Clasificación 202/429/5xx/4xx/timeout/red, timeout presente en la petición, texto plano antes del HTML, `reply_to` opcional, y que ni el motivo del fallo ni el resultado contengan la clave o el cuerpo. También que el adaptador de desarrollo no imprima cuerpo ni dirección completa |
| `lib/email/templates.test.ts` | Enlace al CRM sin token, escapado del texto libre, acuse sin marketing que solo confirma recepción, acuse con marketing y cómo darse de baja, sin promesas de plazos, y accesibilidad de las cuatro plantillas (texto plano, `lang`, `h1`, `role="presentation"`, `th scope="row"`, `max-width`, sin imágenes) |
| `lib/notifications/lead-request-notification.test.ts` | Envío correcto, sin configurar, **fallo después de guardar** (transitorio, permanente y excepción del adaptador, comprobando que la solicitud sigue intacta), acuse activado y desactivado, marketing concedido y revocado, y que el registro no guarde cuerpo, asunto, clave ni direcciones completas |
| `lib/notifications/overdue-tasks.test.ts` | Sin destinatarios, sin tareas, resumen único, ventana de silencio y su expiración, sin proveedor, fallo del proveedor sin tocar el CRM, y enlace a la vista de vencidas |

El registro del aviso **no** se comprueba desde el test del endpoint: allí el envío
sale por `runAfterResponse` y puede escribirse después de que el test termine, así
que afirmar sobre él sería intermitente. El endpoint comprueba lo que le toca —que
responde 201 y que la solicitud queda guardada aunque el correo falle— y el estado
del envío se prueba en los archivos de notificación.
