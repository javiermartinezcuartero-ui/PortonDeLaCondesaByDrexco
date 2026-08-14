# El Portón de la Condesa — Web pública y CRM de captación

Aplicación web full-stack para una finca de bodas y celebraciones real (El Portón de la Condesa, Molina de Segura, Murcia): la web pública de la marca, dos bibliotecas de contenido tras un gate de correo validado en servidor, un CMS propio para que el equipo publique sin tocar código, y un CRM que registra, puntúa y sigue cada consulta comercial hasta cerrarla.

Un único proyecto Next.js 16 con PostgreSQL y Prisma. Sin backend separado, sin CRM de terceros, sin que los datos de los contactos salgan de la infraestructura del proyecto.

Trabajo Fin de Máster. **Este documento es la referencia técnica completa y autocontenida:** con leerlo se entiende y se reproduce el proyecto entero. Los documentos de `docs/` amplían capítulos concretos, no los sustituyen.

Lo que no está confirmado o implementado se marca explícitamente como `PENDIENTE`, nunca como completado.

---

## Índice

**Planteamiento** — [1. Resumen](#1-resumen) · [2. Problema](#2-problema) · [3. Objetivos](#3-objetivos) · [4. Alcance y fuera de alcance](#4-alcance-y-fuera-de-alcance) · [5. Usuarios y casos de uso](#5-usuarios-y-casos-de-uso) · [6. Estado actual](#6-estado-actual)

**Producto** — [7. Funcionalidades públicas](#7-funcionalidades-públicas) · [8. Gate de acceso y captación](#8-gate-de-acceso-y-captación) · [9. CMS de Bodas Reales y Catering](#9-cms-de-bodas-reales-y-catering) · [10. CRM, pipeline, tareas e informes](#10-crm-pipeline-tareas-e-informes)

**Ingeniería** — [11. Arquitectura](#11-arquitectura) · [12. Diagrama de componentes](#12-diagrama-de-componentes) · [13. Modelo de datos](#13-modelo-de-datos) · [14. Decisiones y justificación](#14-decisiones-y-justificación) · [15. Stack y versiones](#15-stack-y-versiones) · [16. Estructura del repositorio](#16-estructura-del-repositorio)

**Operación** — [17. Instalación](#17-instalación) · [18. Variables de entorno](#18-variables-de-entorno) · [19. Supabase](#19-supabase) · [20. Prisma y migraciones](#20-prisma-y-migraciones) · [21. Bootstrap de administración](#21-bootstrap-de-administración) · [22. Sembrado y demostración](#22-sembrado-y-demostración) · [23. Scripts](#23-scripts)

**Calidad** — [24. Pruebas y resultados reales](#24-pruebas-y-resultados-reales) · [25. Seguridad](#25-seguridad) · [26. Privacidad](#26-privacidad) · [27. Accesibilidad](#27-accesibilidad) · [28. SEO](#28-seo) · [29. Rendimiento](#29-rendimiento) · [30. Despliegue en Vercel](#30-despliegue-en-vercel)

**Cierre** — [31. Metodología y uso de IA](#31-metodología-y-uso-de-ia) · [32. Limitaciones conocidas](#32-limitaciones-conocidas) · [33. Roadmap](#33-roadmap) · [34. Licencia](#34-licencia) · [35. Derechos de marca y assets](#35-derechos-de-marca-y-assets) · [36. Enlaces de entrega](#36-enlaces-de-entrega)

**Anexos** — [37. Documentación complementaria](#37-documentación-complementaria) · [38. Historial de fases](#38-historial-de-fases)

---

## 1. Resumen

El Portón de la Condesa es una finca de celebraciones con una web bonita y ningún sistema detrás: el formulario de contacto enviaba los mensajes a un servicio de terceros y ahí se perdía el rastro. Nadie sabía cuántas consultas llegaban, cuáles se habían contestado, ni qué contenido las provocaba.

Este proyecto sustituye eso por un sistema propio, en tres piezas que se apoyan una en otra:

1. **Captación con contrapartida.** El contenido que más convence a quien busca dónde casarse son bodas ya celebradas en la finca. Ese contenido pasa a estar detrás de un gate: se entrega a cambio de un correo electrónico, con consentimiento de privacidad obligatorio y de marketing separado y opcional. La protección se valida **en servidor antes de consultar la base de datos**, así que sin acceso no hay contenido ni en el HTML ni en el payload del cliente.
2. **Un CMS para el equipo.** Publicar una boda real o un catering no requiere desarrollador: borrador, imágenes en un bucket privado, previsualización y publicación, con la web reflejándolo al instante.
3. **Un CRM que no pierde nada.** Cada solicitud entra con su origen —qué ficha la generó, de qué campaña venía—, se puntúa sola, se asigna a alguien, genera tareas con fecha y recorre un pipeline con transiciones validadas. Todo queda en un historial y en un registro de auditoría.

El resultado, en una frase: la finca pasa de perder sus consultas a tener cada una registrada, puntuada y con responsable.

**Cifras del proyecto:** 25 tablas, 10 migraciones, 3 roles, 22 fases de desarrollo, **741 pruebas unitarias y de integración** en 61 archivos, **23 pruebas end-to-end** que recorren los 13 escenarios críticos en un navegador real contra el build de producción, y **cero errores y cero advertencias** de lint, tipos y compilación.

---

## 2. Problema

### Qué pasaba antes

El sitio original conseguía interés y lo dejaba caer. El recorrido real de un cliente potencial era este:

```
Instagram / Bodas.net / búsqueda
            │
            ▼
        web pública ──► contenido de bodas reales visible para cualquiera,
            │           sin pedir nada a cambio
            ▼
    formulario de contacto
            │
            ▼
      servicio de terceros ──► un correo en una bandeja
            │
            ▼
            ?           sin registro, sin seguimiento,
                        sin saber qué había funcionado
```

Cuatro problemas concretos, no genéricos:

1. **Las consultas no quedaban en ningún sistema propio.** El formulario enviaba a Web3Forms. Si alguien no veía ese correo, la consulta desaparecía. No había forma de responder a «¿cuántas consultas llegaron en mayo?».
2. **No se sabía qué contenido convence.** Ninguna solicitud llevaba pegado de dónde venía. Invertir en fotografía de bodas o en publicidad era una apuesta sin datos.
3. **El activo más persuasivo se regalaba.** Las bodas ya celebradas son la prueba social más fuerte que tiene una finca, y estaban accesibles para cualquiera sin dejar ni un correo.
4. **Publicar exigía desarrollador.** El contenido vivía en archivos del código. Añadir una boda era una tarea técnica, así que en la práctica no se añadían.

### La oportunidad

Las cuatro cosas se resuelven con la misma pieza: **convertir el contenido en la contrapartida de un dato de contacto**, y construir alrededor el sistema que registra, atribuye y sigue lo que entra por ahí.

De ahí sale una consecuencia que condiciona todo el diseño: si el contenido es la moneda de cambio, el gate tiene que ser real. Uno que se salte con la tecla F12 no protege nada y, además, engaña al negocio con métricas de captación falsas.

---

## 3. Objetivos

### Objetivo general

Diseñar, construir y validar una aplicación web full-stack que resuelva el ciclo completo de captación comercial de una finca de celebraciones real: desde la visita anónima hasta el seguimiento del cliente potencial por parte del equipo, con las garantías de seguridad y privacidad que exige tratar datos personales.

### Objetivos específicos

| # | Objetivo | Estado | Dónde comprobarlo |
|---|---|---|---|
| OE-1 | Conservar la identidad visual y la experiencia de la web pública existente, sin degradar diseño, responsive ni animaciones | **Cumplido** | §7 |
| OE-2 | Implementar un gate de correo cuya protección se valide en servidor antes de consultar contenido | **Cumplido** | §8, §25 |
| OE-3 | Sustituir la dependencia de terceros para la captación por una API propia | **Cumplido** | §8 |
| OE-4 | Construir un CMS que permita al equipo publicar sin conocimientos técnicos, con control de estados y validación de calidad | **Cumplido** | §9 |
| OE-5 | Construir un CRM con contactos, solicitudes, pipeline, tareas, notas e informes, con permisos por rol | **Cumplido** | §10 |
| OE-6 | Separar interfaz, validación, dominio y acceso a datos, con autorización comprobada en servidor en cada operación privada | **Cumplido** | §11, §25 |
| OE-7 | Tratar los datos personales con minimización, consentimientos separados e inmutables, anonimización y derechos operativos | **Cumplido** (con revisión jurídica pendiente) | §26 |
| OE-8 | Validar el sistema con pruebas automatizadas en todos los niveles, incluidas end-to-end en navegador real | **Cumplido** | §24 |
| OE-9 | Dejar el proyecto reproducible y desplegable: un solo lockfile, build sin dependencias de red, migraciones documentadas | **Cumplido** | §30 |
| OE-10 | Documentar el proyecto de forma que un tercero pueda entenderlo, reproducirlo y verificar cada afirmación | **Cumplido** | este documento y `docs/evidencias-tfm.md` |
| OE-11 | Desplegar en producción con dominio propio | `PENDIENTE` | §30 — preparado y verificado, no ejecutado |

---

## 4. Alcance y fuera de alcance

### Dentro del alcance

- Web pública responsive, bilingüe en navegación, home, contacto y páginas legales.
- Dos bibliotecas de contenido —Bodas Reales y Catering— tras un gate de correo con sesión en servidor.
- CMS privado de fichas con borrador, media, previsualización y publicación.
- API propia de alta de solicitudes comerciales, con antispam y rate limit.
- CRM: interesados, solicitudes, fases de seguimiento, acciones, notas, informes y exportación a Excel.
- Autenticación administrativa con tres roles y permisos por área.
- Correo transaccional desacoplado tras una interfaz de proveedor.
- Seguridad: cabeceras, CSP, autorización en servidor, validación de imágenes por firma de bytes, anti-SSRF, rate limit persistente.
- Privacidad: consentimientos separados e inmutables, minimización, anonimización, derechos RGPD, retención configurable.
- Pruebas en todos los niveles y preparación completa del despliegue.

### Fuera del alcance, y por qué

| Fuera | Motivo |
|---|---|
| **Facturación, contratos y presupuestos formales** | Es gestión posterior a la venta. El proyecto acompaña hasta el cierre de la oportunidad; a partir de ahí interviene la gestoría de la finca con sus propias herramientas |
| **Reserva y pago en línea** | La finca vende con visita previa y presupuesto a medida. Un carrito de la compra no encaja con cómo vende, y montarlo obligaría a integrar pasarela de pago y política de cancelaciones para un flujo que nadie usaría |
| **Aplicación móvil nativa** | La web es responsive y el panel lo usa un equipo pequeño desde escritorio. Una app nativa duplicaría el mantenimiento sin resolver nada nuevo |
| **Multi-finca / multi-tenant** | Hay una finca. Diseñar para N complica el modelo de datos, los permisos y cada consulta, a cambio de una necesidad hipotética |
| **Chat en vivo o chatbot** | Exige alguien atendiendo. Sin ese compromiso del negocio, un chat sin respuesta es peor que no tenerlo |
| **Automatización de marketing (secuencias de correo)** | Necesita base legal revisada y contenido comercial aprobado. Ninguna de las dos cosas existe todavía (§26) |
| **Traducción completa del contenido** | Las fichas VIP y el texto íntegro de las páginas legales no están traducidos. Traducir textos legales sin revisión profesional sería peor que no traducirlos |
| **Panel multilingüe** | Lo usa el equipo de la finca, en español. Es una decisión, no una carencia |

---

## 5. Usuarios y casos de uso

### Los cinco actores

| Actor | Quién es | Qué puede hacer |
|---|---|---|
| **Visitante anónimo** | Cualquiera que llega a la web | Ver la web pública. **No** ve el contenido de las bibliotecas: ni renderizado, ni en el HTML, ni en el payload del cliente |
| **Visitante identificado** | Ha dejado su correo en el gate | Todo lo anterior, más las dos bibliotecas completas y sus fichas. Su sesión es una cookie `HttpOnly` respaldada por una fila en base de datos |
| **CONTENT** | Quien publica contenido en la finca | Solo el CMS. **No accede a datos personales**: las nueve rutas del CRM le devuelven 404 |
| **SALES** | Equipo comercial | Todo el CRM: contactos, solicitudes, pipeline, tareas, notas, informes. **No** publica contenido y **no** puede exportar |
| **ADMIN** | Responsable del sistema | Todo, más gestión de usuarios, configuración del scoring, exportación a Excel y las operaciones de privacidad (copia de datos, anonimizar, revocar) |

Que la navegación oculte lo que un rol no puede usar es interfaz. La autorización real se comprueba en el servidor en cada página, cada Server Action y cada endpoint, y hay pruebas que invocan cada mutación con la sesión equivocada y verifican que la base de datos no cambia.

### Casos de uso principales

**CU-1 · El visitante descubre el contenido y deja su correo**
Llega a `/bodas-reales`. Ve el gate. Escribe su correo, acepta la política de privacidad (obligatoria) y decide sobre comunicaciones comerciales (opcional, desmarcada de origen). En una sola transacción se crea o actualiza su contacto, se registran los consentimientos como eventos inmutables con la versión de la política, se anota la actividad y se abre la sesión de acceso. Si algo de eso falla, no se concede acceso.
*Alternativas:* correo inválido → mismo mensaje de error exista o no ya en el sistema; cinco intentos en diez minutos → limitado, con la IP siempre hasheada.

**CU-2 · El visitante consulta una ficha y pide presupuesto**
Abre una boda concreta. La visita queda registrada como interacción, deduplicada para que recargar no la cuente dos veces. Pulsa «Quiero una boda así»: llega al formulario con el tipo de evento ya seleccionado y el asunto sugerido. Envía. Se crea una solicitud **nueva** (nunca se sobrescribe una anterior) con su ficha de origen verificada en servidor, su puntuación recalculada y el aviso interno enviado después del commit.
*Alternativas:* honeypot rellenado → respuesta 202 indistinguible de un éxito, sin guardar nada; formulario enviado en menos de tres segundos → error recuperable; doble clic → una sola solicitud, garantizado por índice único.

**CU-3 · CONTENT publica una boda real**
Crea un borrador, rellena los campos, sube fotografías. Intenta publicar y la interfaz le dice exactamente qué falta —típicamente el texto alternativo de una imagen—. Lo completa, previsualiza con la misma vista que verá el público, publica. La ruta pública lo refleja de inmediato.
*Alternativas:* slug repetido → rechazado con mensaje claro; otra persona ha guardado mientras editaba → aviso, sin pisar su trabajo.

**CU-4 · SALES gestiona una solicitud**
Ve la solicitud nueva en su listado, con su origen y su puntuación. La abre: el mensaje que escribió la persona está tal cual, sin reescribir. Añade su valoración como campo de gestión, se asigna la solicitud, crea una tarea con fecha y mueve el estado. Cada movimiento queda en el historial y en la auditoría, en la misma transacción.
*Alternativas:* transición no válida → no aparece como opción, y el servidor la rechaza igualmente; marcar como perdida sin motivo → rechazado en el esquema y otra vez en el dominio.

**CU-5 · ADMIN atiende un derecho de privacidad**
Alguien pide su copia de datos: ADMIN la descarga en JSON desde la ficha del contacto. Pide darse de baja de comunicaciones: se registra un evento nuevo de revocación, sin destruir el historial. Pide supresión: se anonimiza, lo que vacía también el texto libre de sus solicitudes y borra las notas del equipo, conservando consentimientos y auditoría como prueba del tratamiento. Todo queda auditado.

---

## 6. Estado actual

Las filas van **en orden de fase**, que es el orden en que ocurrieron. El detalle de cada una está en el anexo §38.

| Área | Fase | Estado |
|---|---|---|
| Frontend público (home, bodas reales, catering, legal) | — | **Implementado** — §7 |
| Saneamiento técnico (lint, typecheck real, tests, CI) | 1 | **Implementado** — §24 |
| Base de datos, Prisma y capa de dominio | 2 | **Implementado** — §13, §20 |
| Autenticación administrativa y roles | 3 | **Implementado** — §21, `docs/autenticacion.md` |
| CMS de contenido | 4 | **Implementado** — §9, `docs/cms.md` |
| Rutas públicas de las bibliotecas conectadas al CMS | 5 | **Implementado** — §7 |
| Gate de correo con sesión en servidor | 5 | **Implementado** — §8. **Resuelto el riesgo crítico** de las fases anteriores |
| Captación con API propia | 6 | **Implementado** — §8. Web3Forms retirado |
| CRM: fases de seguimiento, acciones e informes | 7 | **Implementado** — §10, `docs/crm.md` |
| Correo transaccional desacoplado | 8 | **Implementado** — §10, `docs/email.md` |
| Endurecimiento de seguridad y privacidad | 9 | **Implementado** — §25, §26, `docs/modelo-amenazas.md` |
| Pruebas E2E y base de pruebas aislada | 10 | **Implementado** — §24, `docs/pruebas-e2e.md` |
| Preparación del despliegue | 10 | **Implementado** — §30, `docs/despliegue-vercel.md` |
| Documentación de entrega y preparación de la publicación | 11 | **Implementado** — §34, §36, `docs/publicacion-github.md` |
| Auditoría correctiva final | 12 | **Implementado** — 15 defectos reales corregidos con su prueba de regresión |
| **Despliegue en producción** | 13 | **Desplegado** en https://elportondelacondesa.solucionesbonicas.com — §30 |
| Licencia del código | 13 | **MIT** — `LICENSE`, §34 |
| Acceso al panel con clave única y rediseño del panel | 14 | **Implementado** — §21, §25 |
| Limpieza de los datos ficticios | 15 | **Implementado** |
| Identidad propia del panel y contraste del menú público | 16 | **Implementado** |
| Fotografía de fondo en el panel y rótulo destacado | 17 | **Implementado** |
| Modos día/noche y front compacto | 18 | **Implementado** |
| Selector de fecha propio, destello en las bibliotecas y pie compacto | 19 | **Implementado** |
| Correo transaccional por Resend, con envío verificado | 20 | **Implementado** — `docs/email.md`, `npm run email:test` |
| Exportación del CRM en Excel (`.xlsx`) con tipos reales | 20 | **Implementado** — §10 |
| Tablero de seguimiento con arrastre y alternativa de teclado | 20 | **Implementado** — §10 |
| Panel estilo CRM, fondo animado y modos menos extremos | 20 | **Implementado** |
| Pipeline reducido a cinco fases comerciales | 21 | **Implementado** — §10, §13, §20 |
| Panel renombrado en lenguaje de negocio | 21 | **Implementado** — §10 |
| Gráficas circulares, de barras y de embudo en el panel | 21 | **Implementado** — §10 |
| Acciones y Puntuación Visitantes editables en la propia tabla | 21 | **Implementado** — §10 |
| Cortina de carga del sitio público | 21 | **Implementado** — §7, §29 |
| Captación con aviso a los 35 s | 21 | **Implementado** — §8 |
| **Revisión jurídica de los textos legales** | — | `PENDIENTE` — la base jurídica y el plazo de retención los tiene que fijar un profesional. §26 |

---

## 7. Funcionalidades públicas

### Home

Una sola página con secciones ancladas: hero, la finca, espacios, gastronomía, bodas reales (llamada a la biblioteca), catering, testimonios, ubicación con mapa y formulario de contacto. Conserva el diseño, la tipografía, el color y las animaciones de la plantilla original adaptados a la marca real.

- **Responsive** de móvil a escritorio.
- **Bilingüe** (español/inglés) en navegación, home, contacto y enlaces legales, con conmutador en la cabecera. Las fichas VIP y el texto completo de las páginas legales no están traducidos (§32).
- **Mapa sin clave de API**: se incrusta el mapa público de Google, con el color de marca aplicado por filtro CSS sobre el iframe. Ninguna clave de Google Maps Platform, ninguna cuota que agotar.
- **Cero peticiones a terceros para pintar la página.** Las tipografías se sirven desde el propio dominio (§29), así que la IP del visitante no viaja a Google.
- **Consentimiento de cookies** con privacidad y marketing como decisiones separadas.
- **Cortina de carga con la marca** mientras el documento termina de cargar, para que una conexión lenta no muestre la página a medio pintar. La retira el CSS y el JavaScript solo lo adelanta: si el bundle falla o está bloqueado, la web se ve igual (§29).

### Páginas legales

`/aviso-legal`, `/politica-privacidad` y `/politica-cookies`. La política de privacidad describe el tratamiento técnico real, y lo que no está validado jurídicamente lleva un aviso explícito en lugar de una cifra inventada (§26).

### Bibliotecas de contenido

`/bodas-reales` y `/catering`: listado de fichas y ficha individual en `/[slug]`. Las cuatro rutas leen del CMS y están protegidas por el gate (§8). No se pregeneran slugs y no hay `generateStaticParams`: publicar se ve al instante.

Cada ficha muestra galería, decoración, photocall, minuta, cronología, momentos destacados, proveedores, testimonio, desglose orientativo de presupuesto y una llamada a la acción contextual. Las fichas de ejemplo llevan la etiqueta **«Ejemplo ilustrativo»** visible mientras el equipo no publique casos reales.

### Acceso al panel

Un botón discreto en la cabecera lleva a `/admin/login` o a `/admin` según haya sesión. No es un enlace oculto ni una URL secreta: la seguridad está en la autenticación, no en que nadie encuentre la puerta.

---

## 8. Gate de acceso y captación

Detalle completo en `docs/gate-vip.md` y `docs/flujo-captacion.md`. Contrato HTTP de la API en `docs/openapi.yaml`.

### El gate

**Lo importante en una frase: el contenido protegido no está oculto, no se ha consultado.**

Sin una sesión de acceso válida, la capa de datos no se llama. No hay contenido en el HTML servido, ni en el payload del cliente, ni difuminado por CSS, ni un botón para saltarse la verificación. Comprobable con un `curl` y una búsqueda de texto (`docs/evidencias-tfm.md` §3), y con una prueba automática que espía la capa de datos para verificar que **no se la invoca** (`components/vip/access-boundary.test.tsx`).

Cómo funciona:

- Un correo, una vez. Desbloquea **las dos** bibliotecas.
- La autorización vive en una cookie `HttpOnly` respaldada por la tabla `VipAccessSession`. La cookie contiene **solo un token**, nunca el correo ni el identificador del contacto; en la base solo se guarda su HMAC, verificado con comparación de tiempo constante.
- Consentimiento de privacidad obligatorio y de marketing separado, opcional y desmarcado de origen. Los dos se persisten como eventos inmutables con la versión de la política aceptada.
- Rate limit persistente de 5 intentos cada 10 minutos por IP, con la IP **siempre** hasheada.
- El mensaje de error es idéntico exista o no el correo en el sistema.
- Todo en una transacción: si falla, no se concede acceso.
- Cada ficha abierta se registra como interacción, deduplicada por categoría para que recargar no la cuente dos veces.

### La captación

`POST /api/leads/requests` es el **único** camino de alta de una solicitud comercial. La interfaz nunca habla con Prisma: valida con el esquema compartido y envía a través de `lib/leads.ts`.

- **Campos.** Contacto (nombre, apellidos, correo, teléfono opcional) y solicitud (tipo de evento, fecha y número de invitados opcionales, espacio de interés, presupuesto orientativo opcional, asunto, mensaje). En eventos corporativos aparecen además empresa —**obligatoria**—, cargo y necesidades audiovisuales; con cualquier otro tipo esos tres campos se descartan en servidor. Se exige la empresa porque es el dato que permite cualificar, no el cargo.
- **Vocabulario estable.** El tipo de evento se guarda como código (`WEDDING`, `CORPORATE_EVENT`, …), nunca como etiqueta traducida, para que «Boda» y «Wedding» agrupen igual en el CRM. Un test comprueba que las listas de espacios de la web y del formulario no se desvíen.
- **Transacción única.** Se crea o actualiza el contacto, se crea **siempre** una solicitud nueva, se registra el consentimiento de privacidad —y el de marketing solo si se concede— y se anota la actividad. El recálculo de puntuación y el aviso por correo van después del commit: son derivados y no deben alargar ni condicionar la transacción.
- **Atribución.** `firstSource` se escribe solo al crear el contacto (first touch); `lastSource`, en cada solicitud (last touch). Cada solicitud conserva además su propia atribución completa: página, formulario, ficha de origen, referrer y las cinco UTMs.
- **Llamada a la acción contextual.** «Quiero una boda así» enlaza a `/?tipo=<CÓDIGO>&ficha=<id>#contacto`. El servidor no se cree la ficha: verifica que corresponde a contenido publicado y, si no, descarta el origen pero **guarda la solicitud igual**.
- **Consentimientos.** La versión de la política se valida contra la vigente (409 si no coincide, para no registrar un consentimiento sobre un texto que ya cambió). Dejar marketing sin marcar **no** registra un `granted=false`: no sería una petición de baja y revocaría un consentimiento dado antes por otra vía.
- **Antispam.** Honeypot (responde 202, indistinguible de un éxito, y no guarda nada), tiempo mínimo de formulario de 3 s, rate limit de 5 envíos/15 min por IP y 3/60 min por correo con la clave hasheada, límite de cuerpo de 32 KiB, validación de mismo origen e idempotencia por `submissionId`. **Sin CAPTCHA**: descartado mientras no haya abuso demostrado, porque penaliza a todo el mundo por lo que hacen unos pocos.
- **Errores que no filtran.** Se responde con códigos, no con textos, y nunca con los valores recibidos: en un error de validación solo viaja la lista de nombres de campo. Un fallo de escritura devuelve un error genérico y el motivo real queda solo en el log del servidor.
- **Estados de la interfaz.** *Enviando*, *éxito* y *error*, con la región de resultado en `aria-live` recibiendo el foco. Un error **no borra lo escrito**.

---

## 9. CMS de Bodas Reales y Catering

Detalle completo en `docs/cms.md`. Todas las rutas exigen `cms:access` (ADMIN o CONTENT), validado en la página **y** en cada Server Action.

- **Rutas.** `/admin/contenidos` (listado), `/nuevo`, `/[id]` (editor) y `/[id]/preview`.
- **Listado.** Pestañas (todo, bodas reales, catering, borradores, publicados, archivados), búsqueda por título, slug y espacio, filtros por tipo, estado, demo, destacado y fecha, paginación en servidor. Acciones: editar, duplicar como borrador, previsualizar, publicar, despublicar y archivar. **No hay «eliminar»**: una ficha publicada no se borra físicamente desde la interfaz.
- **Editor.** Todos los campos que muestra la ficha pública, en el mismo orden. Estados *Guardando / Guardado / Error / Cambios sin guardar*.
- **Flujo de trabajo.** Toda ficha nace borrador. Publicar exige título, slug, traducción española, imagen principal y **texto alternativo en todas las imágenes**, y la interfaz dice exactamente qué falta. Publicar, despublicar y archivar son transaccionales con su evento de auditoría. Las sobrescrituras concurrentes se detectan por `updatedAt` y se rechazan en vez de pisar el trabajo ajeno. Publicar revalida las rutas públicas afectadas.

  El texto alternativo obligatorio no es burocracia: sin él la ficha es inaccesible para quien usa lector de pantalla, y si no se exige al publicar, no se añade nunca.
- **Media.** Bucket **privado** en Supabase Storage. La clave privilegiada no puede llegar al navegador (`import "server-only"` rompe el build si se intenta). Se valida tamaño (10 MB máximo), extensión, MIME y **la firma real de los bytes**, además de las dimensiones leídas de la cabecera: un `.exe` renombrado a `.png`, o un JPEG declarado como PNG, se rechazan. Los nombres de objeto los genera el servidor (UUID), nunca el usuario. Las URL son firmadas y temporales. El borrado **no elimina un objeto todavía referenciado** por otra ficha —caso real: duplicar como borrador comparte los objetos—. Los vídeos externos exigen `https`, host de una lista explícita, miniatura y pasan un filtro anti-SSRF.
- **Auditoría.** Creación, actualización, publicación, despublicación, archivado, duplicado y operaciones de media, con metadatos limitados a identificadores y datos técnicos: nunca cuerpos de contenido ni URL firmadas.

---

## 10. CRM, pipeline, tareas e informes

Detalle completo en `docs/crm.md`. Correo transaccional en `docs/email.md`.

### Apartados y permisos

Los ocho apartados llevan **nombres de negocio, no de tecnología**, fijados por el titular en la Fase 21. Las rutas no cambiaron: renombrar carpetas habría roto marcadores, `revalidatePath` y los escenarios E2E sin que se viera nada en pantalla.

| Apartado | Ruta | Permiso | Qué es |
|---|---|---|---|
| Estatus Plataforma | `/admin` | `crm:access` | Cómo va la captación ahora mismo, en gráficas |
| Captaciones | `/admin/contactos` | `crm:access` | Personas identificadas por su correo, con su historial |
| Solicitudes Formulario | `/admin/solicitudes` | `crm:access` | Peticiones llegadas por el formulario público |
| Seguimiento clientes | `/admin/pipeline` | `crm:access` | Tablero de las cinco fases comerciales |
| Acciones | `/admin/tareas` | `crm:access` | Llamadas, visitas y recordatorios, editables en la tabla |
| Contenidos Biblioteca | `/admin/contenidos` | `cms:access` | Fichas de bodas reales y catering |
| Informes captación | `/admin/informes` | `crm:access` | Conversión y adquisición por año |
| Puntuación Visitantes | `/admin/configuracion` | `settings:manage` | Cuántos puntos vale cada hito |

`/admin` tiene dos caras: con `crm:access` muestra las métricas y, sin él, un punto de partida con acceso a Contenidos Biblioteca en lugar de una pantalla vacía.

### Resumen e informes

Interesados captados, solicitudes sin trabajar, tiempo medio hasta el primer contacto leído del historial real, reparto por fase, conversión sobre cerradas **con el denominador a la vista**, origen y campaña, contenido más consultado, embudo biblioteca → ficha → solicitud, y últimos movimientos. Informes captación repite el cuadro filtrado por año, con pastillas de periodo desde 2025.

**Los datos se muestran en gráficas** —anillo, barras y embudo— **escritas a mano en SVG y HTML**, no con una librería. El proyecto arrastra `recharts` de la plantilla inicial, así que usarla no habría añadido una dependencia; se descarta por dos motivos concretos: solo funciona en el cliente, y obligaría a **pasar los colores por props**, es decir, a tener la paleta en un segundo sitio. El panel resuelve sus dos modos enteramente con variables CSS, así que una gráfica que recibe `#3b82f6` se queda con el color del otro modo al cambiar de tema. Aquí el SVG usa `var(--tono)` y cambia solo.

**El dibujo lleva `aria-hidden` y el dato va siempre en la leyenda**, que es texto real con su cifra y su porcentaje: un anillo no se puede leer en voz alta.

Dos reglas que conviene decir en voz alta:

- **Un ratio sin denominador devuelve «sin datos», no 0 %.** Un 0 % afirma que nadie convierte, que es distinto de no tener datos todavía. Cada ratio y cada media viajan con su denominador o su tamaño de muestra.
- **No se dibuja un anillo con cifras que se solapan.** Las tres de Acciones —vencidas, próximos 7 días y pendientes en total— no son una partición: la última incluye a las dos primeras. Se convierten en una restando los tramos, en lugar de sumar lo mismo dos veces en el mismo círculo.

### Contactos y solicitudes

- **Captaciones.** Paginación en servidor; búsqueda por nombre y por **correo y teléfono normalizados** —buscar `600 11 22 33` encuentra a quien está guardado como `+34600112233`—; filtros por origen, etiqueta, puntuación, interacción, consentimiento y fechas, todos reflejados en la URL. Ficha 360º con datos, consentimientos, solicitudes, contenido consultado, historial, notas y acciones.
- **Solicitudes Formulario.** Listado paginado con filtros en URL y **orden por lista blanca cerrada**, más un segundo criterio estable por `id` para que ninguna fila salga en dos páginas. El detalle edita la gestión —prioridad, responsable, próxima acción, espacio, presupuesto— y **no reescribe el asunto ni el mensaje** que escribió la persona. Enlaces mailto, tel y WhatsApp con todo codificado y esquema fijo. Aviso de posibles coincidencias del mismo contacto que **no fusiona nada**.
- **Los filtros de las dos pantallas van plegados.** Son once campos con su etiqueta: desplegados ocupaban 291 px —más que las primeras filas de datos—, así que lo primero que se veía al entrar era el formulario para buscar y no lo que hay. Plegados ocupan 38 px. Es un `<details>` nativo: funciona sin JavaScript, y el navegador ya le da el rol y el estado de accesibilidad correctos. **Se abre solo si hay algún filtro puesto**, porque al revés sería una trampa: quien llega por un enlace filtrado vería tres resultados sin encontrar el filtro que los recorta. El recuento de filtros activos se ve incluso plegado.

### Pipeline

**Cinco fases: Contacto, Presentación, Propuesta, Cliente y Perdida.** Antes eran nueve estados, y la reducción se hizo **en el enumerado de la base de datos**, no agrupando nueve estados en cinco columnas al pintar. El motivo: los informes, la exportación a Excel y el historial de cada persona leen el mismo campo, así que un tablero de cinco columnas sobre nueve estados guardados habría enseñado nueve fases en los informes y cinco en el tablero. El pipeline es dominio, no presentación.

`CLIENT` es terminal y `LOST` se puede reabrir a `CONTACT`. **Se permite un paso hacia atrás** —Presentación a Contacto, Propuesta a Presentación—, que con nueve estados no hacía falta porque existía un aparcamiento (`NURTURING`) al que retirar una solicitud enfriada. Sin ese aparcamiento y sin vuelta atrás, deshacer un avance obligaría a darla por perdida y reabrirla, ensuciando el historial con dos movimientos falsos.

**Solo tablero, y se mueve arrastrando.** La vista de tabla y el desplegable «Mover a» se retiraron a petición del titular. Durante el arrastre se marcan solo las columnas que la máquina de estados acepta, y el servidor **vuelve a validar** la transición: que una columna se pinte no es nunca la garantía. La actividad y la auditoría se escriben **en la misma transacción** que el cambio. Perder una oportunidad exige motivo, comprobado en el esquema y otra vez en el dominio, así que soltar en Perdida abre un diálogo que lo pide.

**El arrastre no quita el teclado:** con una tarjeta enfocada, Control o Comando más flecha la mueve a la fase válida anterior o siguiente, y cada movimiento se anuncia en una región `aria-live`. No ocupa un píxel de pantalla, que era la objeción al desplegable (§27).

### Tareas y notas

Crear, asignar, editar, completar y cancelar, ligadas a una persona. Completar registra actividad; **cancelar no borra**: conserva la fila y su rastro. Notas internas en texto plano interpolado en JSX —no hay `dangerouslySetInnerHTML` en el CRM—, con límite de 4.000 caracteres, y editar queda auditado sin copiar el cuerpo.

**La pantalla es una tabla que se edita en la propia celda**, sin las seis pestañas de filtro que tenía. Cada campo guarda al modificarlo: el texto al salir del campo o con Intro —guardar al teclear sería una petición por letra—, y los desplegables y la fecha al cambiar. Cada cambio envía **la fila completa**, porque el dominio valida la tarea entera; una acción por campo exigiría cuatro validaciones parciales del mismo objeto.

**Una acción cerrada no se edita, y eso lo decide el dominio** (`updateFollowUpTask` rechaza cualquiera que no esté pendiente). En la tabla sus campos se pintan como texto: ofrecer un desplegable que el servidor va a rechazar es peor que no ofrecerlo. El estado de cada guardado se ve en la última columna y **se anuncia** en una región `aria-live`, porque una tabla que guarda sola no da ninguna otra señal.

El parámetro `vista` sigue funcionando sin interfaz que lo genere: los anillos de Estatus Plataforma enlazan aquí acotados —vencidas, próximos 7 días—, y cuando llega acotado se dice en una línea con salida a la vista completa. Ese salto de una cifra a su detalle es la mitad de la utilidad de un panel.

### Puntuación

Configurable por ADMIN y auditada. **`recalculateLeadScore` recalcula desde el historial, nunca acumula**, así que el mismo hito no puede sumar dos veces y un cambio de pesos se aplica en el siguiente movimiento de cada persona.

Los ocho hitos se editan en **una tabla agrupada en tres bloques** —lo que cuenta en el formulario, lo que hace en las bibliotecas, lo que pide expresamente— con el subtotal de cada bloque y el máximo alcanzable al pie, calculados en vivo mientras se escribe. La agrupación es lo que permite comparar pesos: en una lista alfabética, que es como llegan de la base de datos, no hay forma de ver si «dejar el teléfono» y «pedir una visita» están bien valorados uno respecto al otro. Una regla desactivada **conserva su peso** y no suma, así que no entra en el máximo.

### Exportación

**Excel (`.xlsx`) solo para ADMIN** (`crm:export`, un permiso **distinto** de consultar el CRM): respeta los filtros, encabezados en español en negrita y fila fija, lista blanca de columnas —nada de credenciales, tokens, hashes ni identificadores internos—, `no-store`, y un evento de auditoría por exportación sin el término de búsqueda.

**El cambio de CSV a Excel elimina la inyección de fórmulas por construcción, no por saneado.** En CSV había que poner un apóstrofo delante de todo valor que empezara por `=`, `+`, `-` o `@`, porque Excel interpreta la celda al abrirla; en `.xlsx` la celda **declara su tipo**, y una cadena es una cadena aunque empiece por `=`. Efecto colateral que se buscaba igual: las fechas van como fechas y los números como números, así que se ordenan y se suman sin convertir columnas a mano.

### Correo transaccional

**Principio: la base de datos es la fuente de verdad y el correo es un efecto secundario.** Guardar una solicitud no depende de que el proveedor responda. El envío ocurre después del commit y después de responder al visitante; ninguna función de notificación lanza, y un fallo de correo no borra datos ni produce un error falso.

- Interfaz `EmailProvider` con dos adaptadores: **Resend** (API por `fetch`, con timeout de 10 s) y desarrollo (registra y no envía). La aplicación nunca habla con Resend directamente. El adaptador de SendGrid **se retiró** en lugar de dejar los dos: con dos instalados, un despliegue con la variable equivocada envía por un canal que nadie mira.
- Se usa `after()` de Next.js, no `void promise`: mantiene viva la invocación hasta que el envío termina sin retrasar la respuesta. Un `void` parece equivalente pero deja el envío a medias cuando la plataforma congela la función, y sin rastro.
- Cuatro estados: `SENT` (el proveedor aceptó; no promete bandeja), `SKIPPED_CONFIG` (falta configuración, no es error), `RETRY_PENDING` (fallo transitorio) y `FAILED` (4xx: reintentar no arreglaría nada). El adaptador de desarrollo devuelve `SKIPPED_CONFIG`, **no `SENT`**.
- Registro sin datos personales innecesarios: plantilla, proveedor, estado, motivo corto y destinatarios **parcialmente ocultos**. Nunca el cuerpo, el asunto, la clave de API ni la dirección completa.
- El aviso interno enlaza al detalle protegido del CRM **sin token**: un enlace con acceso incorporado sería permanente para cualquiera que reenviara el correo.
- **Lo que no garantiza:** no hay entrega garantizada. `RETRY_PENDING` describe un fallo que merecería reintento y **nada lo reintenta** (§32).

---

## 11. Arquitectura

### Decisión de base

Un **único proyecto Next.js full-stack**, no un frontend y un backend separados. Menos superficie que asegurar, un solo despliegue, y tipos compartidos entre cliente y servidor sin generación de clientes ni contratos duplicados.

### Capas

| Capa | Dónde | Responsabilidad | Regla |
|---|---|---|---|
| **Interfaz** | `app/`, `components/` | Presentación e interacción | **Nunca** habla con Prisma |
| **Validación** | `lib/validation/` | Esquemas Zod compartidos cliente/servidor | El servidor revalida siempre, no confía en el cliente |
| **Dominio** | `lib/domain/` | Lógica de negocio y transacciones | Único lugar donde se decide qué es válido |
| **Datos** | `lib/db.ts`, `prisma/` | Acceso a PostgreSQL | Un solo cliente Prisma, un solo ORM |

Servicios transversales: `lib/auth/` (sesión y permisos), `lib/security/` (hash, tokens, rate limit, cabeceras, texto), `lib/storage/` (Supabase Storage), `lib/email/` (proveedor de correo), `lib/observability/` (registro estructurado).

### Autorización: dónde vive de verdad

Esto merece un apartado propio porque es la decisión de seguridad más importante del proyecto.

`middleware.ts` **solo redirige** según exista o no la cookie de sesión. No consulta la base de datos —es Edge, no llega— y por tanto **no autoriza**. La autorización real se comprueba, contra la base de datos, en:

- cada página protegida (`app/admin/(protected)/layout.tsx` y las guardas de `guards.ts`),
- cada Server Action,
- cada Route Handler privado.

Un middleware que autoriza es un único punto que, si se equivoca, lo abre todo. Y el acceso sin permiso devuelve **404, no 403**: un 403 confirmaría que el apartado existe.

---

## 12. Diagrama de componentes

```
                            NAVEGADOR
                                │
                    ┌───────────┴───────────┐
                    │   público             │  /admin
                    ▼                       ▼
        ┌───────────────────────────────────────────────────┐
        │              NEXT.JS 16 · App Router              │
        │                                                   │
        │  middleware.ts ── solo redirige /admin según       │
        │                   exista la cookie. NO autoriza.   │
        ├───────────────────────────────────────────────────┤
        │                                                   │
        │  RUTAS PÚBLICAS            PANEL /admin           │
        │  ├ home, legal             ├ resumen              │
        │  ├ /bodas-reales  ┐        ├ contactos            │
        │  └ /catering      │        ├ solicitudes          │
        │                   │        ├ pipeline             │
        │            ┌──────┘        ├ tareas               │
        │            ▼               ├ informes             │
        │      GATE VIP              ├ contenidos (CMS)     │
        │  sesión en servidor        ├ configuración        │
        │  cookie HttpOnly           └ usuarios             │
        │  ¿válida? ─ no ─► formulario, sin consultar nada   │
        │       │ sí                        │                │
        │       ▼                           ▼                │
        │                     AUTORIZACIÓN EN SERVIDOR       │
        │                     Better Auth · 3 roles          │
        │                     ADMIN · SALES · CONTENT        │
        │                                                   │
        │  API ROUTES                                       │
        │  ├ POST /api/leads/requests   (pública)           │
        │  ├ /api/auth/[...all]         (Better Auth)       │
        │  ├ /api/admin/crm/export      (solo ADMIN)        │
        │  ├ /api/admin/crm/lead-data   (solo ADMIN)        │
        │  └ /api/health                (sin fugas)         │
        └───────────────────────┬───────────────────────────┘
                                │
                    ┌───────────▼────────────┐
                    │  lib/validation  (Zod) │  esquemas compartidos
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │      lib/domain        │  transacciones,
                    │  leads · requests ·    │  reglas de negocio,
                    │  content · scoring ·   │  auditoría
                    │  tasks · privacy       │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   lib/db.ts (Prisma)   │  un único ORM
                    └───────────┬────────────┘
                                │
            ┌───────────────────┴───────────────────┐
            ▼                                       ▼
    ┌───────────────┐                     ┌──────────────────┐
    │  PostgreSQL   │                     │ Supabase Storage │
    │  (Supabase)   │                     │ bucket PRIVADO   │
    │  25 tablas    │                     │ URL firmadas     │
    └───────────────┘                     └──────────────────┘

            servicios transversales (server-only)
    ┌──────────────┬──────────────┬──────────────┬─────────────┐
    │ lib/security │ lib/email    │ lib/storage  │ lib/observ. │
    │ hash · rate  │ EmailProvider│ validación   │ log sin PII │
    │ limit · CSP  │ Resend/dev   │ de bytes     │ requestId   │
    └──────────────┴──────────────┴──────────────┴─────────────┘
                          │
                          ▼
                   Resend (opcional)
```

**Cómo se lee este diagrama:** todo lo que baja hacia la base de datos pasa por validación y por dominio. No hay ninguna flecha que salte de la interfaz a Prisma, y eso no es una convención: es lo que permite que la autorización y las reglas de negocio estén en un solo sitio comprobable.

---

## 13. Modelo de datos

**25 tablas.** Esquema completo, narrado y con diagrama ER en `docs/modelo-datos.md`; definición en `prisma/schema.prisma`.

### Las cuatro decisiones que explican el resto

**1. `Lead` separado de `LeadRequest`.** Una persona, varias solicitudes. Nunca se sobrescribe una anterior: quien pregunta por su boda y dos años después por una comunión es la misma persona con dos peticiones distintas, y las dos cuentan. Un modelo con una sola tabla obligaría a elegir entre perder la primera consulta o duplicar la persona.

**2. Los consentimientos son eventos inmutables, no una casilla.** `ConsentEvent` con `purpose` (`PRIVACY` / `MARKETING`), `granted`, la versión de la política y la fecha. Revocar es un evento nuevo, nunca un `UPDATE`. Solo así se puede demostrar **qué** se consintió, **cuándo** y **sobre qué texto**. Una columna booleana solo sabe decir el estado de hoy, que es justo lo que no sirve ante una reclamación.

**3. La sesión de acceso VIP vive en la base de datos.** `VipAccessSession` guarda el **HMAC** del token; la cookie del navegador lleva solo el token. Ni el correo ni el identificador del contacto salen del servidor, y revocar un acceso es una operación real, no esperar a que caduque una cookie.

**4. Las fases del pipeline son un enumerado de cinco valores, no columnas de una pantalla.** `LeadRequestStatus` es `CONTACT`, `PRESENTATION`, `PROPOSAL`, `CLIENT` y `LOST`. Fueron nueve hasta la Fase 21, y reducirlas se hizo en el esquema —con su migración— y no agrupando estados al pintar el tablero: el mismo campo lo leen los informes, la exportación a Excel y el historial de cada persona, así que dos vocabularios habrían dado dos respuestas distintas a la misma pregunta. El precio, dicho claramente: **la migración no es reversible**, porque tres estados antiguos caen en `PRESENTATION` y nada guarda cuál era cada uno.

### Grupos de tablas

| Grupo | Tablas | Para qué |
|---|---|---|
| **Autenticación** | `User`, `Session`, `Account`, `Verification`, `RateLimit` | Compatible con Better Auth, sin tabla de contraseñas paralela. El rol va como campo del usuario |
| **CRM** | `Lead`, `LeadRequest`, `ConsentEvent`, `LeadActivity`, `LeadNote`, `FollowUpTask`, `Tag`, `LeadTag`, `ScoringRule` | El núcleo comercial |
| **CMS** | `ContentEntry`, `ContentTranslation`, `ContentMedia`, `ContentProvider`, `ContentMenuSection`, `ContentMenuItem`, `ContentTimelineItem`, `ContentHighlight` | Una ficha y sus ocho tipos de contenido asociado, con traducciones separadas de la entrada |
| **Acceso e interacción** | `VipAccessSession`, `ContentInteraction` | Quién ha accedido y qué ha consultado |
| **Transversal** | `AuditEvent`, `NotificationLog`, `RateLimitCounter` | Auditoría, correo y limitación de la aplicación (distinta de la de Better Auth) |

### Núcleo, en relaciones

```
                    ┌──────────────────┐
                    │      Lead        │  emailNormalized UNIQUE
                    │  score, source,  │  (la clave real: buscar por
                    │  lifecycle       │   correo normalizado)
                    └────────┬─────────┘
                             │ 1:N
     ┌───────────┬───────────┼───────────┬────────────┬──────────────┐
     ▼           ▼           ▼           ▼            ▼              ▼
┌──────────┐ ┌────────┐ ┌────────┐ ┌─────────┐ ┌───────────┐ ┌──────────────┐
│LeadRequest│ │Consent │ │Activity│ │ Note    │ │FollowUpTask│ │VipAccess    │
│          │ │Event   │ │        │ │         │ │            │ │Session      │
│ status   │ │INMUTABLE│ │historial│ │internas │ │ con fecha  │ │ HMAC token  │
│ submission│ │privacy/ │ │        │ │         │ │            │ │             │
│ Id UNIQUE│ │marketing│ │        │ │         │ │            │ │             │
└─────┬────┘ └────────┘ └────────┘ └─────────┘ └───────────┘ └──────────────┘
      │                                                              │
      │ sourceContentId                                              │
      │ (verificado en servidor)                          ContentInteraction
      ▼                                                              │
┌──────────────────┐                                                 │
│  ContentEntry    │◄────────────────────────────────────────────────┘
│  slug + type     │
│  UNIQUE          │  status: DRAFT / PUBLISHED / ARCHIVED
└────────┬─────────┘  isDemo, isFeatured, sortOrder
         │ 1:N
    ┌────┴────┬──────────┬───────────┬─────────────┐
    ▼         ▼          ▼           ▼             ▼
Translation  Media   Provider   MenuSection   TimelineItem
 (ES / EN)  (bucket   (con su    │             Highlight
            privado)   media)    └─ MenuItem
```

Dos detalles que valen más que un párrafo de explicación:

- **`LeadRequest.submissionId` es único.** Es la garantía real contra el doble envío: no una comprobación en el cliente, sino un índice que la base de datos hace cumplir.
- **`ContentEntry` es único por slug *y* tipo.** Así una boda y un catering pueden compartir slug sin colisionar, que es lo natural cuando son dos bibliotecas distintas.

---

## 14. Decisiones y justificación

Las decisiones que cambiaron el resultado, con la alternativa que se descartó. Las de infraestructura están ampliadas en `docs/arquitectura-backend.md`.

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| **Gate validado en servidor** antes de consultar contenido | Gate en cliente con `localStorage` (era el estado inicial del proyecto) | Un gate de cliente se salta con F12 y, peor, produce métricas de captación falsas. Si el contenido es la contrapartida, la protección tiene que ser real. **Era el riesgo crítico del proyecto y se resolvió en la Fase 5** |
| **API propia de solicitudes** | Seguir con Web3Forms | Sin backend propio no hay registro, ni atribución, ni seguimiento: es decir, no hay proyecto. Y los datos de los contactos dejaban de estar en un tercero |
| **Autorización en cada página, acción y endpoint** | Autorizar en el middleware | El middleware es Edge y no llega a la base de datos; solo puede mirar si existe una cookie. Un único punto de autorización que se equivoca lo abre todo |
| **404 en vez de 403** al acceder sin permiso | 403 Forbidden | Un 403 confirma que el recurso existe. El 404 no dice nada |
| **Consentimientos como eventos inmutables** | Columnas booleanas en `Lead` | Un booleano solo conoce el estado de hoy. Ante una reclamación hay que poder demostrar qué se consintió, cuándo y sobre qué versión del texto |
| **`Lead` separado de `LeadRequest`** | Una sola tabla de «contactos» | Obligaría a elegir entre perder la consulta anterior o duplicar la persona |
| **Better Auth** | Auth.js (era la sugerencia del documento de referencia) | Tres piezas nativas que hacían falta: adaptador oficial de Prisma sobre el esquema ya creado, rate limiting persistente sin Redis, y roles vía `additionalFields` sin tabla paralela |
| **Prisma 6, no 7** | Prisma 7 (la última) | La 7 exige un *driver adapter* y mueve la configuración a `prisma.config.ts`: complejidad que no compra nada aquí. Revisable en el futuro |
| **Bucket privado con URL firmadas** | Bucket público | Las fotografías de una boda son de sus protagonistas. Un bucket público es una URL adivinable para siempre |
| **Validar imágenes por la firma real de los bytes** | Confiar en la extensión y el MIME declarado | Los dos los controla quien sube el archivo. Se leen las cabeceras de PNG, JPEG y WebP a mano, sin `sharp`: `sharp` ya arrastra vulnerabilidades conocidas en este proyecto y para leer una cabecera no hace falta decodificar el bitmap |
| **Tablero con arrastrar y soltar** (Fase 20; **revierte** la decisión contraria de la Fase 7) | Desplegable «Mover a» por tarjeta | Lo pidió el titular, y la objeción original era buena: un tablero accesible con arrastre exige alternativa de teclado, anuncios en vivo y manejo del foco. Se implementó **con** esa alternativa —`Ctrl`/`Cmd` más flecha, sin ocupar un píxel— en lugar de aceptar el gesto y perder el teclado, que era el riesgo real |
| **Cinco fases en el enumerado** (Fase 21) | Nueve estados guardados agrupados en cinco columnas al pintar | Habría sido más barato, y habría enseñado nueve fases en los informes y cinco en el tablero. El pipeline es dominio, no presentación. Coste asumido: la migración no es reversible |
| **Gráficas escritas a mano en SVG** | `recharts`, que ya está en las dependencias | Solo funciona en cliente y obliga a pasar los colores por props. El panel resuelve día y noche con variables CSS: una gráfica con el color en props se queda con el del otro modo al cambiar de tema |
| **Ratios sin denominador devuelven «sin datos»** | Mostrar 0 % | Un 0 % afirma que nadie convierte. No es lo mismo que no tener datos |
| **La retención solo identifica candidatos** | Anonimizar automáticamente al cumplirse el plazo | Anonimizar es irreversible y no puede depender de una tarea programada mal configurada |
| **Correo después del commit, con `after()`** | Enviar dentro de la transacción, o con `void promise` | Dentro de la transacción, un proveedor lento retrasa la respuesta al visitante y un fallo puede tumbar el guardado. Con `void`, la plataforma congela la función y el envío se queda a medias sin rastro |
| **Tipografías locales** | `next/font/google` | El build llegó a fallar con doce errores de red por no alcanzar `fonts.googleapis.com`. Un build que puede fallar por motivos ajenos al código no es reproducible. Efecto colateral: dos excepciones menos en la CSP y ninguna petición del visitante a un tercero |
| **CSP en Report-Only por defecto** | CSP bloqueando desde el primer día | Una CSP que rompe la web en el primer despliegue se acaba desactivando entera. Se activa con `CSP_ENFORCE=true` cuando haya informes limpios |
| **Sin CAPTCHA** | reCAPTCHA o similar | Honeypot, tiempo mínimo y rate limit cubren el abuso automatizado ingenuo. Un CAPTCHA penaliza a todos los visitantes por lo que hacen unos pocos, y aún no hay abuso demostrado |
| **Base de pruebas E2E aislada, con guardia en código** | Documentar «no ejecutar contra producción» | Las E2E vacían todas las tablas. Un aviso en un runbook no impide el accidente; una guardia que aborta antes de abrir la conexión, sí. Y tiene sus propias 13 pruebas |
| **Sembrado partido en tres comandos** | Un único `seed.ts` | Hacía tres cosas distintas —configuración, primer ADMIN y datos de ejemplo—, lo que obligaba a elegir entre sembrar configuración o no sembrar nada |
| **npm, un solo lockfile** | pnpm (había un `pnpm-lock.yaml` residual) | Dos lockfiles son un despliegue no reproducible esperando a ocurrir. Se eliminó el que no se usaba |

---

## 15. Stack y versiones

| Pieza | Elección | Versión | Justificación |
|---|---|---|---|
| Framework | Next.js (App Router, Turbopack) | 16.0.10 | Base de la plantilla original; permite un único proyecto full-stack |
| Interfaz | React + TypeScript estricto | 19.2.0 / 5.x | `strict: true`, sin `any` ni `ts-ignore` |
| Estilos | Tailwind CSS + Radix UI / shadcn | 4.1.9 | Sistema de diseño ya construido sobre esta base; se conserva para no romper el lenguaje visual |
| Formularios | React Hook Form + Zod | 7.60 / 3.25.76 | Validación coherente cliente/servidor con el mismo esquema |
| Base de datos | PostgreSQL (Supabase) | 16 | Gestionado, con Storage en el mismo proveedor |
| ORM | Prisma | 6.19.3 | Migraciones versionadas y tipos generados. La 7 exige driver adapters (§14) |
| Autenticación | Better Auth | 1.6.26 | Adaptador de Prisma, rate limit persistente y roles nativos (§14) |
| Almacenamiento | Supabase Storage | `@supabase/supabase-js` 2.112.3 | Bucket privado con URL firmadas |
| Correo | Resend tras interfaz propia | API HTTP | Adaptador sustituible; la aplicación no depende del proveedor. SendGrid se retiró en la Fase 20 |
| Gestor de paquetes | **npm** | — | Un solo lockfile: `package-lock.json` |
| Runtime | Node | ≥ 22 (`engines.node`) | Es lo que lee Vercel para elegir el runtime. Se usa `--env-file-if-exists`, que requiere 22 |
| Lint | ESLint (flat config) + `eslint-config-next` | 9.39.5 / 16.0.10 | Versión alineada con Next; incluye las reglas del compilador de React |
| Pruebas unitarias | Vitest + Testing Library + jsdom | 4.1.10 | Arranque rápido, integración nativa con Vite |
| Pruebas E2E | Playwright | 1.62.1 | Chromium, contra el build de producción |
| CI | GitHub Actions | — | `npm ci` → lint → typecheck → test → secret scan del historial → build. Sin secretos |
| Tipografías | `next/font/local` | — | Tres familias variables, OFL 1.1, servidas desde el propio dominio |

---

## 16. Estructura del repositorio

```
app/                       rutas (App Router)
├── page.tsx               home
├── layout.tsx             layout raíz: tipografías locales, metadatos, PublicChrome
├── globals.css            tokens de diseño y variables de tipografía
├── robots.ts              robots.txt (+ test): Disallow de /admin y /api
├── sitemap.ts             sitemap sin rutas VIP ni slugs
├── aviso-legal/ politica-privacidad/ politica-cookies/
├── bodas-reales/          listado + [slug]  ── envoltorios sobre VipLibrary/VipStory
├── catering/              idem: no hay componentes duplicados por sección
├── fonts/                 3 woff2 variables + 3 licencias OFL + README con su origen
├── admin/login/           acceso público al panel
├── admin/(protected)/     layout protegido y todo el panel
│   ├── page.tsx           resumen (dos caras según el rol)
│   ├── guards.ts          guardas de página: sin sesión → login, sin permiso → 404
│   ├── crm-actions.ts     Server Actions del CRM (autorizan y validan en servidor)
│   ├── contactos/         listado + ficha 360º
│   ├── solicitudes/       listado paginado + detalle editable
│   ├── pipeline/          tablero por estado + vista de tabla accesible
│   ├── tareas/ informes/ configuracion/ usuarios/
│   └── contenidos/        CMS: listado, /nuevo, /[id] editor, /[id]/preview
└── api/
    ├── auth/[...all]      handler de Better Auth
    ├── leads/requests/    alta pública de solicitudes (contrato en docs/openapi.yaml)
    ├── admin/users/       API solo ADMIN
    ├── admin/crm/export/  descarga Excel .xlsx (solo ADMIN)
    ├── admin/crm/lead-data/  copia de datos de un contacto en JSON (solo ADMIN)
    └── health/            healthcheck sin versiones, secretos ni excepciones

components/
├── sections/              secciones de la home (hero, espacios, contacto, ...)
├── vip/                   vip-library, vip-story (servidor, compartidos por ambas
│                          secciones), vip-gate, track-vip-view, story-card,
│                          story-detail, list-header, access-boundary.test
├── public-chrome.tsx      oculta la cabecera y el pie públicos dentro de /admin
├── admin-access.tsx       botón discreto de acceso al panel
├── structured-data.tsx    JSON-LD
└── ui/                    shadcn/ui adaptado

lib/
├── db.ts                  singleton de PrismaClient
├── auth.ts                configuración de Better Auth (servidor)
├── auth-client.ts         cliente de Better Auth (React)
├── auth/                  session.ts (requireSession/requireRole/requirePermission)
├── domain/                servicios de dominio: leads, lead-requests, consents,
│                          activities, notes, tasks, content, content-media,
│                          vip-sessions, interactions, scoring, audit, privacy,
│                          metadata, errors, demo + CRM (crm-leads, crm-requests,
│                          crm-export, metrics)
├── validation/            content, vip-gate, lead-request, crm  (esquemas Zod)
├── security/              hash (HMAC rotable), tokens, rate-limit (persistente),
│                          text (saneado de salida), headers (cabeceras y CSP),
│                          secret-patterns (patrones del escáner de secretos)
├── storage/               supabase (server-only), bucket, validate-image
│                          (firma real de bytes), external-url (anti-SSRF), object-name
├── email/                 provider (interfaz), resend, development, config, templates
├── notifications/         lead-request-notification, overdue-tasks, record, after-response
├── content/               to-story-detail, to-story-card, demo-stories, seed-equivalence
├── vip/                   session (cookie + getVipLead), gate-action, track-action, metadata
├── observability/         log.ts (registro estructurado con requestId, sin PII ni stack)
├── crm/labels.ts          etiquetas en español del panel
├── testing/               e2e-database-guard (impide vaciar una base que no sea de pruebas)
├── leads.ts               envío al endpoint propio
├── attribution.ts         UTMs y referrer
├── i18n.tsx  legal.ts  slug.ts  utils.ts

data/
├── site-content.ts        contenido de presentación (+ espejo en site-content.en.ts)
└── vip-stories.ts         6 casos de ejemplo — las rutas ya NO lo leen: es la
                           fuente del sembrado de demostración

prisma/
├── schema.prisma          25 tablas
├── migrations/            9 migraciones (ver docs/migraciones.md)
└── seed.ts                solo configuración operativa (pesos del scoring)

scripts/
├── admin-bootstrap.ts     primer usuario ADMIN
├── ensure-storage-bucket.ts   crea el bucket privado
├── notify-overdue-tasks.ts    resumen de tareas vencidas (manual)
├── retention-report.ts    candidatos a anonimizar (NO anonimiza)
├── demo-seed.ts / demo-clean.ts    demostración: sembrar y retirar
├── secrets-scan-history.ts     escáner de secretos del historial de Git
└── e2e-env.ts / e2e-migrate.ts / e2e-seed.ts / e2e-env-init.mjs

e2e/                       6 especificaciones de Playwright (23 pruebas), helpers,
                           fixtures, auth.setup.ts y global-setup.ts
middleware.ts (+ test)     redirección de /admin según la cookie (no autoriza)
docker-compose.e2e.yml     PostgreSQL desechable (puerto 55432, solo 127.0.0.1)
playwright.config.ts       E2E contra el build de producción, un trabajador
vitest.config.mts          Vitest (excluye e2e/, que es de Playwright)
eslint.config.mjs  next.config.mjs  postcss.config.mjs  tsconfig*.json

docs/                      documentación técnica y de entrega (índice en §Documentación)
project-reference/         fuente de verdad de negocio: extracción del sitio original,
                           Instagram, arquitectura CRM de referencia, marca — no eliminar
.github/
├── workflows/ci.yml       integración continua
└── RELEASE_TEMPLATE.md    plantilla de release/tag de entrega
CLAUDE.md                  reglas de trabajo vinculantes del proyecto
CONTRIBUTING.md            versión corta de esas reglas
NOTICE                     derechos de terceros: marca, fotografías, textos, tipografías
```

---

## 17. Instalación

Requisitos: **Node 22 o superior** (declarado en `engines.node`, que es lo que lee Vercel) y **npm**. Docker solo para las pruebas E2E.

### Desde cero

```bash
npm ci                       # instala y genera el cliente de Prisma (postinstall)
cp .env.example .env         # y rellenar (§18)

npx prisma migrate deploy    # aplica las 9 migraciones en orden (§20)
npm run db:seed              # configuración operativa: pesos del scoring
npm run storage:bootstrap    # crea el bucket privado vip-content
npm run admin:bootstrap      # primer usuario ADMIN (§21)

npm run dev                  # http://localhost:3000
```

### Calidad

```bash
npm run lint         # ESLint 9, incluidas las reglas del compilador de React
npm run typecheck    # tsc --noEmit, modo estricto
npm test             # Vitest. Los tests con base de datos necesitan .env; sin él se saltan solos
npm run build        # build de producción (Turbopack, valida tipos)
```

### Pruebas E2E

```bash
npm run e2e:env       # crea .env.e2e con secretos aleatorios (no sobrescribe)
npm run e2e:setup     # contenedor de PostgreSQL + migraciones + escenario
npm run e2e           # los 13 escenarios críticos
npm run e2e:ui        # modo interactivo, paso a paso
npm run e2e:report    # informe HTML de la última ejecución
npm run e2e:db:reset  # borra el contenedor y su volumen: base virgen
```

Detalle en `docs/pruebas-e2e.md`.

---

## 18. Variables de entorno

Plantilla sin valores en `.env.example`. El `.env` real **no se versiona** y hay una prueba que lo comprueba (§25).

| Variable | Uso | Estado |
|---|---|---|
| `DATABASE_URL` | Prisma en runtime — pooler de Supabase en modo Transaction (puerto 6543, `pgbouncer=true`) | **En uso** desde Fase 2 |
| `DIRECT_URL` | `prisma migrate` — pooler en modo Session (puerto 5432). La conexión directa no resuelve en este entorno (`docs/arquitectura-backend.md` §2) | **En uso** desde Fase 2 |
| `SUPABASE_URL` | URL del proyecto. La usa el cliente de Storage y determina el host autorizado de `next/image` | **En uso** desde Fase 4 |
| `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY` | Clave pública (formato nuevo / legacy) | Provisionadas, **sin uso en código**: el bucket es privado y todo pasa por servidor |
| `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Clave privilegiada, **solo servidor**: subida, borrado y firma de URL. `SECRET_KEY` tiene precedencia | **En uso** desde Fase 4. Secreto crítico |
| `BETTER_AUTH_SECRET` | Firma las cookies y tokens de sesión (32 bytes aleatorios) | **En uso** desde Fase 3. Rotarlo invalida todas las sesiones activas |
| `BETTER_AUTH_URL` | Origen real desde el que se sirve la app; determina si la cookie se marca `Secure` y cuál es el origen de confianza | **En uso** desde Fase 3 |
| `RATE_LIMIT_HASH_SECRET` (+ `_PREVIOUS`) | HMAC irreversible de los identificadores de rate limit. **Nunca se guarda la IP** | **En uso** desde Fase 5 |
| `VIP_TOKEN_HASH_SECRET` (+ `_PREVIOUS`) | HMAC irreversible del token de sesión VIP | **En uso** desde Fase 2 |
| `NEXT_PUBLIC_SITE_URL` | Base de los enlaces al panel en los correos, sin barra final | **Opcional.** Sin ella, `http://localhost:3000`. **Única variable pública del proyecto** |
| `ADMIN_GATE_PASSWORD` | La clave única que se teclea en `/admin/login`. Mínimo 8 caracteres | **En uso** desde Fase 14 |
| `ADMIN_GATE_EMAIL` | Cuenta real, con rol ADMIN, contra la que se inicia sesión al acertar la clave | **En uso** desde Fase 14 |
| `ADMIN_GATE_ACCOUNT_PASSWORD` | Contraseña de esa cuenta. No se teclea nunca en la pantalla | **En uso** desde Fase 14 |
| `ENABLE_CREDENTIALS_LOGIN` | Abre `/admin/login/credenciales`, que sin ella responde 404. Solo el valor exacto `true` | **No se declara en el despliegue.** La usa el servidor de las pruebas E2E |
| `ENABLE_DEMO_CONTENT` | Si no es `"true"`, oculta de los listados públicos las fichas con `isDemo=true` | **En uso** desde Fase 2 |
| `CSP_ENFORCE` | `"true"` hace que la CSP bloquee en vez de solo informar | **Opcional**, apagado (§25) |
| `DATA_RETENTION_MONTHS` | Plazo de retención en meses (1–240) para **identificar** candidatos a anonimizar | **Opcional**, 36 por defecto. Nada se anonimiza solo, y el plazo no está validado jurídicamente |
| `RESEND_API_KEY` | Credencial de Resend (`re_…`). Solo servidor | **En uso** desde Fase 20. Sin ella cada intento queda como `SKIPPED_CONFIG` |
| `LEADS_FROM_EMAIL` | Remitente de un dominio verificado en Resend | **En uso.** Necesaria junto con la clave. `onboarding@resend.dev` vale para pruebas pero solo escribe al titular de la cuenta |
| `LEADS_NOTIFICATION_TO` | Destinatarios internos del aviso comercial (lista separada por comas) | **Opcional.** Sin ella no se envía el aviso interno |
| `SEND_LEAD_ACKNOWLEDGEMENT` | `"true"` activa el acuse de recibo al visitante | **Opcional, apagado.** Solo el valor exacto `"true"` lo activa |
| `ADMIN_BOOTSTRAP_NAME` / `_EMAIL` / `_PASSWORD` | Solo para `npm run admin:bootstrap`, una vez | **Uso puntual** — retirar del entorno inmediatamente después (§21) |
| `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD` | Cuenta de evaluación que crea `npm run demo:seed`. Mínimo 12 caracteres | **Uso puntual** — retirar tras sembrar. Se entrega solo por canal privado (§22) |

Las variables del entorno de pruebas (`E2E_*`) viven en `.env.e2e`, que tampoco se versiona; se generan con `npm run e2e:env` y están documentadas en `.env.e2e.example`. No se solapan con ninguna de la tabla: `scripts/e2e-env.ts` las traduce a las que la aplicación lee, **después** de validar que la base de pruebas es desechable.

Ninguna variable de Supabase ni de hashing lleva prefijo `NEXT_PUBLIC_`, porque su uso previsto es siempre server-side. Hay una prueba que comprueba que la **única** `NEXT_PUBLIC_` del proyecto es `NEXT_PUBLIC_SITE_URL`.

### Variables pendientes de aportar antes de desplegar

Ninguna es un valor que el proyecto pueda generar por sí mismo.

**Obligatorias en Production** — sin ellas la aplicación no arranca o no autentica:

1. `DATABASE_URL` — pooler en modo Transaction (puerto 6543, `pgbouncer=true`)
2. `DIRECT_URL` — pooler en modo Session (puerto 5432), para las migraciones
3. `SUPABASE_URL`
4. `SUPABASE_SECRET_KEY` (o `SUPABASE_SERVICE_ROLE_KEY`)
5. `BETTER_AUTH_SECRET` — 32 bytes aleatorios, **distinto en cada entorno**
6. `BETTER_AUTH_URL` — el origen real, con el dominio definitivo
7. `NEXT_PUBLIC_SITE_URL` — la misma URL
8. `RATE_LIMIT_HASH_SECRET` — 32 bytes aleatorios
9. `VIP_TOKEN_HASH_SECRET` — 32 bytes aleatorios

**De uso puntual, y que hay que borrar después de ejecutar su comando una vez:**

10. `ADMIN_BOOTSTRAP_NAME`, `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`
11. `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD` (solo si se siembra la demo)

**Opcionales, según lo que se quiera activar:** `ENABLE_DEMO_CONTENT` (mientras haya demo), `CSP_ENFORCE`, `DATA_RETENTION_MONTHS`, y el bloque de correo.

Los tres secretos aleatorios se generan con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Retiradas y renombradas

- **Fase 6:** `NEXT_PUBLIC_WEB3FORMS_KEY` ya no existe. Desapareció al sustituir el envío del navegador a Web3Forms por `POST /api/leads/requests`.
- **Fase 8:** `LEAD_NOTIFICATION_TO` pasó a `LEADS_NOTIFICATION_TO`, por coherencia con `LEADS_FROM_EMAIL`.

---

## 19. Supabase

Supabase aporta dos servicios: **PostgreSQL** y **Storage**. Nada más: no se usa Supabase Auth (la autenticación es Better Auth sobre el mismo esquema), ni sus políticas RLS, ni su cliente en el navegador. Detalle en `docs/arquitectura-backend.md`.

### PostgreSQL: dos conexiones, y por qué

Es el punto donde más veces se ha equivocado la configuración, así que conviene tenerlo claro:

| Variable | Conexión | Puerto | Para qué |
|---|---|---|---|
| `DATABASE_URL` | Pooler en modo **Transaction** | 6543 + `pgbouncer=true` | El runtime de la aplicación. En serverless cada invocación abre y cierra conexiones; sin pooler se agotan |
| `DIRECT_URL` | Pooler en modo **Session** | 5432 | `prisma migrate`. Las migraciones necesitan sentencias que el modo Transaction no admite (por ejemplo, cambios de tipos enumerados) |

Confundirlas da errores que no se parecen a su causa: migraciones que fallan con mensajes sobre sentencias preparadas, o una aplicación que agota conexiones bajo carga. La conexión directa (`db.<proyecto>.supabase.co`) **no resuelve en este entorno** —probablemente IPv6 únicamente—, así que se usa el pooler en modo Session como alternativa para migraciones.

### Storage: un bucket privado

Bucket `vip-content`, **privado**. Se crea o reconcilia con `npm run storage:bootstrap` (idempotente).

- La clave privilegiada vive tras `import "server-only"`: si alguien la importa desde un componente cliente, **el build falla**. No es una convención, es una barrera de compilación.
- Las URL de lectura son **firmadas y temporales**. No se registran en auditoría, porque una URL firmada en un registro es un acceso al archivo para quien lea el registro.
- `next/image` solo tiene autorizado el host de Supabase y solo la ruta `/storage/v1/object/sign/**`. Un `/**` permitiría usar el optimizador de imágenes como proxy de cualquier archivo del proyecto.
- Los nombres de objeto los genera el servidor (UUID), nunca el usuario.

### Si el proyecto gratuito se pausa

Supabase pausa los proyectos del plan gratuito tras un periodo de inactividad, y entonces la aplicación deja de funcionar entera. El procedimiento de recuperación está en `docs/despliegue-vercel.md`. Merece una mención aquí porque es el fallo más probable de este proyecto en producción y el que más despista: no hay ningún error en el código.

---

## 20. Prisma y migraciones

`prisma/schema.prisma` define las 25 tablas. `lib/db.ts` expone el singleton de `PrismaClient`. Detalle de las migraciones —qué hace cada una, su orden y qué hacer cuando falla— en **`docs/migraciones.md`**.

### Las diez migraciones

| # | Migración | Qué hace |
|---|---|---|
| 1 | `20260811101614_init` | Esquema completo inicial |
| 2 | `20260811120036_add_rate_limit_table` | Tabla de rate limit de Better Auth |
| 3 | `20260811125648_cms_content_fields` | Campos del CMS |
| 4 | `20260811223102_content_media_in_gallery` | Media en galería |
| 5 | `20260812073315_app_rate_limit_counter` | Contador de rate limit propio de la aplicación |
| 6 | `20260812120000_lead_request_submission_id` | `submissionId` único (idempotencia del formulario) |
| 7 | `20260812210000_notification_status_values` | Añade valores al enumerado de estados de notificación |
| 8 | `20260812210100_notification_log_fields` | Usa esos valores nuevos |
| 9 | `20260813205449_add_metrics_indexes` | Tres índices que faltaban, encontrados en la auditoría final: `ContentInteraction([type, createdAt])` y `LeadActivity([createdAt])` y `([leadRequestId])`. Solo `CREATE INDEX`: nada destructivo |
| 10 | `20260814120000_pipeline_cinco_fases` | Reduce `LeadRequestStatus` de nueve valores a cinco, con la correspondencia en un `CASE`. **La única migración del historial que no es reversible** (ver más abajo) |

Las migraciones 7 y 8 van separadas **por obligación, no por gusto**: PostgreSQL no permite usar un valor de un tipo enumerado en la misma transacción en la que se ha añadido.

**La 10 es la única que destruye algo, y conviene entender exactamente qué.** PostgreSQL no sabe quitar valores de un enumerado: hay que crear un tipo nuevo, convertir la columna con un `CASE` y borrar el viejo, así que esa migración contiene un `DROP TYPE`. Lo que se pierde no es el tipo, es la información: `CONTACTED`, `QUALIFIED` y `VISIT_SCHEDULED` caen los tres en `PRESENTATION`, y nada guarda cuál era cada uno. Se aplicó con cuatro solicitudes en la base y ninguna pérdida relevante, pero **en un entorno con historial hay que hacer copia antes**.

Lo que la 10 **no** toca es la pista de auditoría: `LeadActivity` y `AuditEvent` conservan las transiciones tal como se anotaron —`{from: "NEW", to: "CONTACTED"}`—, porque reescribir un registro para que diga lo que no dijo es falsearlo. Quien las lee acepta los dos vocabularios: `LEGACY_STATUS_LABEL` en `lib/crm/labels.ts` los traduce y `averageHoursToFirstContact` cuenta el paso a la segunda fase con cualquiera de los dos nombres.

### Reglas de operación

- **En producción, siempre `npx prisma migrate deploy`.** Nunca `migrate dev`: es interactivo y puede decidir recrear el esquema desde cero.
- **Vercel no aplica migraciones.** Se aplican a mano. Una migración lanzada por cada despliegue, en paralelo desde varias instancias, es una forma excelente de corromper una base de datos.
- **Ninguna migración del historial borra una tabla o una columna.** No hay ningún `DROP TABLE` ni `DROP COLUMN`. Sí hay un `DROP TYPE` en la migración 10, que es la única forma que da PostgreSQL de quitar valores de un enumerado; el aviso está arriba.
- **No hay rollback automático.** Prisma no genera migraciones inversas: la vía normal es corregir hacia delante con una migración nueva. Antes de cualquier cambio destructivo, copia o exportación previa.
- Verificado: las diez se aplican en orden sobre una base virgen sin errores (`npm run e2e:db:reset && npm run e2e:db:migrate`).

### Comandos

```bash
npx prisma migrate deploy   # PRODUCCIÓN y cualquier entorno automatizado
npm run db:migrate          # prisma migrate dev — interactivo, SOLO desarrollo
npm run db:generate         # regenera el cliente tras cambiar el schema
npm run db:studio           # explorador visual
npx prisma validate         # valida el esquema
```

---

## 21. Bootstrap de administración

### Dos formas de entrar, un solo sistema de autenticación

Desde la Fase 14 hay dos pantallas de acceso, y las dos acaban en la misma sesión de Better Auth:

| Pantalla | Qué pide | Disponible |
|---|---|---|
| `/admin/login` | **Una sola clave**, sin usuario | Siempre. Es la puerta del despliegue |
| `/admin/login/credenciales` | Correo y contraseña | **404 salvo que el entorno declare `ENABLE_CREDENTIALS_LOGIN=true`**, que solo hace el servidor de las pruebas E2E |

**En el despliegue hay una sola forma de entrar**, por decisión expresa del titular. La segunda pantalla existe porque las pruebas E2E inician sesión como ADMIN, COMMERCIAL y CONTENT para verificar que cada rol ve lo suyo y no ve lo ajeno, y eso no se puede comprobar con una clave que entra siempre como la misma cuenta. `playwright.config.ts` declara la variable; ningún otro sitio lo hace.

La consecuencia, dicha sin rodeos: **mientras esa variable no esté en el despliegue, CONTENT y COMMERCIAL no pueden iniciar sesión en producción.** Los roles siguen existiendo y sus permisos se siguen validando en servidor; lo que no hay es puerta para ellos. Es lo que se pidió, y el día que haya equipo basta con declarar la variable.

La clave única es una **decisión explícita del titular, tomada a sabiendas de lo que cuesta**, y lo que cuesta está en §25. Lo importante aquí es lo que *no* cambió: no se ha añadido un segundo sistema de autenticación —lo que las reglas del proyecto prohíben—, sino una forma distinta de abrir el que ya había. Al acertar la clave, el servidor inicia sesión contra una cuenta real con `auth.api.signInEmail`, y a partir de ahí todo el panel funciona como antes: permisos, `AuditEvent`, revocación de sesión y expiración incluidas.

Las tres variables que la configuran están en §18. **Sin ellas la pantalla existe pero no deja entrar**: no hay valor por defecto, así que un despliegue a medio configurar deja la puerta cerrada, no abierta.

### El registro público sigue desactivado

**El registro público está desactivado** (`emailAndPassword.disableSignUp`). No hay pantalla de alta, y el endpoint de registro de Better Auth rechaza las peticiones: hay una prueba que lo comprueba. Por tanto el primer usuario tiene que crearse fuera de la aplicación.

```bash
# 1. Poner las tres variables en el entorno
ADMIN_BOOTSTRAP_NAME=...
ADMIN_BOOTSTRAP_EMAIL=...
ADMIN_BOOTSTRAP_PASSWORD=...      # mínimo 12 caracteres

# 2. Ejecutar una vez
npm run admin:bootstrap

# 3. BORRAR las tres variables del entorno
```

- Es **idempotente**: si el usuario ya existe, no lo duplica.
- **No usa el endpoint público de alta**, que está desactivado: crea el usuario a través del adaptador interno de Better Auth, con el mismo hash de contraseña (scrypt) que usaría un alta normal.
- El paso 3 no es una recomendación. Una contraseña de administración en las variables de entorno de Vercel es una contraseña compartida con todo el que tenga acceso al panel de Vercel, para siempre.

**El alta de usuarios todavía no tiene pantalla.** `/admin/usuarios` lista al equipo y permite cambiar el perfil de cada persona, pero no crear cuentas: hoy la única vía es volver a ejecutar `npm run admin:bootstrap`, que crea un **ADMIN**, y ajustar después el perfil a CONTENT o SALES desde esa pantalla. Está en §Limitaciones conocidas, y es la razón por la que el procedimiento del manual insiste en el orden: crear y **después** degradar, no dejarlo en ADMIN. Detalle en `docs/autenticacion.md` §4.

Dos reglas que el sistema hace cumplir en servidor, no por convención:

- **Nadie puede cambiarse su propio perfil**, ni siquiera un ADMIN. El camino más probable al bloqueo era el más inocente —"a ver qué ve un CONTENT"—, y después ya no queda permiso para deshacerlo.
- **No se puede quitar el último perfil de administración.** Sin ADMIN se pierden la gestión de usuarios, la configuración del scoring, la exportación y las tres operaciones de privacidad del RGPD, y no hay forma de recuperarlo desde la interfaz. La comprobación y el `UPDATE` van en la misma transacción, para que dos degradaciones simultáneas no dejen cero.
- Cada cambio de perfil queda en `AuditEvent` con el perfil anterior y el nuevo, sin copiar datos personales.

### Autenticación, en resumen

- `/admin/login` es pública; `/admin` y toda subruta exigen sesión, comprobada **en servidor**.
- Contraseña mínima de 12 caracteres; hash scrypt (el de Better Auth por defecto).
- **Mensajes de login genéricos**: el mismo error exista o no la cuenta. Sin enumeración de usuarios.
- Rate limit persistente en base de datos. CSRF y validación de origen **sin desactivar**.
- Cookies `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- Tres roles con permisos por área: `users:manage` y `settings:manage` (ADMIN), `crm:access` (ADMIN, SALES), `cms:access` (ADMIN, CONTENT), `crm:export` (ADMIN).
- Cerrar sesión **revoca la sesión en el servidor**: la cookie anterior deja de servir. Comprobado en E2E.

---

## 22. Sembrado y demostración

Tres comandos separados, porque son tres cosas distintas. Hasta la Fase 10 un único `seed.ts` hacía las tres, y eso obligaba a elegir entre sembrar configuración o no sembrar nada.

| Comando | Qué siembra | Cuándo |
|---|---|---|
| `npm run db:seed` | Los 8 pesos del scoring. **Configuración operativa**, no datos de ejemplo: sin ella el CRM puntúa a todo el mundo con cero | Siempre, tras migrar |
| `npm run admin:bootstrap` | El primer usuario ADMIN | Una vez por instalación |
| `npm run demo:seed` | 6 fichas de ejemplo, equipo ficticio, 8 contactos con solicitudes por todo el pipeline, tareas, notas y la cuenta de evaluación | Solo si hace falta demostración |

`db:seed` es idempotente y actualiza solo la etiqueta de cada regla, **no sus puntos**: así el ajuste que haya hecho un ADMIN desde Configuración no se deshace al volver a sembrar.

### La demostración

Procedimiento completo, guion y retirada en **`docs/runbook-demo.md`**.

```bash
npm run demo:seed                        # idempotente: sembrar dos veces no duplica nada
npm run demo:clean                       # retira los datos de demostración
npm run demo:clean -- --cuenta           # además desactiva la cuenta de evaluación
npm run demo:clean -- --seco --cuenta    # dice qué borraría, sin borrar nada
```

Decisiones que hacen que la demo sea segura de enseñar y de retirar:

- **Todas las fichas de demostración llevan `isDemo`**, y quedan ocultas en producción salvo `ENABLE_DEMO_CONTENT=true`. Su equivalencia con la fuente original está probada campo por campo.
- **Los estados del pipeline se alcanzan moviendo cada solicitud por las transiciones reales** del dominio, no escribiendo el estado final. Así el historial y la auditoría de la demo son los que produciría el uso normal: abrir una solicitud ganada enseña los seis movimientos que la llevaron ahí.
- **Todos los correos terminan en `.test`**, un dominio reservado por la RFC 2606 que no resuelve. Ninguna dirección de la demo puede recibir un correo por error, ni siquiera si alguien activara el proveedor de correo por accidente. Y es la marca que permite a `demo:clean` borrar exactamente lo suyo.
- **El equipo ficticio no tiene contraseña.** Existe para firmar tareas y notas. Crear tres cuentas con contraseña conocida sería regalar tres puertas de entrada.
- **La cuenta de evaluación** se declara por variable de entorno y el script **no imprime nunca su contraseña**. Se entrega solo por canal privado (`docs/formulario-entrega-tfm.md`).
- **Al retirar, la cuenta se desactiva en vez de borrarse**: se revocan sus sesiones y se le quitan las credenciales, pero el usuario sigue existiendo porque la auditoría de la demo le apunta como autor. Un registro del que no se sabe quién hizo qué no sirve para nada.
- `demo:clean` borra los objetos del bucket **antes** de borrar las filas, porque después ya no habría lista de qué borrar, y **aborta si Storage no está disponible** en lugar de dejar objetos huérfanos silenciosamente.

---

## 23. Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción (valida tipos) |
| `npm start` | Sirve el build |
| `npm run lint` | ESLint 9 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` / `test:watch` | Vitest |
| `npm run db:generate` | Regenera el cliente de Prisma |
| `npm run db:migrate` | `prisma migrate dev` — **solo desarrollo** |
| `npm run db:seed` | Configuración operativa (pesos del scoring). Idempotente |
| `npm run db:studio` | Explorador visual de la base |
| `npm run admin:bootstrap` | Crea el primer ADMIN. Idempotente (§21) |
| `npm run storage:bootstrap` | Crea o reconcilia el bucket privado. Idempotente |
| `npm run notify:overdue` | Envía el resumen interno de tareas vencidas. **Manual**: no hay programador |
| `npm run privacy:retention` | Informa de qué contactos superan el plazo de retención. **No anonimiza** |
| `npm run demo:seed` / `demo:clean` | Sembrar y retirar la demostración (§22) |
| `npm run test:clean` | Retirar los contactos ficticios que dejan las pruebas de Vitest. `-- --seco` informa sin borrar; `-- --dominio=x.y` añade un dominio puntual |
| `npm run secrets:history` | Escáner de secretos sobre **todo el historial de Git** (§25) |
| `npm run email:test` | Comprueba la configuración de correo y **envía un correo real** con el adaptador del proyecto (Fase 20) |
| `npm run images:optimize` | Prepara una fotografía de cámara para servirla como fondo. `-- <origen> <destino> [ancho] [calidad]` (Fase 20) |
| `npm run e2e` | Las 23 pruebas end-to-end |
| `npm run e2e:env` | Crea `.env.e2e` con secretos aleatorios. No sobrescribe |
| `npm run e2e:setup` | Contenedor de PostgreSQL + migraciones + escenario |
| `npm run e2e:ui` / `e2e:report` | Modo interactivo / informe HTML |
| `npm run e2e:db:up` / `down` / `reset` | Contenedor de pruebas: levantar, parar, borrar con su volumen |
| `npm run e2e:db:migrate` / `e2e:seed` | Migrar y sembrar la base de pruebas |

---

## 24. Pruebas y resultados reales

| Tipo | Herramienta | Alcance |
|---|---|---|
| Tipos | `tsc --noEmit` | Modo estricto, sin `any` ni `ts-ignore`. Verde |
| Lint | ESLint 9 + `eslint-config-next` | Incluidas las reglas del compilador de React. **0 errores, 0 advertencias** |
| Validación | Vitest (puros) | 6 archivos: esquemas compartidos cliente/servidor, límites, normalización |
| Dominio y base de datos | Vitest contra PostgreSQL real | 14 archivos: contactos, solicitudes, contenido, scoring, tareas, notas, privacidad. Concurrencia, transacciones e inmutabilidad de consentimientos |
| Autenticación y autorización | Vitest contra Better Auth real | `requireSession`/`requireRole`/`requirePermission`, 401/403/200, alta pública rechazada, error genérico de login, logout que revoca, redirecciones del middleware |
| CMS | Vitest, incluido **contra el bucket real** | Validación de imagen por firma de bytes (JPEG-como-PNG, `.exe`, SVG, PDF, tamaño, dimensiones), anti-SSRF (13 destinos internos), permisos por rol en cada Server Action, publicación incompleta, objeto compartido no borrado, auditoría sin datos sensibles |
| Gate y publicación dinámica | Vitest, con espías sobre la capa de datos | El gate **no consulta contenido ni firma URL** sin sesión, slug directo protegido, cookie manipulada/caducada/revocada, el hash no sirve como token, rate limit persistente con IP hasheada, fallo de base de datos que no desbloquea |
| Captación | Vitest + Testing Library | Solicitud completa, dos solicitudes del mismo correo conservadas, first/last touch, privacidad rechazada sin guardar nada, política caducada (409), honeypot, tiempo mínimo, rate limit, doble clic concurrente, UTMs, ficha de origen verificada, fallo de persistencia sin filtrar el error |
| CRM | Vitest | Filtros y paginación, búsqueda normalizada, transiciones válidas e inválidas, `LOST` sin motivo rechazado dos veces, tareas, notas, scoring idempotente, métricas con denominador, exportación (filtros, el libro de Excel se abre y se comprueba su contenido real, sin identificadores internos) |
| Correo | Vitest | Selección de proveedor, enmascarado que nunca devuelve la dirección completa, clasificación 202/429/5xx/4xx/timeout, ni clave ni cuerpo en los motivos de fallo, enlace al CRM sin token, accesibilidad de las cuatro plantillas, fallo **después** de guardar sin tocar la solicitud |
| Seguridad | Vitest | **Ataque:** endpoints sin sesión (401) y con rol insuficiente (403), rol declarado por cabecera/cuerpo/cookie, cookie inventada, cookie VIP falsa, hash usado como token, sesión revocada, payload de 200 KB, HTML guardado como texto, respuesta de error sin stack ni rastro de Prisma, contacto anonimizado que no reaparece en ninguna exportación. **Secretos:** el árbol que git subiría, 11 patrones |
| Privacidad | Vitest | Retención con valores absurdos, exclusión de negociaciones vivas, exportación sin el hash del token, revocaciones auditadas sin destruir historial, anonimización campo por campo |
| SEO y metadatos | Vitest | `robots.txt` (Disallow de `/admin` y `/api`; **sin** bloquear las bibliotecas, donde la exclusión es por `noindex`), sitemap sin rutas VIP ni slugs, `noindex` en bibliotecas y fichas, títulos que no filtran el nombre real de la ficha, imagen de Open Graph que no es una URL firmada |
| Observabilidad | Vitest | Que ningún registro filtre datos personales ni un stack |
| Guardia de la base E2E | Vitest | 13 pruebas: rechaza la base de la aplicación comparando host, puerto y nombre —un `?pgbouncer=true` de diferencia no la despista—, hosts gestionados sin permiso explícito, hosts remotos cuyo nombre no delata que son de pruebas, y que ningún mensaje de error filtra la contraseña |
| **End-to-end** | Playwright 1.62 + Chromium, contra el **build de producción** y una base PostgreSQL **aislada** en Docker | 6 archivos, **23 pruebas** (≈40 s): los 13 escenarios críticos más nueve comprobaciones derivadas. Cada prueba actúa por la interfaz: ninguna inyecta cookies ni escribe en la base para llegar antes a un estado |
| CI | GitHub Actions | `npm ci` → lint → typecheck → test → **escáner del historial** → build. Sin secretos. Las E2E aún no están en CI (§32) |

### Resultados reales

Ejecutados el **13 de agosto de 2026**. Salidas reales, no previstas.

| Comando | Resultado |
|---|---|
| `npm ci` | Correcto, un único lockfile |
| `npm run lint` | **0 errores, 0 advertencias** |
| `npm run typecheck` | Sin errores |
| `npm test` | **698 pruebas en 58 archivos**, verdes (un intermitente residual, §Limitaciones conocidas) |
| `npm run e2e` | **23 pruebas, todas verdes** (≈40 s) |
| `npm run build` | Correcto, **sin ninguna petición de red** |
| `npx prisma validate` / `generate` | Esquema válido, cliente generado |
| `npm run secrets:history` | 5 commits, 288 versiones de archivo, **0 hallazgos** |
| Simulación del entorno de CI (sin `.env`) | 329 pruebas pasan, 325 se saltan solas, exit 0 |
| `npm audit` | 3 vulnerabilidades altas, heredadas de `next@16.0.10` (§32) |

### Lo que las pruebas encontraron

La evidencia más honesta de que una suite sirve es la lista de lo que encontró. **Cinco defectos de producto y dos de aislamiento**, todos corregidos y con su prueba de regresión. Están detallados en `docs/evidencias-tfm.md` §5; el más significativo:

> El botón «Quiero una boda así» precargaba el asunto pero **no** el tipo de evento, y el primer envío se rechazaba. Causa: el componente `Select` de la librería de interfaz, dentro de un `<form>`, dispara un evento `change` sintético en su `<select>` nativo oculto cada vez que cambia de valor; con el desplegable cerrado ese select solo tiene la opción vacía, así que escribía una cadena vacía sobre el valor precargado. **La prueba de la Fase 6 pasaba** porque volvía a elegir el tipo a mano.

No se ha medido porcentaje de cobertura, a propósito: un porcentaje alto no dice nada sobre si las pruebas comprueban lo que importa. La lista de defectos encontrados, sí.

---

## 25. Seguridad

Modelo de amenazas completo, con activos, actores, superficie, correspondencia OWASP y riesgos aceptados: **`docs/modelo-amenazas.md`**.

### Autorización

- **En servidor, en cada lectura y mutación privada.** No solo en el middleware, que es Edge y no llega a la base de datos. Hay pruebas que invocan cada mutación con la sesión equivocada y comprueban que **la base de datos no cambia**.
- **404 en vez de 403** al acceder sin permiso: un 403 confirmaría que el recurso existe.
- Exportar es un permiso propio (`crm:export`): consultar el CRM no implica poder sacarlo en un archivo.
- **El contenido VIP no se consulta, renderiza ni serializa antes de validar la sesión de acceso en servidor.** Es la garantía central del producto, y está probada espiando la capa de datos.

### La clave única del panel, y qué se pierde con ella

Desde la Fase 14, `/admin/login` pide una sola clave sin usuario (§21). Es una decisión del titular, y conviene que quien lea este documento sepa exactamente qué implica en lugar de encontrárselo:

- **Se pierde saber quién hizo cada cosa.** Los `AuditEvent` se siguen escribiendo, pero todos con el mismo actor. Con una sola persona operando es soportable; con equipo, el registro deja de servir para lo que existe.
- **Se pierde revocar a una persona.** Cambiar la clave se la cambia a todo el mundo.
- **Se pierde la separación de perfiles.** Quien entra por ahí entra como ADMIN, y como el acceso por credenciales responde 404 en el despliegue, CONTENT y COMMERCIAL no tienen puerta en producción. Sus permisos se siguen validando en servidor: lo que falta es por dónde entrar.

Lo que **no** se ha cedido, porque no formaba parte de la decisión:

- **La clave no está en el código.** Sale de `ADMIN_GATE_PASSWORD`. Escribirla en el repositorio la habría publicado en GitHub —y en su historial, aunque se borrara después—, y el escáner de secretos del propio proyecto la habría detectado. Que funciona se comprobó sin querer: la primera versión de las pruebas usaba un valor de ejemplo sin marcador reconocible y **el escáner rompió la suite**, que es exactamente su trabajo.
- **Rate limit propio**: cinco intentos cada diez minutos por IP, comprobado *antes* de mirar la clave. El de Better Auth solo entra en juego cuando la clave ya es correcta, así que no cubría este caso.
- **Comparación en tiempo constante**, sobre digests de longitud fija. Con una clave única y sin usuario, el tiempo de respuesta es la única señal medible desde fuera; comparar las cadenas directamente habría filtrado la longitud correcta.
- **Un fallo cerrado**: sin configuración no se entra, y una clave correcta con la cuenta mal configurada devuelve el mismo error que una clave incorrecta, para no convertir la pantalla en un oráculo sobre el estado del despliegue.

### Datos que no se guardan

- **Nunca una IP en claro**, ni un token en claro. HMAC-SHA256 con rotación de clave (`_PREVIOUS`), comparación de tiempo constante.
- Better Auth guardaba la IP y el user-agent completos de cada sesión y el proyecto no los usa: un hook los vacía antes de persistir. **No** se usó `advanced.ipAddress.disableIpTracking`, que era el interruptor obvio: además de no guardar la IP, deja al limitador sin clave y **desactiva el rate limit del login**. Cambiar protección contra fuerza bruta por minimización habría sido un mal negocio.
- `sanitizeMetadata` descarta contraseñas, tokens, IP y user-agent, y trunca cadenas antes de guardar cualquier metadato de actividad o auditoría.

### Entrada y salida

- Validación con el mismo esquema Zod en cliente y servidor; el servidor **revalida siempre**.
- **El texto libre no se transforma al guardarlo.** El saneado es de salida: JSX escapa en la interfaz y `escapeHtml` en el correo. Lo único que se elimina antes de persistir son caracteres de control, porque PostgreSQL rechaza el byte NUL. Transformar la entrada destruye lo que la persona escribió y no protege más.
- Los errores responden con **códigos, no con textos**, y nunca con los valores recibidos. Un fallo de escritura devuelve un error genérico y el motivo real queda solo en el log.
- Excel con **lista blanca de columnas**: una columna nueva del esquema no aparece por descuido. La **inyección de fórmulas dejó de ser posible** al pasar de CSV a `.xlsx`: la celda declara su tipo, así que una cadena que empieza por `=` sigue siendo una cadena (§10).
- Imágenes validadas por la **firma real de los bytes**. URL externas tras un filtro **anti-SSRF** (loopback, redes privadas, `169.254.169.254`, `.internal`/`.local`) y **anti-XSS** (solo `https:`).
- Rate limit persistente en base de datos, con incremento atómico y la clave siempre hasheada. Corregido un **falso 429**: `updateMany` con 0 filas afectadas significaba dos cosas distintas —límite agotado o fila desaparecida— y se trataban igual.

### Cabeceras

Siete cabeceras desde `lib/security/headers.ts`, con pruebas —una CSP escrita en la configuración es un sitio donde nadie mira hasta que algo se rompe en producción—: CSP con `default-src 'self'` y sin comodines, derivando el host de Supabase de la variable; `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-*`, y **sin cabecera de versión**.

La CSP se sirve en **Report-Only** salvo `CSP_ENFORCE=true`. Es una decisión, no un olvido: una CSP que rompe la web en el primer despliegue se acaba desactivando entera. Lo que falta para activarla está en §32.

### Secretos

Dos escáneres, porque son dos estados distintos:

- **El árbol** (`lib/security/secrets-scan.test.ts`, dentro de `npm test`): pregunta a git qué está versionado o sin ignorar —exactamente el conjunto que puede acabar publicado— y busca 11 patrones. Un `.env` lleno de claves reales no es un problema mientras esté ignorado; el problema es lo que sale del repositorio. **Ya evitó una fuga real:** en la Fase 6 el README llegó a contener la contraseña de administración en claro.
- **El historial** (`npm run secrets:history`): todas las versiones de todos los archivos de todos los commits, y los mensajes de commit. Hace falta porque limpiar el árbol no limpia el historial: un secreto borrado en un commit posterior sigue estando en el anterior, y en GitHub sigue siendo consultable por su URL para siempre.

Los dos comparten patrones y excepciones (`lib/security/secret-patterns.ts`), y cada excepción lleva su motivo escrito —hay una prueba que comprueba que lo lleva—. Estado actual: **árbol e historial limpios**. Procedimiento si algún día aparece algo: `docs/publicacion-github.md` §5, cuyo primer paso no es Git, es rotar la credencial.

### Healthcheck

`GET /api/health` devuelve `{ status: "ok" }` y nada más. Ni versiones —un healthcheck que anuncia «Next 16.0.10» es un catálogo gratis de vulnerabilidades—, ni configuración, ni excepciones. Hace una consulta mínima para distinguir «el proceso vive» de «el proceso llega a su base de datos».

### Vulnerabilidades conocidas

3 de severidad alta en dependencias transitivas de `next@16.0.10` (`postcss`, `sharp`), corregibles solo subiendo a `next@16.3.0`, fuera del rango declarado. No aplicado: queda como decisión para el equipo (§32).

---

## 26. Privacidad

### Principios aplicados

- **Consentimientos separados.** Privacidad y marketing son decisiones distintas en toda la web —formulario y gate—, y el de marketing va desmarcado de origen.
- **Consentimientos inmutables.** Cada uno es un evento con su finalidad, su valor, la versión de la política y la fecha. Revocar es un evento nuevo, nunca un `UPDATE`. Se lee siempre el **último** evento, así que una revocación futura funciona sin tocar ninguna consulta.
- **Minimización.** No se guarda lo que no se usa: ni IP, ni user-agent, ni el cuerpo de los correos, ni los términos de búsqueda en la auditoría. Los destinatarios de notificaciones se guardan **parcialmente ocultos**.
- **Sin promesa de más de lo que se hace.** El acuse de recibo al visitante es transaccional y no necesita consentimiento de marketing, pero **sin él solo confirma la recepción**: ni novedades ni contenido promocional. Colar promoción en un acuse convierte una base legal transaccional en un envío comercial no consentido.

### Derechos operativos (solo ADMIN, todo auditado)

| Derecho | Cómo | Detalle |
|---|---|---|
| **Acceso / portabilidad** | Copia completa de los datos de una persona en JSON | `/api/admin/crm/lead-data`. Sin el hash del token de sesión: no forma parte de sus datos y publicarlo sería un riesgo |
| **Supresión** | Anonimización transaccional | Vacía también el **texto libre** de sus solicitudes y **borra las notas** del equipo, conservando lo agregable. Revoca sus sesiones VIP y limpia los destinatarios de los avisos |
| **Oposición** | Revocación de marketing como evento nuevo `granted=false` | No destruye el historial |
| **Retirada del acceso** | Revocación de sesiones VIP | Efecto inmediato: la cookie deja de servir |

La anonimización se corrigió en la Fase 9 tras encontrar que solo tocaba las columnas del contacto y dejaba a la persona identificable en el texto libre de sus solicitudes y en las notas del equipo. **Anonimizar a medias es no anonimizar.**

### Retención

`DATA_RETENTION_MONTHS` (1–240, 36 por defecto). `npm run privacy:retention` **solo informa** de qué contactos superan el plazo, excluyendo negociaciones vivas. **Nada se anonimiza solo:** es irreversible y no puede depender de una tarea programada mal configurada.

### Registro

Estructurado, correlacionable por `requestId`, y **descarta por nombre de clave** correo, teléfono, nombre, mensajes, notas, tokens, IP y user-agent. **Nunca guarda el stack.** Códigos de error operativos estables, para poder buscar sin necesitar el texto.

### Pendientes legales

Esto es lo que el proyecto **no** hace, y es deliberado:

- **El plazo de retención concreto no está validado jurídicamente.** El mecanismo existe y es configurable; la cifra la tiene que fijar un profesional. Por eso la política de privacidad **no indica ningún plazo** en lugar de inventarlo.
- **La base jurídica de cada tratamiento necesita revisión profesional.** El apartado 5 de la política describe el tratamiento técnico real tras retirar Web3Forms, pero la redacción definitiva —identificación del encargado del tratamiento, contrato de encargo y transferencias internacionales si las hubiera— la tiene que validar alguien cualificado.
- **Los tramos de presupuesto del formulario no son tarifas de la finca**, sino una propuesta de trabajo pendiente de confirmación del cliente.

**Consecuencia operativa, dicha claramente:** con datos ficticios y la demostración puesta, el proyecto se puede desplegar hoy. **Antes de recoger datos de personas reales**, esos textos los tiene que firmar alguien cualificado.

---

## 27. Accesibilidad

Lo que está hecho, y lo que falta. Las dos listas importan.

### Implementado

- **Enlace de salto al contenido**, primer elemento tabulable de cada página pública, oculto hasta recibir el foco. Sin él había que recorrer la cabecera entera —logo, seis enlaces, CTA, idioma y acceso al panel— en cada página. Añadido en la auditoría final; todos los `<main>` públicos llevan el ancla.
- **`prefers-reduced-motion` respetado.** Animaciones y transiciones bajan a 1 ms y el desplazamiento suave de las anclas pasa a instantáneo. Se reduce a 1 ms en lugar de a `none` para no romper los componentes que esperan un evento `animationend`. Añadido en la auditoría final: antes no había nada, en un sitio con animaciones de entrada y revelación progresiva de imágenes.
- **Semántica y idioma.** `lang="es"` en el documento, encabezados jerárquicos, listas y tablas reales.
- **Cada landmark de navegación tiene nombre accesible y son distintos entre sí**, en el panel y en el sitio público. Hay tres a la vez en cualquier página —cabecera o menú móvil, más los dos del pie—, y sin nombre un lector de pantalla los lista como entradas idénticas. En el pie el nombre sale del encabezado visible con `aria-labelledby`, así que se traduce solo. Corregido en la auditoría final: estaba resuelto solo en `/admin` y el README lo declaraba general.
- **El menú móvil cerrado está `inert`:** fuera del recorrido de teclado y del árbol de accesibilidad. `opacity-0` y `pointer-events-none` no retiran nada de ninguno de los dos, así que por debajo de `xl` el foco entraba en ocho controles invisibles. Corregido en la auditoría final, con prueba.
- **Primitivas accesibles.** La interfaz se construye sobre Radix UI: foco, roles ARIA y navegación por teclado en diálogos, desplegables, pestañas y acordeones vienen resueltos y probados por la librería, en lugar de reimplementados.
- **Foco visible** en controles interactivos (`focus-visible`), sin eliminar el anillo de foco por estética.
- **El formulario comercial** tiene su región de resultado con `aria-live` y **recibe el foco** cuando el servidor responde, para que quien usa lector de pantalla se entere de que ha pasado algo. Un error no borra lo escrito. Probado en jsdom: movimiento de foco y atributos de la región.
- **El honeypot está fuera del alcance del teclado y de los lectores de pantalla**, para que nadie lo rellene por accidente y pierda su mensaje.
- **Texto alternativo obligatorio para publicar** en el CMS: sin él no se puede publicar una ficha, y la interfaz dice exactamente qué imagen le falta. Es la única forma de que se añada.
- **El tablero de seguimiento funciona con teclado, aunque se mueva arrastrando.** El arrastre se añadió en la Fase 20 revirtiendo la decisión contraria, y la objeción original era buena: un tablero con arrastre y sin alternativa deja fuera a quien no puede hacer el gesto. Con una tarjeta enfocada, `Ctrl`/`Cmd` más flecha izquierda o derecha la mueve a la fase válida anterior o siguiente, y cada movimiento se anuncia en una región `aria-live`. La instrucción de teclado está en la página, visible solo al recibir el foco.
- **Las tablas que se editan en la celda anuncian lo que guardan.** Acciones y Puntuación Visitantes guardan al cambiar un campo, sin botón; el resultado de cada guardado va a una región `aria-live` además del icono, porque un icono que aparece y desaparece no dice nada a quien no lo ve.
- **Los iconos de acción llevan nombre accesible.** En Contenidos Biblioteca las cinco acciones por fila son iconos sin texto, y cada uno lleva `title` —la sugerencia del navegador— y `aria-label` con el título de la ficha dentro: «Editar Boda de Ana y Luis», no «Editar». Con seis filas hay seis botones «Editar», y sin el título son indistinguibles al navegar por controles. Lo mismo en el conmutador de día y noche, que se quedó solo con el icono.
- **El bloque de filtros plegable es un `<details>` nativo**, no un desplegable propio: el rol, el estado expandido y el manejo de teclado vienen del navegador.
- **Las cuatro plantillas de correo** son accesibles: `lang="es"`, un `h1` real, `th scope="row"` en tablas de datos, `role="presentation"` en las de maquetación, sin imágenes, y **siempre con alternativa en texto plano** antes del HTML.
- **Contraste** derivado de los tokens de color de la marca, con texto sobre fondos sólidos. Los placeholders del formulario público se corrigieron en la auditoría final: iban al 50 % de opacidad sobre el token, lo que los dejaba en torno a 2:1 —por debajo del 4,5:1 exigido—, y llevan información que no está en la etiqueta (el formato del teléfono, el orden de magnitud de los invitados).

### Lo que falta

- **No se ha escuchado con un lector de pantalla real.** Se prueban los atributos, los nombres de los landmarks y el movimiento del foco en jsdom, pero eso no es lo mismo que oír cómo se anuncia. Sin NVDA o VoiceOver de verdad, no se puede afirmar que la experiencia sea buena, solo que la estructura es correcta.
- **Sin auditoría formal WCAG.** No se ha ejecutado ni axe ni Lighthouse contra el sitio desplegado (§29), así que no hay un nivel de conformidad que declarar. Declararlo sin medirlo sería peor que no declararlo.
- **El menú móvil no gestiona el foco al abrirse ni se cierra con Escape.** Ya no atrapa el foco cuando está cerrado, que era el problema grave, pero al abrirlo el foco se queda en el botón en lugar de entrar en el panel. Es una mejora pendiente, no un bloqueo.

---

## 28. SEO

### Implementado

- **Solo se indexa el sitio oficial.** `lib/seo/indexing.ts` responde a una única pregunta —¿el origen desde el que se sirve esto es el dominio del negocio?— y de ella cuelgan las tres señales: el `X-Robots-Tag: noindex, nofollow` que se emite en todas las respuestas cuando no lo es, el sitemap, que solo se genera y solo se declara en `robots.txt` cuando sí lo es, y el valor por defecto, que es **no indexar**. Así el subdominio de demostración, las previews de Vercel y el desarrollo local quedan fuera de los buscadores sin que nadie tenga que acordarse de configurar nada, y el sitio oficial se indexa en cuanto `NEXT_PUBLIC_SITE_URL` es su dominio. Motivo y coste en §32.

  **La exclusión se hace con la cabecera, no con un `Disallow: /`**, y la diferencia importa: un rastreador que tiene prohibido el acceso tampoco puede leer la orden de no indexar, y Google puede acabar listando la URL a secas —sin título ni descripción— si alguien la enlaza desde fuera. Para desaparecer de los resultados hay que **dejar rastrear y decir que no se indexe**, que es lo contrario de lo que sugiere la intuición. Es el mismo razonamiento que ya gobernaba las bibliotecas VIP, aplicado al sitio entero.
- **Metadatos por ruta.** Título, descripción, canonical y Open Graph en cada página, con `generateMetadata` donde el contenido es dinámico.
- **`robots.txt`** (`app/robots.ts`, con pruebas): permite el sitio, **prohíbe `/admin` y `/api`**, y declara el sitemap con URL absoluta cuando hay sitemap que declarar.
- **`sitemap.xml`** (`app/sitemap.ts`): solo la home. **No incluye las bibliotecas VIP ni ningún slug de ficha**, y eso es deliberado por dos razones: un buscador solo vería el formulario del gate, y publicar los slugs revelaría qué fichas existen sin que nadie haya dejado su correo.

  **Tampoco las tres páginas legales, y esto se corrigió en la auditoría final:** estaban en el sitemap *y* emitían `robots: { index: false }`. Un sitemap es una petición explícita de indexación y el `noindex` es la orden contraria, así que Search Console habría marcado como error de cobertura tres de las cuatro URL enviadas desde el primer rastreo. Se alineó el sitemap con el `noindex` —y no al contrario— porque es la opción que no cambia qué se indexa. Hay una prueba que lee el metadata real de cada página y falla si alguien vuelve a poner las dos señales en contra.
- **`noindex` en las bibliotecas y sus fichas**, mientras el contenido esté cerrado.
- **Dos mecanismos distintos para dos problemas distintos**, que es la parte que se hace mal a menudo:
  - `/admin` y `/api` se bloquean en `robots.txt`. Su contenido no debe aparecer nunca y no se pierde nada impidiendo el rastreo.
  - Las bibliotecas **no** se bloquean ahí: son rutas que algún día serán públicas, y para excluir contenido de los resultados la forma correcta es el `noindex` de cada página. Bloquearlas en `robots.txt` daría exactamente el resultado que se quiere evitar —URL indexadas sin que el buscador pueda leer la etiqueta que pide no indexarlas—.
- **Títulos que no filtran.** El título de una ficha protegida es genérico («Boda real»), no el real: construirlo desde la base de datos obligaría a leer la ficha **antes** de validar el acceso. Hay una prueba que lo comprueba.
- **La imagen de Open Graph es un asset público**, nunca una URL firmada del bucket: una URL firmada en una etiqueta `og:image` es un acceso al archivo para cualquiera que lea el HTML.
- **Datos estructurados** JSON-LD (`components/structured-data.tsx`).
- **Todo `/admin` se sirve con `no-store` y `noindex`.**
- **Sin cabecera de versión del framework.**

### Pendiente

Métricas reales de posicionamiento: no las habrá mientras el despliegue esté excluido de los buscadores a propósito, y esa exclusión es deliberada (§32). Core Web Vitals sí se pueden medir ya sobre el despliegue actual; no se ha hecho (§29).

---

## 29. Rendimiento

### Decisiones tomadas

- **Tipografías locales, cero peticiones a terceros.** Tres familias **variables**, subconjunto latin, un archivo por familia en lugar de cinco pesos. Servidas desde el propio dominio con `next/font/local`. Tres efectos: el build no depende de la red, el navegador del visitante no le pide nada a Google —así que su IP no viaja—, y hay peticiones menos en la ruta crítica.
- **Imágenes optimizadas** por `next/image`, con `remotePatterns` **mínimos**: solo el host de Supabase y solo la ruta de objetos firmados.
- **Estático donde se puede.** De las 32 rutas del build, **7 se prerenderizan** —home, las tres páginas legales, `robots.txt`, `sitemap.xml` y la de error— y 25 se sirven en servidor bajo demanda: las 15 del panel y las 6 de API, porque dependen de la sesión, y las 4 de las bibliotecas VIP, por la razón que se explica más abajo.
- **Consultas sin N+1.** Las relaciones se traen con `include` en un número fijo de consultas, no una por fila. Las colecciones de las fichas 360º están acotadas (últimos 50 movimientos, últimas interacciones), y el camino para el histórico completo es el listado paginado o la exportación, que tiene tope de 5.000 filas.
- **Paginación en servidor** en todos los listados del panel, con orden por lista blanca cerrada y un segundo criterio estable para que ninguna fila salga en dos páginas.
- **El correo no está en la ruta crítica.** Se envía después del commit y después de responder al visitante.

### La cortina de carga, y qué no hace

**Un preloader no acelera nada.** Lo que hace es tapar el momento en que la página se pinta a medias —la tipografía del sistema que salta a la definitiva, las imágenes entrando de una en una— y sustituirlo por una pantalla de marca. En una conexión lenta eso mejora la percepción; en una rápida añade el tiempo del desvanecido, 420 ms. Se pidió así y se hizo así, con el diseño puesto en que no pueda romper nada:

- **La retira el CSS, no el JavaScript.** La regla lleva una animación con retardo que la desvanece sola a los 4,5 s. Si el bundle no llega, está bloqueado o falla la hidratación, la web se ve igual. Con el JavaScript como único responsable, cualquiera de esos fallos deja una pantalla en blanco permanente.
- **`pointer-events: none` siempre.** Incluso opaca, los enlaces de debajo responden.
- **Se pinta desde el servidor**, en el HTML inicial: un componente de cliente aparecería después de descargar el bundle, es decir, cuando ya no hace falta.
- **La marca de «ya cargó» vive en `<html>`**, no en la propia cortina. La cortina se desmonta al entrar en /admin y se vuelve a montar al salir; con la marca en su elemento, cada vuelta al sitio público traería un destello de cortina en una navegación que no carga nada.

### Coste asumido, dicho claramente

- **Las bibliotecas VIP son `force-dynamic`.** Cada visita consulta la base de datos y actualiza la marca de uso de la sesión. Es lo que permite que publicar se vea al instante, pero significa que estas rutas no se sirven desde caché estática. Con el volumen previsto —una finca, no un medio de comunicación— es la decisión correcta; si el tráfico creciera mucho, habría que introducir caché por sesión.
- **Las URL firmadas duran una hora**, así que `next/image` reoptimiza cada imagen como máximo una vez por hora. Aceptable, pero no gratis.
- **Las imágenes se guardan tal cual** (con el límite de 10 MB por archivo): no hay recorte, redimensionado ni generación de miniaturas.

### Lo que no está medido

**No hay métricas de Lighthouse ni de Core Web Vitals**, porque requieren el sitio en producción. La preparación está hecha —imágenes optimizadas, tipografías locales, sin peticiones a terceros, páginas estáticas donde se puede—, pero **preparación no es medición**, y este documento no va a presentar una como la otra. Es el primer paso después de desplegar (§33).

---

## 30. Despliegue en Vercel

**Desplegado** en https://elportondelacondesa.solucionesbonicas.com, un subdominio del sitio de servicios del autor. No es el dominio del negocio: `elportondelacondesa.com` sigue sirviendo el WordPress original, y esta aplicación convive con él en lugar de sustituirlo. Por eso **este despliegue está excluido de los buscadores**; el mecanismo y el motivo, en §28.

La base de datos es el proyecto de Supabase descrito en §19, con las nueve migraciones aplicadas (`prisma migrate status` → *Database schema is up to date*).

Procedimiento completo en **`docs/despliegue-vercel.md`**, verificado contra la configuración real del repositorio: requisitos, enlace del proyecto, las variables de cada entorno (Development / Preview / Production) **sin valores**, la pareja de conexiones de Supabase, el bucket privado, el build, las migraciones, el bootstrap del ADMIN, el dominio, trece smoke tests, el rollback, la recuperación si el proyecto gratuito de Supabase se pausa, y cómo retirar `ENABLE_DEMO_CONTENT`.

### Qué hace el despliegue reproducible

- **Un único lockfile** (`package-lock.json`): `npm ci` instala exactamente lo declarado.
- **`npm ci` es autosuficiente.** Un `postinstall` genera el cliente de Prisma. Sin él, una instalación limpia dejaba un cliente incompleto y `npm run typecheck` fallaba con "Module '@prisma/client' has no exported member 'ContentType'" — es decir, **CI habría estado rojo en el primer runner limpio**, y cualquiera que clonase el repositorio se habría encontrado lo mismo. No se detectó antes porque en local el cliente ya estaba generado de una ejecución anterior: el fallo solo aparece cuando `node_modules` se crea de cero, que es lo que nadie hace en local y CI hace siempre. Encontrado en la auditoría final (§37), con prueba en `lib/testing/reproducible-install.test.ts`.
- **El build no sale a Internet.** Las tipografías se sirven desde el repositorio; con `next/font/google` el build llegó a fallar con doce errores de red.
- **`engines.node` declarado** (≥ 22), que es lo que Vercel lee para elegir el runtime.
- **Sin `ignoreBuildErrors` ni exclusiones**: el build valida tipos de verdad.
- **`remotePatterns` mínimos.**
- **Vercel no aplica migraciones.** Se aplican a mano con `prisma migrate deploy` (§20).

### Qué falta

Comprobar en Vercel que `BETTER_AUTH_URL` y `NEXT_PUBLIC_SITE_URL` valen exactamente `https://elportondelacondesa.solucionesbonicas.com`. Es el paso que se olvida al asignar un dominio: si `BETTER_AUTH_URL` no coincide con el origen desde el que se sirve la aplicación, Better Auth responde `403 INVALID_ORIGIN` y **el login del panel falla con el mensaje genérico de credenciales incorrectas** — el mismo síntoma que ya se diagnosticó en la Fase 3 (§37).

Para la demostración: **`docs/runbook-demo.md`**. Para el equipo: **`docs/manual-admin.md`**. Estado de cada requisito con su evidencia: **`docs/checklist-aceptacion.md`** y **`docs/evidencias-tfm.md`**.

---

## 31. Metodología y uso de IA

### Cómo se ha trabajado

Doce fases secuenciales. Cada una con su enunciado escrito, su implementación, su validación con **comandos reales** y su entrada en el historial de este documento (§37).

```
enunciado de fase → inspección del código existente → implementación
        ▲                                                    │
        │                                                    ▼
     revisión ◄──── lint · typecheck · pruebas · build ──────┘
```

El contrato de trabajo está en `CLAUDE.md` y es vinculante: fuente de verdad en el código y no en la documentación, prohibido inventar datos de negocio, prohibido ocultar errores con `any` o `ignoreBuildErrors`, prohibido mezclar dos ORM o dos sistemas de autenticación, prohibido hacer commit, push o despliegue sin petición explícita, y documentación obligatoria por fase.

Dos reglas de ese contrato han condicionado el resultado más que ninguna decisión técnica:

- **No se marca como terminado lo que no se ha probado.** De ahí que este documento tenga tantos `PENDIENTE` y una sección de limitaciones tan larga.
- **Detente al final de cada fase para revisión.** Ninguna fase se encadena con la siguiente sin que una persona lea lo que salió.

### Uso de IA

El desarrollo se ha hecho con **Claude Code** como asistente de desarrollo full-stack, siguiendo el flujo de prompts documentado en `project-reference/docs/02-prompts-claude-code.md`.

Reparto honesto: el asistente ha escrito la mayor parte del código. Lo que no se ha delegado es el criterio —qué construir, qué rechazar y qué dar por bueno—, la verificación, y las decisiones de §14, incluidas las de rechazar cosas: el CAPTCHA, Prisma 7, la CSP bloqueando desde el primer día.

**Dos de esas decisiones se revirtieron después, y las dos por petición del titular:** el arrastrar y soltar del tablero (Fase 20) y la reducción del pipeline a cinco fases (Fase 21). Quedan anotadas como reversiones y no reescritas como si nunca se hubiera decidido lo contrario, porque el motivo original —la accesibilidad del arrastre, la coherencia de un enumerado con nueve valores— seguía siendo válido y obligó a resolver el problema, no a ignorarlo: el arrastre llegó con alternativa de teclado, y las cinco fases con su migración en el esquema en lugar de un agrupamiento al pintar.

Y el dato que mejor describe el método: **las pruebas encontraron defectos reales que ni el asistente ni la revisión humana habían visto leyendo el código.** Uno de ellos impedía enviar el formulario desde el botón de una ficha, y la prueba que existía para ese flujo lo tapaba. Están enumerados en `docs/evidencias-tfm.md` §5. Un proyecto asistido por IA sin esa lista es un proyecto que no se ha comprobado.

---

## 32. Limitaciones conocidas

Ordenadas por lo que importa. Cada una con su motivo.

### Legales y de negocio

- **La base jurídica y el plazo de retención necesitan revisión profesional.** El mecanismo existe y es configurable; la cifra y la redacción las tiene que fijar alguien cualificado. La política de privacidad **no indica ningún plazo** en lugar de inventarlo (§26).
- **Los tramos de presupuesto** del formulario son una propuesta de trabajo, no tarifas de la finca. Marcado con `TODO(negocio)` en el código.
- **Contenido pendiente de verificar con el cliente**, marcado explícitamente en el código: la fotografía `public/images/porton/02-salon-celebraciones.jpg` lleva marca de agua de un fotógrafo externo **sin derechos de uso confirmados**; el teléfono y el código postal del aviso legal original son inconsistentes con el resto de la web; la ficha de Bodas.net está pendiente de confirmación; y el CIF y los datos registrales del aviso legal siguen como `[PENDIENTE]`.

### Seguridad

- **La CSP se sirve en Report-Only.** Recoge violaciones, no bloquea. Falta pasarla a bloqueo y montar un receptor de informes. Además usa `'unsafe-inline'` en `script-src` y `style-src` porque Next emite scripts en línea para hidratar y Tailwind inyecta estilos; la solución correcta es una CSP con nonce por petición, que exige tocar cada punto de render.
- **Sin segundo factor.** Un ADMIN comprometido lo pierde todo: no hay 2FA ni aprobación de dos personas para exportar o anonimizar. Con un solo operador es proporcionado; con equipo, es el siguiente paso.
- **El gate VIP no verifica el correo.** Cualquiera puede escribir la dirección de otra persona y acceder. La plantilla de verificación está preparada y probada; faltan la ruta que consuma el enlace, el cambio en el gate y la caducidad del token.
- **Sin alertas ni agregador de logs.** Los registros son estructurados y correlacionables, pero nadie los vigila: un ataque sostenido se vería *después*.
- **El tiempo mínimo de formulario es falsificable**: se calcula con un valor que envía el cliente. Es un filtro de automatismos ingenuos que se suma al honeypot y al rate limit, no una defensa criptográfica. Documentado como tal en el código.
- **El honeypot puede perder un mensaje legítimo** si un gestor de contraseñas o una extensión rellena el campo oculto. Es el compromiso habitual de la técnica, asumido a conciencia.
- **3 vulnerabilidades altas** en dependencias transitivas de `next@16.0.10` (`postcss`, `sharp`), corregibles solo subiendo a `next@16.3.0`.
- Los diez riesgos aceptados, con su justificación, en `docs/modelo-amenazas.md` §7.

### Correo

- **No hay entrega garantizada.** `RETRY_PENDING` describe un fallo que merecería reintento y **nada lo reintenta**. Es deliberado: montar media cola daría sensación de fiabilidad sin la fiabilidad.
- **`SENT` no significa «llegó a la bandeja»**, solo que el proveedor aceptó el mensaje. Saber qué pasó después exigiría webhooks, que no están integrados.
- **El envío está verificado de punta a punta con Resend** desde la Fase 20 (`npm run email:test` y un formulario real cuyo aviso llegó a la bandeja). Lo que sigue probado con `fetch` simulado es la **clasificación de las respuestas de error**: no se han provocado un 429 ni un 500 reales del proveedor.
- **El remitente es `onboarding@resend.dev`**, que no exige verificar dominio pero **solo escribe a la dirección titular de la cuenta**. Por eso el acuse al visitante sigue apagado: encenderlo antes de verificar el dominio propio no daría un error visible en la web —la solicitud se guarda igual— sino un fallo silencioso por cada visitante.
- **El resumen de tareas vencidas es manual.** No hay programador en el proyecto, así que no se afirma ninguna periodicidad. Tampoco se ha expuesto como endpoint HTTP: una ruta que envía correos sin exigir sesión es una vía de abuso.

### Accesibilidad

- **Sin escucha con lector de pantalla real y sin auditoría formal WCAG.** Se prueban atributos, nombres de landmarks y movimiento del foco en jsdom, que no es lo mismo que oír cómo se anuncia. El enlace de salto y `prefers-reduced-motion` sí están, desde la auditoría final. Detalle y motivo en §27.
- **El menú móvil no gestiona el foco al abrirse ni se cierra con Escape.**

### Indexación: por qué este despliegue no sale en Google

No es una limitación pendiente, es una decisión, pero conviene entenderla antes
de tocarla. La aplicación vive en `elportondelacondesa.solucionesbonicas.com` y
el negocio sigue teniendo su WordPress en `elportondelacondesa.com`. Publicar el
mismo contenido en los dos sitios habría enfrentado al proyecto contra su propio
cliente en los resultados de búsqueda, así que **solo se indexa el despliegue
servido desde el dominio oficial** (§28). El día que esta aplicación sustituya al
WordPress y `NEXT_PUBLIC_SITE_URL` pase a ser ese dominio, la indexación se
activa sola.

Lo que había antes era el peor de los mundos y se corrigió en la Fase 13: el
subdominio publicaba un `sitemap.xml` con las URL del *otro* dominio. Search
Console rechaza un sitemap cuyas URL están fuera del dominio que lo sirve, así
que no servía para nada; y si algún buscador lo hubiera seguido, habría
encontrado dos sitios casi idénticos.

**El coste real de la decisión**, que es lo que hay que saber: no se pueden medir
posicionamiento ni impresiones sobre este despliegue, porque no lo hay. Para el
tribunal es indiferente —nadie necesita que una demo esté en Google para
evaluarla— y para el negocio es exactamente lo que interesa.

### Escala: dos límites conocidos, con su umbral

Los dos se encontraron en la auditoría final. Ninguno se ha reescrito, y el motivo es el mismo: la corrección exige rehacer una consulta, y en la última fase eso tiene más riesgo que un límite que está tres órdenes de magnitud por encima del volumen real. Lo que sí se ha hecho es **corregir los comentarios que afirmaban lo contrario**, para que nadie dé por acotado lo que no lo está.

- **El tablero del pipeline tiene tope global, no por columna.** Trae 225 solicitudes ordenadas por prioridad y las reparte por estado en la interfaz. Con **más de 225 solicitudes activas**, si las primeras 225 caen todas en un mismo estado, las demás columnas se pintan con `(0)` y "Vacío" aunque tengan solicitudes vivas — un comercial vería un embudo sin negociaciones en curso. El parámetro se llama `limitPerColumn` y el docstring decía "con tope por columna": las dos cosas eran falsas y están corregidas. El listado paginado de Solicitudes es la vista completa y fiable. Arreglarlo son nueve consultas en un `Promise.all` más un `groupBy` de conteos.
- **`averageHoursToFirstContact` calcula la media en memoria.** Trae todas las solicitudes del periodo y todas sus actividades de cambio de estado, sin `take`. Con del orden de **65.000 solicitudes** el `IN (...)` supera el límite de parámetros de PostgreSQL y **el Resumen entero devuelve 500**, no solo esa tarjeta, porque va dentro del mismo `Promise.all`. Mucho antes de eso ya sería la consulta más lenta del panel. El docstring del módulo afirmaba "nunca se carga la base en memoria"; ahora enumera las dos excepciones reales. Arreglarlo es un `$queryRaw` con `FILTER` y `AVG(EXTRACT(EPOCH ...))`.

### Funcionalidad

- **La clave única del panel no distingue quién entra, y es la única puerta del despliegue.** Todo lo que se hace queda auditado con el mismo actor, cambiar la clave se la cambia a todo el mundo, y CONTENT y COMMERCIAL no pueden iniciar sesión en producción porque el acceso por credenciales responde 404 sin `ENABLE_CREDENTIALS_LOGIN`. Es una decisión del titular, no un descuido; el detalle está en §25.
- **El alta de usuarios no tiene pantalla.** `/admin/usuarios` lista al equipo y cambia perfiles, pero no crea cuentas: hay que volver a ejecutar `npm run admin:bootstrap`, que crea un **ADMIN**, y degradar después. El README, el manual y la propia pantalla de Configuración prometían un alta desde el panel que no existía, lo que empujaba a dar privilegios de administración a todo el equipo; los tres textos están corregidos. Implementarla es una Server Action con creación de `User` + `Account` de credenciales y su auditoría.
- **La tarea de seguimiento no guarda a qué solicitud pertenece.** El enlace queda en la actividad que registra su creación, no como columna, así que la vista de Tareas no puede filtrar por solicitud. Arreglarlo es una columna, una migración y un cambio en la vista.
- **No se pueden añadir vídeos externos desde el editor.** El servicio y su validación están implementados y probados, pero el formulario solo sube imágenes. La media externa existente sí se lista, ordena y borra.
- **Las etiquetas se pueden filtrar y se muestran, pero no hay pantalla para crearlas ni asignarlas.** El modelo existe desde la Fase 2.
- **La fusión de contactos no está implementada.** El aviso de posibles coincidencias no fusiona nada: decidir qué consentimiento e historial sobreviven necesita criterio humano y un diseño propio.
- **Cambiar un peso de scoring no recalcula toda la base al instante.** Cada contacto se pone al día en su siguiente movimiento, y cada ficha tiene un botón para recalcular al momento. Recorrer miles de filas dentro de una petición web sería peor que esa desactualización.
- **El filtro de consentimiento de marketing busca si existe un evento concedido.** Hoy equivale al estado vigente porque solo se registra el consentimiento cuando se concede; si algún día se registran revocaciones habrá que mirar el último evento por fecha.
- **El panel es monolingüe en español**, a propósito. Traducción del sitio público limitada a navegación, home, contacto y enlaces legales.
- **Los usuarios del equipo de demostración no tienen credenciales**: existen para firmar tareas y notas, no para iniciar sesión.

### Pruebas y operación

- **El intermitente residual quedó capturado y corregido en la Fase 15.** Eran **dos** mecanismos, no uno, y los dos venían del mismo origen: Vitest ejecuta los archivos **en paralelo** contra una única base de desarrollo. El primero, un estado global compartido —`ScoringRule` es una tabla de configuración, y un archivo cambiaba pesos mientras otro comprobaba que recalcular dos veces da el mismo número—. El segundo, el mismo defecto de relación obligatoria que la auditoría había corregido en la exportación **pero no en el listado de Solicitudes**, que es la pantalla donde el equipo trabaja todo el día. Ambos con su corrección y su prueba (§Historial, Fase 15), y después **tres pasadas consecutivas de la suite completa en verde**. La solución de fondo —una base aislada por archivo— sigue siendo la de la línea siguiente.
- **Las pruebas de Vitest que usan base de datos corren contra la base de desarrollo real**, no contra una aislada. Las E2E **sí** usan una propia y desechable desde la Fase 10, pero migrar las de Vitest al mismo contenedor está pendiente y merece su propia revisión. Mientras tanto, cada ejecución completa deja cientos de contactos ficticios en el CRM: se retiran con **`npm run test:clean`**, que solo alcanza dominios reservados por el IETF y por tanto no puede tocar a nadie real (§Scripts).
- **Las E2E no están en integración continua.** Necesitan un PostgreSQL de servicio y las credenciales de Storage como secretos del repositorio. La guardia ya contempla ese caso (`E2E_ALLOW_NONLOCAL`), así que es configuración, no desarrollo.
- **El escenario E2E de subida de imagen usa el bucket real de Supabase.** Storage no tiene equivalente local: su API no es S3, así que ni MinIO sirve. El sembrado borra los objetos de la ejecución anterior; si alguien borra el volumen sin sembrar, quedan unos pocos PNG huérfanos de 40 KB.
- **Sin métricas de Lighthouse ni de Core Web Vitals medidas sobre el despliegue.** Ya hay dónde medirlas (§30); no se han ejecutado, así que no se declara ninguna cifra (§29).
- **Sin verificación en navegador de algunos detalles de la interfaz** anteriores a la Fase 10: el arrastre de orden de la media y los estados de carga del editor se comprobaron con peticiones reales y pruebas automatizadas, pero no visualmente.
- `middleware.ts` genera un **aviso de obsolescencia** en el build de Next 16 (`"middleware" file convention is deprecated, use "proxy" instead`). Sigue siendo funcional; no se ha renombrado por no tener confirmada la convención exacta de exportación de esa nueva API sobre un componente de seguridad.
- Se usa **Prisma 6 en vez de 7** por una razón de arquitectura (§14), no por desconocimiento.
- El host de **conexión directa de Supabase no resuelve** en este entorno; se usa el pooler en modo Session para migraciones (§19).

---

## 33. Roadmap

### Hecho

1. ~~Schema de Prisma, cliente y primera migración.~~ **Fase 2**
2. ~~Better Auth para `/admin`, con registro público desactivado.~~ **Fase 3**
3. ~~CMS de contenido y media en bucket privado.~~ **Fase 4**
4. ~~Conectar las rutas públicas al CMS.~~ **Fase 5**
5. ~~Sustituir el gate de cliente por acceso validado en servidor.~~ **Fase 5**
6. ~~API propia del formulario, sustituyendo Web3Forms.~~ **Fase 6**
7. ~~CRM completo: dashboard, pipeline, tareas, informes.~~ **Fase 7**
8. ~~Correo transaccional desacoplado.~~ **Fase 8**
9. ~~Endurecimiento de seguridad, privacidad, SEO y operación.~~ **Fase 9**
10. ~~Pruebas E2E con base aislada y preparación del despliegue.~~ **Fase 10**
11. ~~Documentación de entrega y preparación de la publicación.~~ **Fase 11**
12. ~~Auditoría correctiva final: revisión como pull request ajena, con corrección y prueba de cada defecto.~~ **Fase 12**
13. ~~Publicación del código con licencia MIT y despliegue en producción.~~ **Fase 13**
14. ~~Acceso al panel con clave única y su rediseño.~~ **Fase 14**
15. ~~Retirada de los datos ficticios de la base.~~ **Fase 15**
16. ~~Identidad propia del panel y contraste del menú público.~~ **Fases 16 a 19**
17. ~~Correo real por Resend, exportación a Excel y tablero con arrastre.~~ **Fase 20**
18. ~~Pipeline de cinco fases, panel en lenguaje de negocio, gráficas y tablas editables.~~ **Fase 21**
19. ~~Cierre de sesión real en despliegue, credenciales siempre, borrado de contactos y navegación agrupada.~~ **Fase 22**

### Siguiente, por orden

1. **Rotar la clave de API de Resend**, que se compartió por chat y hay que dar por comprometida.
2. **Verificar un dominio propio en Resend** y cambiar `LEADS_FROM_EMAIL`. Hasta entonces el acuse al visitante se queda apagado (§32).
3. **Revisión jurídica** de la base legal y el plazo de retención. La política nombra ya a Resend y declara el correo activo.
4. **Métricas reales** de Lighthouse y Core Web Vitals sobre el sitio desplegado, incluida la cortina de carga.
5. **Accesibilidad:** una escucha con lector de pantalla real y una auditoría formal WCAG.
6. **CSP en bloqueo** con nonce por petición y receptor de informes.
7. **E2E en integración continua** (contenedor de servicio + secretos de Storage) y migración de las pruebas de Vitest al contenedor aislado.
8. **Verificación del correo en el gate**, si se decide exigirla: la arquitectura ya está preparada.
9. **2FA para ADMIN** y alertas sobre los logs.
10. **Entrega garantizada de correo:** programador para reintentar los `RETRY_PENDING`, idempotencia por mensaje y webhooks del proveedor.
11. **Completar la media del CMS:** vídeos externos desde el editor, y valorar redimensionado y miniaturas.
12. **Gestión de etiquetas** y **fusión de contactos**.
13. **Buscador en Contenidos Biblioteca**, si la biblioteca crece: al retirar los filtros de esa pantalla se quedó solo con la paginación, que basta con siete fichas y no con setenta.

---

## 34. Licencia

**MIT**, decidida por el titular en la Fase 13. El texto está en **`LICENSE`**.

Es la licencia habitual en una entrega académica: permisiva, de una página, y permite a cualquiera leer, citar y reutilizar el código conservando la autoría. Se eligió frente a Apache-2.0 —también permisiva, pero con concesión expresa de patentes y obligación de declarar modificaciones— porque este proyecto no tiene patentes que conceder y la brevedad importa cuando el lector es un tribunal.

**La licencia cubre el código fuente y nada más.** El propio `LICENSE` lo dice en sus dos últimos párrafos, en inglés y en español, para que no haya que leer el `NOTICE` para enterarse: la marca, el nombre, el logotipo, las fotografías y los textos comerciales de El Portón de la Condesa **no son software**, no pertenecen al autor y no se licencian aquí. Ver §35.

Queda una comprobación que no es técnica y sigue siendo del titular: si existe contrato con el cliente, confirmar que la titularidad del código permite licenciarlo así. Desarrollado en **`docs/publicacion-github.md`** §6.

**Lo que sí está decidido, y no depende de esa elección:** ninguna licencia de software que se aplique al código cubre el contenido del negocio. Ver §35.

---

## 35. Derechos de marca y assets

Detalle completo, archivo por archivo, en **`NOTICE`**.

Este repositorio contiene dos cosas con dueños distintos: **software** y **contenido de un negocio real**. Nadie puede tomarlo y republicar la marca, las fotografías o los textos de El Portón de la Condesa, ni con licencia abierta ni sin ella.

| Qué | Titular | Situación |
|---|---|---|
| Marca «El Portón de la Condesa», logotipos e iconos | El Portón de la Condesa | Todos los derechos reservados. Fuera de cualquier licencia de software |
| Fotografías de la finca, espacios y gastronomía | El Portón de la Condesa | Ídem |
| Textos comerciales, descripciones y textos legales | El Portón de la Condesa | Ídem |
| Datos de contacto del negocio | El Portón de la Condesa | Publicados por él mismo en su web |
| `public/images/porton/02-salon-celebraciones.jpg` | Fotógrafo externo | **Derechos de uso sin confirmar.** Marca de agua visible. Sustituir o conseguir cesión por escrito antes de cualquier publicación comercial |
| `public/brand/solucionesbonicas-logo.png` | Solucionesbonicas | Crédito de desarrollo en el pie. Marca de su titular |
| Las 6 fichas de ejemplo | — | **Ficticias**: nombres, proveedores, menús, precios y testimonios inventados. Ninguna persona real identificada. Etiquetadas «Ejemplo ilustrativo» en la interfaz |
| Tipografías (Cormorant Garamond, DM Sans, JetBrains Mono) | Sus autores | **SIL Open Font License 1.1**, que permite expresamente esta redistribución. Los tres textos de licencia acompañan a sus archivos en `app/fonts/` |
| Dependencias de software | Sus autores | Conservan sus licencias; se instalan con `npm ci` y no se redistribuyen. Los componentes de `components/ui/` provienen de shadcn/ui (MIT), pensado para copiarse y adaptarse |

Uso permitido de los elementos del negocio: leer, evaluar y ejecutar el proyecto para estudiar el software. Cualquier otro uso necesita autorización expresa del titular.

---

## 36. Enlaces de entrega

Estado y permisos de cada entregable en **`docs/checklist-entrega-tfm.md`**, que es la fuente de verdad y lleva las fechas de comprobación en incógnito.

Los marcadores son literales: `[PENDIENTE: URL]` significa que el entregable no existe todavía, **no** que la URL sea esa.

| Entregable | URL | Permiso |
|---|---|---|
| **Aplicación pública** | https://elportondelacondesa.solucionesbonicas.com | Pública y usable |
| **Repositorio GitHub** | https://github.com/javiermartinezcuartero-ui/PortonDeLaCondesaByDrexco | Debe pasar a público (§34, `docs/publicacion-github.md`) |
| **README** | https://github.com/javiermartinezcuartero-ui/PortonDeLaCondesaByDrexco/blob/main/README.md | Público con el repositorio |
| **Google Slides** | `[PENDIENTE: URL]` | Cualquier persona con el enlace puede ver |
| **Vídeo (Google Drive)** | `[PENDIENTE: URL]` | Visualización mediante enlace |
| **Dashboard** | https://elportondelacondesa.solucionesbonicas.com/admin | **Protegido**: exige sesión. Verificado: `/admin` responde 307 a `/admin/login` |
| **Cuenta de evaluación** | Se entra por el panel | Credenciales **solo por canal privado**. Se desactiva tras la evaluación |

**Ninguna credencial aparece en este documento, en el repositorio, en las Slides ni en el vídeo.** La cuenta de evaluación se entrega por el formulario de entrega o el canal privado acordado, y se retira con `npm run demo:clean -- --cuenta`.

Material de la entrega:

| Documento | Para qué |
|---|---|
| `docs/checklist-entrega-tfm.md` | Estado, URL, permisos y comprobaciones en incógnito de cada entregable |
| `docs/guion-presentacion-tfm.md` | 14 diapositivas con mensaje, evidencia, tiempo y notas del orador |
| `docs/guion-video-obs.md` | Grabación: escena, qué no debe salir en pantalla, recorrido y comprobaciones antes de subir |
| `docs/formulario-entrega-tfm.md` | Plantilla del formulario, canal privado de credenciales y justificante |
| `docs/publicacion-github.md` | Preparación de la publicación, escaneo de secretos, remediación y licencia |
| `.github/RELEASE_TEMPLATE.md` | Plantilla de release y convenio de tag de entrega |

---

## 37. Documentación complementaria

Amplían capítulos concretos de este documento; **no lo sustituyen**.

| Documento | Contenido |
|---|---|
| **`README.md`** | Este documento: la referencia técnica completa |
| `docs/evidencias-tfm.md` | Qué se puede comprobar, con qué comando y qué salida da |
| `docs/checklist-aceptacion.md` | Requisitos con su estado real y las limitaciones conocidas |
| `docs/modelo-datos.md` | Esquema narrado y diagrama ER completo |
| `docs/arquitectura-backend.md` | Decisiones de infraestructura y conexiones |
| `docs/modelo-amenazas.md` | Activos, actores, amenazas, OWASP y riesgos aceptados |
| `docs/autenticacion.md` | Better Auth, sesiones y roles |
| `docs/gate-vip.md` | Diseño del acceso a las bibliotecas |
| `docs/flujo-captacion.md` | Recorrido del visitante hasta el CRM |
| `docs/cms.md` | Ciclo de vida del contenido y de la media |
| `docs/crm.md` | Pipeline, scoring y exportación |
| `docs/email.md` | Correo transaccional desacoplado |
| `docs/openapi.yaml` | Contrato de la API pública |
| `docs/migraciones.md` | Las 10 migraciones, su orden y qué hacer si una falla |
| `docs/pruebas-e2e.md` | Cobertura, aislamiento de la base y decisiones de la suite |
| `docs/despliegue-vercel.md` | Despliegue paso a paso, smoke tests, rollback y recuperación |
| `docs/runbook-demo.md` | Preparar, enseñar y retirar la demostración |
| `docs/manual-admin.md` | Manual de uso del panel, sin tecnicismos |
| `docs/publicacion-github.md` | Preparación de la publicación y escaneo de secretos |
| `docs/checklist-entrega-tfm.md` · `guion-presentacion-tfm.md` · `guion-video-obs.md` · `formulario-entrega-tfm.md` | Entrega académica |
| `docs/auditoria-v2.md` | Auditoría inicial del proyecto heredado |
| `app/fonts/README.md` | Origen y licencias de las tipografías |
| `CLAUDE.md` · `CONTRIBUTING.md` · `NOTICE` | Reglas de trabajo y derechos de terceros |

---

## 38. Historial de fases

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

### Fase 7 — CRM, pipeline, tareas y analítica (2026-08-12)

Panel comercial completo dentro de `/admin`, reutilizando la autenticación, los servicios de dominio y el sistema visual ya existentes. Detalle en `docs/crm.md`.

**Navegación por permiso.** Se añadieron dos permisos a `lib/auth/session.ts`: `crm:export` y `settings:manage`, los dos solo ADMIN. El layout del panel filtra los enlaces con `roleHasPermission`, añadido precisamente para poder hacerlo **sin** duplicar la lista de roles en la interfaz. `/admin` tiene dos caras: con `crm:access` muestra métricas y sin él (CONTENT) un punto de partida con acceso a Contenidos.

**Acceso directo sin permiso: 404, no 500 ni 403.** `requirePermission` lanza, y una excepción sin capturar en un Server Component acaba en una página de error 500 —protege, pero informa mal—. Las guardas de `app/admin/(protected)/guards.ts` traducen el fallo: sin sesión, redirección al login; con sesión y sin permiso, 404, porque un 403 confirmaría que el apartado existe. Se aplicó también a las cuatro páginas del CMS, que hasta ahora devolvían un 500 a un usuario SALES.

**Métricas honestas** (`lib/domain/metrics.ts`). Un ratio sin denominador devuelve `null` y la interfaz dice "sin datos": un 0 % afirma que nadie convierte, y eso es distinto de no tener datos todavía. Cada ratio viaja con su denominador y cada media con su tamaño de muestra. La conversión se calcula **sobre cerradas** (`WON / (WON + LOST)`), no sobre el total, para que abrir solicitudes nuevas no empeore la métrica. El tiempo hasta el primer contacto se lee del historial real de `LeadActivity` filtrando el JSON de metadata, no de un campo denormalizado que pudiera quedar desfasado. El embudo cuenta en cada escalón solo a quien viene del anterior.

**Orden y filtros seguros.** Los filtros viven en la URL para poder compartir una vista, lo que significa que llegan de fuera: cada uno pasa por un parseador con lista blanca (`lib/validation/crm.ts`) y lo que no se reconoce se ignora. La ordenación del listado de solicitudes se resuelve contra `REQUEST_SORTS`, un objeto cerrado, y nunca se pasa la cadena de la URL a Prisma; hay un test que comprueba que `__proto__`, `constructor` y `lead.email` se rechazan. Todo orden lleva `id` como segundo criterio: sin él, dos filas con el mismo valor podrían cambiar de página entre consultas y verse dos veces.

**Pipeline sin arrastrar y soltar, a propósito.** Un tablero con drag and drop accesible de verdad exige alternativa de teclado, anuncios en vivo y manejo del foco tras el reordenado; y aun así el gesto no comunica la restricción que importa, que es qué transiciones permite la máquina de estados. Cada tarjeta lleva un desplegable con **solo los estados válidos**, más una vista de tabla en `?vista=tabla`. El servidor revalida la transición: hay una prueba que intenta ir de `NEW` a `WON` con sesión ADMIN y comprueba que se rechaza. Cada movimiento escribe `LeadActivity` y `AuditEvent` **en la misma transacción**.

**`LOST` exige motivo**, comprobado dos veces (esquema Zod y dominio). El motivo se guarda en la solicitud; en la auditoría solo va su longitud, para no duplicar texto libre.

**Cancelar no borra.** Una tarea cancelada conserva su fila, su autor y su fecha, y no se le inventa una fecha de finalización. Completar sí registra actividad en el historial del contacto: es trabajo comercial hecho y tiene que verse en el timeline.

**Notas sin HTML.** Se guardan como texto plano y se interpolan en JSX, que escapa solo. No hay `dangerouslySetInnerHTML` en ninguna parte del CRM. Editar queda auditado sin copiar el cuerpo de la nota.

**Scoring configurable y ya idempotente.** Los pesos se editan solo desde ADMIN y cada cambio deja `AuditEvent`. Se corrigió el peso de `FORM_SUBMITTED` en el seed, que estaba en 10 y el enunciado fija en 15. `recalculateLeadScore` no necesitó cambios: recalcula desde el historial en vez de acumular, así que el mismo hito no puede sumar dos veces —probado con dos solicitudes del mismo contacto y con tres fichas distintas frente a dos—.

**Exportación CSV con permiso propio.** `crm:export` es solo ADMIN: consultar el CRM (que incluye SALES) no implica poder sacarlo en un archivo que sobrevive a cualquier control de acceso posterior. Lista blanca de columnas explícita —así una columna nueva del esquema no aparece por descuido—, neutralización de fórmulas con el apóstrofo en la primera posición de la celda (también cuando hay espacios delante, porque algunas versiones de Excel los ignoran), UTF-8 con BOM y `;` para Excel en español, `no-store`, y un `AuditEvent` por exportación que **no** guarda el término de búsqueda porque puede ser el email de una persona.

**Un test intermitente detectado y corregido.** La primera pasada completa falló en un test de métricas que comparaba el total de solicitudes `NEW` de la tabla antes y después de crear una: Vitest ejecuta los archivos en paralelo y otro test podía crear o borrar una fila entre las dos lecturas. Se reescribió para colocar sus filas en una ventana histórica propia y contar solo ese rango, que es determinista. Se comprobó con tres pasadas completas seguidas. Otros dos tests de filtros tenían el mismo tipo de fragilidad —dependían de que sus filas cayeran en la primera página de una base compartida— y se hicieron deterministas con un marcador único en el asunto.

**Etiquetas compartidas.** Se movieron las etiquetas de los tramos de presupuesto de `components/sections/contact.tsx` a `data/site-content.ts` y su espejo en inglés, para que el CRM y la web pública no puedan llamar a la misma cosa de dos maneras. `lib/crm/labels.ts` traduce los códigos reutilizando esa capa.

**Archivos creados:** `lib/domain/metrics.ts`, `lib/domain/crm-leads.ts`, `lib/domain/crm-requests.ts`, `lib/domain/crm-export.ts`, `lib/crm/labels.ts`, `lib/validation/crm.ts`, `app/admin/(protected)/guards.ts`, `crm-ui.tsx`, `crm-forms.tsx`, `crm-actions.ts`, las páginas de `contactos/`, `solicitudes/`, `pipeline/`, `tareas/`, `informes/` y `configuracion/`, `contactos/contact-links.tsx`, `app/api/admin/crm/export/route.ts`, `docs/crm.md` y 4 archivos de pruebas.

**Archivos modificados:** `lib/auth/session.ts`, `lib/domain/lead-requests.ts`, `lib/domain/tasks.ts`, `lib/domain/notes.ts`, `lib/domain/scoring.ts`, `prisma/seed.ts`, `app/admin/(protected)/layout.tsx`, `app/admin/(protected)/page.tsx`, las cuatro páginas de `contenidos/`, `components/sections/contact.tsx`, `data/site-content.ts`, `data/site-content.en.ts` y `README.md`.

**Validación (comandos y resultados reales):**

| Comando | Resultado |
|---|---|
| `npm run lint` | exit 0 — 0 errores, 0 warnings |
| `npm run typecheck` | exit 0 |
| `npm test` | 42 archivos, **493 pruebas**, todas verdes (91 nuevas en esta fase); confirmado con tres pasadas completas tras corregir un test intermitente |
| `npm run build` | correcto; las 8 rutas del CRM como dinámicas y la home todavía estática |
| Verificación E2E por HTTP contra `npm run dev` | **39/39 comprobaciones** con tres sesiones reales |

La verificación end-to-end creó un usuario de cada rol con credenciales reales, inició sesión por HTTP y comprobó: ADMIN llega a los nueve apartados; SALES llega a los seis del CRM y recibe 404 en Configuración y en Contenidos; CONTENT recibe 404 en los cinco apartados del CRM y 200 en Contenidos y en su Resumen reducido; sin sesión, `/admin/contactos` redirige al login; el menú de cada rol no ofrece lo que no puede usar y SALES no ve el botón de exportar; la descarga CSV devuelve 403 con SALES y 200 con ADMIN, con `attachment`, `no-store` y encabezados en español; y las páginas del panel se sirven con `no-store` y `noindex`.

**Pendiente / no incluido:** pruebas en navegador real (Playwright sigue sin incorporarse), gestión de etiquetas desde la interfaz, fusión de contactos y el transporte real del correo. Detalle en §16.

**Veredicto: APTO PARA AÑADIR NOTIFICACIONES.** El CRM ya tiene los tres cimientos que una capa de notificaciones necesita: **eventos fiables** —cada movimiento de pipeline, cada tarea y cada nota dejan `LeadActivity` y `AuditEvent` dentro de la misma transacción que el cambio, así que no puede haber avisos de cosas que no ocurrieron ni cambios sin rastro—, **destinatarios y permisos claros** —responsable por solicitud, asignado por tarea y roles verificados en servidor en cada mutación—, y **un contrato de "no romper lo guardado" ya probado** con `notifyNewLeadRequest`, que se invoca tras el commit, sin `await`, y registra en `NotificationLog` sin poder tumbar la operación. Las métricas de tareas vencidas y de solicitudes sin primer contacto son exactamente las consultas que dispararían los avisos, y ya existen. Queda fuera, y conviene resolverlo al añadir notificaciones: el transporte de correo real y la preferencia de aviso por usuario.

### Fase 8 — Email transaccional desacoplado (2026-08-12)

Correo transaccional detrás de una interfaz, con SendGrid como adaptador y un adaptador de desarrollo que no envía. Detalle en `docs/email.md`.

**El principio manda sobre todo lo demás.** La base de datos es la fuente de verdad y el correo es un efecto secundario: guardar un lead no depende de que SendGrid responda. De ahí salen todas las decisiones del módulo —el envío va después del commit y después de responder, ninguna función de notificación lanza, y un fallo de correo no borra datos ni produce un error falso para quien envió el formulario—.

**Interfaz `EmailProvider` y dos adaptadores.** `SendGridEmailProvider` habla con la API v3 por `fetch` con timeout de 10 s; se descartó el SDK oficial porque arrastra dependencias que no hacen falta para un único POST y en el runtime de Vercel cada dependencia pesa. `DevelopmentEmailProvider` registra y no envía. La aplicación nunca habla con SendGrid directamente, que es lo que permite quedarse sin proveedor sin tocar el dominio.

**El contrato dice que `send` no lanza.** Devuelve estado, incluido el fallo. Un proveedor que lanzara obligaría a cada llamante a envolverlo en `try/catch`, y el día que alguien lo olvidara un correo caído se llevaría por delante una operación ya guardada. Las capas de notificación ponen su propio `try/catch` igualmente, por si un adaptador futuro incumple el contrato: hay una prueba que lo comprueba con un adaptador que lanza.

**`after()` de Next.js, no `void promise`.** Es el punto técnico de la fase. Lanzar la promesa sin esperarla parece equivalente y no lo es: en cuanto la función devuelve la respuesta, Vercel puede congelarla, y el envío queda a medias sin dejar rastro — exactamente el fallo silencioso que este proyecto evita en todas partes. `after()` mantiene viva la invocación hasta que el trabajo termina sin retrasar la respuesta. Como solo funciona dentro del ámbito de una petición de Next, `runAfterResponse` cae a ejecutar el trabajo directamente cuando no lo hay (scripts, tests), donde no hay respuesta que no bloquear.

**Cuatro estados que dicen la verdad.** `SENT` (el proveedor aceptó; **no** promete bandeja), `SKIPPED_CONFIG` (falta configuración, y no es un error), `RETRY_PENDING` (timeout, 429 o 5xx: el mensaje era válido y el problema es del momento) y `FAILED` (otros 4xx: reintentar no arreglaría nada). El adaptador de desarrollo devuelve `SKIPPED_CONFIG`, **no `SENT`**: afirmar que salió un correo que no salió sería peor que no tener correo. Se añadieron los dos estados nuevos al enum en una migración propia, porque PostgreSQL no permite usar un valor de enum recién creado dentro de la misma transacción en que se añadió y la corrección de datos lo necesitaba.

**Registro sin PII de más.** `NotificationLog` guarda plantilla, proveedor, estado, motivo corto y destinatarios **parcialmente ocultos** (`an***a@example.test`, conservando el dominio para poder diagnosticar). Nunca el cuerpo, el asunto —puede llevar el texto que escribió una persona—, la clave de API ni la dirección completa. `leadId` pasó a opcional: el resumen de tareas vencidas habla de varios contactos y no pertenece a ninguno. En desarrollo sin credenciales tampoco se imprime el correo completo por consola: un log se copia en incidencias y acaba en sitios que nadie previó.

**Consentimiento en el acuse.** El acuse es transaccional y no necesita consentimiento de marketing, pero **sin él solo confirma la recepción**: ni novedades ni contenido promocional. Colar promoción en un acuse es la forma exacta de convertir una base legal transaccional en un envío comercial no consentido. El consentimiento se lee del **último** evento `MARKETING`, no de si existe alguno concedido, así que una revocación futura funciona sin tocar la consulta; hay una prueba con revocación posterior.

**Enlaces sin token.** El aviso interno enlaza al detalle protegido del CRM y quien lo abra inicia sesión. Un enlace con acceso incorporado es permanente para cualquiera que reenvíe el correo, y no hace falta para que el equipo llegue a su propio panel. El acuse al visitante no lleva enlaces al panel: no tiene nada que hacer ahí.

**Cuatro plantillas** simples, responsive (una columna, `max-width: 600px`, sin media queries) y accesibles: `lang="es"`, `h1` real, `th scope="row"` en las tablas de datos, `role="presentation"` en las de maquetación, sin imágenes y siempre con alternativa en texto plano. Los estilos van en línea porque los clientes de correo ignoran las hojas externas.

**Los cuatro casos, y qué está activo de verdad.** Aviso interno de solicitud nueva: **activo**. Acuse al visitante: **activo si `SEND_LEAD_ACKNOWLEDGEMENT=true`** (solo ese valor exacto; `"1"` o `"si"` lo dejan apagado, porque escribir a alguien se decide a propósito). Resumen de tareas vencidas: **implementado y manual** con `npm run notify:overdue` — el proyecto no tiene programador y esta fase no añade cola, así que afirmar una periodicidad sería fingir fiabilidad; tampoco se expuso como endpoint HTTP, porque una ruta que envía correos sin exigir sesión es una vía de abuso. Verificación del email VIP: **plantilla preparada y probada, no activa**, con las tres piezas que faltarían documentadas.

**Lo que esta fase no garantiza, dicho claramente.** No hay entrega garantizada: un `RETRY_PENDING` describe un fallo que merecería reintento y **nada lo reintenta**. Es deliberado —montar media cola daría sensación de fiabilidad sin la fiabilidad— y la evolución necesaria (programador con backoff, idempotencia por mensaje, automatizar el resumen, webhooks de SendGrid) está en `docs/email.md` §7 en lugar de disimulada en el código.

**Un tropiezo real y su arreglo.** El script de tareas vencidas fallaba al arrancar: `import "server-only"` lanza salvo que se resuelva con la condición `react-server`, que solo aplica el bundler de Next, y un script de Node se la come de frente. Se resolvió con `tsconfig.scripts.json`, que mapea el paquete a su módulo vacío **solo para `tsx`**, igual que ya hacía `vitest.config.mts` para los tests. La protección del build queda intacta: importar un módulo `server-only` desde un componente cliente sigue rompiendo la compilación.

**Variables:** `SENDGRID_API_KEY`, `LEADS_FROM_EMAIL`, `LEADS_NOTIFICATION_TO`, `SEND_LEAD_ACKNOWLEDGEMENT` y `NEXT_PUBLIC_SITE_URL`. Todas opcionales: sin ellas el proyecto funciona igual y cada intento queda como `SKIPPED_CONFIG`. `LEAD_NOTIFICATION_TO` de la Fase 6 pasó a `LEADS_NOTIFICATION_TO` por coherencia. Hacen falta clave **y** remitente para considerar que hay transporte: con solo la clave, SendGrid rechazaría el envío por falta de remitente verificado.

**Archivos creados:** `lib/email/provider.ts`, `config.ts`, `development.ts`, `sendgrid.ts`, `templates.ts`, `index.ts`; `lib/notifications/record.ts`, `after-response.ts`, `overdue-tasks.ts`; `scripts/notify-overdue-tasks.ts`; `tsconfig.scripts.json`; `docs/email.md`; y 5 archivos de pruebas (`lib/email/config.test.ts`, `sendgrid.test.ts`, `templates.test.ts`, `lib/notifications/lead-request-notification.test.ts` reescrito, `overdue-tasks.test.ts`).

**Archivos modificados:** `prisma/schema.prisma` + 2 migraciones, `lib/notifications/lead-request-notification.ts` (reescrito), `app/api/leads/requests/route.ts`, `app/api/leads/requests/route.test.ts`, `.env.example`, `package.json` y `README.md`.

**Validación (comandos y resultados reales):**

| Comando | Resultado |
|---|---|
| `npx prisma migrate deploy` | 9 migraciones, las dos de esta fase aplicadas |
| `npm run lint` | exit 0 — 0 errores, 0 warnings |
| `npm run typecheck` | exit 0 |
| `npm test` | 46 archivos, **557 pruebas**, todas verdes (64 nuevas netas); dos pasadas completas seguidas |
| `npm run build` | correcto |
| `npm run notify:overdue` | funciona y reporta con honestidad: sin destinatarios y sin tareas vencidas |
| Comprobación de `after()` en el servidor real | **8/8 comprobaciones** |

La comprobación de `after()` no se podía hacer con pruebas unitarias: se envió una solicitud real al servidor de desarrollo y se verificó que la respuesta llega en menos de 5 s sin esperar al correo, que la solicitud queda guardada, que el aviso **se ejecuta después** de responder (aparece el registro instantes más tarde), que sin credenciales el estado es `SKIPPED_CONFIG` con proveedor `development`, y que el registro no contiene ni el cuerpo del mensaje ni la dirección completa.

**Pendiente / no incluido:** entrega garantizada (§7 de `docs/email.md`), automatizar el resumen de tareas vencidas, activar la verificación VIP, webhooks del proveedor, y **envío real contra la API de SendGrid**: no hay cuenta configurada, así que la clasificación de respuestas está probada con `fetch` simulado, no contra el servicio.

**Veredicto: APTO PARA ENDURECIMIENTO.** El correo está desacoplado de verdad: la persistencia no depende de él, el proveedor se sustituye cambiando una línea, y lo que no se envía queda registrado con un estado que distingue "no había configuración" de "falló y merece reintento" de "falló y reintentar no serviría". Nada del módulo puede tumbar una operación ya confirmada —probado con fallo transitorio, fallo permanente y un adaptador que lanza—, ningún registro guarda cuerpos, claves ni direcciones completas, y ningún enlace de correo lleva acceso incorporado. Lo que la fase **no** resuelve está documentado como límite y no disimulado como característica, que es la condición para poder endurecer sobre esto: hay tres frentes concretos que atacar —entrega garantizada, ejecución programada del resumen, y protección de un futuro endpoint de disparo— y ninguno está a medias fingiendo estar hecho.

### Fase 9 — Seguridad, privacidad, SEO y operación (2026-08-12)

Fase específica de endurecimiento. No es un informe: se auditó el proyecto, se corrigieron los problemas confirmados y cada corrección tiene su prueba. Detalle y riesgos aceptados en `docs/modelo-amenazas.md`.

**Cabeceras y CSP** (`lib/security/headers.ts`). Antes no había ninguna. Ahora: CSP con `default-src 'self'` y sin comodines, derivando el host de Supabase de la variable en vez de escribirlo a mano; `frame-ancestors 'none'` y `X-Frame-Options` contra clickjacking; `nosniff`; `Referrer-Policy: strict-origin-when-cross-origin` para que una URL de ficha VIP no viaje en el Referer; `Permissions-Policy` cerrando cámara, micrófono, geolocalización y pagos; `Cross-Origin-*`; y `poweredByHeader: false`. La lista vive en `lib/` y no en `next.config.mjs` **para poder probarla**: una CSP escrita en la configuración es un sitio donde nadie mira hasta que algo se rompe.

**La CSP va en Report-Only** salvo `CSP_ENFORCE=true`. Es una decisión, no una omisión: `next/image`, las fuentes de Google y el iframe del mapa introducen orígenes que conviene observar antes de bloquear, y una CSP que rompe la web en el primer despliegue se acaba desactivando entera. Verificado en el servidor real: la cabecera se sirve con el host real del proyecto.

**Minimización de la sesión administrativa, y el interruptor que NO se usó.** Better Auth guardaba la IP y el user-agent completos de cada sesión, y el proyecto no tiene ninguna función que los use. El interruptor obvio era `advanced.ipAddress.disableIpTracking`, pero leyendo su código se ve que además de no guardar la IP deja al limitador sin clave por la que agrupar y **desactiva el rate limit del login** (`resolveRateLimitConfig` devuelve `null`). Cambiar protección contra fuerza bruta por minimización habría sido un mal negocio. La vía correcta es un `databaseHooks.session.create.before` que vacía ambos campos: la IP se sigue resolviendo en memoria para el límite, pero no llega a la tabla.

**Anonimización completa y transaccional** (`lib/domain/privacy.ts`). La versión anterior solo tocaba las columnas del `Lead`, y eso dejaba a la persona perfectamente identificable donde nadie mira: el mensaje libre de sus solicitudes ("soy Ana y mi teléfono es…"), las notas del equipo y los destinatarios de los avisos. Anonimizar a medias es no anonimizar. Ahora vacía el texto libre **conservando lo agregable** (tipo de evento, invitados, espacio, estado, atribución), borra las notas, revoca las sesiones VIP y limpia los destinatarios, manteniendo consentimientos y auditoría como prueba de que el tratamiento fue legítimo. Se eliminó la función duplicada de `lib/domain/leads.ts`: dos funciones con el mismo nombre y distinto alcance eran la vía directa a llamar a la incompleta sin darse cuenta.

**Derechos RGPD operativos, solo ADMIN.** Copia completa de los datos de una persona en JSON (`/api/admin/crm/lead-data`, sin el hash de sus tokens: eso es un secreto del sistema, no un dato suyo), revocación de marketing como evento nuevo `granted=false` que **no destruye el consentimiento anterior**, y revocación de accesos VIP. Todo con `AuditEvent`. La anonimización pide confirmación escrita en la interfaz, no un "¿seguro?": es irreversible.

**Retención configurable que no borra sola.** `DATA_RETENTION_MONTHS` (36 por defecto, valores absurdos ignorados) identifica candidatos y excluye a quien tenga una negociación viva. `npm run privacy:retention` **informa y no anonimiza**: una operación irreversible sobre datos de personas no puede depender de un cron mal configurado.

**Registro estructurado con `requestId`** (`lib/observability/log.ts`). Descarta valores **por nombre de clave** —email, teléfono, nombre, mensajes, notas, tokens, IP, user-agent— marcándolos `[omitido]` en vez de dejar un hueco silencioso, no serializa objetos ni arrays (que es donde se cuelan los cuerpos enteros) y **nunca registra el stack**: en producción revela rutas del sistema y versiones. Códigos de error operativos estables (`E_PERSISTENCE`, `E_FORBIDDEN`…). El endpoint de solicitudes devuelve el `requestId` en un 503 para poder cruzar una queja concreta con su traza sin contar nada de quien la envió.

**Healthcheck** (`/api/health`) que devuelve `{ status: "ok" }` y nada más: ni versiones —un healthcheck que anuncia "Next 16.0.10" es un catálogo gratis de vulnerabilidades—, ni configuración, ni excepciones. Hace una consulta mínima para distinguir "el proceso vive" de "el proceso llega a su base de datos", que es la diferencia que le importa a un monitor.

**Un falso 429 encontrado y corregido.** `consumeRateLimit` interpretaba "`updateMany` afectó 0 filas" como "límite agotado", cuando también puede significar "la fila desapareció" (la purga, o una ventana reiniciada en paralelo). Eso produce un rechazo a alguien que no ha hecho nada. Ahora se distinguen los dos casos releyendo la fila, con prueba propia. Lo destapó un fallo intermitente de la suite, no una revisión teórica.

**Textos legales al día con la infraestructura real.** La política de cookies describía el acceso VIP como `localStorage`, cosa que dejó de ser cierta en la Fase 5: ahora detalla la cookie `porton_vip_access` con su duración y sus atributos, y la clasifica explícitamente como **estrictamente necesaria y funcional**, que es lo que la exime de consentimiento previo. La política de privacidad enumera los tres encargados reales (Supabase, Vercel y SendGrid, este último "solo si el envío está activado", que hoy no lo está). **No se inventa ningún plazo de retención ni base jurídica nueva**: donde falta validación profesional hay un aviso explícito, incluido el hecho de que el plazo concreto no está fijado. El banner existente se mantiene y se adapta; no se añadió otro.

**Pruebas de ataque** (`lib/security/attack-surface.test.ts`, 22 pruebas). Cada bloque intenta algo que no debería poder hacerse, siempre por la vía directa: acceso a endpoints sin sesión y con rol insuficiente, rol declarado por cabecera/cuerpo/cookie, cookie de sesión inventada, SALES intentando anonimizar, CONTENT moviendo estados, cookie VIP falsa, el hash usado como token, sesión caducada y revocada, revocación que invalida una cookie ya emitida, payload de 200 KB, HTML y script guardados como texto, rate limit por IP, origen ajeno, respuesta de error sin stack ni rastro de Prisma, contacto anonimizado que no reaparece en ninguna exportación, `no-store` en las descargas y healthcheck sin fugas.

**Escáner de secretos** (`lib/security/secrets-scan.test.ts`). Recorre los archivos que **git subiría** —no el disco— con 11 patrones (claves de Supabase en los dos formatos, JWT, SendGrid, cadenas de conexión con contraseña, hex de 64, claves privadas, tokens de GitHub y AWS), comprueba que `.env` está ignorado, que `.env.example` no lleva ningún valor y que la única variable `NEXT_PUBLIC_` es la URL del sitio. Incluye una comprobación de que el escáner no está vacío por error, porque un `git ls-files` fallido lo haría pasar con 0 archivos y daría falsa tranquilidad. Los falsos positivos van en una lista con su motivo escrito, no silenciados.

**`docs/modelo-amenazas.md`**: activos ordenados por lo que costaría perderlos, ocho actores con su motivación, los tres cruces de frontera que importan, nueve familias de amenazas con la mitigación **y el archivo de prueba que la comprueba**, cobertura del OWASP Top 10 con lo parcial marcado como parcial, y diez riesgos aceptados con su motivo.

**Auditoría de dependencias sin subir majors**, como pedía el enunciado: `npm audit` mantiene las 3 vulnerabilidades altas heredadas de `next@16.0.10` (`postcss`, `sharp`). El arreglo disponible es `next@16.3.0`, fuera del rango declarado. **No se ha aplicado**: es un cambio de versión de framework que toca render y build, y merece su propia fase con la suite completa como red, no un `--force` al final de una fase de seguridad.

**Archivos creados:** `lib/security/headers.ts`, `lib/observability/log.ts`, `lib/domain/privacy.ts`, `app/api/health/route.ts`, `app/api/admin/crm/lead-data/route.ts`, `app/admin/(protected)/privacy-actions.ts`, `app/admin/(protected)/contactos/[id]/privacy-panel.tsx`, `scripts/retention-report.ts`, `docs/modelo-amenazas.md`, y 5 archivos de pruebas.

**Archivos modificados:** `next.config.mjs`, `lib/auth.ts`, `lib/security/rate-limit.ts`, `lib/domain/leads.ts`, `lib/domain/crm-leads.ts`, `lib/validation/lead-request.ts`, `app/api/leads/requests/route.ts`, `app/admin/(protected)/contactos/[id]/page.tsx`, `app/politica-cookies/page.tsx`, `app/politica-privacidad/page.tsx`, `.env.example`, `package.json`, y 3 archivos de pruebas ajustados.

**Validación (comandos y resultados reales):**

| Comando | Resultado |
|---|---|
| `npm run lint` | exit 0 — 0 errores, 0 warnings |
| `npm run typecheck` | exit 0 |
| `npm test` | 51 archivos, **629 pruebas**, todas verdes (72 nuevas); dos pasadas completas seguidas |
| `npm run build` | correcto |
| `npm audit` | 3 altas heredadas de `next@16.0.10`; **no** se aplica el `--force` que subiría a 16.3.0 |
| `npm run privacy:retention` | funciona: informa del plazo y de los candidatos, sin anonimizar |
| Cabeceras en el servidor real | CSP Report-Only con el host real de Supabase, más las 6 cabeceras defensivas; `/api/health` devuelve solo `{"status":"ok"}`; `/admin` responde `no-store` y redirige al login |

**Tres fallos de mis propias pruebas, corregidos:** una expectativa desactualizada (la respuesta de error ahora incluye `requestId`), tokens fijos en una columna `@unique` que chocaban entre ejecuciones, y un filtro que dependía de caer en la primera página de una base compartida. El cuarto fallo no era del test sino del código, y es el falso 429 descrito arriba.

**Pendiente / no incluido:** los diez riesgos aceptados de `docs/modelo-amenazas.md` §7. Los cinco que más pesan: CSP con nonce y en modo bloqueo, alertas sobre los logs (hoy nadie los vigila), verificación del email en el gate VIP, 2FA para ADMIN, y la subida de `next@16.3.0`.

**Veredicto: APTO.** La fase corrige problemas confirmados y no entrega un informe: cada cambio tiene su prueba, y las pruebas atacan en vez de describir. Lo que se ha cerrado de verdad: no hay dato personal almacenado sin finalidad —la IP y el user-agent de sesión dejaron de guardarse sin perder el rate limit—, la anonimización ya no deja a la persona identificable en el texto libre, los derechos de acceso y revocación son operaciones reales y auditadas en vez de una promesa del texto legal, ningún log puede filtrar PII ni un stack, y el escáner de secretos convierte en fallo de test lo que en la Fase 6 fue una fuga real en el README. Lo que **no** está cerrado está enumerado con su motivo en el modelo de amenazas, incluido lo incómodo: la CSP todavía no bloquea, nadie vigila los logs, y el gate sigue aceptando el email de otra persona. Eso es lo que permite seguir endureciendo sobre esto: hay una lista concreta de lo que falta, y ninguna pieza finge estar terminada.

### Fase 10 — Pruebas E2E, despliegue y demo reproducible (2026-08-13)

Fase de preparación, no de despliegue: el enunciado pedía dejarlo todo listo **sin** desplegar ni subir nada. Lo que la fase entrega de verdad son cinco defectos reales corregidos, una suite E2E que los encontró, y el procedimiento escrito para poner esto en producción.

**Pruebas E2E: 22 pruebas, los 13 escenarios críticos** (`e2e/`, `docs/pruebas-e2e.md`). Playwright 1.62 sobre el **build de producción**, no `next dev`: si la fase prepara un despliegue, las pruebas deben recorrer el código que se va a desplegar —y `next dev` además activa los orígenes de confianza de desarrollo de Better Auth, que ocultarían un problema de configuración de producción. Cada prueba actúa por la interfaz: ninguna inyecta cookies ni escribe en la base para llegar antes a un estado. Los nueve escenarios extra salieron de preguntar "¿y si…?" sobre los trece pedidos: que el marketing se pueda dejar sin marcar y el envío funcione, que una contraseña incorrecta no revele si el email existe, que perder una oportunidad exija motivo, que un borrador no se sirva por su ruta pública, y —la otra mitad, que es fácil olvidar— que lo que CONTENT **sí** puede hacer siga funcionando: una autorización que lo cierra todo también está mal.

**Base de datos aislada, con guardia y con pruebas** (`docker-compose.e2e.yml`, `lib/testing/e2e-database-guard.ts`). Las E2E vacían todas las tablas en cada ejecución, así que apuntarlas por error a la base de la aplicación la borraría. La comprobación no es un aviso en el runbook: es código que aborta antes de abrir la primera conexión si la base coincide con la de la aplicación —comparando host, puerto y nombre, para que un `?pgbouncer=true` de diferencia no la despiste—, si el host parece gestionado, o si es remota y su nombre no delata que es de pruebas (la base por defecto de Supabase se llama `postgres`, así que un copiar y pegar sigue abortando). **13 pruebas propias**, incluida una que comprueba que ningún mensaje de error filtra la contraseña. Una salvaguarda sin pruebas no es una salvaguarda: es una intención. El contenedor va en el **puerto 55432** y publicado solo en `127.0.0.1`: el 5432 puede estar ocupado por otro PostgreSQL de la máquina, y usar un puerto propio evita justo el accidente que todo esto existe para impedir.

**Cinco defectos reales encontrados por las E2E**, todos con su prueba de regresión:

1. **El CTA "Quiero una boda así" no precargaba el tipo de evento.** El asunto sí, el desplegable no, y el primer envío se rechazaba con "Selecciona el tipo de evento". La causa tardó en salir: Radix Select, cuando vive dentro de un `<form>`, renderiza además un `<select>` nativo oculto para que las librerías de formularios lo vean, y su `BubbleSelect` **dispara un evento `change` sintético cada vez que cambia su valor**. Con el desplegable cerrado ese select nativo solo tiene la opción vacía del marcador de posición —los `SelectItem` viven en `SelectContent`, que no está montado—, así que el evento llegaba con la cadena vacía y la escribía de vuelta en el formulario, deshaciendo la precarga. La corrección es descartar la cadena vacía en el `onValueChange`, que es seguro porque **ninguna opción real la usa**. Lo demoledor: la prueba de la Fase 6 pasaba, porque rellenaba todos los campos obligatorios incluido ese desplegable y tapaba el fallo.
2. **La cabecera pública tapaba el panel.** El layout raíz —el único que puede declarar `<html>`— pintaba la cabecera `fixed` con `z-50` también en `/admin`, dejando el botón "Cerrar sesión" **materialmente inalcanzable** con el ratón en escritorio. Debajo aparecían además el pie con enlaces comerciales y el botón de WhatsApp, dentro de un CRM. Se resolvió con `components/public-chrome.tsx` y `usePathname()` en vez de partir el proyecto en dos layouts raíz: eso obligaría a mover todas las rutas a grupos y duplicar tipografías y metadatos, con mucho más riesgo para el sitio público a cambio de lo mismo.
3. **Una cookie de sesión revocada rompía el panel con `ERR_TOO_MANY_REDIRECTS`.** El panel redirigía al login por no haber sesión y el middleware devolvía al panel por haber cookie. Pasaba con cualquier sesión caducada, revocada, con `BETTER_AUTH_SECRET` rotado o con la base restaurada: es decir, en los momentos en los que más falta hace poder entrar. El middleware no puede validar la sesión (es Edge, no llega a la base), así que la redirección de quien **sí** tiene sesión se movió a la propia página del login, que sí puede consultarla.
4. **Una imagen subida no aparecía en el editor hasta recargar la página entera.** El editor guarda la ficha —media incluida— en estado de cliente inicializado una sola vez, así que el `router.refresh()` posterior a la subida actualizaba los avisos calculados en servidor ("falta el alt de 1 archivo") pero **no** la lista del panel, que seguía diciendo "todavía no hay archivos". Con el aviso pidiendo un alt y el panel sin archivo al que ponérselo, no se podía publicar. La acción ahora devuelve el archivo ya en la forma que usa el editor, con su URL firmada, en vez de un identificador suelto.
5. **`/admin/usuarios` respondía 200** con un mensaje de "Acceso no autorizado" en vez de 404 como el resto del panel. Autorizaba bien —nunca llegaba a consultar los usuarios—, pero era la única página con una comprobación de rol escrita a mano, y por tanto la única que podía desincronizarse de `PERMISSIONS` sin que nadie se enterase.

**Y un sexto, en las propias pruebas:** dos archivos se borraban los contadores de rate limit entre sí con un `deleteMany` por prefijo demasiado ancho. Producía un fallo intermitente que dependía del orden de ejecución y que no tenía nada que ver con lo que ninguna de las dos pruebas quería comprobar. Ahora cada archivo borra solo sus claves.

**Tipografías propias: se acabó la dependencia de red del build** (`app/fonts/`). El build llegó a fallar con doce errores `Error while requesting resource` por no poder alcanzar `fonts.googleapis.com`, y volvió a funcionar al reintentar sin cambiar nada. Un build que puede fallar por motivos ajenos al código no es reproducible, y la reproducibilidad era el objetivo de la fase. Se descargó un archivo **variable** por familia, subconjunto latin, que cubre todos los pesos del sitio (300–700) con un archivo en vez de cinco, y se incluyen los tres `OFL.txt` originales sin modificar: las tres familias son SIL Open Font License 1.1, que permite redistribuirlas acompañadas de su licencia y su copyright. Efectos secundarios, todos a favor: la CSP deja de necesitar los dos dominios de Google, el navegador del visitante no le pide nada a un tercero para pintar el texto —así que su IP no viaja—, y hay una petición menos en la ruta crítica. **Y una trampa que la captura de pantalla destapó:** `globals.css` pedía las familias por su nombre comercial, que solo existía porque `next/font/google` las registraba con ese nombre exacto. Con fuentes locales el nombre cambia, así que el sitio se quedó pintado en Georgia **sin avisar de nada**. Se corrige apuntando a las variables CSS que `next/font` publica.

**Sembrado partido en tres, porque hacía tres cosas distintas.** Hasta ahora `prisma/seed.ts` creaba configuración, usuarios y contenido de ejemplo a la vez, lo que obligaba a elegir entre sembrar configuración o no sembrar nada. Ahora: `npm run db:seed` deja solo los pesos del scoring (**configuración operativa**: sin ella el CRM puntúa a todo el mundo con cero, así que no es un dato de ejemplo); `npm run admin:bootstrap` crea el primer ADMIN; y `npm run demo:seed` siembra la demostración.

**Demo idempotente y retirable** (`scripts/demo-seed.ts`, `scripts/demo-clean.ts`, `docs/runbook-demo.md`). 6 fichas `isDemo`, un equipo de tres roles **sin contraseña** —existen para firmar tareas y notas; crear tres cuentas con contraseña conocida sería regalar tres puertas de entrada—, 8 contactos con solicitudes repartidas por **todo** el pipeline, tareas con una vencida, notas y consentimientos. Los estados se alcanzan **moviendo cada solicitud por las transiciones reales** del dominio, no escribiendo el estado final: así el historial y la auditoría de la demo son los que produciría el uso normal, y abrir una solicitud ganada enseña los seis movimientos que la llevaron ahí. Todos los emails terminan en `.test`, un TLD reservado por la RFC 2606 que no resuelve: ninguna dirección de la demo puede recibir un correo por error, ni siquiera si alguien activase SendGrid por accidente. Ese dominio es también la marca que permite a `demo:clean` borrar exactamente lo suyo. La cuenta de evaluación se declara por variable de entorno, el script **no imprime nunca su contraseña**, y al terminar se **desactiva** en vez de borrarse: la auditoría de la demo le apunta como autor, y un registro del que no se sabe quién hizo qué no sirve para nada. Comprobado: sembrar dos veces no duplica nada, y la limpieza en seco dice qué borraría antes de tocar la base.

**Siete documentos nuevos.** `docs/pruebas-e2e.md` (cobertura, aislamiento y las decisiones de la suite), `docs/migraciones.md` (las ocho en orden, las dos con corrección de datos, por qué la 7 y la 8 van separadas —PostgreSQL no permite usar un valor de enum en la misma transacción en que se añadió— y qué hacer cuando una falla, incluido que **no hay rollback automático** y la vía normal es corregir hacia delante), `docs/despliegue-vercel.md` (con la pareja de conexiones de Supabase explicada: confundir el pooler en modo Transaction con el de Session es el error de configuración más frecuente del proyecto), `docs/runbook-demo.md`, `docs/manual-admin.md` (para el equipo de la finca, sin tecnicismos), `docs/checklist-aceptacion.md` (con la regla de que nada figura como cumplido sin evidencia) y `docs/evidencias-tfm.md`.

**Archivos creados:** `playwright.config.ts`, `docker-compose.e2e.yml`, `.env.e2e.example`, `lib/testing/e2e-database-guard.ts` (+ test), `lib/domain/demo.ts`, `lib/content/demo-stories.ts`, `components/public-chrome.tsx`, `app/admin/(protected)/contenidos/[id]/editor-media.ts`, `components/sections/contact-prefill.test.tsx`, seis scripts en `scripts/` (`e2e-env.ts`, `e2e-migrate.ts`, `e2e-seed.ts`, `e2e-env-init.mjs`, `demo-seed.ts`, `demo-clean.ts`), nueve archivos en `e2e/`, `app/fonts/` (3 woff2 + 3 licencias + README) y 7 documentos.

**Archivos modificados:** `app/layout.tsx`, `app/globals.css`, `app/admin/login/page.tsx`, `app/admin/(protected)/usuarios/page.tsx`, `app/admin/(protected)/guards.ts`, `app/admin/(protected)/contenidos/actions.ts`, la página y los dos componentes del editor de contenido, `components/sections/contact.tsx`, `middleware.ts` (+ test), `lib/security/headers.ts` (+ test), `lib/security/secrets-scan.test.ts`, `lib/security/attack-surface.test.ts`, `app/api/leads/requests/route.test.ts`, `prisma/seed.ts`, `vitest.config.mts`, `package.json`, `.gitignore` y `.env.example`.

**Validación (comandos y resultados reales):**

| Comando | Resultado |
|---|---|
| `npm ci` | correcto, un único lockfile |
| `npm run lint` | exit 0 — 0 errores, 0 warnings |
| `npm run typecheck` | exit 0 |
| `npm test` | 53 archivos, **646 pruebas**, todas verdes |
| `npm run e2e` | 6 archivos, **23 pruebas**, todas verdes (≈40 s) |
| `npm run build` | correcto, **sin ninguna petición de red** |
| `npx prisma validate` / `generate` | esquema válido, cliente generado |
| Migraciones sobre base virgen | las 8 en orden, sin errores |
| `npm run demo:seed` dos veces | idempotente: 6 fichas + 8 solicitudes la primera vez, 0 la segunda |
| `npm run demo:clean` | borra solo lo de la demo; en seco informa sin tocar nada |
| Escáner de secretos | sin hallazgos (3 falsos positivos añadidos a la lista **con su motivo escrito**) |
| Guardia de base E2E | rechaza la base de la aplicación: verificado apuntándola a la real a propósito |

**Pendiente / no incluido:** el **despliegue** (el enunciado pedía no hacerlo), las métricas de Lighthouse (necesitan producción), las E2E en integración continua (necesitan un contenedor de servicio y las credenciales de Storage como secretos), y la migración de las 646 pruebas de Vitest al contenedor aislado, que merece su propia revisión. La subida de imagen del escenario 8 usa el bucket real de Supabase porque Storage no tiene equivalente local; el sembrado borra los objetos de la ejecución anterior. Sigue en pie lo de la Fase 9: los diez riesgos aceptados de `docs/modelo-amenazas.md` §7, y la subida de `next@16.3.0` con sus 3 vulnerabilidades altas.

**Veredicto: APTO PARA DESPLEGAR**, con una condición que no es técnica. Lo que sostiene el veredicto: los trece escenarios críticos se recorren en un navegador real contra el build de producción, cinco defectos que ninguna prueba anterior veía están corregidos con su regresión, el build ya no depende de la red, las migraciones se aplican en orden sobre una base virgen y tienen procedimiento escrito para cuando fallen, la demo se siembra y se retira con un comando, y las variables pendientes están enumeradas una por una en el README §Variables de entorno sin que ninguna sea un valor que el proyecto pueda inventarse. Lo que **no** sostiene el veredicto y hay que decir en voz alta: la **revisión jurídica** de la base legal y del plazo de retención sigue pendiente, y eso debería resolverse **antes de recoger datos de personas reales**, no antes de desplegar. Con datos ficticios y la demo puesta, el proyecto se puede desplegar hoy; con datos de clientes, ese texto lo tiene que firmar alguien cualificado. Y la CSP sigue en Report-Only: observa, no bloquea. Está enumerado, no escondido, que es la única forma de que la siguiente fase pueda ir a por ello.

### Fase 11 — README definitivo, preparación de GitHub público y entrega TFM (2026-08-13)

Fase de documentación y preparación, no de desarrollo: el enunciado pedía dejar la entrega lista **sin** hacer push, sin cambiar la visibilidad del repositorio, sin inventar URL y sin incluir credenciales. Lo que la fase entrega de verdad son un README que sostiene el proyecto por sí solo, un escáner de secretos que también mira el historial, y una afirmación falsa corregida.

**El README pasa de 18 a 37 secciones y deja de delegar en `docs/`.** Estaba completo en lo técnico pero le faltaban las secciones que permiten entender el proyecto a quien llega de cero: problema, objetivos general y específicos, alcance y **fuera de alcance** con el motivo de cada exclusión, usuarios y casos de uso con sus alternativas, diagrama de componentes, modelo de datos resumido con las tres decisiones que explican el resto, una tabla de decisiones con la alternativa descartada en cada caso, y capítulos propios de accesibilidad, SEO, rendimiento, licencia y derechos de marca. Lo que estaba repartido entre `docs/` y el código —Supabase, bootstrap del ADMIN, scripts— tiene ahora su apartado, porque un documento que para cada pregunta remite a otro archivo no es una referencia: es un índice.

**Un defecto real: `robots.txt` no llevaba el `Disallow` que tres documentos afirmaban.** `docs/checklist-aceptacion.md` (requisito 1.7), `docs/despliegue-vercel.md` (smoke test 9) y `docs/evidencias-tfm.md` (§3) daban por hecho un `Disallow: /admin` que `app/robots.ts` no emitía: solo había `allow: "/"`. El `noindex` del panel sí era real, así que la protección efectiva existía, pero el smoke test del despliegue **habría fallado el primer día en producción** y la afirmación era falsa. Se corrige en el código —`disallow: ["/admin", "/api"]`— porque es donde la afirmación se vuelve cierta, y se añade `app/robots.test.ts` con cinco pruebas que fijan las dos decisiones: bloquear el panel y la API, y **no** bloquear las bibliotecas VIP, donde la exclusión tiene que seguir siendo por `noindex`. Bloquearlas en `robots.txt` produciría justo el resultado que se quiere evitar: URL indexadas sin que el buscador pueda leer la etiqueta que pide no indexarlas.

**Escáner de secretos del historial** (`scripts/secrets-scan-history.ts`, `npm run secrets:history`). Existía el escáner del árbol de trabajo, y no basta: limpiar el árbol no limpia el historial. Un secreto añadido en un commit y borrado en el siguiente sigue estando en el primero, y en GitHub el commit anterior sigue siendo consultable por su URL para siempre — el escáner del árbol diría que todo está bien. El nuevo recorre todas las versiones de todos los archivos de todos los commits alcanzables desde cualquier referencia, deduplicadas por contenido, más los mensajes de commit. Los blobs se leen con un solo proceso `git cat-file --batch` en lugar de uno por archivo, porque en Windows cientos de procesos son decenas de segundos. Los dos escáneres comparten ahora patrones y excepciones en `lib/security/secret-patterns.ts`: estaban duplicados, y eso garantizaba que antes o después se desviaran.

**Resultado del escaneo: historial limpio.** 5 commits, 288 versiones de archivo, 11 patrones, 0 hallazgos. La única coincidencia son los checksums SHA-256 de `project-reference/data/image-manifest.json` —64 caracteres hexadecimales, la misma forma que un secreto—, clasificados como falso positivo conocido. Esa línea es además la prueba de que la detección funciona de verdad: si estuviera rota, no aparecería. **No se ha reescrito ningún historial**, porque no hacía falta.

**Un hueco del escáner, cerrado:** filtraba por extensión, así que no miraba archivos de texto sin extensión. `NOTICE` no se habría revisado, ni `LICENSE` cuando exista, ni un `Dockerfile`. Se añade una lista de nombres conocidos y una prueba que comprueba que `NOTICE` entra en el conjunto escaneado. Un escáner que da por revisado lo que no ha abierto es peor que no tenerlo, porque tranquiliza.

**CI: `fetch-depth: 0` y un paso nuevo.** El escaneo del historial se añade al flujo de trabajo, pero `actions/checkout` hace un clon superficial por defecto: con `fetch-depth: 1` el escáner solo vería el último commit y **pasaría siempre**. Un paso de CI que no puede fallar es peor que ninguno.

**CI verde, comprobado en su propio entorno.** Se simuló el runner apartando el `.env` —con restauración garantizada— para reproducir exactamente lo que ve GitHub Actions: **329 pruebas pasan y 325 se saltan solas** (las que necesitan base de datos, condicionadas a `DATABASE_URL`), exit 0. Afirmar «CI verde» sin ejecutarlo sin `.env` es afirmar algo que no se ha comprobado: en local todas las pruebas encuentran credenciales.

**Comprobación de datos personales en lo que se publicaría.** Revisado el árbol versionable completo. **No hay datos personales de particulares.** Lo que hay, y por qué puede publicarse, queda documentado en `docs/publicacion-github.md` §3: los datos de contacto del negocio son los que él mismo publica en su web; `@elportondelacondesa` es su cuenta oficial; los nombres de las seis fichas de ejemplo son ficticios y el propio archivo lo declara; el único correo con dominio real vive en una prueba de normalización que **necesita** el dominio `gmail.com` para comprobar lo que comprueba; y los correos de la demostración usan `.test`, reservado por la RFC 2606. Los datos personales reales viven solo en la base de datos, nunca en el repositorio.

**`.gitignore` endurecido.** Se añaden volcados (`*.dump`, `*.bak`, `*.sqlite`, `/dumps/`, `/backups/`, `/exports/`), subidas locales, `.vercel` y la basura de sistema y editores. `*.sql` **no** se ignora, y es deliberado: las migraciones de Prisma son `.sql` y tienen que estar versionadas —comprobado que las ocho siguen versionadas tras el cambio—. La regla de los `.env` se mantiene en negativo (ignorar todo, reabrir las plantillas una a una) y se documenta por qué: al contrario, una variante nueva como `.env.staging` quedaría versionable por omisión, que es exactamente como se filtran las credenciales.

**`NOTICE`: la marca queda fuera de cualquier licencia de software.** El repositorio contiene dos cosas con dueños distintos, y sin este archivo quien leyera una licencia permisiva asumiría que cubre las fotografías de las bodas. Se enumeran archivo por archivo los logotipos, las fotografías, los textos comerciales y los datos de contacto del negocio; la fotografía con marca de agua de fotógrafo externo **cuyos derechos no están confirmados**; el logotipo de Solucionesbonicas como crédito de desarrollo; las tres tipografías con su OFL 1.1 y sus textos de licencia; y la declaración de que las seis fichas de ejemplo son ficticias. Se corrigió una afirmación propia por el camino: las cinco imágenes de relleno de la plantilla no están todas sin usar — `placeholder.svg` sí se usa, como valor de reserva de un componente.

**`LICENSE` no se ha creado, a propósito.** La licencia la elige el titular del código, no quien lo escribe por encargo. Sin ese archivo el código queda bajo todos los derechos reservados por defecto, que para una entrega académica puede ser exactamente lo que se quiere. `docs/publicacion-github.md` §6 desarrolla las cinco opciones con sus implicaciones y las tres cosas que hay que tener presentes antes de decidir, incluida la que se olvida: si hay contrato con el cliente, puede que el código no sea del autor para licenciarlo.

**Cuatro documentos de entrega.** `docs/checklist-entrega-tfm.md` (nueve entregables con estado, URL, permiso, última prueba en incógnito, responsable y pendiente; con el árbol de dependencias que explica por qué casi todo cuelga de dos decisiones de Javier), `docs/guion-presentacion-tfm.md` (14 diapositivas con mensaje único, evidencia, tiempo y notas del orador, más cinco preguntas probables ya contestadas), `docs/guion-video-obs.md` (escena, ajustes de OBS reales, qué no debe salir en ningún fotograma, recorrido minuto a minuto y comprobaciones antes de subir) y `docs/formulario-entrega-tfm.md` (plantilla, canal privado de credenciales por orden de preferencia, comprobación externa y justificante). Más `docs/publicacion-github.md` y `.github/RELEASE_TEMPLATE.md`.

**Una regla repetida en los cuatro documentos, porque es la que más fácil se rompe:** ninguna credencial en el README, ni en el repositorio, ni en las Slides, ni en el vídeo, ni en el cuerpo de una release. Y la comprobación en incógnito no es opcional: una ventana normal arrastra las sesiones de Google y de GitHub del autor, así que todo parece accesible aunque esté restringido.

**Archivos creados:** `NOTICE`, `CONTRIBUTING.md`, `.github/RELEASE_TEMPLATE.md`, `app/robots.test.ts`, `lib/security/secret-patterns.ts`, `scripts/secrets-scan-history.ts`, y cinco documentos (`publicacion-github.md`, `checklist-entrega-tfm.md`, `guion-presentacion-tfm.md`, `guion-video-obs.md`, `formulario-entrega-tfm.md`).

**Archivos modificados:** `README.md` (reescrito: 18 → 37 secciones, conservando el historial completo), `app/robots.ts`, `lib/security/secrets-scan.test.ts`, `.gitignore`, `.github/workflows/ci.yml`, `package.json`, y las referencias cruzadas al README en `lib/storage/validate-image.ts`, `lib/storage/supabase.ts`, `lib/validation/lead-request.ts`, `lib/domain/privacy.ts`, `scripts/retention-report.ts`, `app/admin/(protected)/contenidos/actions.ts`, `e2e/05-crm.spec.ts`, `data/site-content.ts`, `docs/crm.md`, `docs/email.md`, `docs/migraciones.md`, `docs/pruebas-e2e.md`, `docs/evidencias-tfm.md`, `docs/autenticacion.md`, `docs/modelo-amenazas.md` y `docs/checklist-aceptacion.md`.

Las referencias numéricas al README (`README §12`, `§7`, `§11`…) se han convertido en referencias **por nombre de sección** (`§Seguridad`, `§Variables de entorno`). Con 37 secciones, renumerar volvería a romperlas en la fase siguiente; un nombre sobrevive a la reordenación. Cuatro de ellas apuntaban ya a secciones que no existían.

**Validación (comandos y resultados reales):**

| Comando | Resultado |
|---|---|
| `npm ci` | correcto, un único lockfile |
| `npm run lint` | exit 0 — 0 errores, 0 warnings |
| `npm run typecheck` | exit 0 |
| `npm test` | 58 archivos, **698 pruebas**, todas verdes |
| `npm run build` | exit 0 — 32 rutas, 7 estáticas, sin peticiones de red |
| `npm run e2e` | **23 pruebas, todas verdes** (1,4 min). No cambia nada que cubran, pero el `Disallow` toca una ruta y conviene comprobarlo |
| `npm run secrets:history` | 5 commits, 288 versiones de archivo, **0 hallazgos** |
| Escáner del árbol | 8 pruebas verdes, 11 patrones, 0 hallazgos |
| Simulación del entorno de CI (sin `.env`) | 329 pasan, 325 se saltan solas, exit 0 |
| `.env` versionable | ninguno: solo las dos plantillas, ambas sin valores |
| Volcados, exportaciones y subidas en el árbol | ninguno |
| Datos personales de particulares en el árbol | ninguno |
| Migraciones aún versionadas tras endurecer `.gitignore` | las 8 |

**Pendiente / no incluido:** el **push**, el **cambio de visibilidad** del repositorio y la **creación del `LICENSE`** (los tres, decisión explícita de Javier; los dos primeros los prohibía el enunciado). Sigue pendiente el **despliegue**, y con él las URL de aplicación, README público, Slides, vídeo y dashboard, más las métricas de Lighthouse. Y sigue en pie la **revisión jurídica** de la base legal y el plazo de retención.

**Veredicto: APTO PARA ENTREGA DOCUMENTAL.** Lo que lo sostiene: el README es autocontenido y ninguna de sus 37 secciones remite a otro archivo para responder a lo que se le pregunta; el árbol y el historial están escaneados con herramienta propia y reproducible, y los dos están limpios; no hay ningún dato personal de particulares en lo que se publicaría; los cuatro documentos de entrega existen con su procedimiento y sus comprobaciones; y ninguna URL inventada figura como real — los marcadores `[PENDIENTE: URL]` son literales y están declarados como tales. Lo que **no** sostiene el veredicto y hay que decir en voz alta: la entrega **no está hecha**, y lo que falta no es documentación sino tres decisiones y un despliegue que solo Javier puede tomar y ejecutar. La documentación está lista para acompañar una entrega; la entrega, no.

### Fase 12 — Auditoría correctiva final (2026-08-13)

Revisión del proyecto como si fuera una pull request ajena, con mandato de corregir y no solo describir. El resultado son **15 defectos reales corregidos**, cada uno con la prueba que lo habría detectado, y dos límites de escala documentados con su umbral en lugar de reescritos.

La auditoría se organizó como nueve lentes independientes sobre el código —secretos y datos personales, autorización, gate, contraseñas y sesión, solicitudes y consentimientos, Storage, migraciones e índices, accesibilidad y caché, y coherencia de la documentación— con verificación adversarial de cada hallazgo. **Seis de las nueve lentes completaron y la verificación automática se agotó a mitad**, así que los 22 hallazgos que quedaron sin refutar se verificaron a mano, leyendo el código, antes de tocar nada. Tres lentes (gate, contraseñas/sesión y Storage) se auditaron después directamente. Conviene decirlo porque cambia cómo hay que leer el resultado: no es "un agente dijo que había 22 fallos", es "22 candidatos, verificados uno a uno contra el código, de los que 15 eran reales".

**El más grave: datos personales del visitante en el log de producción.** `DevelopmentEmailProvider` registraba `asunto: message.subject`, y el asunto del aviso interno se compone con el texto libre del formulario (`Nueva solicitud: ${request.subject}`). El nombre del adaptador engaña: `resolveEmailProvider` lo devuelve **siempre que falte `SENDGRID_API_KEY` o `LEADS_FROM_EMAIL`**, y las dos son opcionales —el estado documentado por defecto—, así que en producción sin SendGrid cada solicitud escribía en el log de Vercel lo que la persona hubiera teclado. Contradecía tres cosas escritas a la vez: que `NotificationLog` nunca guarda el asunto, que los logs no llevan datos personales, y el propio docstring del registro estructurado, cuya lista de claves bloqueadas incluye `subject|asunto`. La corrección es pasar por `logInfo` en vez de `console.info`: el filtro por nombre de clave existía y este código lo esquivaba.

**El guardián de secretos no guardaba.** Dos defectos en el mismo archivo. La aserción que debía impedir versionar un `.env` era una tautología —`expect(files.some(f => f === ".env" || f.startsWith(".env."))).toBe(files.includes(".env.example"))`, es decir `true === true`, porque `.env.example` hace verdaderos los dos lados—: añadir un `.env.production` con credenciales reales no la rompía. Y ningún patrón detectaba **una contraseña en claro**, que es exactamente la fuga que este proyecto ya tuvo en la Fase 6. Ahora la aserción compara la lista exacta de plantillas, la familia `.env` entra en el escaneo por contenido (antes `.env.example` colaba por casualidad, por acabar en `.example`), y hay dos patrones nuevos con **pruebas propias de los patrones**, que era el hueco de fondo: un escáner sin casos positivos es un test que siempre pasa. El umbral son 12 caracteres porque es el mínimo que el proyecto exige a sus propias contraseñas.

La primera versión del patrón de contraseñas produjo diez falsos positivos y enseñó algo: usaba `\s*` tras el igual, `\s` incluye el salto de línea, y en `.env.example` acababa tomando el nombre de la variable siguiente como valor de la anterior. Está anotado en el código, con su prueba de regresión.

**Bloqueo irrecuperable de la administración.** `updateUserRoleAction` hacía `prisma.user.update` sin comprobar nada: el único ADMIN podía degradarse a sí mismo —el camino más probable es el más inocente, "a ver qué ve un CONTENT"— y a partir de ahí nadie podía volver a cambiar roles, porque el alta pública está desactivada a propósito. Con él se perdían la gestión de usuarios, la configuración, la exportación y **las tres operaciones de privacidad del RGPD**, que son obligaciones legales. Además era la **única mutación administrativa sin `AuditEvent`**, justo la que concede privilegios, y escribía con Prisma desde la capa de interfaz. Se movió a `lib/domain/users.ts`: rechaza el autocambio, cuenta administradores y actualiza **en la misma transacción** —hacerlo antes dejaría la ventana para que dos degradaciones simultáneas acaben en cero—, y audita con el rol anterior y el nuevo sin copiar datos personales. El guardián del último ADMIN se probó como función pura, porque la rama que importa no se puede provocar contra una base de desarrollo compartida que siempre tiene administradores reales; degradar cuentas de verdad para forzar el escenario habría sido peor.

De paso, `docs/manual-admin.md` ya afirmaba "nadie puede cambiarse su propio perfil". Era falso; ahora es verdad.

**Un POST público borraba el nombre de un contacto.** El `.trim()` de JavaScript no considera espacio en blanco a los caracteres de control, así que un `firstName` de dos caracteres C0 pasaba el `.min(1)` del esquema, el servidor los eliminaba antes de persistir, y el `update` del upsert escribía `""`. El endpoint no verifica el correo: quien conociera la dirección de un contacto dejaba su ficha del CRM sin nombre, de forma irreversible. Corregido en las dos capas: el esquema exige un carácter imprimible y devuelve 400 en el borde, y el dominio nunca sobrescribe con vacío —Prisma distingue `undefined` ("no toques") de `""` ("escribe vacío") y esa diferencia era el fallo—.

**Un 503 sobre datos ya guardados, y el aviso comercial perdido.** `recalculateLeadScore` se llamaba sin `.catch` después del commit, al contrario que en `grantVipAccess`. Si fallaba —pool agotado, timeout del pooler—, el endpoint devolvía `persistence-failed` sobre una solicitud que **sí** estaba guardada, y `runAfterResponse(notifyNewLeadRequest)` no llegaba a ejecutarse. Peor: el reintento del visitante entraba por la rama `duplicate`, que tampoco avisa. La finca no se enteraba nunca de esa solicitud. Una línea, con el precedente correcto ya en el propio proyecto.

**El gate registraba el consentimiento con la versión de política del servidor**, no con la que la persona tenía delante: el esquema del gate no tenía el campo. Si la política cambiaba mientras alguien tenía la página abierta, se guardaba un `ConsentEvent` sobre un texto que nunca vio — y `policyVersion` es precisamente el campo que existe para demostrar sobre qué texto se consintió. El endpoint del formulario ya devolvía 409 en ese caso; el gate no comprobaba nada. Ahora los dos caminos se comportan igual, con un código de error propio que pide recargar. El cambio rompió 17 pruebas por no enviar el campo, que es la señal de que ahora se exige de verdad.

**Paginación que podía repetir y perder filas.** `listLeadsForAdmin` ordenaba por `[lastActivityAt, createdAt]` sin criterio único, mientras el README prometía que ningún listado del panel deja salir una fila en dos páginas —`listRequestsForAdmin` sí lo hacía—. Con contactos empatados en ambos campos, lo normal en una ráfaga de altas o en el sembrado, uno se veía dos veces y otro no se veía nunca; revisando la lista para atender una supresión, el omitido no se trataba. Añadido `{ id: "asc" }` en el listado, la exportación y el listado del CMS.

**Dos señales de indexación contradictorias.** Las tres páginas legales estaban en `sitemap.xml` *y* emitían `noindex`. Search Console habría marcado como error de cobertura tres de las cuatro URL enviadas desde el primer rastreo. Se alineó el sitemap con el `noindex`, que es la opción que no cambia qué se indexa, y hay una prueba que lee el metadata real de cada página y falla por cualquiera de los dos lados.

**Accesibilidad: cuatro correcciones, una de ellas seria.** El menú móvil cerrado solo se apagaba con `opacity-0 pointer-events-none`, y ninguna de las dos retira nada del recorrido de teclado ni del árbol de accesibilidad: por debajo de `xl`, pulsar Tab desde el botón de hamburguesa metía el foco en ocho controles completamente invisibles, sin anillo visible en ninguna parte y con Enter navegando a donde nadie había pedido. Ahora lleva `inert`. Además: **ninguno de los tres landmarks de navegación del sitio público tenía nombre** —el README lo declaraba resuelto y solo lo estaba en `/admin`—, faltaba el **enlace de salto al contenido**, no había **nada** que respetara `prefers-reduced-motion` en un sitio con animaciones de entrada y revelación de imágenes, y los placeholders del formulario iban al 50 % de opacidad, en torno a 2:1 de contraste, llevando información que no está en la etiqueta. No existía ninguna prueba de la cabecera ni del pie; ahora sí.

**Tres índices que faltaban** (migración 9, solo `CREATE INDEX`). Cinco consultas del Resumen filtran `ContentInteraction` por `type` y ningún índice empezaba por ahí: cada carga de `/admin` recorría cinco veces la tabla que más crece. "Últimos movimientos" ordenaba `LeadActivity` por fecha sobre toda la tabla, y el índice compuesto que empieza por `leadId` no le servía.

**Una prueba E2E que no probaba lo que decía.** Los escenarios de autorización llamaban a `?entity=leads` y `?leadId=`, y los handlers leen `?conjunto=` y `?lead=`: cualquier 4xx, incluido el de un parámetro inexistente, hacía pasar la prueba. Bastaba con mover el parseo por delante de la comprobación de permiso para que una regresión de autorización pasara inadvertida. Corregidos los nombres y **añadida la aserción positiva**: las mismas URL con sesión ADMIN devuelven 200 y `no-store`. Es lo que ancla la prueba al contrato real.

**Y tres más, menores pero del mismo tipo:** `/api/admin/users` devolvía nombre, correo y rol de todo el personal interno sin `Cache-Control` —el middleware que la fija solo cubre `/admin`, no `/api`—; ese mismo endpoint y la Server Action de roles duplicaban la política con `requireRole(["ADMIN"])` en vez de leerla de `PERMISSIONS`, que es la desincronización que el proyecto declaraba resuelta; y la ficha 360º traía cuatro colecciones sin cota mientras su docstring afirmaba que todas llevaban `take`.

**Lo que se investigó y NO era un defecto**, dicho porque una auditoría que solo lista hallazgos no permite juzgar su criterio: el dashboard `/admin` sin guarda explícita (comprueba `crm:access` antes de leer métricas, es correcto); las 11 rutas de documentación que un comprobador automático marcó como roto (son referencias deliberadas a archivos retirados y a rutas propuestas en la auditoría inicial); `robots.txt` (ya corregido en la Fase 11); y las tres vulnerabilidades altas de `npm audit`, que siguen ahí con un matiz que faltaba: `sharp` procesa las imágenes que sube el CMS, así que el vector existe, pero exige una cuenta CONTENT o ADMIN autenticada y las imágenes pasan validación por firma de bytes y tope de 10 MB antes de almacenarse. No se ha subido a `next@16.3.0`: es un salto de versión menor del framework fuera del rango declarado, y eso no es un cambio mínimo seguro en una auditoría final. Queda como decisión explícita.

**Archivos creados:** `lib/domain/users.ts` (+ test), `lib/security/secret-patterns.test.ts`, `components/chrome-a11y.test.tsx`, `prisma/migrations/20260813205449_add_metrics_indexes/`.

**Archivos modificados:** `lib/email/development.ts`, `lib/email/sendgrid.test.ts`, `lib/security/secret-patterns.ts`, `lib/security/secrets-scan.test.ts`, `app/admin/(protected)/usuarios/actions.ts` (+ test), `app/api/admin/users/route.ts`, `lib/domain/lead-requests.ts`, `lib/domain/leads.ts` (+ test), `lib/validation/lead-request.ts`, `app/api/leads/requests/route.test.ts`, `lib/validation/vip-gate.ts` (+ test), `lib/vip/gate-action.ts` (+ test), `lib/vip/gate-failure.test.ts`, `lib/domain/vip-access.ts`, `components/vip/vip-gate.tsx`, `lib/domain/crm-leads.ts`, `lib/domain/crm-export.ts`, `lib/domain/crm-requests.ts`, `lib/domain/crm.test.ts`, `lib/domain/content.ts`, `lib/domain/metrics.ts`, `app/sitemap.ts`, `lib/vip/metadata.test.ts`, `components/header.tsx`, `components/footer.tsx`, `components/sections/contact.tsx`, `app/layout.tsx`, `app/globals.css`, los cuatro `page.tsx` públicos y los dos componentes VIP (ancla del salto), `app/admin/(protected)/configuracion/page.tsx`, `prisma/schema.prisma`, `e2e/03-panel-acceso.spec.ts`, `e2e/06-autorizacion.spec.ts`, `.env.e2e.example`, `README.md`, `docs/manual-admin.md`, `docs/flujo-captacion.md`, `docs/migraciones.md`, `docs/checklist-aceptacion.md`, `docs/publicacion-github.md`, `docs/pruebas-e2e.md`, `docs/evidencias-tfm.md`.

**Validación (comandos y resultados reales):**

| Comando | Resultado |
|---|---|
| `npm ci` | correcto, un único lockfile |
| `npm run lint` | exit 0 — 0 errores, 0 warnings |
| `npm run typecheck` | exit 0 |
| `npm test` | 58 archivos, **698 pruebas** (**+44**). Verde en 5 de 6 pasadas: ver el intermitente residual más abajo |
| `npm run e2e` | **23 pruebas**, todas verdes (1,4 min) |
| `npm run build` | exit 0 — 32 rutas, 7 estáticas, sin peticiones de red |
| `npx prisma validate` / `generate` | esquema válido, cliente generado |
| `npx prisma migrate deploy` | migración 9 aplicada, las 9 en orden |
| `npm run secrets:history` | 5 commits, 288 versiones, **11 patrones**, 0 hallazgos |
| Escáner del árbol | 8 pruebas verdes, 11 patrones, 0 hallazgos |
| `npm audit` | 3 altas, heredadas de `next@16.0.10`, con su alcance real analizado |
| Enlaces internos de documentación | 660 referencias, 0 roturas reales |

**Y un último fallo, encontrado por la propia validación de esta fase: `npm ci` no dejaba un proyecto que compilase.** Al ejecutar la instalación limpia que el enunciado pedía comprobar, `npm run typecheck` falló con `Module '@prisma/client' has no exported member 'ContentType'`: el paquete se instala con un cliente incompleto y `prisma generate` no estaba en ningún sitio —ni en `postinstall`, ni en el flujo de trabajo de CI, ni en el procedimiento de instalación del README—. La secuencia que fallaba es exactamente la de integración continua, así que **CI habría estado rojo en el primer runner limpio**, y cualquiera que clonase el repositorio se habría encontrado lo mismo. No se había detectado en once fases porque en el equipo de desarrollo el cliente ya estaba generado de antes: el fallo solo aparece cuando `node_modules` se crea de cero, que es lo que nadie hace en local y CI hace siempre. Corregido con un `postinstall`, que arregla de una vez CI, un clon nuevo y Vercel, y verificado borrando el cliente y repitiendo `npm ci` + `typecheck` sin ningún paso manual. Con prueba en `lib/testing/reproducible-install.test.ts`, que además comprueba que el flujo de CI sigue ejecutando la secuencia completa.

Es el hallazgo que mejor justifica esta fase: no lo encontró ninguna de las nueve lentes de auditoría leyendo código, sino ejecutar de verdad la validación que se pedía.

**Veredictos: APTO PARA GITHUB PÚBLICO. APTO PARA DESPLIEGUE. APTO PARA ENTREGA TFM.** Los tres con la misma condición de siempre, que no es técnica: la revisión jurídica de la base legal y el plazo de retención sigue pendiente y debe resolverse **antes de recoger datos de personas reales**. Lo que sostiene los veredictos después de esta fase: el fallo de datos personales en el log de producción está cerrado y el filtro que debía impedirlo ahora se usa de verdad; el escáner de secretos detecta la clase de fuga que el proyecto ya sufrió, y lo demuestra con casos positivos propios; no hay forma de dejar el sistema sin administración; ningún POST público puede destruir un dato guardado; los consentimientos registran la versión que la persona aceptó por los dos caminos; y las cuatro carencias de accesibilidad que quedaban declaradas están corregidas menos las dos que exigen un lector de pantalla real y una auditoría formal. Lo que **no** sostiene los veredictos y queda enumerado: dos límites de escala con su umbral, el alta de usuarios sin pantalla, las tres vulnerabilidades heredadas, y los diez riesgos aceptados del modelo de amenazas.

---

### Fase 13 — Publicación del código y despliegue (2026-08-14)

Las Fases 10 y 11 prepararon el despliegue y la publicación con el mandato expreso de **no ejecutarlos**. Esta fase los ejecuta.

**La aplicación está en línea** en https://elportondelacondesa.solucionesbonicas.com, un subdominio del sitio de servicios del autor. La base de datos es el mismo proyecto de Supabase de desarrollo, con las nueve migraciones aplicadas y verificadas (`prisma migrate status` → *Database schema is up to date*), así que la publicación del código no arrastra ninguna migración pendiente.

**Lo que había desplegado antes de esta fase era la Fase 6.** El despliegue seguía al último commit publicado (`5adde3a`, «Backend completo, Fases 1-6») y todo el trabajo de las Fases 7 a 12 estaba sin subir. Se comprobó sobre el sitio en vivo, y las tres diferencias que se ven desde fuera lo confirman: `robots.txt` servía `Allow: /` sin los `Disallow` de `/admin` y `/api` (§28), el sitemap enumeraba las tres páginas legales que emiten `noindex` (el defecto que corrigió la auditoría final), y de las cabeceras de seguridad de la Fase 9 solo llegaba `Strict-Transport-Security`, que la pone Vercel por su cuenta. Las tres se resuelven con este despliegue.

**Comprobación previa a publicar**, porque un repositorio público no se puede despublicar de verdad: el escáner del árbol y el del historial, verdes; `.env` y `.env.e2e` fuera del índice y correctamente ignorados, con solo las dos plantillas sin valores versionadas; y la secuencia completa de validación repetida sobre el estado exacto que se iba a subir.

**Un defecto encontrado al mirar el sitio en vivo: la aplicación se servía en un dominio y declaraba otro.** La base de las URL canónicas, del `sitemap.xml` y del JSON-LD sale de `brand.website`, que vale `https://elportondelacondesa.com` —el WordPress del negocio, que sigue en pie—, de modo que el sitemap publicado en el subdominio enumera URL de un dominio distinto: Search Console lo rechaza, y si algún buscador indexara el subdominio competiría con el sitio real del cliente. Se planteó al titular con las dos salidas razonables —excluir el subdominio de los buscadores mientras sea una demostración, o tomar la base de `NEXT_PUBLIC_SITE_URL` cuando la aplicación sustituya al WordPress— y **eligió la primera**.

Implementado en `lib/seo/indexing.ts`, que responde a una única pregunta: ¿el origen desde el que se sirve esto es el dominio del negocio? De ella cuelgan las tres señales —la cabecera `X-Robots-Tag`, el sitemap y su declaración en `robots.txt`—, el valor por defecto es no indexar, y la indexación se activará sola el día que `NEXT_PUBLIC_SITE_URL` sea el dominio oficial. Detalle en §28.

**La exclusión se hace con `X-Robots-Tag: noindex, nofollow` y no con un `Disallow: /`**, aunque lo segundo sea lo que sugiere la intuición: un rastreador que tiene prohibido el acceso tampoco puede leer la orden de no indexar, y Google puede acabar listando la URL a secas si alguien la enlaza. Es el mismo razonamiento que ya gobernaba las bibliotecas VIP, aplicado al sitio entero. Verificado sobre el servidor de producción local: la cabecera viaja en la home **y en las imágenes** —donde una etiqueta `<meta>` no llega—, `robots.txt` no declara sitemap y `sitemap.xml` sale vacío.

Tres detalles del camino, porque los tres eran evitables y ninguno lo pareció de entrada. `lib/security/headers.ts` **no puede importar** `lib/seo/indexing.ts`: `next.config.mjs` lo carga con un `import` dinámico fuera del grafo de módulos de Next, donde no se resuelven ni el alias `@/` ni las rutas sin extensión, y el intento rompió el build con `Cannot find module`. La decisión se resuelve por tanto en `next.config.mjs` y se le pasa a `securityHeaders({ indexable })`, cuyo valor por defecto es *no indexable* —el lado seguro— con una prueba que lee la configuración y falla si alguien quita el argumento, porque ese fallo sería mudo: todo seguiría verde y el sitio oficial dejaría de indexarse. Y el origen canónico se repite como constante en `indexing.ts` en lugar de leerse de `data/site-content.ts`, por la misma limitación, con una prueba que compara las dos y falla si se separan.

**Licencia decidida: MIT** (§34). El archivo `LICENSE` está en la raíz, y sus dos últimos párrafos —en inglés y en español— dicen expresamente que cubre el código fuente y no la marca, el logotipo, las fotografías ni los textos del negocio, que quedan donde estaban: en `NOTICE`. Sin ese párrafo, quien lea "MIT" asumiría que cubre el repositorio entero.

**Archivos creados:** `LICENSE`, `lib/seo/indexing.ts` (+ test).

**Archivos modificados:** `app/robots.ts` (+ test), `app/sitemap.ts`, `lib/security/headers.ts` (+ test), `next.config.mjs`, `lib/vip/metadata.test.ts`, `README.md`, `docs/checklist-entrega-tfm.md`, `docs/formulario-entrega-tfm.md`, `docs/despliegue-vercel.md`, `docs/publicacion-github.md`. Además de las URL reales de entrega, se corrigieron tres afirmaciones que la Fase 12 había dejado desfasadas en §32: seguía diciendo que faltaban el enlace de salto y `prefers-reduced-motion` (añadidos en la auditoría), que no había despliegue, y el recuento de defectos de la propia entrada de la Fase 12 (13 donde son 15).

**Validación (comandos y resultados reales), sobre el estado publicado:**

| Comando | Resultado |
|---|---|
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | 59 archivos, **717 pruebas** (**+19**). Reaparecio el intermitente conocido en `crm.test.ts`; el archivo aislado da 48/48 |
| `npm run build` | exit 0 — 32 rutas |
| `npx prisma migrate status` | 9 migraciones, esquema al día |
| Escáner del árbol | 19 pruebas verdes, 0 hallazgos |
| `npm run secrets:history` | 5 commits, 288 versiones, 11 patrones, 0 hallazgos |
| Aplicación en vivo | `/`, `/robots.txt`, `/sitemap.xml`, `/admin/login` → 200; `/admin` → 307 a `/admin/login` |

**Pendiente, y es de Javier:**

1. **El repositorio sigue privado.** El código está subido, pero cambiar la visibilidad exige la interfaz de GitHub (Settings → General → Danger Zone): `gh` no está instalado en el equipo. Antes conviene cerrar la licencia (§34) y revisar el `NOTICE` con el cliente.
2. **Comprobar `BETTER_AUTH_URL` y `NEXT_PUBLIC_SITE_URL` en Vercel.** Deben valer exactamente el origen del subdominio. Si no coinciden, Better Auth responde `403 INVALID_ORIGIN` y el login del panel falla mostrando el mensaje genérico de credenciales incorrectas — el mismo síntoma diagnosticado en la Fase 3.
3. **Definir `NEXT_PUBLIC_SITE_URL` en Vercel** con el origen del subdominio. Hoy no está definida en ningún sitio, y aunque el resultado coincide con lo que se quiere —sin variable no se indexa—, coincide por omisión y no por decisión; además los enlaces de los correos caen a `http://localhost:3000` (§18).
4. La revisión jurídica, que sigue siendo la condición de los tres veredictos de la Fase 12.

---

### Fase 14 — Acceso al panel con clave única y rediseño del panel (2026-08-14)

Cuatro peticiones de interfaz del titular, más lo que cada una arrastró.

**La fotografía del hero se veía lavada, y el motivo no era la fotografía.** El primer intento fue bajarle la luminosidad con un filtro; la captura de comprobación salió **idéntica** a la anterior. Leyendo el estilo calculado en el navegador, el filtro sí estaba aplicado (`brightness(0.72) contrast(1.12)`): lo que blanqueaba la escena eran los **dos velos del color de fondo** que van encima de la imagen, al 40 % y al 60 %. Aligerarlos —a 32 % y 48 %, no quitarlos, porque son lo que sostiene el contraste del titular, que es texto oscuro sobre foto— fue lo que se vio de verdad. Efecto colateral que hubo que corregir: con menos velo, el párrafo y la etiqueta de localización en `text-muted-foreground` se quedaron cortos de contraste sobre la imagen, y pasaron a `text-foreground/80` y `/75`.

**El botón de acceso al panel no se veía, y pasó por dos versiones antes de verse.** Estaba en `bg-primary/5` con el icono en gris de texto secundario: sobre la cabecera clara no se distinguía de un separador. La primera corrección —lavado verde al 10 % con anillo— siguió leyéndose como un círculo gris en la captura a tamaño real. La que funciona es verde de marca **sólido**, con el icono claro, que aclara y crece al pasar por encima. Es el único punto de entrada al panel en toda la web.

**`/admin/login` pide ahora una sola clave, sin usuario.** Fotografía a pantalla completa con el zoom lento de 40 s que pidió el titular, tarjeta de vidrio con sombra azulada, el logotipo de la finca, un único campo y el botón de entrar. Es una decisión tomada a sabiendas de lo que cuesta —trazabilidad individual, revocación por persona y separación de perfiles por esa puerta— y todo eso está enumerado en §25 en lugar de quedar implícito.

Lo que la implementación **no** cedió, porque no formaba parte de lo pedido: la clave sale de `ADMIN_GATE_PASSWORD` y no del código, en un repositorio que es público y cuyo historial no se puede limpiar del todo; hay rate limit propio de cinco intentos cada diez minutos por IP, comprobado antes de mirar la clave, porque el de Better Auth solo actúa cuando la clave ya es correcta; la comparación es en tiempo constante sobre digests de longitud fija, porque con una clave única el tiempo de respuesta es la única señal medible; y sin configuración no se entra. Que la protección del secreto funciona quedó demostrado por accidente: la primera versión de las pruebas usaba un valor de ejemplo sin marcador reconocible y **el escáner de secretos rompió la suite**. Se corrigió el valor de la prueba, no el patrón.

**No se ha introducido un segundo sistema de autenticación**, que es lo que las reglas del proyecto prohíben: al acertar la clave, el servidor abre una sesión real de Better Auth contra una cuenta existente. De ahí que permisos, auditoría, revocación y expiración sigan funcionando sin tocarlos.

**El cambio rompía las pruebas E2E, y eso reveló lo que faltaba.** La suite inicia sesión con tres perfiles para comprobar que cada uno ve lo suyo; con una sola clave que entra siempre como ADMIN, CONTENT y COMMERCIAL habrían quedado **inservibles** —no solo sin probar—. Se conservó el formulario de correo y contraseña en `/admin/login/credenciales`, y se amplió la exención del middleware a las subrutas del login con `startsWith("/admin/login/")` en vez de un `startsWith("/admin/login")` a secas, que habría dejado pasar también `/admin/loginfalso`.

**Segunda vuelta, el mismo día: el titular pidió que no hubiera ninguna otra vía de acceso.** La primera versión dejaba el formulario de credenciales accesible pero sin enlazar, y eso no es lo que se pidió: no enlazar una puerta no es cerrarla. Ahora responde **404** salvo que el entorno declare `ENABLE_CREDENTIALS_LOGIN=true`, y el único sitio que lo declara es el servidor bajo prueba de `playwright.config.ts`. En el despliegue no existe esa variable, así que **la clave única es la única puerta**.

La gradación importa y por eso se resolvió con una variable y no borrando el archivo: eliminarlo habría dejado sin cobertura la autorización por rol, que es lo que más sostiene este proyecto —23 de las 26 pruebas E2E dependen de poder iniciar sesión con tres perfiles distintos—. Con el interruptor, el despliegue tiene una sola entrada y las pruebas siguen verificando lo que siempre verificaron. Se añadió el escenario 14 (tres pruebas) para cubrir la puerta nueva de punta a punta: rechaza una clave incorrecta vaciando el campo, entra con Enter y da acceso completo, y no ofrece ninguna alternativa en pantalla.

**Configuración de la puerta en este despliegue.** Se creó una cuenta ADMIN dedicada (`acceso.panel@…`) con una contraseña aleatoria de 40 caracteres que vive solo en el entorno: nadie la teclea nunca. La clave que se escribe es la que eligió el titular. Así la contraseña de la cuenta no es memorizable ni reutilizada, y la auditoría identifica esa cuenta como la de la puerta. Verificado en el navegador contra el servidor local: clave incorrecta rechazada con el campo vaciado, clave correcta dentro del panel con los ocho apartados de ADMIN, y `/admin/login/credenciales` devolviendo 404.

**El panel adopta la estética de la pantalla de acceso** redefiniendo los tokens de color dentro de una clase `.admin-shell`, no reescribiendo las nueve vistas: ya se pintan con `bg-background`, `border-border` y `text-muted-foreground`, que en Tailwind 4 resuelven a variables CSS y por tanto heredan. Azul noche, superficies de vidrio, esquinas redondeadas, cabecera fija con la navegación en pastillas y tablas con cabecera adherente y filas que responden al puntero. El fondo del panel es un degradado y no la fotografía: una imagen a pantalla completa detrás de una tabla de datos compite con lo que hay que leer. *(Decisión revisada en la Fase 17 a petición del titular: el panel lleva la fotografía, bajo un velo del 87 %.)* El `--muted-foreground` se fijó en 0.78 de luminosidad, no en el gris del sitio público, que sobre este fondo se habría quedado en torno a 3:1.

**La fotografía de fondo llegó al final, y venía a 8000 × 5000 px y 13,3 MB.** Servir eso como `background-image` habría puesto 13 MB en la primera petición de la pantalla, sin pasar por `next/image` —un `background-image` de CSS no se optimiza—. Se redimensionó a 2560 px de ancho con `sharp`: **290 KB**, un 98 % menos, y sigue sobrada para pantalla completa con el zoom al 120 %. La ruta y los requisitos quedan escritos en `public/images/admin/README.md` para la próxima vez.

**Un descuido propio que conviene anotar:** el archivo entró en un `git add -A` sin que nadie lo hubiera mirado, así que la versión de 13 MB llegó a publicarse y **sigue en el historial de Git**, que no se reescribe por norma del proyecto (§Publicación). El coste es un repositorio 13 MB más pesado al clonar, no un problema de funcionamiento. La lección es la evidente: revisar el peso de un binario antes de versionarlo, no después.

Con la fotografía puesta se ajustó el velo que va encima: iba del 25 % al 70 % de negro y apagaba la imagen sin necesidad, porque el texto de la pantalla se apoya en la tarjeta de vidrio y no en la fotografía desnuda. Ahora va del 8 % al 45 %, lo justo para que los bordes no vibren cuando el zoom acerca la zona más saturada.

**Archivos creados:** `lib/auth/admin-gate.ts` (+ test), `app/admin/login/gate-action.ts`, `app/admin/login/gate-form.tsx`, `app/admin/login/credenciales/page.tsx`, `public/images/admin/README.md`.

**Archivos modificados:** `app/admin/login/page.tsx`, `app/admin/(protected)/layout.tsx`, `app/globals.css`, `components/sections/hero.tsx`, `components/admin-access.tsx`, `middleware.ts`, `e2e/helpers.ts`, `e2e/03-panel-acceso.spec.ts`, `.env.example`, `README.md`.

**Validación (comandos y resultados reales):**

| Comando | Resultado |
|---|---|
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | 60 archivos, **731 pruebas, todas verdes** (**+33**) |
| `npm run e2e` | **26 pruebas, todas verdes** (2,5 min) — 3 nuevas del escenario 14 |
| `npm run build` | exit 0 |
| Escáner de secretos | 0 hallazgos, tras corregir el valor de prueba que él mismo detectó |
| Comprobación en navegador | Home, pantalla de acceso, tres vistas del panel, y el recorrido real de la puerta: clave incorrecta, clave correcta y 404 de la segunda vía |

**Dos fallos propios que conviene dejar escritos, porque los dos costaron una vuelta:** un `.next` que quedó inconsistente hacía que `/admin/login` devolviera **500 en producción y 200 en desarrollo**, y la primera captura salió en blanco por eso —se resolvió con `rm -rf .next` y build limpio—. Y la primera ejecución de las E2E falló en los tres perfiles porque `reuseExistingServer` reutilizó un `next start` mío que había quedado vivo en el puerto 3100 sirviendo justo ese build roto: las pruebas no fallaban por el cambio, sino por el servidor que encontraron.

---

### Fase 15 — Limpieza de los datos ficticios (2026-08-14)

El CRM en producción mostraba 68 solicitudes nuevas y 382 contactos. Ninguno era real.

**El inventario fue la parte que decidió el trabajo**, y por eso se hizo antes de borrar nada: 382 contactos con correo en `@example.invalid` —residuo de las pruebas de Vitest, que corren contra la base de desarrollo real (§Limitaciones)—, 1 contacto de una prueba manual con un dominio mal escrito, **0 contactos reales**, 6 reportajes marcados `isDemo` y 10.053 `AuditEvent` generados por los tests (5.011 `content.create`, 432 `crm.export.leads`, 382 `privacy.anonymize`).

`npm run demo:clean`, que existía para esto, encontró **0 contactos**: identifica lo suyo por el dominio `demo.portondelacondesa.test` y los residuos de Vitest usan otro. De ahí el script nuevo.

**Se borraron solo los contactos**, por decisión del titular tras ver el desglose: 383 contactos con su cascada —101 solicitudes, 33 consentimientos, 30 sesiones VIP, 31 notificaciones, 7 interacciones, 1 actividad—. Se conservaron los 6 reportajes (borrarlos habría dejado `/bodas-reales` y `/catering` sin nada detrás del gate), los 10.053 eventos de auditoría y las cuentas de administración.

**`npm run test:clean`** queda en el proyecto, y no como comando de una vez, porque el residuo **se regenera en cada `npm test`**. Tiene modo seco, imprime el desglose por dominio y cuenta lo que arrastra la cascada *antes* de borrar, porque después ya no habría forma de decirlo. No toca los `AuditEvent`: un registro de auditoría que desaparece con lo auditado no es un registro de auditoría.

**Lo que hace segura la operación** es que solo alcanza sufijos que el IETF reserva —`.test`, `.invalid`, `.example` y los `example.com/net/org` de la RFC 2606—, dominios que no se pueden registrar ni resolver. Ningún contacto legítimo puede coincidir. Para un dominio que no esté en la lista hay que nombrarlo con `--dominio=`, y esa fricción es intencionada. `lib/testing/test-data-clean.test.ts` falla si alguien añade a la lista algo que sí podría ser real.

**Un fallo propio, encontrado al escribir esa prueba:** importaba la lista directamente del script, y el script llama a `main()` en su nivel superior. Es decir, **cada `npm test` habría ejecutado el borrado contra la base de datos**. Pasó desapercibido porque la base ya estaba vacía cuando la prueba corrió por primera vez. La lista se movió a `lib/testing/test-data-domains.ts`, un módulo sin efectos, y el comentario de ese archivo explica por qué vive ahí y no donde parecería natural.

**Comprobado con la base vacía**, que es un caso límite que nadie prueba: el Resumen, Informes, Contactos, Solicitudes, Pipeline y Tareas responden 200 sin un solo error de página, los ratios dicen "Sin datos" en lugar de inventar un porcentaje, y los estados vacíos explican qué falta ("Nadie ha pasado por el gate todavía").

**Archivos creados:** `scripts/test-data-clean.ts`, `lib/testing/test-data-domains.ts`, `lib/testing/test-data-clean.test.ts`.

**Archivos modificados:** `lib/domain/crm-requests.ts`, `lib/domain/crm.test.ts`, `lib/domain/scoring.test.ts`, `package.json`, `README.md`.

**Y lo que apareció al validar la limpieza: el fallo intermitente que la auditoría final no pudo capturar. Eran dos mecanismos.**

El primero, **estado global compartido**. `ScoringRule` no son datos de un test: es la tabla de configuración de la puntuación, una fila por señal, compartida por todo el sistema. `scoring.test.ts` la modifica —fija pesos, desactiva `FORM_SUBMITTED` para comprobar que una regla apagada no suma— mientras `crm.test.ts` recalculaba el mismo contacto tres veces esperando el mismo número. El síntoma exacto era `expected 40 to be 30`: entre el primer recálculo y el segundo, la regla volvía a activarse y sus 10 puntos volvían a contar. **Vitest ejecuta los archivos en paralelo pero los tests de un mismo archivo en serie**, así que la corrección fue juntar a quien muta la configuración con quien depende de ella: las pruebas de puntuación viven ahora todas en `scoring.test.ts`, con un `afterAll` que devuelve los pesos a los del seed y un comentario que le dice a quien añada una prueba nueva por qué tiene que ponerla ahí.

El segundo era **el mismo defecto que la auditoría corrigió en la exportación, en un sitio donde no se corrigió**: `listRequestsForAdmin` traía la relación obligatoria `lead` anidada, y Prisma la resuelve con una segunda consulta interna. Si el contacto desaparece entre ambas —otro archivo borrando en paralelo, o en producción alguien ejecutando una supresión mientras un comercial abre la pantalla— lanza `Inconsistent query result: Field lead is required to return data, got null` y **el listado entero de Solicitudes devuelve 500**. Es peor que en la exportación: exportar es un clic ocasional, Solicitudes es donde se trabaja. Corregido con el mismo patrón —`leadId` en el `select` y los contactos en una consulta aparte, omitiendo la fila sin dueño— y con dos pruebas: una que rompe la integridad a propósito con un `DELETE` directo, y otra que comprueba que en el caso normal el contacto sí llega, porque una corrección así podría haber dejado el listado sin datos de contacto sin que nada avisara.

La lección de fondo: **corregir un defecto en un sitio y no buscar el mismo patrón en los demás deja el fallo vivo**. La auditoría lo arregló en `crm-export.ts` y anotó el intermitente como irreproducible; estaba a una consulta de distancia, en el módulo de al lado.

**Validación:** 737 pruebas en 61 archivos, **tres pasadas consecutivas en verde**; 26 E2E; lint, typecheck y build exit 0.

---

### Fase 16 — Identidad propia del panel y contraste del menú público (2026-08-14)

Cinco ajustes de interfaz pedidos por el titular. Los dos que tienen fondo son la tipografía del panel y el menú del sitio público.

**El panel deja de usar la serif del sitio público.** Todo pasa a DM Sans con el tracking cerrado, y las cifras de las tarjetas de métricas a JetBrains Mono con `font-variant-numeric: tabular-nums`. El motivo no es estético: el panel es una herramienta de trabajo donde se leen cifras y estados de un vistazo muchas veces al día, y una serif clásica resta legibilidad a tamaño pequeño y en tablas. Las cifras tabulares impiden además que los números cambien de posición al cambiar de valor, que es lo que permite compararlos en columna. **Se usa la sans que ya estaba en el repositorio** en lugar de traer una familia nueva: ni una petición más, ni un archivo más, ni una licencia más que auditar.

**Un fallo propio, visto en la captura de comprobación:** la primera versión aplicaba la monoespaciada con el selector `.font-serif.text-3xl`, y eso es exactamente lo que usan **también** los encabezados de página, así que «Resumen» y «Solicitudes» salían monoespaciados. Los valores de métrica son `span` y los encabezados son `h1`: el elemento es lo que los distingue de verdad, no el tamaño. Es el tipo de error que un typecheck no ve y una captura sí.

**El menú del sitio público no se leía, y el motivo estaba en la combinación, no en el color.** Los enlaces eran texto de 12 px en mayúsculas con el gris de texto secundario, y la cabecera es transparente sobre la fotografía del hero mientras no se hace scroll: sobre una imagen con zonas claras y oscuras no hay contraste fiable en ninguna. Se corrigió por tres vías a la vez —color de texto principal, peso medio y un punto más de tamaño— y sobre todo dándole base con un degradado desde arriba, que es lo que garantiza el contraste sin convertir la cabecera en una barra sólida, cosa que el diseño de la portada evita a propósito.

El degradado se ajustó **dos veces**: al 92 % aclaraba el tercio superior de la fotografía y deshacía parte del oscurecido de la Fase 14, así que bajó al 72 %. Con el texto ya en negro y con peso, sigue sobrando para leerlo.

**El resto:** el título del panel pasa de «Panel privado» a **«Seguimiento comercial»**, que dice lo que se hace ahí; desaparece la etiqueta con el nombre y el rol de la sesión —con una sola clave de acceso siempre mostraba la misma cuenta, así que ocupaba sitio sin informar de nada—; «Cerrar sesión» pasa a **«Salir»** en pastilla, con estado de carga propio; y el fondo del panel toma la paleta de la pantalla de acceso —azul noche con halos magenta, cian y ámbar— **sin la fotografía**, porque una imagen a pantalla completa detrás de una tabla compite con lo que hay que leer y son 290 KB que el panel no necesita descargar. Lo que da continuidad es el color, no el archivo. *(Esta última decisión la revisó el titular en la Fase 17: el panel lleva la fotografía.)*

**Archivos modificados:** `app/globals.css`, `app/admin/(protected)/layout.tsx`, `app/admin/(protected)/logout-button.tsx`, `components/header.tsx`, `README.md`.

**Validación:** `npm run lint` y `npm run typecheck` exit 0, y comprobación real en el navegador con capturas de la home, la cabecera, el Resumen y Solicitudes. **Las suites de pruebas no se han ejecutado en esta fase**, por decisión del titular: son cambios de presentación y cada pasada completa cuesta minutos. Quedan pendientes de la siguiente ejecución que él indique.

---

### Fase 17 — Fotografía de fondo en el panel y rótulo destacado (2026-08-14)

Dos peticiones de diseño del titular sobre el panel privado.

**El fondo del panel pasa a ser la fotografía de la pantalla de acceso.** Es una revisión explícita de la decisión de la Fase 16, que dejó solo la gama de color: el titular quiere continuidad visual entre entrar y trabajar. Se reutiliza el mismo archivo ya optimizado (2560 px, 290 KB), que además está en la caché del navegador cuando se llega al panel —se acaba de mostrar a pantalla completa en el acceso—, así que no cuesta una descarga nueva. Va con `background-attachment: fixed`, porque un fondo que acompaña al scroll en un listado largo arrastra la vista.

**El velo es la pieza que hace esto viable, no un adorno.** Sin él, el texto de las tablas cae sobre las zonas claras de la fotografía y el contraste depende de por dónde recorte la imagen el navegador, que cambia con cada tamaño de ventana. Con un velo al 87 %–81 % el contraste lo garantiza el CSS: medido sobre el fondo desnudo —ocultando el contenido y analizando los píxeles reales de la captura—, en el punto más claro el texto secundario queda a **7,7:1** y el principal a **12,6:1**, frente al 4,5:1 que exige la WCAG AA. Se repitió la medición a 390 px de ancho, donde el recorte `cover` amplía la zona más saturada: **7,7:1** también.

**Se quitaron los halos magenta, cian y ámbar.** Existían para dar interés a un degradado plano; sumados a una fotografía que ya es una nube de pigmentos de esos mismos colores, disparaban la saturación de la banda central y el Resumen quedaba ruidoso justo entre las tarjetas. Se vio en la captura de comprobación. El color lo pone ahora la fotografía y el CSS solo la apaga lo justo. En la misma línea, las superficies de vidrio subieron del 5 % de blanco a un azul al 62 % con más desenfoque: con una imagen detrás, un vidrio casi transparente deja el texto a merced de lo que toque de la foto.

**El rótulo «Seguimiento comercial» gana notoriedad, y hubo que tocar dos cosas para conseguirlo.** Subirlo de cuerpo no bastaba: a 28 px y peso 600 quedaba igualado con los títulos de sección —30 px y también 600—, dos textos casi idénticos a ochenta píxeles de distancia. La causa era una regla propia de la Fase 16 que forzaba `font-weight: 600` a todos los encabezados del panel y pisaba el `font-light` que cada vista escribe. Se eliminó esa declaración, así que los títulos de sección vuelven a la ligera que eligió su autor, y el rótulo pasa a 30 px en negrita con una barra de acento en degradado. La jerarquía se lee sola. El rótulo sigue siendo un `span` y no un `h1`: el encabezado de la página lo pone cada vista, y meter un segundo `h1` en el layout rompería la jerarquía de encabezados.

**Hallazgo que queda documentado en el código.** Los comentarios del bloque `.admin-shell` afirmaban que el `:where()` deja ganar a cualquier utilidad de Tailwind escrita en el componente. **Es falso**, y se comprobó leyendo el peso calculado del `h1`: este archivo declara sus reglas fuera de toda `@layer`, y el CSS sin capa vence al que está en capas por poca especificidad que tenga. La forma de dejar que el componente decida no es bajar la especificidad, es **no declarar** la propiedad. Corregido en los dos comentarios que lo afirmaban, porque es justo el tipo de nota que hace perder una tarde a quien venga después.

**Un tropiezo del proceso:** el rate limit del propio gate —5 intentos por 10 minutos— bloqueó las comprobaciones en el navegador a mitad de la sesión, funcionando exactamente como debe. Se liberó el contador en la base de datos de desarrollo; el límite se queda como está.

**Archivos modificados:** `app/globals.css`, `app/admin/(protected)/layout.tsx`, `README.md`.

**Validación:** `npm run lint` y `npm run typecheck` exit 0. Comprobación real en el navegador con capturas del Resumen, Solicitudes, Contactos y Configuración a 1440 px y del Resumen a 390 px, más medición de contraste sobre los píxeles del fondo desnudo en ambos anchos. Sin desbordamiento horizontal en móvil (`scrollWidth` = `clientWidth` = 390). **Las suites de pruebas siguen sin ejecutarse**, por decisión del titular; estos cambios no tocan dominio, validación ni autorización.

---

### Fase 18 — Modos día/noche, captación a los 90 s y front compacto (2026-08-14)

Bloque largo de peticiones del titular, todas de interfaz salvo dos que tocan validación y una que añade funcionalidad nueva.

#### Panel privado

**Dos modos, día y noche, con el conmutador a la izquierda de «Salir».** El tema no vive en las pantallas: `data-tema` sobre `.admin-shell` elige la paleta y las nueve vistas no saben en qué modo están. Todo lo que no es color —radios, tipografía, tablas adherentes, desenfoques— se declara una sola vez, y cada modo redefine solo sus tokens. Se introdujeron variables propias para las superficies (`--admin-surface`, `--admin-line`, `--admin-chrome`…) porque con colores literales cada regla habría necesitado duplicarse por modo, y ahí es donde dos temas se desincronizan con el primer cambio hecho con prisa.

**El modo elegido vive en una cookie, no en `localStorage`.** El layout del panel se renderiza en servidor, así que puede leer la cookie y pintar el modo correcto en el primer HTML. Con `localStorage` el servidor no sabe nada: el primer pintado saldría en un modo y el cliente lo corregiría tras hidratar —el parpadeo clásico—, y para evitarlo habría que meter un script inline en el `<head>` y abrirle un hueco a la CSP. Es **cookie de sesión de navegador**, y `enterAdminArea` la borra al entrar, así que **cada acceso empieza en día**, como se pidió; el cambio se recuerda mientras se navega, que es lo que espera cualquiera al pulsar un interruptor.

**El cromo dejó de usar colores fijos.** `bg-black/40` y `ring-white/15` son invisibles sobre fondo claro: ese es exactamente el error que aparece al añadir un segundo tema sobre una interfaz escrita en un solo tono. Ahora la cabecera, las pastillas y los enlaces de sección salen de `admin-chrome`, `admin-pill` y `admin-navlink`.

**El resto del panel:** el modo día se oscureció un escalón —era casi blanco de papel y deslumbra en una herramienta de uso continuado—, manteniendo las tarjetas blancas para que el contenido gane capa en vez de fundirse con el fondo; el rótulo pasa a **«Gestión comercial»** a 34 px, en negrita y con un degradado de texto de la propia gama, protegido con `@supports` porque `background-clip: text` con `color: transparent` sin red de seguridad es un rótulo invisible en cuanto un navegador no lo soporta; y **«Salir» es rojo**, con un tono distinto por modo, porque el mismo rojo que funciona sobre azul noche resulta chillón sobre fondo claro.

**Un hallazgo medido:** en modo día hay texto secundario que cae directamente sobre la fotografía, no sobre tarjeta, y el velo claro deja pasar más imagen que el oscuro. Medido sobre los píxeles del fondo desnudo, en el punto más oscuro el token daba 5,5:1; se bajó a 0.44 para dejarlo en 6,0:1. Los dos pasaban el 4,5:1 de la WCAG AA —se eligió el margen—. La primera medición dio 3,53:1 y era **errónea**: usaba un color estimado a mano en lugar del que renderiza el navegador.

#### Bibliotecas VIP

Las dos —bodas reales y catering— pasan a la gama del panel con la misma técnica de tokens (`.vip-shell`), sin reescribir sus seis componentes. Dos diferencias deliberadas con el panel: **sin la fotografía de fondo**, porque aquí competiría con el contenido, que es precisamente fotografía; y **se conserva la serif Cormorant** en los títulos, porque una biblioteca de historias es contenido editorial y no una herramienta de trabajo. Lo que moderniza estas pantallas es el color y las superficies, no cambiarles la voz.

#### Aviso de captación a los 90 segundos

Nuevo `VipInvitePopup`: a los 90 s pide el email y, cuando lo recibe, ofrece un botón que entra directamente en la biblioteca de bodas reales. **No es un gate ni lo sustituye**: el contenido protegido sigue detrás de `VipGate` y de la validación en servidor. Usa la misma acción, así que registra el lead, los dos consentimientos por separado y la atribución igual que el formulario de la biblioteca —y la sesión que abre vale para las dos bibliotecas, que ya funcionaba así—.

**Se calla cuando debe:** en las dos bibliotecas (ya tienen su propio formulario a pantalla completa), en el panel, en las páginas legales —interrumpir la lectura de la política de privacidad con una captación de email es justo lo que no hay que hacer—, para quien ya tiene acceso, y durante el resto de la visita si se cierra.

**Cómo sabe si ya hay acceso.** La cookie VIP es `HttpOnly`, así que el cliente no puede mirarla. Se añadió `GET /api/vip/access`, que devuelve **solo un booleano**: ni el email, ni el identificador del lead, ni la caducidad. No se resolvió en el layout a propósito: leer la cookie ahí habría marcado como dinámico todo el sitio público, incluidas las páginas que hoy se generan estáticas. La consulta sale una sola vez y solo si el visitante sigue ahí al minuto y medio.

**El diálogo es el de Radix** y no un `div` con `position: fixed`: foco atrapado, Escape, `aria-modal`, retorno del foco y bloqueo del scroll de fondo vienen resueltos, y un aviso que interrumpe es justo donde no conviene improvisar accesibilidad. Tras el repaso del titular quedó sin icono decorativo, con menos texto, esquinas de 24 px, casillas discretas de 14 px —sin reducir su área de pulsación, que la da la etiqueta entera—, campo de email con el icono dentro y sin el botón «Ahora no»: sigue habiendo tres formas de rechazarlo (aspa, Escape y clic fuera).

Verificado de punta a punta con el reloj real: no aparece a los 1,5 s, aparece a los ~91 s, rechaza sin el consentimiento de privacidad, concede acceso en 1,9 s y el botón entra en la biblioteca; después, `/catering` tampoco pide nada.

#### Formulario de contacto

**Un solo campo de nombre.** El formulario pedía nombre y apellidos por separado; ahora es uno con el marcador «Nombre y Apellidos». **El dominio sigue guardando los dos por separado** —el CRM ordena, busca y saluda con ellos— y **el contrato del endpoint no cambia**: `leadRequestFormSchema` se deriva del compartido con `.omit().extend()`, y `splitFullName` traduce en un único sitio, al construir el payload. Por eso el campo exige dos palabras: con una sola no habría apellido, y rellenarlo con un guion o repitiendo el nombre sería meter basura en la ficha del cliente. La primera palabra es el nombre y el resto los apellidos; es una convención que partirá algún nombre compuesto, y se acepta porque adivinar dónde acaba uno falla más y de forma menos predecible, y porque en el panel ambos campos son editables.

**Fuera el espacio preferido y el presupuesto orientativo.** El presupuesto ya era opcional y deja de enviarse. El espacio lo sigue exigiendo el endpoint, así que quien no lo pregunta envía `NO_SPACE_PREFERENCE` —«sin preferencia, aconsejadme»—, que es exactamente lo que significa no haberlo preguntado.

**Sin rótulo visible sobre cada campo,** que era la mitad de la altura del formulario. Las etiquetas siguen en el HTML con `sr-only`: unidas a su campo, anunciadas por un lector de pantalla y con el `for` llevando el foco al pulsar. Borrarlas habría dejado diez campos sin nombre accesible, que es una barrera de verdad. **Lo que sí se pierde** es la pista visual cuando el campo ya tiene texto escrito, porque el marcador desaparece al escribir; y el campo de fecha, que no admite marcador, queda sin rótulo visible.

Aspecto: tarjeta con borde y esquinas grandes, campos con relleno redondeado en lugar de una línea inferior —un campo subrayado no dice dónde acaba la zona pulsable, y en móvil eso se nota— y botón en pastilla.

#### Resto del front

**El mapa era una ilustración y ahora es un módulo de ubicación.** El filtro anterior (`grayscale(0.55) sepia(0.35) hue-rotate(45deg) saturate(2.2)`) dejaba el mapa teñido de un verde irreal donde costaba distinguir una carretera de un río: un mapa es información, y si hay que entornar los ojos para leer una calle el filtro está de más. Queda una corrección mínima. Mapa y datos van dentro de una sola tarjeta, con un chip que nombra el punto, la dirección y las coordenadas con su icono, las coordenadas en monoespaciada con botón de copiar —copia las decimales, que son las que acepta un GPS, no la etiqueta con grados y símbolos— y **dos acciones**: ver ruta y abrir el mapa. Antes había un solo botón que decía «Abrir en Google Maps» pero llevaba a las indicaciones.

**La web es un 16 % más corta:** de 11.111 px a 9.343 px medidos a 1440 px de ancho, de 12,3 a 10,4 pantallas. Sin quitar contenido: se recortaron los rellenos de sección (128/192 px → 80/112), los huecos de las rejillas, un escalón en los títulos grandes, y sobre todo las dos fotografías a ancho completo, que medían 936 y 596 px de alto y pasan a formato panorámico. El hero baja de `min-h-screen` a `88vh`, con lo que asoma el borde de la sección siguiente: además de acortar, le dice a quien llega que hay más abajo.

**Cabecera con cristal al hacer scroll,** como la tarjeta de la pantalla de acceso: fondo al 72 % y desenfoque `xl` en vez de una barra opaca al 95 %, con una sombra baja que la despega del contenido.

**Pie compactado** y con iconos delante de la dirección, el correo y el teléfono. Van con `aria-hidden`: son ayuda visual, no información nueva; un lector que los anunciara diría «imagen, sobre, correo@…», que es peor que no tenerlos.

**Fotografía del hero un 20 % más oscura** (0,49 → 0,40 de luminancia en la zona del titular) y viñeta lateral reducida a menos de la mitad (48 % → 22 %). El límite no es estético: el titular, el párrafo y la etiqueta de localización son **texto oscuro sobre la fotografía**, y los velos crema son lo que les da contraste. Con el velo intermedio al 16 % la etiqueta de localización caía a 2,37:1; se dejó en el 26 % y se le dio base propia a esa etiqueta —el mismo recurso que ya usaba la de coordenadas—, con lo que los tres quedan en 8,21:1, 8,99:1 y 13,45:1.

**Logotipo de la cabecera más grande** (de 36/44 px a 44/56) con sombra proyectada sobre la silueta de las letras, y **acceso al panel más pequeño** (40 → 32 px): es una herramienta interna, no una llamada a la acción, así que cede protagonismo. El propio botón se rehízo antes en esta fase porque se empastaba con la fotografía: el verde de marca es `#182605`, casi negro, y plano sobre el hero desaparecía. Se arregló con volumen y **dos contornos con trabajos distintos** —uno claro que lo dibuja sobre fondo oscuro y una sombra que lo despega sobre fondo claro—, con los tonos derivados del token mediante `color-mix` para que no haya un segundo verde escrito a mano.

**Una falsa alarma que conviene anotar,** porque cuesta tiempo dos veces: se dio por roto el conjunto de sombras arbitrarias con `oklch(... / ..%)` al ver `boxShadow` transparente en el navegador. No estaban rotas: Tailwind 4 pone cuatro capas vacías de inset y ring **delante** de la sombra real, y la comprobación truncaba la cadena a 70 caracteres, justo antes del valor. Las sombras se pasaron igualmente a `rgba()` por coherencia con la pantalla de acceso, que ya lo usaba.

**Archivos modificados:** `app/globals.css`, `app/layout.tsx`, `app/admin/(protected)/layout.tsx`, `app/admin/(protected)/logout-button.tsx`, `app/admin/(protected)/theme-toggle.tsx` (nuevo), `app/admin/login/page.tsx`, `app/admin/login/gate-action.ts`, `app/api/vip/access/route.ts` (nuevo), `lib/admin-theme.ts` (nuevo), `lib/leads.ts`, `lib/validation/lead-request.ts`, `components/header.tsx`, `components/footer.tsx`, `components/admin-access.tsx`, `components/sections/*.tsx`, `components/vip/vip-invite-popup.tsx` (nuevo), `components/vip/vip-library.tsx`, `components/vip/vip-story.tsx`, `data/site-content.ts`, `data/site-content.en.ts`, `README.md`.

**Validación:** `npm run lint` y `npm run typecheck` exit 0 tras cada bloque. Comprobación real en el navegador: los dos modos del panel con su cookie y su persistencia al navegar, el aviso a los 90 s de punta a punta, el gate y las dos bibliotecas, el formulario simplificado, el mapa con el copiado de coordenadas (portapapeles leído: `38.077167, -1.150417`), la cabecera con scroll y el responsive en 360, 390, 768, 1024 y 1440 px sin desbordamiento horizontal en ninguna combinación. Medición de contraste sobre los píxeles del fondo en los dos modos del panel y en los tres textos del hero. Los tres contactos de prueba que generaron las comprobaciones se borraron con `npm run test:clean` (quedan 0 contactos).

**Pendiente y advertido:** **las suites siguen sin ejecutarse** por decisión del titular, y esta fase **sí toca validación y dominio** —`lead-request.ts`, `lib/leads.ts`— además del formulario, así que hay pruebas que necesitan actualizarse: las que envían `firstName`/`lastName` desde el formulario y las que esperan los campos de espacio y presupuesto en pantalla. Es lo primero que habrá que mirar cuando se dé la orden de ejecutarlas.

---

### Fase 19 — Selector de fecha propio, destello en las bibliotecas y pie compacto (2026-08-14)

#### Formulario

**El calendario salía en inglés y no había atributo que lo cambiara.** El control nativo `<input type="date">` pinta su calendario en el idioma de la **interfaz del navegador**, no en el de la página: con un Chrome en inglés salía en inglés aunque el documento declare `lang="es"`. Se sustituye por el `Calendar` que ya estaba en el proyecto (react-day-picker) dentro de un `Popover`, con el `locale` de `date-fns` que corresponde al idioma de la web. Verificado: el calendario dice «agosto 2026» y «lu ma mi ju vi sá do».

El cambio resuelve de paso la segunda queja: el control nativo traía su propia caja y **medía distinto** que el desplegable de al lado. El valor del formulario sigue siendo `yyyy-MM-dd`, que es lo que valida el esquema y lo que espera el endpoint; lo que cambia es cómo se elige y cómo se muestra. La conversión usa `parse` con formato explícito y no `new Date(cadena)`, que interpreta `2026-09-12` como UTC y según la zona devuelve el día anterior —el error clásico de las fechas sin hora, que aquí significaría mostrar un día distinto del elegido—.

**Las alturas ya no bailan: los cuatro campos de la rejilla miden 48 px.** El desajuste que quedaba era del desplegable, que fijaba su alto con `data-[size=default]:h-9`; por ser un selector de atributo gana a un `h-12` suelto y `tailwind-merge` no los fusiona, así que medía 36 frente a 48. Se corrige apuntando a la misma variante.

**Los marcadores de posición dicen el nombre del campo, no un ejemplo,** como se pidió. Excepción justificada: el de la fecha se acorta a «Fecha prevista» porque «Fecha prevista (opcional)» no cabe en una línea y partía la caja en dos; el «(opcional)» sigue en la etiqueta accesible, que es donde hace falta. Y se corrigieron dos deslices del cambio anterior: el marcador del teléfono había quedado en español dentro del bloque inglés, y el del desplegable seguía diciendo «Selecciona una opción».

#### Bibliotecas VIP

**Destello de color en movimiento,** en la gama del panel —magenta, cian, ámbar y un punto de violeta— en lugar del degradado quieto. Va en un pseudoelemento propio y se animan solo `transform` y `opacity`, que el navegador resuelve en la capa de composición sin recalcular diseño ni repintar; animar las paradas del degradado daría el mismo efecto a la vista y obligaría a repintar dos manchas a pantalla completa durante toda la visita. Lleva también un grado y medio de rotación: con solo mover y escalar, el recorrido se adivina en pocos segundos y el fondo parece una diapositiva deslizándose. Comprobado que se mueve de verdad comparando dos fotogramas separados siete segundos: **cambia el 67 % de los píxeles**. La regla global de `prefers-reduced-motion` lo deja quieto, y quieto sigue siendo un fondo correcto porque el destello decora, no comunica.

La primera versión salió demasiado tímida —se vio en la captura— y hubo que subir las opacidades bastante por encima de las del panel: sobre un fondo sin fotografía, las mismas manchas se leen mucho más flojas.

**Tipografía del panel y contenido centrado.** Esto revierte una decisión de la fase anterior, que conservaba la serif Cormorant por su aire editorial: el titular quiere que las dos bibliotecas se lean como la zona privada. Ahora es DM Sans, la misma del panel y del acceso. El formulario del gate se queda alineado a la izquierda dentro del bloque centrado: un campo de email y dos consentimientos centrados se leen peor.

**Títulos concretos.** «Accede a la biblioteca de bodas reales» describía el trámite de entrar; ahora dice qué hay dentro: **«Bodas reales celebradas aquí»** y **«Caterings servidos por nosotros»**, en el gate y en la cabecera del listado, en los dos idiomas.

#### Pie

**Fuera el filete intermedio,** que partía en dos algo que se lee como una sola pieza —el pie ya está delimitado por su propio borde superior—. La separación la da el espacio.

**De cuatro filas a dos.** El crédito de desarrollo tenía una fila propia y se integra junto al copyright; la columna de navegación, con siete enlaces en vertical, pasa a dos columnas y es la que más altura devuelve. El pie mide **335 px**, frente a los 514 con los que empezó la sesión: un **35 % menos** sin quitar un solo enlace ni reducir el área de pulsación.

#### Portada

**El hero vuelve a pantalla completa.** Se había bajado a `88vh` para acortar la página y el titular lo devolvió: con la fotografía recortada, el titular, el párrafo y los dos botones quedaban apretados contra el borde inferior. El aire de la portada es parte de lo que vende la finca, así que la reducción de longitud se queda en las secciones interiores. La home queda en 9.282 px, 10,3 pantallas —sigue un 16 % por debajo de los 11.111 px de partida—.

#### Un aviso que no era

Apareció un error de hidratación en la consola durante las comprobaciones. **No se reproduce**: tres cargas limpias con contexto nuevo salen sin un solo error, y era la recompilación en caliente de Turbopack sirviendo un HTML de una versión y un cliente de otra. Aprovechando el susto se corrigió algo que sí estaba mal por otro motivo: `disabled={{ before: startOfToday() }}` llamaba al reloj en **cada render** del formulario, también en el del servidor, y un valor que depende de la hora no debe entrar en el árbol que se hidrata. Ahora es una función y solo se evalúa al abrir el calendario.

**Archivos modificados:** `app/globals.css`, `components/sections/contact.tsx`, `components/sections/hero.tsx`, `components/footer.tsx`, `components/vip/vip-gate.tsx`, `components/vip/list-header.tsx`.

**Validación:** `npm run lint` y `npm run typecheck` exit 0. En el navegador: alturas de los cuatro campos medidas, calendario en español, marcadores comprobados uno a uno, pie medido, destello comparado entre fotogramas, y responsive de la home y de las dos bibliotecas en 360, 390, 768, 1024 y 1440 px **sin desbordamiento horizontal en ninguna de las quince combinaciones**. Las suites siguen sin ejecutarse por decisión del titular; sigue en pie el aviso de la Fase 18 sobre las pruebas que hay que actualizar.

---

### Fase 20 — Resend, exportación a Excel, tablero con arrastre y panel estilo CRM (2026-08-14)

Fase larga y con muchas peticiones encadenadas. Se agrupa por bloques porque las
decisiones de cada uno son independientes.

#### Correo transaccional: SendGrid fuera, Resend dentro

**El motivo del cambio es del titular: SendGrid no iba a ser posible.** El adaptador de
SendGrid se **retira**, no se deja en paralelo con una variable que elija. Con dos
proveedores instalados, un despliegue con la variable equivocada envía por un canal que
nadie mira y `NotificationLog` acaba contando dos historias distintas.

El cambio no toca ni el dominio ni la captación: para eso existía `EmailProvider`, y esta
es la primera vez que se cobra el interés de haberlo puesto. Lo que cambia es un archivo
de adaptador, la variable de entorno y las pruebas de ese adaptador.

Diferencias reales entre las dos APIs, que es donde estaba el trabajo:

- **200 en lugar de 202**, y el identificador del envío viene en el **cuerpo**
  (`{ "id": ... }`), no en una cabecera. Leer ese JSON va envuelto en un `try`: un cuerpo
  ilegible **no es un fallo de envío** —el proveedor ya respondió 200— y sin la guarda un
  cambio de formato en su respuesta convertiría un envío correcto en una excepción. Hay
  prueba para ese caso.
- **`reply_to` es una cadena**, no `{ email }`. Y en la API HTTP va en snake_case; es el
  SDK el que expone `replyTo`.
- **El cuerpo va en `text` y `html`**, sin el array `content` con tipos MIME que obligaba
  a ordenar el texto plano antes del HTML.

Se sigue usando `fetch` y no el SDK oficial, por lo mismo que con el proveedor anterior:
para una sola llamada HTTP el SDK arrastra dependencias que en el runtime de Vercel se
pagan.

**El remitente es donde esto falla en la práctica**, y conviene tenerlo escrito:
`onboarding@resend.dev` funciona sin verificar ningún dominio pero **solo puede escribir
a la dirección titular de la cuenta**. Por eso `SEND_LEAD_ACKNOWLEDGEMENT` se queda
apagado hasta que haya un dominio propio verificado: encenderlo antes no produce un error
visible en la web —la solicitud se guarda igual— sino una fila `FAILED` por cada
visitante.

**Nuevo comando: `npm run email:test`.** Lee la configuración, dice qué falta si falta
algo y, si está todo, envía un correo real usando **el adaptador del proyecto**. Es la
diferencia entre comprobar que Resend funciona y comprobar que esta aplicación envía. De
la clave solo informa el prefijo y la longitud.

**La política de privacidad cambió y su versión sube a `2026-08.2`.** No es un detalle
administrativo: la versión anterior nombraba a SendGrid y afirmaba que el envío estaba
desactivado y que ningún dato salía hacia el proveedor. Con Resend en marcha eso ya no es
cierto, y un consentimiento otorgado sobre aquel texto no cubre este. Efecto conocido y
buscado: quien tenga el formulario abierto desde antes recibirá
`policy-version-mismatch` y tendrá que recargar.

El patrón de detección de secretos también se sustituye: fuera el de SendGrid, dentro el
de Resend (`re_` + 24 caracteres de letras, dígitos y guiones bajos). **Sin guiones
medios**, y el escáner del propio proyecto es quien lo enseñó: la primera versión los
admitía y marcaba como secreto la constante ficticia de las pruebas. Ceñirse al formato
real detecta mejor y deja fuera los valores de prueba, que se escriben con guiones justo
para no parecer credenciales.

#### Exportación: de CSV a Excel de verdad

Se pidió que los botones descargaran Excel. Se entrega un `.xlsx` real, no un CSV
renombrado, y el cambio aporta más de lo que parece:

1. **Las fechas son fechas y los números son números.** En CSV todo era texto, así que no
   se podía ordenar por fecha ni sumar invitados sin convertir las columnas a mano. Peor:
   Excel interpretaba algunas fechas ISO según la configuración regional y podía cambiar
   el día. El formato de la columna se declara explícito (`dd/mm/yyyy hh:mm`) porque el
   mismo libro abierto en dos equipos mostraría 12/06 y 06/12 para la misma celda, y en
   una fecha de evento eso son seis meses de error.
2. **La inyección de fórmulas deja de ser un riesgo por construcción.** En CSV, un valor
   que empieza por `=`, `+`, `-` o `@` lo ejecuta la hoja al abrirla, y el asunto de una
   solicitud es texto que escribe un desconocido; había que prefijarlo con un apóstrofo,
   que ensuciaba el dato. En `.xlsx` la celda declara su tipo: una cadena es una cadena.
   **La prueba que antes comprobaba que el valor se retocaba ahora comprueba que llega
   íntegro**, y que no acaba siendo fórmula se verifica releyendo el archivo.

La arquitectura se separa en dos: `crm-export.ts` decide **qué** sale —lista blanca de
columnas y evento de auditoría, que es la parte con consecuencias— y `crm-workbook.ts`
decide **cómo**. Antes la decisión de seguridad más importante del proyecto compartía
archivo con el escapado de comillas.

Se añade `exceljs`. Escribir un ZIP y su XML a mano para ahorrar una dependencia es
riesgo sin beneficio en un formato que Excel valida con severidad. **Coste honesto:
`npm audit` pasa a informar de una vulnerabilidad moderada más (`uuid`, transitiva de
exceljs, sin vía de explotación aquí: exige controlar el argumento `buf` de v3/v5/v6).**

Las pruebas del libro **releen el archivo generado** con un parser independiente. Es la
diferencia entre afirmar que se escribió algo y afirmar que ese algo es un libro válido
con las celdas correctas. Y en las pruebas de la ruta es imprescindible por otro motivo:
un `.xlsx` es un ZIP, así que un `expect(texto).not.toContain("clave-interna")` sobre los
bytes crudos pasaría **siempre**, incluso con el dato dentro. Las comprobaciones de «esto
no debe salir» son justo las que no pueden depender de eso.

Los dos botones pasan a **solo iconos** —hoja de cálculo y flecha de descarga— sin texto,
como se pidió. Eso obliga a `aria-label` y `title`: sin el primero, un lector de pantalla
anuncia «enlace» y nada más; sin el segundo, el botón es un jeroglífico para quien usa el
ratón. Los dos iconos van con `aria-hidden` para que no se lean como «imagen, imagen».

#### Pipeline: solo tablero, y se mueve arrastrando

**Esto revierte una decisión documentada, y el motivo anterior era bueno:** no había
arrastrar y soltar porque un tablero accesible con ese gesto exige alternativa de teclado,
anuncios en vivo y manejo del foco. El titular pidió el arrastre y que desapareciera el
desplegable «Mover a». Se hace lo pedido **sin perder el acceso por teclado**:

- Cada tarjeta es enfocable con `Tab`, y con `Ctrl`/`Cmd` + flecha izquierda o derecha se
  mueve al estado válido anterior o siguiente. Nada de esto ocupa un píxel: el
  desplegable ya no está, que era la objeción.
- Cada movimiento se anuncia en una región `aria-live`. Es la única forma de que alguien
  que no ve el tablero sepa qué acaba de pasar.

La vista de tabla se retira, también pedido.

**Quien decide sigue siendo el dominio.** Durante el arrastre solo se marcan como
válidas las columnas que la máquina de estados acepta —verificado: desde «Nueva» solo se
ofrecen «Contactada» y «Perdida»— y el servidor vuelve a comprobarlo. Que una columna se
pinte o no nunca es la garantía. Las tarjetas en «Ganada» no son arrastrables porque es
estado final.

**«Perdida» exige motivo**, y eso no se puede resolver con el gesto solo: soltar ahí abre
un diálogo que lo pide. Es la única transición del tablero que necesita un paso más.

Los títulos de columna pasan a pastilla tipo semáforo, del frío al verde, con el rojo
para «Perdida». **El color no es la única señal**: la pastilla lleva siempre su texto y su
recuento, porque un tablero donde el estado se dedujera del color sería inservible para
entre el 4 y el 8 % de los hombres, y el rojo y el verde son justo el par que se confunde.

#### Panel: aspecto de CRM, modos menos extremos, fondo animado

- **El fondo se mueve en los dos modos**, pedido. La fotografía pasa a capa propia con el
  mismo zoom lento de la pantalla de acceso, y el velo va en otra capa **sin animar**:
  metido en la misma, escalaría con la imagen y una viñeta que crece y decrece se nota.
  Comprobado que se mueve: **16,7 % de los píxeles cambian en 7 segundos**.
- **Noche menos oscuro y día menos claro**, pedido. El lienzo nocturno sube de 0,16 a
  0,23 de luminosidad; el diurno baja de 0,90 a 0,855. Hay un efecto contraintuitivo que
  obligó a un ajuste: al oscurecer el modo día, el texto secundario que cae directamente
  sobre el fondo **pierde** contraste, porque es texto oscuro sobre fondo más oscuro. Por
  eso `--muted-foreground` baja de 0,44 a 0,40. Medido sobre los píxeles reales del fondo
  desnudo: **5,11:1 en día y 5,70:1 en noche**, sobre el 4,5:1 que exige la WCAG.
- **Las tablas van dentro de una tarjeta.** Iban sobre el fondo, así que las filas se
  leían sobre la fotografía. Se resuelve con una regla sobre el contenedor
  (`:has(table)`), que alcanza a los cinco listados sin tocar ninguna pantalla.
- Las tarjetas ganan elevación, que es lo que las convierte de «caja con borde» en
  superficie apoyada sobre el lienzo. La sombra se define por modo: en oscuro una sombra
  negra no se ve y lo que separa es un filo de luz arriba.
- Los botones pasan a cápsula y los rótulos diminutos en mayúsculas espaciadas a texto
  normal en peso medio. Esa fórmula viene del escaparate, donde funciona porque hay pocos
  botones muy separados; en una barra con seis controles convierte cada uno en un cartel.
  **El radio se unifica en `globals.css` y no en las clases**: este archivo declara fuera
  de toda `@layer`, así que gana a la utilidad del componente, y un `rounded-full` escrito
  en el botón se habría quedado sin efecto.

#### Front público

- **Fondos propios en Catering y Bodas reales**, con el zoom del acceso y velo por
  sección. Los dos velos son distintos y está medido: la fotografía de catering tiene 173
  de luminancia media sobre 255 y la de bodas 72, así que con un velo único o una sección
  queda ilegible o la otra se apaga sin motivo. Contraste final: 12,64:1 y 9,77:1 en
  catering, 8,93:1 y 6,13:1 en bodas.
- **Las imágenes se procesan antes de servirlas.** Llegaron con 9 MB y 23 MB: son
  archivos de cámara, y un fondo decorativo de 23 MB tarda más de medio minuto en móvil.
  Nuevo comando `npm run images:optimize`. Quedan en 291 KB y 394 KB. Dato medido que va
  contra la intuición: **WebP y AVIF pesan MÁS que JPEG** en la foto de catering —941 KB
  en JPEG, 1,3 MB en WebP, 1,9 MB en AVIF—, porque con texturas de altísima frecuencia la
  predicción de esos formatos no encuentra nada que predecir. Por eso el fondo va en CSS
  y no en `next/image`, que serviría WebP.
- **Cabecera y pie se adaptan a esas secciones** con `:has()`. Se sirven desde el layout
  raíz, fuera del `<main>`, así que no heredaban la paleta: el menú era verde casi negro
  sobre una fotografía oscura. Y ahí estaba **el fallo del pie al bajar** que se reportó:
  el velo es `fixed` con `z-index: 1` y el pie no llevaba `z-index`, así que el velo se
  pintaba encima del pie.
- **Los dos accesos del menú, como llamada a la acción.** Tres iteraciones hasta acertar
  —verde plano «aburrido», multicolor animado con reflejo «no me gustan los colores», y
  finalmente la especificación que entregó el titular—. Contraste del texto blanco
  comprobado en los cuatro extremos de los dos degradados: entre 5,2:1 y 7,6:1.
- **Hero más alto** (112vh en escritorio, pantalla completa en móvil) y **titular en el
  verde de marca**. Se probó un halo crema detrás del texto para separarlo del fondo y
  **se retiró**: el efecto fue el contrario del buscado —un resplandor claro alrededor de
  un texto oscuro se lee como desenfoque, no como contraste— y así lo describió el
  titular, «se ven rarísimos, como muy blanquecinos». La legibilidad se resuelve donde
  debe, en el velo: el titular no baja de 3,66:1 en móvil y no mide menos de 48 px en
  ningún tamaño, así que cumple el 3:1 de la WCAG para texto grande.
- **Formulario:** fuera el asunto, casillas de consentimiento más discretas (14 px y
  texto de 12) y el botón pasa a «Enviar mensaje». El asunto **sigue viajando**: el panel
  lista las solicitudes por él, así que se deriva del tipo de evento, o se conserva el
  texto del CTA cuando la solicitud viene de una ficha VIP. El área de pulsación de las
  casillas no se reduce al empequeñecerlas: la etiqueta entera sigue siendo pulsable.

#### Datos

A petición del titular se vaciaron **todos los contactos y su historial** —solicitudes,
consentimientos, actividad, sesiones VIP e interacciones— conservando los **7
contenidos**. Los `AuditEvent` **no se tocan**: el esquema los declara supervivientes de
los borrados a propósito, porque son la traza de quién hizo qué. La operación se hizo con
un script temporal que **no se ha dejado en el repositorio**: `npm run test:clean` es
seguro porque solo borra dominios que el IETF reserva, y un comando que borre todos los
contactos es un accidente esperando a que alguien lo ejecute contra producción.

#### Archivos modificados

`app/globals.css`, `app/admin/(protected)/layout.tsx` (sin cambios de estructura),
`app/admin/(protected)/crm-ui.tsx`, `app/admin/(protected)/export-button.tsx` (nuevo),
`app/admin/(protected)/pipeline/page.tsx`, `app/admin/(protected)/pipeline/pipeline-board.tsx` (nuevo),
`app/admin/(protected)/contactos/page.tsx`, `app/admin/(protected)/solicitudes/page.tsx`,
`app/api/admin/crm/export/route.ts`, `app/politica-privacidad/page.tsx`,
`lib/legal.ts`, `lib/email/resend.ts` (nuevo, sustituye a `sendgrid.ts`), `lib/email/config.ts`,
`lib/email/index.ts`, `lib/email/provider.ts`, `lib/email/development.ts`,
`lib/domain/crm-export.ts`, `lib/domain/crm-workbook.ts` (nuevo), `lib/security/secret-patterns.ts`,
`lib/security/headers.ts`, `lib/validation/lead-request.ts`, `lib/leads.ts`,
`components/header.tsx`, `components/sections/hero.tsx`, `components/sections/contact.tsx`,
`components/vip/vip-library.tsx`, `components/vip/vip-story.tsx`,
`data/site-content.ts`, `data/site-content.en.ts`,
`scripts/optimize-background.ts` (nuevo), `scripts/email-test.ts` (nuevo), `scripts/e2e-env.ts`,
`docs/email.md`, `.env.example`, `package.json`, y las pruebas afectadas.

#### Validación

`npm test`: **741 pruebas en 61 archivos, todas en verde**. Incluye la deuda que la Fase
18 dejó anotada —las pruebas del formulario que esperaban nombre y apellidos separados,
espacio y presupuesto— que queda saldada aquí.

`npm run typecheck` y `npm run lint`: exit 0.

En el navegador: envío real por Resend aceptado (`SENT`, con identificador) y **circuito
completo verificado desde el formulario** (`SENT · resend · lead-request-created`);
descarga de Excel abierta y validada con un parser independiente (hoja «Contactos», 13
columnas, encabezado en negrita y congelado); arrastre de una tarjeta entre columnas con
persistencia comprobada; capas de fondo y contraste medidos en los dos modos del panel;
contraste del front medido en hero, bibliotecas y CTA.

#### Pendiente para el titular

1. **Rotar la clave de Resend.** Se compartió por chat y en una captura, así que hay que
   considerarla comprometida: crear una nueva en el panel de Resend y revocar la actual.
2. **Verificar un dominio propio en Resend** y cambiar `LEADS_FROM_EMAIL` a una dirección
   de ese dominio. Hasta entonces el acuse al visitante debe seguir apagado.
3. **Declarar las variables en Vercel**: `RESEND_API_KEY`, `LEADS_FROM_EMAIL`,
   `LEADS_NOTIFICATION_TO` y, cuando proceda, `SEND_LEAD_ACKNOWLEDGEMENT=true`.
4. **Revisión jurídica de la política de privacidad**, que ahora nombra a Resend como
   encargado del tratamiento y declara el envío activo.

### Fase 21 — Pipeline de cinco fases, panel en lenguaje de negocio y gráficas (2026-08-14)

Quince peticiones del titular en un solo bloque. Tres cambian el dominio o la estructura de una pantalla entera; el resto son ajustes de forma. Se documentan juntas porque comparten una idea: **el panel deja de hablar como el código y empieza a hablar como el negocio**.

#### El pipeline pasa de nueve estados a cinco fases

Contacto, Presentación, Propuesta, Cliente y Perdida. Lo pedido era «deja las fases en» esas cinco, y había dos formas de hacerlo:

- Agrupar los nueve estados guardados en cinco columnas **al pintar el tablero**. Barato, sin migración, sin riesgo.
- Reducir el enumerado **en la base de datos**, con su migración.

Se hizo lo segundo, y el motivo es que la primera opción no habría cumplido la petición: el mismo campo lo leen los informes, la exportación a Excel y el historial de cada persona, así que el tablero habría enseñado cinco fases y los informes nueve. Y esta misma fase pedía gráficas en los informes, es decir, habría dibujado un anillo con nueve porciones al lado de un tablero con cinco columnas. **El pipeline es dominio, no presentación.**

La correspondencia va en el `CASE` de la migración `20260814120000_pipeline_cinco_fases`: `NEW` y `NURTURING` a `CONTACT`; `CONTACTED`, `QUALIFIED` y `VISIT_SCHEDULED` a `PRESENTATION`; `PROPOSAL_SENT` y `NEGOTIATION` a `PROPOSAL`; `WON` a `CLIENT`. `CONTACT` queda como fase de entrada, lo que conserva la métrica de tiempo hasta el primer contacto: es lo que tarda una solicitud en salir de ahí.

**Es la primera migración del proyecto que no es reversible**, y queda dicho en §20 con su aviso: tres estados caen en `PRESENTATION` y nada guarda cuál era cada uno. También es la primera que contiene un `DROP TYPE`, porque PostgreSQL no sabe quitar valores de un enumerado de otra forma. Se aplicó con cuatro solicitudes en la base y el reparto resultante se comprobó: 2 en Contacto, 1 en Presentación, 1 en Perdida.

**La máquina de estados gana un paso hacia atrás** (Presentación → Contacto, Propuesta → Presentación), que antes no hacía falta: con nueve estados existía `NURTURING` como aparcamiento al que retirar una solicitud enfriada, y por ahí se volvía. Sin él, deshacer un arrastre a la columna equivocada obligaría a darla por perdida y reabrirla, dejando dos movimientos falsos en el historial.

**El histórico no se reescribe.** `LeadActivity` y `AuditEvent` conservan las transiciones tal como se anotaron —hay una real en la base: `{from: "NEW", to: "CONTACTED"}`—, porque cambiar un registro de auditoría para que diga lo que no dijo es falsearlo. En su lugar, quien lo lee acepta los dos vocabularios: `LEGACY_STATUS_LABEL` traduce los nueve nombres antiguos y `averageHoursToFirstContact` cuenta el paso a la segunda fase tanto si se anotó como `PRESENTATION` como si se anotó como `CONTACTED`. Comprobado en pantalla: ese movimiento se sigue leyendo «Nueva → Contactada».

#### El panel renombrado

Estatus Plataforma, Captaciones, Solicitudes Formulario, Seguimiento clientes, Acciones, Contenidos Biblioteca, Informes captación y Puntuación Visitantes. El rótulo pasa a «Gestión comercial · Seguimiento clientes».

**Las rutas no cambian.** Siguen siendo `/admin/contactos`, `/admin/tareas`, `/admin/configuracion`. Renombrar las carpetas habría roto los marcadores guardados, las llamadas a `revalidatePath` de cada Server Action y los diez escenarios E2E, sin que se viera nada distinto en pantalla.

Efecto lateral que hubo que resolver: los rótulos nuevos son largos, y en mayúsculas con `0.15em` de espaciado las ocho pastillas de navegación no cabían en una línea ni en pantalla ancha —se partían en tres filas y la cabecera crecía hasta comerse el título de la página—. Pasan a caja normal con el espaciado justo, que además es lo que hace un CRM: la navegación se lee, no se declama.

#### Gráficas, escritas a mano

Se pidió «todo lo que se pueda en gráficas, circulares con colores». Hay anillo, barras y embudo, en un módulo compartido por Estatus Plataforma e Informes captación, y **están escritas en SVG y HTML**, no con una librería.

El proyecto arrastra `recharts` de la plantilla inicial, así que usarla no habría añadido una dependencia. Se descarta por dos razones concretas: solo funciona en el cliente —las siete pantallas del panel son componentes de servidor, así que cada gráfica exigiría una frontera de cliente— y obligaría a **pasar los colores por props**. El panel resuelve día y noche enteramente con variables CSS, así que una gráfica que recibe `#3b82f6` es un segundo sitio donde vive la paleta y se queda con el color del otro modo al cambiar de tema. Aquí el SVG usa `var(--tono)` y cambia solo.

Para eso hubo que sacar los ocho tonos del tablero: estaban atados a `.pipe-pill[data-tono]`, y ahora la regla apunta a `[data-tono]` en cualquier elemento y expone el color en `--tono`, que hereda. Un `<circle>` de SVG puede escribir `stroke="var(--tono)"` sin recibir ningún color.

Dos decisiones sobre qué **no** dibujar:

- **El dibujo lleva `aria-hidden` y el dato va en la leyenda**, que es texto real con su cifra y su porcentaje. Un anillo no se puede leer en voz alta.
- **Las tres cifras de Acciones no son un anillo tal cual.** «Pendientes en total» incluye a las vencidas y a las de esta semana, así que un anillo con las tres sumaría lo mismo dos y tres veces y mentiría sobre el total. Se convierten en una partición real restando los tramos.

#### Dos tablas que se editan en la celda

**Acciones** pierde las seis pestañas de filtro y pasa a una tabla donde cada campo guarda al modificarlo: el texto al salir del campo o con Intro, los desplegables y la fecha al cambiar. Cada cambio envía la fila completa, porque el dominio valida la tarea entera. Una acción cerrada se pinta como texto, porque `updateFollowUpTask` rechaza cualquiera que no esté pendiente: ofrecer un desplegable que el servidor va a rechazar es peor que no ofrecerlo.

**Puntuación Visitantes** (antes «Configuración») pierde los ocho formularios apilados y pasa a una tabla agrupada en tres bloques, con el subtotal de cada uno y el máximo alcanzable al pie, calculados en vivo. La agrupación no es decoración: en la lista alfabética con la que llegan de la base de datos no hay forma de ver si «dejar el teléfono» y «pedir una visita» están bien valorados uno respecto al otro.

En las dos, el resultado de cada guardado va a una región `aria-live` además del icono: una tabla que guarda sola no da ninguna otra señal, y un icono que aparece y desaparece no dice nada a quien no lo ve.

También pedido y hecho en esa pantalla: el bloque de «Usuarios internos» —un párrafo y un botón— deja de mostrarse. La ruta `/admin/usuarios` sigue existiendo y sigue exigiendo ADMIN: se retira el cartel, no el permiso. Y las explicaciones largas bajan **por debajo** de la tabla, porque lo pedido era que el contenido importante no quedara tan abajo.

#### Contenidos Biblioteca, y las acciones en iconos

Fuera las seis pestañas, el buscador y los seis filtros: doce controles para elegir entre siete fichas. Las cinco acciones por fila pasan de enlaces en mayúsculas a iconos, que era lo pedido, con dos cosas que hacen falta las dos: `title` para la sugerencia del navegador y `aria-label` para el lector de pantalla, **y el título de la ficha dentro de ambos**. Con seis filas hay seis botones «Editar», y sin el título son indistinguibles al navegar por controles.

Se retiró `content-filters.tsx` y el recuento por estado, que alimentaba los números de las pestañas, pasó a la línea de resumen bajo el título.

#### Filtros plegables en los dos listados

Interesados y Solicitudes tenían once campos de filtro desplegados: **291 px**, más que las primeras filas de datos. Plegados ocupan **38 px**, medido. Es un `<details>` nativo —funciona sin JavaScript, y el rol y el estado expandido los da el navegador— y se abre solo si hay algún filtro puesto: al revés sería una trampa, porque quien llega por un enlace filtrado vería tres resultados sin encontrar el filtro que los recorta.

#### Informes captación: pastillas de año

Los dos campos de fecha con su botón «Aplicar» se sustituyen por pastillas de año desde 2025, arriba a la izquierda y discretas. El cambio no es solo de aspecto: aquellos permitían pedir del 3 de marzo al 17 de julio, y en la práctica nadie compara eso. Los años se calculan en cada petición y no se escriben a mano, porque una lista fija se queda corta el 1 de enero y el síntoma sería el peor posible: los informes del año nuevo no existirían y nadie sabría por qué.

#### Cortina de carga del sitio público

Pedida «acorde a la estética de la web para conexiones lentas». Conviene no venderla como lo que no es: **un preloader no acelera nada**; tapa el momento en que la página se pinta a medias y lo sustituye por una pantalla de marca. El diseño está puesto en que no pueda romper nada:

- **La retira el CSS y el JavaScript solo lo adelanta.** La regla lleva una animación con retardo que la desvanece sola a los 4,5 s, así que si el bundle no llega, está bloqueado o falla la hidratación, la web se ve igual. Con el JavaScript como único responsable, cualquiera de esos fallos deja una pantalla en blanco permanente.
- **`pointer-events: none` siempre.** Incluso opaca, los enlaces de debajo responden.
- **Se pinta desde el servidor**, en el HTML inicial: un componente de cliente aparecería tras descargar el bundle, es decir, cuando ya no hace falta.
- **La marca de «ya cargó» va en `<html>`**, no en la cortina. La cortina se desmonta al entrar en /admin y se vuelve a montar al salir; con la marca en su propio elemento, cada vuelta al sitio público traería un destello de cortina en una navegación que no carga nada.

#### Ajustes de forma

- **Los CTA de Catering y Bodas reales bajan de 44 a 34 px de alto** y el texto a 13 px, el mismo de los enlaces de texto que tienen al lado. La reducción va **dentro de una consulta de medios en 1280 px**: `.nav-cta` sirve también al menú móvil, y ahí conserva los 44 px, que es el objetivo táctil mínimo. El bloque va **después** de `.nav-cta:hover`, porque una consulta de medios no añade especificidad y el `box-shadow` del hover declarado más abajo habría ganado.
- **El aviso de captación baja de 90 a 35 segundos.**
- **El modo día baja otro escalón**: el lienzo pasa de 0,855 a 0,80 de luminosidad. Con cada escalón hay que **subir** el contraste del texto secundario, no bajarlo, porque es texto oscuro sobre un fondo que se ha oscurecido: el token pasa de 0,40 a 0,36. Medido sobre los píxeles reales: 5,17:1 en día y 8,42:1 en noche para el texto secundario, 7,83:1 y 10,9:1 para los títulos.
- **El conmutador de día y noche se queda solo con el icono**, en un cuadrado de 36 px, y «Salir» se alinea a esa altura. El nombre accesible sigue en `aria-label`: un botón con un icono y nada más es un fallo de accesibilidad si se queda sin nombre, y es el error habitual al pedir «solo iconos».
- La fase de cada solicitud se muestra con la **misma pastilla de color en las cuatro pantallas** que la enseñan. Antes cada una decidía con un ternario `LOST ? alerta : WON ? acento : neutro`, así que las siete fases intermedias salían todas del mismo gris y el color del tablero no se correspondía con el del listado.

#### Dos defectos encontrados al validar

- **Desborde horizontal del panel a 360 y 390 px.** Los `grid` con `lg:grid-cols-2` no declaraban `grid-cols-1`, así que por debajo de ese punto de ruptura la pista implícita era `auto` —con suelo de min-content— en lugar de `minmax(0, 1fr)`, y una tarjeta de gráfica de 430 px ensanchaba la columna por encima de los 342 disponibles. Corregido declarando `grid-cols-1`.
- **Un correo anonimizado desbordaba la ventana.** En «Últimos movimientos», cuando la persona no tiene nombre se muestra su correo, y uno anonimizado del CRM —`anonimizado+cmst9jnzj00147k08hjvrtqk2@…`— son 45 caracteres sin un punto de corte natural. `break-words` no sirve: no rompe dentro de una palabra, y eso es técnicamente una sola palabra. Corregido con `overflow-wrap: anywhere`.

#### Deuda retirada

`countTasksByView` (seis `count` por carga, uno por pestaña), `ScoringRuleForm`, `content-filters.tsx` y el `TONO` local del tablero, que ahora sale de `PIPELINE_TONE` en `lib/crm/labels.ts`.

#### Documentación

Se revisó el README entero, no solo se le añadió esta entrada, y aparecieron **ocho afirmaciones que la Fase 20 dejó desactualizadas en el cuerpo** mientras actualizaba solo su historial: §10 seguía describiendo la exportación en CSV con neutralización de fórmulas y el pipeline «sin arrastrar y soltar, por decisión», §27 declaraba esa misma ausencia como logro de accesibilidad, §14 la mantenía como decisión vigente, §15 y §12 seguían nombrando a SendGrid, §32 afirmaba que ningún correo se había enviado de verdad, y las cifras de §1 iban dos fases por detrás. Corregido todo, con las dos reversiones anotadas **como reversiones** y no reescritas.

Además: la tabla de estado de §6 se reordenó por número de fase —tenía la Fase 14 después de la 20— y ganó una columna de fase; la sección «Documentación», que estaba sin numerar entre la §36 y el historial, pasa a ser la §37 y el historial la §38, las dos bajo un grupo «Anexos» en el índice.

**Archivos modificados:** `prisma/schema.prisma`, `prisma/migrations/20260814120000_pipeline_cinco_fases/migration.sql` (nuevo), `lib/domain/lead-requests.ts`, `lib/domain/metrics.ts`, `lib/domain/tasks.ts`, `lib/domain/crm-requests.ts`, `lib/domain/privacy.ts`, `lib/crm/labels.ts`, `lib/validation/crm.ts`, `app/globals.css`, `app/layout.tsx`, `app/admin/(protected)/layout.tsx`, `page.tsx`, `theme-toggle.tsx`, `logout-button.tsx`, `crm-ui.tsx`, `crm-charts.tsx` (nuevo), `crm-forms.tsx`, `contactos/page.tsx`, `contactos/[id]/page.tsx`, `solicitudes/page.tsx`, `solicitudes/[id]/page.tsx`, `pipeline/page.tsx`, `pipeline/pipeline-board.tsx`, `tareas/page.tsx`, `tareas/tasks-table.tsx` (nuevo), `contenidos/page.tsx`, `contenidos/content-row-actions.tsx`, `configuracion/page.tsx`, `configuracion/scoring-table.tsx` (nuevo), `components/site-preloader.tsx` (nuevo), `components/site-preloader-dismiss.tsx` (nuevo), `components/vip/vip-invite-popup.tsx`, `app/api/vip/access/route.ts`, `scripts/demo-seed.ts`, ocho archivos de prueba y tres de E2E. Retirados: `contenidos/content-filters.tsx`.

**Validación:** `npm test` → **741 pruebas en 61 archivos, todas en verde**. `npx tsc --noEmit` y `npm run lint` exit 0. Migración aplicada con `npx prisma migrate deploy` y reparto comprobado en la base. Comprobación real en el navegador: las 5 rutas públicas y las 8 del panel sin un solo error de consola ni respuesta 5xx; la cortina de carga en las cinco rutas (opacidad 1 en el primer pintado, `pointer-events: none`, y 0 tras `load`); los CTA del menú a 34 px en escritorio y 44 px en el menú móvil; el arrastre en el tablero de cinco columnas ofreciendo solo Presentación y Perdida desde Contacto; la edición en línea de Acciones y de Puntuación Visitantes con persistencia verificada tras recargar —y el valor de puntuación devuelto a su original—; las pastillas de año; el bloque de filtros plegado (38 px) y abierto con dos filtros activos (291 px); los cinco iconos de acción de Contenidos con su `title` y su `aria-label`; contraste medido sobre los píxeles reales en los dos modos; y **55 combinaciones responsive** (5 anchos × 3 rutas públicas + 5 anchos × 8 del panel) sin desbordamiento horizontal en ninguna.

### Fase 22 — Cierre de sesión real, credenciales siempre, borrado de contactos y navegación agrupada (2026-08-14)

Cinco peticiones del titular ya con el sitio desplegado. Dos son un fallo de seguridad/sesión en producción, no de diseño.

#### "Salir" no cerraba la sesión en el despliegue

El botón llamaba a `authClient.signOut()` —un `fetch` del navegador contra `/api/auth/sign-out`— sin comprobar el resultado. Better Auth exige que el origen de esa petición coincida con `BETTER_AUTH_URL` (`originCheckMiddleware`, solo en verbos que cambian estado; `GET /get-session` no pasa por ahí, y por eso el icono de engranaje sí detectaba la sesión mientras "Salir" fallaba). En un despliegue donde ese origen no coincide exactamente, la comprobación rechaza la petición, el botón no se entera porque no mira el `error`, y navega igualmente a `/admin/login` — que con sesión aún viva devolvía a `/admin`: el síntoma reportado, «se queda recargando en Estatus Plataforma». `login-form.tsx` ya comprobaba ese mismo campo desde la Fase 1; "Salir" no seguía la misma norma.

La solución evita la comprobación de origen en vez de depender de configurarla bien: `logout-action.ts`, una Server Action nueva, llama a `auth.api.signOut` en el mismo proceso de servidor, igual que `gate-action.ts` ya hace con el alta. Sin `fetch` de por medio no hay origen que verificar. El botón solo navega si la Server Action confirma éxito; si no, lo dice en vez de dar la sesión por cerrada sin estarlo.

#### La zona admin pedía credenciales solo a veces

El engranaje de la cabecera pública comprobaba la sesión del lado del cliente y, si existía, saltaba directo a `/admin` sin pasar por el formulario — documentado como decisión deliberada en su momento, y revertido ahora por petición expresa: entrar a la zona admin debe pedir la clave **siempre**, viva o no una sesión anterior en ese navegador. El engranaje pasa a llevar siempre a `/admin/login`, y esa pantalla deja de comprobar si ya hay sesión válida para saltársela — comprobado con una sesión abierta: se sigue viendo el formulario. El bucle de redirecciones que esa comprobación evitaba (cookie que sobrevive a su sesión) lo sigue evitando el middleware, que deja pasar `/admin/login` sin condición, con o sin cookie.

Queda un caso sin cerrar y es deliberado: si alguien teclea `/admin` directamente en la barra de direcciones con una sesión previa aún no caducada, sin pasar por el engranaje ni por `/admin/login`, entra sin que se le vuelva a pedir la clave — el comportamiento normal de cualquier sesión mientras no expira. Cerrar también ese caso exigiría acortar la duración de la sesión, con el coste de pedir la clave más a menudo durante el trabajo dentro del panel; no se ha tocado sin que el titular lo pida.

#### Eliminar un contacto, desde el listado

No hay borrado físico: el dato de un contacto vive repartido en solicitudes, notas, auditoría y consentimientos, y borrar la fila destruiría ese historial (`lib/domain/privacy.ts`, sin tocar). El botón nuevo de Captaciones invoca la misma anonimización irreversible que ya existía en la ficha del contacto —sustituye email, nombre y teléfono, vacía el texto libre, borra notas, revoca accesos— con la misma confirmación escribiendo `ANONIMIZAR`, solo que en un clic desde la lista. La fila no desaparece: se queda anonimizada, porque las cifras agregadas del CRM tienen que seguir cuadrando. De paso se corrigió una afirmación de `docs/manual-admin.md` que decía lo contrario —que un contacto anonimizado deja de aparecer en listados y exportaciones—, y no es así en el código: nunca hubo un filtro que lo excluyera.

#### Navegación agrupada por tipología

Las ocho pestañas del panel se agrupan en cuatro bloques con matiz propio, a baja opacidad: Estatus Plataforma sola, Captaciones + Solicitudes Formulario, Seguimiento clientes + Acciones, y Contenidos Biblioteca + Informes captación + Puntuación Visitantes. Reutiliza el sistema `[data-tono]` que ya teñía las pastillas de fase del pipeline —un grupo fija `--tono` con `data-tono`, `.admin-navgroup` lo lee a través de `color-mix`— en vez de inventar una segunda paleta. Cada pestaña gana además una línea inferior naranja al pasar el ratón, deliberadamente ajena a los cuatro matices de grupo: el color de grupo dice "esto va junto", el naranja dice "esto es lo que estás señalando", y si el naranja fuera también un color de grupo las dos lecturas se confundirían en ese grupo.

#### Dosier y visita: piezas del scoring sin puerta de entrada

Consulta del titular, no encargo: dónde se descarga el dosier y cómo se solicita una visita. Ninguna de las dos existe todavía en el sitio público. El modelo de scoring sí las tiene previstas —`DOSSIER_DOWNLOAD` y `VISIT_REQUESTED` en `lib/domain/scoring.ts`, configurables en Puntuación Visitantes— pero ningún componente público llega a crear nunca un `LeadActivity` de tipo `DOSSIER_DOWNLOADED` o `VISIT`: son puntos que ahora mismo ningún contacto puede llegar a sumar. El origen es el propio documento de partida del proyecto (`project-reference/docs/03-arquitectura-crm-leads.md`), que ya contemplaba dossier, visita y acceso a galería como parte del flujo. Queda pendiente de decisión del titular si se construyen.

#### Deuda retirada de paso

Los 186 problemas que `npm run lint` reportaba tras la Fase 21 no eran del código: eran `playwright-report/` y `test-results/`, artefactos HTML/JS minificados que la suite E2E deja escritos y que `eslint.config.mjs` no excluía. Añadidos a sus `ignores`, junto con `e2e/.results/`.

#### Adenda — Limpieza de contactos anonimizados y una fuga de datos de prueba

El titular pidió, en un mensaje aparte, limpiar todos los contactos anonimizados y no volver a crearlos: la plataforma pasa a recibir contactos reales. Al inspeccionar la base antes de borrar nada aparecieron **25 contactos anonimizados sobre 28 totales**, y ninguno venía de `demo-seed.ts` —su consulta por dominio de email dio 0—: `prisma/seed.ts` no crea contactos, y `npm run demo:clean -- --seco` tampoco los detectaba.

La causa: **`vitest.setup.tsx` carga `.env` a propósito, así que los tests de dominio que hablan con base de datos —`itDb`— corren contra la misma base de desarrollo que sirve el despliegue**, no contra una aislada (a diferencia de E2E, que sí tiene la suya en `.env.e2e` desde la Fase 10). `lib/domain/privacy.test.ts` y `lib/security/attack-surface.test.ts` crean contactos de prueba y los borran en su `afterEach` **por email**; varios de sus casos llaman a `anonymizeLead`, que sustituye justo ese email por el marcador irreversible (`anonimizado+<id>@example.invalid`). El contacto de prueba deja de coincidir con la lista de emails a borrar y se queda huérfano en la base para siempre — el mismo fallo, exactamente, que ya se corrigió hoy mismo en `demo-clean.ts` para los contactos de demostración anonimizados, solo que aquí dentro del propio arnés de pruebas. 24 de los 25 encajaban con este patrón (creados en ráfaga de segundos, mismo minuto, sin página de origen; dos con la fecha de fixture `2020-01-01`).

**El 25.º era distinto**: un envío con `submissionId` en formato UUID real, `sourcePage: "/"` y una hora de creación (19:10) separada de la anonimización (21:42) por dos horas y media — el patrón de una persona, no el de un test. Se señaló al titular antes de tocarlo; confirmó borrarlo también, porque ya estaba anonimizado —sin datos personales que proteger más— y la petición era "todos".

Arreglo de raíz en los dos archivos de test: se rastrea también el `id` de cada contacto creado (que la anonimización no toca) y el `afterEach` borra por `id` o por email, no solo por email. Verificado ejecutando ambos archivos tras el arreglo: 43 pruebas en verde y cero contactos nuevos en la base al terminar.

**Archivos modificados:** `app/admin/(protected)/logout-action.ts` (nuevo), `app/admin/(protected)/logout-button.tsx`, `components/admin-access.tsx`, `app/admin/login/page.tsx`, `app/admin/(protected)/layout.tsx`, `app/globals.css`, `app/admin/(protected)/contactos/delete-lead-button.tsx` (nuevo), `app/admin/(protected)/contactos/page.tsx`, `eslint.config.mjs`, `docs/manual-admin.md`, `scripts/demo-clean.ts`, `lib/domain/privacy.test.ts`, `lib/security/attack-surface.test.ts`.

**Validación:** `npx tsc --noEmit` y `npm run lint` exit 0. Verificación real en navegador con un script Playwright puntual (no incorporado a la suite): engranaje → siempre `/admin/login`; con sesión ya abierta, `/admin/login` sigue mostrando el formulario; tras "Salir", la URL vuelve a `/admin/login` con el formulario visible y una nueva petición a `/admin` **vuelve a redirigir al login** en vez de entrar — confirma que la sesión se invalidó de verdad, no solo la navegación; botón de eliminar presente en Captaciones y diálogo de confirmación operativo (cancelado sin anonimizar el contacto de prueba). Captura de la navegación agrupada, en reposo y con hover, verificada visualmente. Limpieza de contactos: inspección real de la base (28 contactos, 25 anonimizados) antes de borrar, confirmación explícita del titular sobre el único caso dudoso, y borrado verificado (28 → 3). `npx vitest run lib/domain/privacy.test.ts lib/security/attack-surface.test.ts` tras el arreglo de la fuga → **43 pruebas en verde**, y una segunda inspección de la base tras esa ejecución confirmó cero contactos nuevos. Pendiente: relanzar la suite E2E completa y el resto de `npm test` (no se ejecutan en cada iteración, solo al pedirlo) y barrer el resto de `docs/` (`checklist-aceptacion.md`, `despliegue-vercel.md`, `evidencias-tfm.md`, `pruebas-e2e.md`) que aún mencionan "Cerrar sesión" y el login por email/contraseña como si fueran el flujo principal.
