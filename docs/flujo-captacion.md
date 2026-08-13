# Flujo de captación

Cómo llega una persona desde la web hasta el CRM. Amplía el resumen del README
§11 y el contrato HTTP de [`openapi.yaml`](openapi.yaml).

## 1. Puntos de entrada

| Origen | Componente | Qué produce | `sourceForm` |
|---|---|---|---|
| Formulario general de la home | `components/sections/contact.tsx` | `Lead` + `LeadRequest` + consentimientos | `contact-home` |
| CTA "Quiero una boda así" / "Quiero un catering así" | `components/vip/story-detail.tsx` → formulario de la home | `Lead` + `LeadRequest` con `sourceContentId` | `vip-story-cta` |
| Gate de acceso a las bibliotecas VIP | `components/vip/vip-gate.tsx` | `Lead` + `VipAccessSession` + consentimientos (**sin** `LeadRequest`) | — |
| Botón flotante de WhatsApp | `components/whatsapp-button.tsx` | nada: es un enlace externo | — |

El gate VIP y el formulario comercial son dos cosas distintas a propósito: el
gate captura un email para dar acceso a contenido, no una petición de
presupuesto. Comparten el `Lead` (mismo email normalizado, una sola persona) pero
solo el formulario genera `LeadRequest`. Ver [`gate-vip.md`](gate-vip.md).

## 2. Del CTA de una ficha al formulario

El CTA de una ficha VIP no abre un formulario propio. Enlaza al de la home con
dos parámetros:

```
/?tipo=WEDDING&ficha=<id de la ContentEntry>#contacto
```

Al montarse, el formulario lee esos parámetros de `window.location` —una sola
vez, para no pisar lo que la persona escriba después— y:

- preselecciona el tipo de evento (`WEDDING` en bodas, `EXTERNAL_CATERING` en
  catering, como valor de partida razonable y editable);
- sugiere como asunto el propio texto del botón que se acaba de pulsar;
- guarda el id de la ficha para enviarlo como `sourceContentId`, y marca el
  origen como `vip-story-cta`.

Se lee de `window` y no con `useSearchParams()` deliberadamente: ese hook
obligaría a envolver la sección en un `<Suspense>` y sacaría el formulario del
HTML estático de la home, que es contenido que interesa que esté indexado.

El servidor **no se cree** el `sourceContentId`: comprueba que corresponde a una
`ContentEntry` en estado `PUBLISHED`. Si no existe o no está publicada, lo
descarta y guarda la solicitud sin atribución de ficha. Perder el origen es
preferible a perder el lead.

## 3. Recorrido de un envío

```
contact.tsx  (valida con leadRequestFormSchema)
   │
   └─ lib/leads.ts  submitLeadRequest()
        · añade atribución (UTMs, referrer, ruta), policyVersion y submissionId
        │
        └─ POST /api/leads/requests
             1. mismo origen (si llega cabecera Origin)
             2. Content-Type: application/json
             3. tamaño de cuerpo ≤ 32 KiB
             4. leadRequestSchema (esquema compartido con el formulario)
             5. policyVersion == versión vigente en servidor
             6. honeypot vacío           → si no: 202 sin guardar nada
             7. formElapsedMs ≥ 3000 ms  → si no: 400 too-fast
             8. rate limit por IP y por email
             9. sourceContentId verificado contra contenido publicado
            10. createLeadRequest()  ── una sola transacción ──
                  · Lead: upsert por email normalizado
                  · LeadRequest: create SIEMPRE (nunca update)
                  · ConsentEvent PRIVACY (+ MARKETING si se concede)
                  · LeadActivity FORM_SUBMITTED
            11. recalculateLeadScore()  (tras el commit)
            12. notifyNewLeadRequest()  (tras el commit, sin await)
```

La interfaz nunca habla con Prisma. El orden de las comprobaciones va de lo
barato a lo caro para que un bot no consuma consultas: todo lo que puede
rechazarse sin tocar la base de datos se rechaza antes.

## 4. Atribución: first touch y last touch

- `Lead.firstSource` se escribe **solo al crear** el `Lead`. Ninguna solicitud
  posterior lo sobrescribe: es el canal que trajo a esa persona por primera vez.
- `Lead.lastSource` se actualiza en cada solicitud.
- La atribución detallada de cada petición vive en la propia `LeadRequest`
  (`sourcePage`, `sourceForm`, `sourceContentId`, `referrer`, `utmSource`,
  `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`), así que dos solicitudes
  del mismo email pueden tener orígenes distintos sin perder ninguno.
- Los datos de contacto sí se refrescan con lo último que la persona escribió
  (es información más reciente y más completa), pero un campo que llega vacío no
  borra el que ya había.

## 5. Consentimientos

Privacidad y marketing son dos decisiones separadas, las dos desmarcadas de
origen:

- **Privacidad**: obligatoria, con enlace a la política. Sin ella no se guarda
  nada — ni el `Lead`.
- **Marketing**: opcional. No se exige para enviar.

Cada concesión es un `ConsentEvent` inmutable con la `policyVersion` aceptada. El
historial no se destruye nunca: una revocación es un evento nuevo con
`granted=false`, no un `UPDATE`.

Decisión que conviene tener presente: **una casilla de marketing sin marcar no
genera un evento `granted=false`**. Si lo generara, alguien que concedió
marketing en el gate VIP y luego rellena el formulario de contacto sin marcar la
casilla vería revocado su consentimiento, y dejar una casilla vacía en un
formulario de contacto no es una petición de baja. Las bajas se modelarán como un
evento explícito desde el CRM.

La `policyVersion` la valida el servidor contra `PRIVACY_POLICY_VERSION`
(`lib/legal.ts`). Si alguien tenía la página abierta desde antes de un cambio de
política, el envío se rechaza con 409 y se le pide recargar: el consentimiento
que enviaría no sería el del texto vigente.

## 6. Antispam

| Medida | Dónde | Comportamiento |
|---|---|---|
| Honeypot | campo `honeypot`, oculto y fuera del recorrido de teclado | Responde 202, indistinguible de un éxito. No guarda nada |
| Tiempo mínimo | `formElapsedMs` ≥ 3000 ms | 400 `too-fast`, recuperable: reenviar funciona |
| Rate limit IP | 5 envíos / 15 min | 429 `rate-limited` |
| Rate limit email | 3 envíos / 60 min | 429 `rate-limited` |
| Tamaño de cuerpo | 32 KiB | 413 `payload-too-large` |
| Mismo origen | cabecera `Origin` vs `host` | 403 `invalid-request` |
| Idempotencia | `submissionId` único | Un doble clic crea una sola solicitud |

Los contadores de rate limit se guardan en `rate_limit_counter` con la clave
**hasheada con HMAC**: la tabla nunca contiene una IP ni un email en claro. El
incremento es atómico, así que dos peticiones simultáneas no pueden colarse
leyendo el mismo valor previo.

No hay CAPTCHA. Se ha descartado mientras no haya abuso demostrado: añade
fricción y dependencia de un tercero antes de saber si hace falta.

El honeypot y el tiempo mínimo se tratan distinto a propósito. Un honeypot solo
lo rellena un automatismo, así que se le miente. Un envío rápido puede ser una
persona con autocompletado, así que se le da un error que puede resolver
reenviando.

## 7. Idempotencia del doble envío

El formulario genera una `submissionId` por intento:

- **Envío correcto** → clave nueva, porque la siguiente será otra solicitud.
- **Envío con error** → se conserva la misma clave. Así, si la primera petición
  llegó a guardarse y solo se perdió la respuesta, el reintento no crea una
  solicitud duplicada: el servidor reconoce la clave y responde 200 con
  `duplicate: true`.

En el servidor la garantía es el índice único de `LeadRequest.submissionId`. Hay
una comprobación previa por rapidez, pero la que de verdad protege es el índice:
si dos peticiones simultáneas la esquivan, una gana el insert y la otra recibe
`P2002`, busca la fila existente y la devuelve como duplicada.

## 8. Aviso interno por email

`lib/notifications/lead-request-notification.ts` se invoca **después** del commit
y **después de responder al visitante**, a través de `runAfterResponse`
(`after()` de Next.js, no un `void promise`: ver `docs/email.md` §3). Su regla es
que no puede hacer fallar un envío de formulario.

Los estados que deja en `NotificationLog` son cuatro, y se corresponden con
situaciones distintas a propósito:

| Estado | Cuándo | Qué significa |
|---|---|---|
| `SENT` | El proveedor aceptó el mensaje | **No** promete bandeja de entrada |
| `SKIPPED_CONFIG` | Falta `SENDGRID_API_KEY` o `LEADS_FROM_EMAIL` | No es un error: no había transporte |
| `RETRY_PENDING` | Timeout, 429 o 5xx | Fallo transitorio que merecería reintento. **Nada lo reintenta** |
| `FAILED` | 4xx del proveedor | Reintentar no arreglaría nada |

Dos avisos de configuración, porque son el error más frecuente al desplegar:

- Las variables son **`LEADS_FROM_EMAIL`** y **`LEADS_NOTIFICATION_TO`**, en
  plural. La versión anterior de este documento decía `LEAD_NOTIFICATION_TO`, que
  se renombró en la Fase 8 y **ya no existe**: configurarla no hace nada, y cada
  aviso quedaría como `SKIPPED_CONFIG` sin que la interfaz lo advirtiera.
- Hacen falta **las dos** junto con la clave. Con la clave y sin remitente
  verificado, SendGrid rechazaría el envío.

El transporte real está implementado desde la Fase 8 (`lib/email/sendgrid.ts`).
Detalle completo, plantillas y clasificación de respuestas del proveedor:
**`docs/email.md`**.

Y dos cosas que no cambian:

- El cuerpo del aviso escapa el texto libre con `escapeHtml`, porque ahí no hay
  JSX que lo haga por nosotros.
- `NotificationLog` guarda un motivo corto y sin datos personales: nunca el
  cuerpo, el asunto, la clave de API ni el destinatario completo —solo
  enmascarado—.

## 9. Texto libre: qué se guarda y cómo se muestra

El texto que escribe una persona **no se transforma al guardarlo**. Si escribe
`<script>` o comillas, eso es lo que quiso escribir y eso es lo que debe leer el
equipo comercial. La defensa contra inyección está en la salida:

- en la interfaz, React/JSX escapa cualquier cadena interpolada;
- fuera de JSX (email, CSV, cabeceras) hay que escapar con `escapeHtml`;
- las consultas van por Prisma con parámetros, nunca concatenando SQL.

La única limpieza previa es la de caracteres de control, y por un motivo técnico
concreto: PostgreSQL rechaza el byte NUL en columnas de texto. Se conservan
saltos de línea y tabuladores.

## 10. Qué se retiró

- `submitLead()` contra `https://api.web3forms.com/submit` desde el navegador.
- La variable `NEXT_PUBLIC_WEB3FORMS_KEY` (eliminada de `.env.example`).
- El estado `not-configured` del formulario, que existía solo porque el envío
  dependía de una clave de un tercero.
- La afirmación de la política de privacidad de que Web3Forms procesaba los
  datos. El apartado queda marcado como **pendiente de revisión jurídica**: el
  texto describe el tratamiento técnico real, pero la redacción legal definitiva
  la tiene que validar un profesional.
