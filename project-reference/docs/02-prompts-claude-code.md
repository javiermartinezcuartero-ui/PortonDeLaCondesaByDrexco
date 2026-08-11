# Prompts secuenciales para Claude Code

Pégalos uno a uno desde la raíz del repositorio.

## Prompt 0 — Auditoría del proyecto

```text
Actúa como arquitecto senior full-stack. No modifiques código todavía.

1. Inspecciona package.json, lockfile, framework, router, TypeScript, Tailwind, componentes UI, assets, lint, tests, variables de entorno y scripts.
2. Dibuja el árbol funcional del proyecto.
3. Identifica qué partes pertenecen a la plantilla de demostración y cuáles conviene conservar.
4. Localiza referencias visibles a la plantilla base, marcas, URLs, imágenes, metadata y textos de demo.
5. Comprueba si existe backend, base de datos, autenticación, API o formularios.
6. Lee todo `project-reference`.
7. Propón un plan incremental de implementación para convertir la plantilla en la nueva web de El Portón de la Condesa con CRM de leads.
8. No cambies ningún archivo. Devuélveme: stack detectado, estructura, riesgos, dependencias, propuesta de fases y archivos que previsiblemente tocarías.
```

## Prompt 1 — Limpieza de plantilla

```text
Aplica únicamente la limpieza de la plantilla aprobada.

- Conserva diseño, componentes, tipografías, responsive y animaciones útiles.
- Sustituye contenido de demostración por una capa de contenido propia.
- Elimina referencias visibles de la plantilla base o de la marca demo sin romper el despliegue.
- Mantén componentes genéricos reutilizables.
- No implementes aún el CRM.
- Ejecuta lint/typecheck/tests y resume los cambios.
```

## Prompt 2 — Sistema de contenido y navegación

```text
Usa `project-reference/data/site-content.json` y `docs/01-extraccion-web.md` para crear el modelo de contenido del front.

Implementa navegación:
Inicio, Bodas, Espacios, Gastronomía, Celebraciones, Catering, Empresas, Inspiración y Contacto.

Subrutas mínimas:
- /bodas
- /bodas/ceremonias-civiles
- /espacios
- /espacios/porton
- /espacios/zafiro
- /espacios/cristal
- /espacios/conde
- /gastronomia
- /celebraciones
- /celebraciones/comuniones
- /catering
- /empresas
- /inspiracion
- /contacto

Centraliza textos, URLs, imágenes, SEO y CTAs en datos; evita hardcode disperso.
```

## Prompt 3 — Assets e imágenes

```text
Integra el banco de imágenes de `project-reference/images/original-site`.

1. Cópialas a una estructura limpia dentro de `public/images`.
2. Renombra solo si mejora la semántica, conservando un manifiesto de origen.
3. Asigna imágenes por contexto: hero, ceremonia civil, exterior, salón, galería.
4. Usa el componente de imagen optimizada del framework detectado.
5. Añade dimensiones/aspect-ratio para evitar CLS.
6. Usa `object-fit` y `object-position` de forma cuidadosa.
7. No hagas hotlinking.
8. Si faltan recursos, deja placeholders claramente identificados y no inventes URLs.
```

## Prompt 4 — Home comercial

```text
Construye una home moderna respetando el lenguaje visual de la plantilla.

Orden recomendado:
1. Hero emocional con CTA principal “Solicitar información” y secundario “Concertar una visita”.
2. Introducción breve a El Portón de la Condesa.
3. Bloque Bodas / Ceremonias civiles.
4. Presentación visual de los cuatro espacios.
5. Gastronomía.
6. Eventos y celebraciones.
7. Catering y empresas.
8. Galería/inspiración.
9. Acceso VIP mediante email.
10. Testimonios/casos reales si existen datos disponibles en la capa de contenido.
11. Contacto y CTA final.

Hazla mobile-first y orientada a conversión, sin convertirla en una colección interminable de secciones.
```

## Prompt 5 — Páginas de espacios

```text
Crea una plantilla reutilizable `SpacePage` o equivalente para Portón, Zafiro, Cristal y Conde.

Cada página debe admitir:
- hero;
- introducción;
- galería;
- atributos/verificados;
- usos recomendados;
- combinación con exteriores cuando esté documentada;
- CTA contextual;
- formulario de captación que registre el espacio consultado.

No inventes aforos ni precios. Si un dato no está confirmado, no lo publiques.
```

## Prompt 6 — Captación de leads

```text
Implementa formularios de captación reutilizables y contextualizados.

Campos:
nombre, apellidos, email, teléfono, tipo de evento, fecha aproximada, número estimado de invitados, mensaje, aceptación de privacidad y consentimiento de marketing separado.

Registrar además:
landingPath, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term y CTA que originó el formulario.

Requisitos:
- validación cliente/servidor;
- honeypot;
- rate limit;
- mensajes accesibles;
- deduplicación por email;
- consentimiento no premarcado;
- no revelar si un email ya existe.
```

## Prompt 7 — Base de datos y CRM

```text
Implementa el dominio definido en `project-reference/docs/03-arquitectura-crm-leads.md`.

Reutiliza ORM/base de datos existentes. Si no existen, propón PostgreSQL + Prisma antes de instalar.

Entidades mínimas:
User, Lead, Consent, Activity, VipAccessToken, Tag, LeadTag.

Incluye:
- pipeline;
- scoring configurable;
- propietario del lead;
- próxima acción;
- motivo de pérdida;
- índices;
- migraciones;
- seed de desarrollo;
- tests de deduplicación, scoring y transiciones.
```

## Prompt 8 — Zona VIP

```text
Implementa una zona VIP de inspiración para convertir visitantes en leads.

Flujo:
1. CTA “Ver reportaje completo” o “Acceder al dossier”.
2. Captura de datos.
3. Creación/update del lead.
4. Generación de token seguro y almacenamiento solo del hash.
5. Enlace mágico con expiración.
6. Sesión VIP limitada.
7. Registro de accesos, reportajes consultados y descargas como Activity.

La zona VIP debe tener `noindex` y protección server-side.
```

## Prompt 9 — Email

```text
Crea una interfaz `EmailProvider` desacoplada con adaptador de desarrollo y SendGrid.

Emails mínimos:
- confirmación de solicitud;
- acceso VIP;
- aviso interno de nuevo lead;
- confirmación de solicitud de visita;
- recordatorio interno de próxima acción.

Configura todo mediante variables de entorno y registra éxito/error como Activity.
```

## Prompt 10 — Administración

```text
Implementa `/admin` con autenticación y roles ADMIN, SALES y CONTENT.

Dashboard:
- nuevos leads;
- pendientes de contacto;
- visitas;
- propuestas;
- ganados/perdidos;
- tiempo medio de primera respuesta;
- leads por origen/campaña;
- próximas acciones vencidas.

Vistas:
- tabla filtrable;
- Kanban por pipeline;
- ficha 360º del lead;
- timeline;
- notas/actividades;
- tags;
- próximas acciones;
- exportación CSV con permisos.
```

## Prompt 11 — SEO, rendimiento y accesibilidad

```text
Haz una pasada de calidad:
- metadata por página;
- canonical;
- sitemap;
- robots;
- schema.org cuando proceda;
- Open Graph;
- imágenes optimizadas;
- Core Web Vitals;
- navegación por teclado;
- contraste;
- labels y errores de formularios;
- prefers-reduced-motion;
- noindex en admin/VIP.

Ejecuta Lighthouse o herramientas disponibles y documenta los resultados reales.
```

## Prompt 12 — README y entrega TFM

```text
Crea/actualiza README.md como documentación técnica principal del proyecto.

Debe incluir:
- objetivo;
- arquitectura;
- stack;
- estructura de carpetas;
- modelo de datos;
- flujo de captación;
- CRM;
- zona VIP;
- variables de entorno;
- instalación;
- desarrollo;
- tests;
- despliegue;
- seguridad;
- decisiones técnicas;
- limitaciones;
- roadmap.

No incluyas secretos. El repositorio debe poder publicarse de forma segura.
```


## Prompt 13 — Marca, Instagram y contenido de inspiración

```text
Integra en el proyecto la identidad visual y la investigación social disponibles en `project-reference`.

Lee primero:
- `project-reference/assets/brand/README.md`
- `project-reference/docs/05-instagram-research.md`
- `project-reference/data/instagram-content.json`

IDENTIDAD
1. Copia los assets de marca necesarios a la estructura pública adecuada del proyecto.
2. Utiliza `logo-porton-transparent-hq.png` como logotipo principal cuando el fondo lo permita.
3. Utiliza `icon-porton-hq.png` para favicon, app icon y metadata cuando sea apropiado.
4. Integra los colores de referencia `#182605` y `#FF422C` dentro del sistema visual existente sin destruir el diseño original de la plantilla.
5. No recrees el logotipo con una tipografía distinta.

CONTENIDO SOCIAL
6. Crea una capa de datos para `RealWedding`, `InspirationItem` o equivalente.
7. Permite relacionar bodas reales con salón, galería, vídeos/Reels, temporada y CTAs.
8. Crea una página moderna de `Bodas reales / Inspiración` y un componente reutilizable para historias de parejas.
9. Añade soporte para vídeo vertical 9:16 de forma responsive y con carga diferida.
10. No dependas del embed de Instagram para el contenido esencial: debe existir fallback con imagen, título y enlace externo.

CAPTACIÓN Y CRM
11. Cada CTA procedente de una boda real, inspiración, Reel o campaña debe poder enviar:
   - `sourceContentId`
   - `sourceContentType`
   - `utmSource`
   - `utmMedium`
   - `utmCampaign`
   - `utmContent`
12. Añade estas dimensiones a la ficha del lead y a los informes de adquisición.
13. Implementa el CTA contextual `Quiero una boda así`.
14. Permite que reportajes completos puedan marcarse como contenido VIP.

EVENTOS / CAMPAÑAS
15. Diseña el modelo necesario para campañas como eventos gastronómicos, San Valentín, Noche Blanca u otras acciones propias.
16. Una campaña debe poder tener landing, fecha, imágenes/vídeo, CTA, lista de espera/lead y métricas de conversión.

Antes de programar, explícame qué componentes y entidades vas a añadir. Después implementa de forma incremental y ejecuta lint/typecheck/tests.
```
