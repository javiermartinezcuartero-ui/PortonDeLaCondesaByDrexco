# Modelo de amenazas

Qué hay que proteger en este proyecto, de quién, por dónde puede entrar y qué lo
frena. Se revisa al cerrar cada fase que toque datos o autorización.

Este documento no es un inventario de buenas intenciones: cada mitigación apunta al
archivo que la implementa y, cuando existe, a la prueba que la comprueba. Lo que no
está mitigado aparece en §7 como riesgo aceptado, no escondido.

## 1. Activos

Ordenados por lo que costaría perderlos.

| Activo | Dónde vive | Por qué importa |
|---|---|---|
| **Datos de contacto de visitantes** (email, nombre, teléfono) | `lead` en PostgreSQL | Datos personales de terceros. Una fuga es un incidente RGPD, no un fallo técnico |
| **Texto libre de las solicitudes** | `lead_request.message`, `subject` | Lo escribe la persona y suele contener más datos de los que pide el formulario |
| **Notas internas del equipo** | `lead_note` | Opiniones sobre personas identificadas. Su filtración es peor que la de un email |
| **Consentimientos** | `consent_event` | Son la prueba de que el tratamiento es legítimo. Sin ellos, todo lo demás es ilícito |
| **Credenciales del equipo** | `account.password` (hash), `session` | Dan acceso a todo el CRM |
| **Claves de infraestructura** | `.env` (Supabase service role, `BETTER_AUTH_SECRET`, secretos HMAC, SendGrid) | La service role de Supabase salta el control de acceso de la base de datos entera |
| **Contenido VIP no publicado** | `content_entry`, bucket `vip-content` | Es el activo comercial del negocio y la razón de existir del gate |
| **Tokens de acceso VIP** | `vip_access_session.tokenHash` | Solo el hash. El token en claro únicamente en la cookie del visitante |

## 2. Actores

| Actor | Capacidades | Motivación plausible |
|---|---|---|
| **Visitante anónimo** | HTTP público, formularios, cookies propias | Ver el contenido VIP sin dejar su email |
| **Bot automatizado** | Peticiones masivas sin navegador | Spam de formularios, rascado de contenido |
| **Visitante con acceso VIP** | Cookie válida | Ver contenido de otras secciones, o acceder tras una revocación |
| **Usuario CONTENT** | Sesión válida, panel de contenidos | Curiosidad sobre datos de clientes que no le corresponden |
| **Usuario SALES** | Sesión válida, CRM completo | Sacarse una copia de la base de clientes antes de irse |
| **Atacante con un enlace filtrado** | Un correo reenviado, una URL compartida | Entrar al CRM o a una ficha sin credenciales |
| **Atacante con acceso al repositorio** | Código y su historial | Buscar credenciales versionadas |
| **Proveedor de infraestructura** | Supabase, Vercel, SendGrid | No es adversario, pero es superficie: un incidente suyo es un incidente nuestro |

## 3. Límites de confianza

```
┌─ Navegador del visitante ──────────────────── NADA de aquí se confía
│  cookie VIP (solo un token opaco), formularios, parámetros de URL
└──────────────┬─────────────────────────────────────────────────────
               │  HTTPS · cabeceras de seguridad · CSP
┌──────────────▼─ Aplicación en Vercel ─────────── frontera principal
│  Route Handlers, Server Actions, Server Components
│  · valida TODO de nuevo en servidor
│  · resuelve sesión y rol contra la base de datos en cada operación
└──────────────┬─────────────────────────────────────────────────────
               │  claves solo de servidor (`import "server-only"`)
┌──────────────▼─ Supabase ──────────────────────────────────────────
│  PostgreSQL (Prisma, consultas parametrizadas)
│  Storage: bucket PRIVADO, acceso solo con service role desde servidor
└────────────────────────────────────────────────────────────────────
               │  servidor a servidor, nunca desde el navegador
┌──────────────▼─ SendGrid (si está configurado) ────────────────────
```

Tres cruces de frontera merecen atención especial:

1. **Navegador → aplicación.** El middleware mira si existe la cookie de sesión, y
   eso **no autoriza nada**: cada página, Route Handler y Server Action vuelve a
   resolver la sesión contra la base de datos. Esconder un enlace no protege un
   endpoint.
2. **Aplicación → Storage.** El bucket es privado y la clave privilegiada nunca sale
   de servidor. El navegador solo recibe URLs firmadas y temporales.
3. **Aplicación → SendGrid.** Un correo nunca puede afectar a lo ya guardado: se
   envía después del commit y su fallo solo produce un registro.

## 4. Amenazas y mitigaciones

### 4.1 Acceso al contenido VIP sin dejar el email

| Amenaza | Mitigación | Prueba |
|---|---|---|
| Leer el contenido en el HTML tras un desenfoque de cliente | La sesión se valida **antes** de consultar cualquier ficha; sin sesión no se consulta ni se serializa nada | `components/vip/access-boundary.test.tsx` espía la capa de datos y comprueba que no se llama |
| Inventarse una cookie | El token se compara contra su HMAC almacenado, con comparación de tiempo constante | `attack-surface.test.ts` → "un token inventado no resuelve ningún contacto" |
| Usar el hash de la base de datos como token | El valor guardado es el hash del token, no el token | idem → "el hash almacenado no sirve como token" |
| Reutilizar una cookie caducada o revocada | La consulta filtra por `revokedAt: null` y `expiresAt > now` | idem → "una sesión caducada o revocada no vale" |
| Seguir dentro después de una revocación | La revocación es de servidor: la cookie sigue en el navegador y deja de valer | idem → "revocar deja inservible una cookie que ya estaba en el navegador" |
| Acceder por el slug directo | El slug exige sesión igual que el listado | `lib/vip/gate-failure.test.ts` |

### 4.2 Escalada de privilegios (OWASP A01 — Broken Access Control)

| Amenaza | Mitigación | Prueba |
|---|---|---|
| Llamar a una Server Action sin pasar por su pantalla | Cada acción empieza por `requirePermission` y no toca datos si falla | `crm-actions.test.ts`, `attack-surface.test.ts` |
| Declarar un rol por cabecera, cuerpo o cookie | El rol se lee de la sesión de servidor; `role` tiene `input: false` en Better Auth | `attack-surface.test.ts` → "manipulación de rol" |
| CONTENT accediendo a datos personales | `crm:access` no incluye CONTENT; el acceso directo devuelve 403 en API y 404 en páginas | idem → "CONTENT no obtiene PII por ninguna de las vías" |
| SALES sacándose la base de clientes | Exportar es `crm:export`, **solo ADMIN**, y deja `AuditEvent` | `app/api/admin/crm/export/route.test.ts` |
| SALES publicando contenido o administrando usuarios | `cms:access` y `users:manage` no lo incluyen | `usuarios/actions.test.ts`, `contenidos/actions.test.ts` |
| Enumerar apartados por la respuesta | Sin permiso, las páginas devuelven **404 y no 403**: un 403 confirmaría que existen | verificación E2E de la Fase 7 (39/39) |

### 4.3 Inyección y contenido hostil (OWASP A03)

| Amenaza | Mitigación | Prueba |
|---|---|---|
| SQL injection | Prisma con consultas parametrizadas; el único `$queryRaw` es un `SELECT 1` sin interpolación | — |
| XSS almacenado desde un formulario | El texto se guarda sin transformar y **se escapa en la salida**: JSX escapa solo y no hay `dangerouslySetInnerHTML` en el proyecto | `attack-surface.test.ts` → "el HTML y el script se guardan como texto" |
| XSS en el cuerpo de un correo | `escapeHtml` en cada valor de las plantillas (ahí no hay JSX) | `lib/email/templates.test.ts` |
| CSV injection al abrir una exportación | Los valores que empiezan por `=`, `+`, `-` o `@` se prefijan con apóstrofo en la primera posición de la celda | `lib/domain/crm-export.test.ts` |
| Caracteres de control que rompan la transacción | Se eliminan los C0/C1 antes de persistir (PostgreSQL rechaza NUL) | `lib/security/text.test.ts` |

### 4.4 SSRF y URLs externas (OWASP A10)

| Amenaza | Mitigación | Prueba |
|---|---|---|
| Vídeo externo apuntando a un servicio interno | Lista blanca de hosts, solo `https`, y bloqueo de loopback, redes privadas, CGNAT, link-local y `169.254.169.254` | `lib/storage/external-url.test.ts` (13 destinos internos) |
| Open redirect | El `returnPath` del gate solo admite rutas internas; el login redirige a `/admin` fijo, sin parámetro de destino | `lib/validation/vip-gate.test.ts` |

### 4.5 Subida de archivos

| Amenaza | Mitigación | Prueba |
|---|---|---|
| Ejecutable renombrado a `.png` | Validación por **firma real de bytes**, no por extensión ni MIME declarado | `lib/storage/validate-image.test.ts` |
| Nombre de archivo malicioso | El nombre del objeto lo genera el servidor (UUID) | `lib/storage/object-name.ts` |
| Agotar el almacenamiento | Límite de 10 MB por imagen y límites reconciliados en el bucket | `scripts/ensure-storage-bucket.ts` |
| Listar el bucket | Bucket privado; no hay ningún endpoint que liste objetos | — |
| Borrar un objeto que otra ficha usa | El borrado comprueba referencias antes de tocar Storage | `lib/domain/content-media.test.ts` |

### 4.6 Autenticación (OWASP A07)

| Amenaza | Mitigación |
|---|---|
| Fuerza bruta en el login | Rate limit persistente de Better Auth (3 intentos/10 s en `/sign-in`), activo también fuera de producción |
| Enumeración de usuarios | El mensaje de error es idéntico exista o no el email |
| Alta pública | `disableSignUp: true`; el primer ADMIN se crea por script |
| Contraseñas débiles | Mínimo de 12 caracteres, hash por defecto de Better Auth (scrypt) |
| Robo de cookie de sesión | `HttpOnly`, `SameSite=Lax`, `Secure` en producción; CSRF/origen de Better Auth sin desactivar |
| Sesión que sobrevive al logout | El logout revoca en servidor, no solo borra la cookie |

### 4.7 Abuso de formularios

| Amenaza | Mitigación | Prueba |
|---|---|---|
| Spam automatizado | Honeypot con aceptación silenciosa + tiempo mínimo de formulario | `app/api/leads/requests/route.test.ts` |
| Inundación de solicitudes | Rate limit persistente por IP (5/15 min) y por email (3/60 min), con la clave hasheada | `attack-surface.test.ts` → "el rate limit por IP corta la repetición" |
| Payload gigante | Límite de 32 KiB comprobado por cabecera **y** sobre el cuerpo leído | idem → "un payload enorme se rechaza sin llegar a la base de datos" |
| Envío desde otro sitio | Validación de mismo origen cuando llega la cabecera `Origin` | idem |
| Duplicados por doble clic | Índice único en `submissionId` | `route.test.ts` |

### 4.8 Fuga de datos por canales laterales

| Amenaza | Mitigación | Prueba |
|---|---|---|
| PII en logs | Registro estructurado que **omite por nombre de clave** email, teléfono, nombre, mensajes, notas, tokens, IP y user-agent | `lib/observability/log.test.ts` |
| Stack en producción | `logError` nunca registra el stack; las respuestas devuelven códigos operativos | idem, y `attack-surface.test.ts` |
| PII en auditoría | `sanitizeMetadata` descarta claves sensibles y trunca; el motivo de pérdida se guarda solo por longitud | `lib/domain/crm.test.ts` |
| PII en caché intermedia | `no-store` en todo `/admin` (middleware) y en cada descarga | `attack-surface.test.ts` → "caché y healthcheck" |
| Indexación de contenido privado | `noindex` en admin, preview y VIP; sitemap sin slugs VIP | `lib/vip/metadata.test.ts` |
| Healthcheck que habla demasiado | Devuelve `{ status: "ok" }` y nada más: ni versiones, ni configuración, ni excepciones | idem |
| Referer que filtra rutas privadas | `Referrer-Policy: strict-origin-when-cross-origin` | `lib/security/headers.test.ts` |
| Credenciales en el repositorio | Escáner de secretos sobre los archivos que git subiría | `lib/security/secrets-scan.test.ts` |
| Secreto en una variable pública | El escáner comprueba que la única `NEXT_PUBLIC_` es `NEXT_PUBLIC_SITE_URL` | idem |

### 4.9 Configuración (OWASP A05)

| Amenaza | Mitigación | Prueba |
|---|---|---|
| Clickjacking | `frame-ancestors 'none'` y `X-Frame-Options: DENY` | `headers.test.ts` |
| Sniffing de tipo de contenido | `X-Content-Type-Options: nosniff` | idem |
| Carga de scripts de terceros | CSP con `default-src 'self'` y sin comodines | idem |
| Fingerprinting de versión | `poweredByHeader: false`; el healthcheck no publica versiones | idem |
| Permisos de navegador innecesarios | `Permissions-Policy` cierra cámara, micrófono, geolocalización y pagos | idem |

## 5. OWASP Top 10 — cobertura

| Categoría | Estado |
|---|---|
| A01 Broken Access Control | Cubierto. Autorización en servidor en cada operación, probada por rol (§4.2) |
| A02 Cryptographic Failures | Cubierto en lo aplicable. Contraseñas con scrypt, tokens solo como HMAC, HTTPS por plataforma |
| A03 Injection | Cubierto. Prisma parametrizado, escapado en salida, CSV neutralizado (§4.3) |
| A04 Insecure Design | Parcial. El diseño separa capas y minimiza datos; **la entrega garantizada de correo no existe** y está documentada como límite |
| A05 Security Misconfiguration | Cubierto en esta fase. Cabeceras, CSP, sin cabecera de versión (§4.9) |
| A06 Vulnerable Components | **Parcial.** Ver §7: 3 vulnerabilidades altas heredadas de `next@16.0.10` |
| A07 Identification & Authentication | Cubierto (§4.6) |
| A08 Software & Data Integrity | Parcial. `package-lock.json` fija versiones; no hay firma de artefactos ni SRI (no se cargan scripts de terceros) |
| A09 Logging & Monitoring | Cubierto en registro. **No hay alertas**: nadie vigila los logs todavía |
| A10 SSRF | Cubierto (§4.4) |

## 6. Datos personales: minimización

Lo que **deliberadamente no se guarda**:

- **IP y user-agent de las sesiones administrativas.** Better Auth los guarda por
  defecto; un hook los vacía antes de persistir. No se usó
  `advanced.ipAddress.disableIpTracking` porque además de no guardar la IP deja al
  limitador sin clave y **desactiva el rate limit del login**: sería cambiar
  protección contra fuerza bruta por minimización.
- **IP de los visitantes.** El rate limit la usa en memoria y solo persiste su HMAC.
- **Datos de terceros en `ContentInteraction`.** Solo el contacto, la sección, el
  tipo, la ficha y las UTMs. Ni IP, ni user-agent, ni huella de navegador.
- **Direcciones completas en `NotificationLog`.** Se guardan enmascaradas.
- **El cuerpo de los correos.** Ni en el registro ni en los logs.

## 7. Riesgos aceptados y pendientes

Cada uno con su motivo. Ninguno está disimulado en el código.

1. **`'unsafe-inline'` en `script-src` y `style-src`.** Next emite scripts en línea
   para hidratar y Tailwind inyecta estilos; los componentes usan `style={{}}` para
   las animaciones. La solución correcta es una CSP con nonce por petición desde el
   middleware, que exige tocar cada punto de render. **Evolución pendiente.**
2. **CSP en Report-Only.** Se sirve como `Content-Security-Policy-Report-Only` salvo
   que `CSP_ENFORCE=true`. Una CSP que rompe la web en el primer despliegue se acaba
   desactivando entera; primero hay que observar las violaciones reales. **Falta
   pasar a bloqueo y montar un receptor de informes.**
3. **3 vulnerabilidades altas en dependencias transitivas** de `next@16.0.10`
   (`postcss`, `sharp`), corregibles solo subiendo a `next@16.3.0`. No se aplica en
   esta fase: es un cambio de versión menor de framework que toca render y build, y
   merece su propia fase con la suite completa como red. **Decisión pendiente.**
4. **Sin entrega garantizada de correo.** Un `RETRY_PENDING` no se reintenta. Ver
   `docs/email.md` §7.
5. **Sin alertas ni agregador de logs.** Los registros son estructurados y
   correlacionables, pero nadie los vigila. Un ataque sostenido se vería *después*.
6. **Sin verificación del email en el gate VIP.** Cualquiera puede escribir el email
   de otra persona y acceder. La plantilla de verificación está preparada
   (`docs/email.md` §5.4); activarla cierra este hueco.
7. **Sin pruebas en navegador real.** No hay automatización de navegador en el
   entorno, así que la CSP, el foco y el comportamiento con lector de pantalla no se
   han verificado en un navegador.
8. **Plazo de retención sin validar.** El mecanismo existe y es configurable; el
   plazo concreto lo tiene que fijar un profesional (README §Pendientes legales).
9. **La base de datos de desarrollo es la de las pruebas.** No hay entorno aislado;
   documentado en `docs/arquitectura-backend.md` §5.
10. **Un ADMIN comprometido lo pierde todo.** No hay segundo factor ni aprobación de
    dos personas para exportar o anonimizar. Con un solo operador es proporcionado;
    con equipo, el 2FA es el siguiente paso.
