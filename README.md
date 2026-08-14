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

**Cierre** — [31. Metodología y uso de IA](#31-metodología-y-uso-de-ia) · [32. Limitaciones conocidas](#32-limitaciones-conocidas) · [33. Roadmap](#33-roadmap) · [34. Licencia](#34-licencia) · [35. Derechos de marca y assets](#35-derechos-de-marca-y-assets) · [36. Enlaces de entrega](#36-enlaces-de-entrega) · [37. Historial de fases](#37-historial-de-fases)

---

## 1. Resumen

El Portón de la Condesa es una finca de celebraciones con una web bonita y ningún sistema detrás: el formulario de contacto enviaba los mensajes a un servicio de terceros y ahí se perdía el rastro. Nadie sabía cuántas consultas llegaban, cuáles se habían contestado, ni qué contenido las provocaba.

Este proyecto sustituye eso por un sistema propio, en tres piezas que se apoyan una en otra:

1. **Captación con contrapartida.** El contenido que más convence a quien busca dónde casarse son bodas ya celebradas en la finca. Ese contenido pasa a estar detrás de un gate: se entrega a cambio de un correo electrónico, con consentimiento de privacidad obligatorio y de marketing separado y opcional. La protección se valida **en servidor antes de consultar la base de datos**, así que sin acceso no hay contenido ni en el HTML ni en el payload del cliente.
2. **Un CMS para el equipo.** Publicar una boda real o un catering no requiere desarrollador: borrador, imágenes en un bucket privado, previsualización y publicación, con la web reflejándolo al instante.
3. **Un CRM que no pierde nada.** Cada solicitud entra con su origen —qué ficha la generó, de qué campaña venía—, se puntúa sola, se asigna a alguien, genera tareas con fecha y recorre un pipeline con transiciones validadas. Todo queda en un historial y en un registro de auditoría.

El resultado, en una frase: la finca pasa de perder sus consultas a tener cada una registrada, puntuada y con responsable.

**Cifras del proyecto:** 25 tablas, 9 migraciones, 3 roles, 12 fases de desarrollo, **698 pruebas unitarias y de integración** en 58 archivos, **23 pruebas end-to-end** que recorren los 13 escenarios críticos en un navegador real contra el build de producción, y **cero errores y cero advertencias** de lint, tipos y compilación.

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
- CRM: contactos, solicitudes, pipeline, tareas, notas, informes y exportación CSV.
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
| **ADMIN** | Responsable del sistema | Todo, más gestión de usuarios, configuración del scoring, exportación CSV y las operaciones de privacidad (copia de datos, anonimizar, revocar) |

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

| Área | Estado |
|---|---|
| Frontend público (home, bodas reales, catering, legal) | **Implementado** — §7 |
| Saneamiento técnico (lint, typecheck real, tests, CI) | **Implementado** (Fase 1) — §24 |
| Base de datos, Prisma y capa de dominio | **Implementado** (Fase 2) — §13, §20 |
| Autenticación administrativa y roles | **Implementado** (Fase 3) — §21, `docs/autenticacion.md` |
| CMS de contenido | **Implementado** (Fase 4) — §9, `docs/cms.md` |
| Rutas públicas VIP conectadas al CMS | **Implementado** (Fase 5) — §7 |
| Gate de correo con sesión en servidor | **Implementado** (Fase 5) — §8. **Resuelto el riesgo crítico** de las fases anteriores |
| Captación con API propia | **Implementado** (Fase 6) — §8. Web3Forms retirado |
| CRM: pipeline, tareas, informes | **Implementado** (Fase 7) — §10, `docs/crm.md` |
| Correo transaccional | **Implementado** (Fase 8) — §10, `docs/email.md` |
| Endurecimiento de seguridad y privacidad | **Implementado** (Fase 9) — §25, §26, `docs/modelo-amenazas.md` |
| Pruebas E2E y base de pruebas aislada | **Implementado** (Fase 10) — §24, `docs/pruebas-e2e.md` |
| Preparación del despliegue | **Implementado** (Fase 10) — §30, `docs/despliegue-vercel.md` |
| Documentación de entrega y preparación de la publicación | **Implementado** (Fase 11) — §34, §36, `docs/publicacion-github.md` |
| Auditoría correctiva final | **Implementado** (Fase 12) — 15 defectos reales corregidos con su prueba de regresión. Ver §37 |
| Publicación del código y despliegue | **Implementado** (Fase 13) — §30, §36 |
| Acceso al panel con clave única y rediseño del panel | **Implementado** (Fase 14) — §21, §25 |
| **Despliegue en producción** | **Desplegado** (Fase 13) en https://elportondelacondesa.solucionesbonicas.com — §30 |
| **Revisión jurídica de los textos legales** | `PENDIENTE` — la base jurídica y el plazo de retención los tiene que fijar un profesional. §26 |
| Licencia del código | **MIT** (Fase 13) — `LICENSE`, §34 |

---

## 7. Funcionalidades públicas

### Home

Una sola página con secciones ancladas: hero, la finca, espacios, gastronomía, bodas reales (llamada a la biblioteca), catering, testimonios, ubicación con mapa y formulario de contacto. Conserva el diseño, la tipografía, el color y las animaciones de la plantilla original adaptados a la marca real.

- **Responsive** de móvil a escritorio.
- **Bilingüe** (español/inglés) en navegación, home, contacto y enlaces legales, con conmutador en la cabecera. Las fichas VIP y el texto completo de las páginas legales no están traducidos (§32).
- **Mapa sin clave de API**: se incrusta el mapa público de Google, con el color de marca aplicado por filtro CSS sobre el iframe. Ninguna clave de Google Maps Platform, ninguna cuota que agotar.
- **Cero peticiones a terceros para pintar la página.** Las tipografías se sirven desde el propio dominio (§29), así que la IP del visitante no viaja a Google.
- **Consentimiento de cookies** con privacidad y marketing como decisiones separadas.

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

Resumen, Contactos, Solicitudes, Pipeline, Tareas e Informes con `crm:access` (ADMIN, SALES); Contenidos con `cms:access` (ADMIN, CONTENT); Configuración con `settings:manage` (ADMIN). `/admin` tiene dos caras: con `crm:access` muestra las métricas y, sin él, un punto de partida con acceso a Contenidos en lugar de una pantalla vacía.

### Resumen e informes

Contactos captados, solicitudes nuevas, pendientes de primer contacto, tiempo medio hasta el primer contacto leído del historial real, visitas, propuestas, ganadas y perdidas, conversión sobre cerradas **con el denominador a la vista**, origen y campaña, contenido más consultado, embudo gate → ficha → solicitud, y últimos movimientos.

**Una regla que conviene decir en voz alta: un ratio sin denominador devuelve «sin datos», no 0 %.** Un 0 % afirma que nadie convierte, que es distinto de no tener datos todavía. Cada ratio y cada media viajan con su denominador o su tamaño de muestra.

### Contactos y solicitudes

- **Contactos.** Paginación en servidor; búsqueda por nombre y por **correo y teléfono normalizados** —buscar `600 11 22 33` encuentra a quien está guardado como `+34600112233`—; filtros por origen, etiqueta, puntuación, interacción, consentimiento y fechas, todos reflejados en la URL. Ficha 360º con datos, consentimientos, solicitudes, contenido consultado, historial, notas y tareas.
- **Solicitudes.** Listado paginado con filtros en URL y **orden por lista blanca cerrada**, más un segundo criterio estable por `id` para que ninguna fila salga en dos páginas. El detalle edita la gestión —prioridad, responsable, próxima acción, espacio, presupuesto— y **no reescribe el asunto ni el mensaje** que escribió la persona. Enlaces mailto, tel y WhatsApp con todo codificado y esquema fijo. Aviso de posibles coincidencias del mismo contacto que **no fusiona nada**.

### Pipeline

Tablero por estado, con alternativa de tabla en `?vista=tabla`. **Sin arrastrar y soltar, por decisión:** cada tarjeta ofrece un desplegable con solo las transiciones válidas, que funciona con teclado y con lector de pantalla sin trabajo extra. El servidor revalida la transición y escribe la actividad y la auditoría **en la misma transacción**. Perder una oportunidad exige motivo, comprobado en el esquema y otra vez en el dominio.

### Tareas y notas

Crear, asignar, editar, completar y cancelar, ligadas a un contacto. Vistas mías, vencidas, hoy, semana, cerradas y todas, con contador. Completar registra actividad; **cancelar no borra**: conserva la fila y su rastro. Notas internas en texto plano interpolado en JSX —no hay `dangerouslySetInnerHTML` en el CRM—, con límite de 4.000 caracteres, y editar queda auditado sin copiar el cuerpo.

### Puntuación

Configurable por ADMIN y auditada: gate +10, teléfono +10, fecha +10, invitados +10, tres fichas distintas +10 una sola vez, formulario +15, visita +25. **`recalculateLeadScore` recalcula desde el historial, nunca acumula**, así que el mismo hito no puede sumar dos veces y un cambio de pesos se aplica en el siguiente movimiento de cada contacto.

### Exportación

CSV solo para ADMIN (`crm:export`, un permiso **distinto** de consultar el CRM): respeta los filtros, UTF-8 con BOM y `;`, encabezados en español, **neutraliza los valores que empiezan por `=`, `+`, `-` o `@`** para que un texto escrito en el formulario público no se ejecute al abrir el archivo, lista blanca de columnas —nada de credenciales, tokens, hashes ni identificadores internos—, `no-store`, y un evento de auditoría por exportación sin el término de búsqueda.

### Correo transaccional

**Principio: la base de datos es la fuente de verdad y el correo es un efecto secundario.** Guardar una solicitud no depende de que el proveedor responda. El envío ocurre después del commit y después de responder al visitante; ninguna función de notificación lanza, y un fallo de correo no borra datos ni produce un error falso.

- Interfaz `EmailProvider` con dos adaptadores: SendGrid (API v3 por `fetch`, con timeout de 10 s) y desarrollo (registra y no envía). La aplicación nunca habla con SendGrid directamente.
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
    │ limit · CSP  │ SendGrid/dev │ de bytes     │ requestId   │
    └──────────────┴──────────────┴──────────────┴─────────────┘
                          │
                          ▼
                   SendGrid (opcional)
```

**Cómo se lee este diagrama:** todo lo que baja hacia la base de datos pasa por validación y por dominio. No hay ninguna flecha que salte de la interfaz a Prisma, y eso no es una convención: es lo que permite que la autorización y las reglas de negocio estén en un solo sitio comprobable.

---

## 13. Modelo de datos

**25 tablas.** Esquema completo, narrado y con diagrama ER en `docs/modelo-datos.md`; definición en `prisma/schema.prisma`.

### Las tres decisiones que explican el resto

**1. `Lead` separado de `LeadRequest`.** Una persona, varias solicitudes. Nunca se sobrescribe una anterior: quien pregunta por su boda y dos años después por una comunión es la misma persona con dos peticiones distintas, y las dos cuentan. Un modelo con una sola tabla obligaría a elegir entre perder la primera consulta o duplicar la persona.

**2. Los consentimientos son eventos inmutables, no una casilla.** `ConsentEvent` con `purpose` (`PRIVACY` / `MARKETING`), `granted`, la versión de la política y la fecha. Revocar es un evento nuevo, nunca un `UPDATE`. Solo así se puede demostrar **qué** se consintió, **cuándo** y **sobre qué texto**. Una columna booleana solo sabe decir el estado de hoy, que es justo lo que no sirve ante una reclamación.

**3. La sesión de acceso VIP vive en la base de datos.** `VipAccessSession` guarda el **HMAC** del token; la cookie del navegador lleva solo el token. Ni el correo ni el identificador del contacto salen del servidor, y revocar un acceso es una operación real, no esperar a que caduque una cookie.

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
| **Pipeline sin arrastrar y soltar** | Tablero con drag and drop | Los desplegables con solo transiciones válidas funcionan con teclado y lector de pantalla sin trabajo extra, y evitan estados imposibles. Si algún día se pide el gesto, tendría que **convivir** con esta alternativa, no sustituirla |
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
| Correo | SendGrid tras interfaz propia | API v3 | Adaptador sustituible; la aplicación no depende del proveedor |
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
    ├── admin/crm/export/  descarga CSV (solo ADMIN)
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
├── email/                 provider (interfaz), sendgrid, development, config, templates
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
| `SENDGRID_API_KEY` | Credencial de SendGrid. Solo servidor | **Opcional, sin configurar.** Sin ella cada intento queda como `SKIPPED_CONFIG` |
| `LEADS_FROM_EMAIL` | Remitente verificado en el proveedor | **Opcional.** Necesaria junto con la clave |
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

### Las nueve migraciones

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

Las migraciones 7 y 8 van separadas **por obligación, no por gusto**: PostgreSQL no permite usar un valor de un tipo enumerado en la misma transacción en la que se ha añadido.

### Reglas de operación

- **En producción, siempre `npx prisma migrate deploy`.** Nunca `migrate dev`: es interactivo y puede decidir recrear el esquema desde cero.
- **Vercel no aplica migraciones.** Se aplican a mano. Una migración lanzada por cada despliegue, en paralelo desde varias instancias, es una forma excelente de corromper una base de datos.
- **Ninguna migración del historial borra una tabla o una columna.** No hay ningún `DROP TABLE`, `DROP COLUMN` ni `DROP TYPE`.
- **No hay rollback automático.** Prisma no genera migraciones inversas: la vía normal es corregir hacia delante con una migración nueva. Antes de cualquier cambio destructivo, copia o exportación previa.
- Verificado: las nueve se aplican en orden sobre una base virgen sin errores (`npm run e2e:db:reset && npm run e2e:db:migrate`).

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
- **Todos los correos terminan en `.test`**, un dominio reservado por la RFC 2606 que no resuelve. Ninguna dirección de la demo puede recibir un correo por error, ni siquiera si alguien activara SendGrid por accidente. Y es la marca que permite a `demo:clean` borrar exactamente lo suyo.
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
| CRM | Vitest | Filtros y paginación, búsqueda normalizada, transiciones válidas e inválidas, `LOST` sin motivo rechazado dos veces, tareas, notas, scoring idempotente, métricas con denominador, exportación (filtros, CSV injection neutralizada, sin identificadores internos) |
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
- CSV con **lista blanca de columnas** —una columna nueva del esquema no aparece por descuido— y **neutralización de fórmulas** (`=`, `+`, `-`, `@`).
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
- **El pipeline funciona con teclado.** No hay arrastrar y soltar: cada tarjeta ofrece un desplegable con las transiciones válidas, y existe una vista de tabla alternativa en `?vista=tabla`. Es la razón principal de esa decisión (§14).
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

Reparto honesto: el asistente ha escrito la mayor parte del código. Lo que no se ha delegado es el criterio —qué construir, qué rechazar y qué dar por bueno—, la verificación, y las decisiones de §14, incluidas las de rechazar cosas: el arrastrar y soltar, el CAPTCHA, Prisma 7, la CSP bloqueando desde el primer día.

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
- **Ningún correo se ha enviado de verdad todavía:** no hay cuenta de SendGrid configurada, así que la clasificación de respuestas está probada con `fetch` simulado, no contra la API real.
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

### Siguiente, por orden

1. **Desplegar** siguiendo `docs/despliegue-vercel.md`. Todo lo demás depende de esto.
2. **Revisión jurídica** de la base legal y el plazo de retención. Antes de recoger datos de personas reales.
3. **Métricas reales** de Lighthouse y Core Web Vitals sobre el sitio desplegado.
4. **Decidir la licencia** del código (§34).
5. **Accesibilidad:** enlace de salto al contenido, `prefers-reduced-motion` y una escucha con lector de pantalla real.
6. **CSP en bloqueo** con nonce por petición y receptor de informes.
7. **E2E en integración continua** (contenedor de servicio + secretos de Storage) y migración de las pruebas de Vitest al contenedor aislado.
8. **Verificación del correo en el gate**, si se decide exigirla: la arquitectura ya está preparada.
9. **2FA para ADMIN** y alertas sobre los logs.
10. **Entrega garantizada de correo:** programador para reintentar los `RETRY_PENDING`, idempotencia por mensaje y webhooks del proveedor.
11. **Completar la media del CMS:** vídeos externos desde el editor, y valorar redimensionado y miniaturas.
12. **Gestión de etiquetas** y **fusión de contactos**.

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

## Documentación

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
| `docs/migraciones.md` | Las 9 migraciones, su orden y qué hacer si una falla |
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

## 37. Historial de fases

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

**El panel adopta la estética de la pantalla de acceso** redefiniendo los tokens de color dentro de una clase `.admin-shell`, no reescribiendo las nueve vistas: ya se pintan con `bg-background`, `border-border` y `text-muted-foreground`, que en Tailwind 4 resuelven a variables CSS y por tanto heredan. Azul noche, superficies de vidrio, esquinas redondeadas, cabecera fija con la navegación en pastillas y tablas con cabecera adherente y filas que responden al puntero. El fondo del panel es un degradado y no la fotografía: una imagen a pantalla completa detrás de una tabla de datos compite con lo que hay que leer. El `--muted-foreground` se fijó en 0.78 de luminosidad, no en el gris del sitio público, que sobre este fondo se habría quedado en torno a 3:1.

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
