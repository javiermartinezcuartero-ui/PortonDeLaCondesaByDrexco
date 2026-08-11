# Análisis de la plantilla base — Portón de la Condesa

## 1. Stack detectado

- Next.js 16.0.10 con App Router.
- React 19.2.0.
- TypeScript.
- Tailwind CSS 4.
- Componentes Radix UI / shadcn.
- Lucide React.
- React Hook Form + Zod disponibles.
- Recharts disponible para el futuro dashboard CRM.
- `next/image` y componente propio `ImageReveal` para tratamiento visual de fotografías.

## 2. Arquitectura actual

La home está compuesta en `app/page.tsx` por:

1. `Header`
2. `HeroSection`
3. `VisionSection`
4. `PhilosophySection`
5. `ExperienceSection`
6. `DishesSection`
7. `ContactSection`
8. `Footer`

Existe además `components/sections/projects.tsx`, actualmente no utilizado por `app/page.tsx`. Es especialmente útil para convertirlo en una sección interactiva de **Espacios / Salones**.

## 3. ADN visual que debe conservarse

No rediseñar desde cero. La plantilla tiene una identidad visual válida y debe evolucionar sobre ella:

- Grandes titulares editoriales con `Cormorant Garamond`.
- Texto funcional con `DM Sans`.
- Mucho espacio negativo.
- Grid de hasta 1800 px.
- Líneas arquitectónicas finas.
- Bordes sin redondeo (`--radius: 0rem`).
- Fotografía protagonista a gran formato.
- Animaciones suaves mediante `IntersectionObserver`.
- Parallax contenido en el hero.
- Apariciones progresivas, no animaciones llamativas.
- Composición asimétrica y editorial premium.

## 4. Adaptación cromática

La marca suministrada trabaja principalmente con:

- Verde profundo: `#182605`
- Coral/rojo: `#FF422C`

La plantilla ya utiliza un fondo marfil y un acento terracota, por lo que la migración visual puede hacerse sin destruir su estética:

- Mantener fondo cálido/marfil.
- Convertir `--primary` en el verde de marca.
- Convertir `--accent` en el coral de marca.
- Mantener textos oscuros y neutros auxiliares.

## 5. Mapeo exacto de componentes

### Header
Actual: logo tipográfico ESSENCE + navegación ancla + CTA.

Destino:
- Logotipo gráfico `/public/brand/logo-porton-transparent-hq.png`.
- Navegación orientada a bodas y eventos.
- CTA principal: `Solicita información` o `Organiza tu evento`.
- En escritorio puede evolucionar a mega-menú más adelante; no hacerlo en la primera iteración.

### HeroSection
Actual: gran imagen, headline editorial, parallax y CTA.

Destino:
- Fotografía emocional de boda/evento.
- Claim de El Portón de la Condesa.
- CTA de conversión.
- CTA secundario hacia bodas reales / espacios.
- Conservar parallax, retícula, timing de animaciones y proporciones.

### VisionSection
Actual: manifiesto + dos columnas + cuatro métricas.

Destino recomendado:
- Presentación del espacio y propuesta de valor.
- 2 párrafos de contexto.
- Métricas reales cuando estén confirmadas: años de experiencia, salones/espacios, capacidad, celebraciones, etc.
- No inventar cifras.

### PhilosophySection
Actual: bloque oscuro con cuatro principios e imagen.

Destino recomendado:
- Filosofía de celebración / servicio.
- Gastronomía, personalización, espacios y acompañamiento.
- Excelente sección para transmitir valores sin convertir la página en catálogo.

### ExperienceSection
Actual: experiencia gastronómica secuencial.

Destino recomendado:
- `Así será tu celebración` o `Tu boda, paso a paso`.
- Visita inicial → propuesta → personalización → celebración.
- Alternativamente puede representar tipos de evento. Priorizar el customer journey.

### ProjectsSection — actualmente no montada

Es un activo muy valioso de la plantilla.

Destino:
- `Nuestros espacios`.
- Cada proyecto pasa a ser un salón/espacio.
- Imagen grande izquierda + ficha derecha + navegación entre espacios.
- Campos actuales `location`, `year`, `area`, `awards` deben renombrarse semánticamente a capacidad, tipo de espacio, características, etc.
- Añadirla a `app/page.tsx` cuando el contenido esté preparado.

### DishesSection
Destino:
- Gastronomía.
- Platos, cóctel, banquete, estaciones o propuestas gastronómicas.
- Mantener la lógica visual de fotografía + navegación.

### ContactSection
Actual: formulario puramente frontend de reserva de restaurante.

Destino:
- Primer mecanismo de captación de leads.
- Nombre y apellidos.
- Email.
- Teléfono.
- Tipo de evento.
- Fecha prevista.
- Número estimado de invitados.
- Mensaje.
- Consentimiento de privacidad obligatorio.
- Consentimiento comercial separado y opcional.
- Captura de UTMs y URL de origen en campos ocultos.
- En una fase posterior el submit llamará a la API y generará el lead en CRM.

### Footer
Destino:
- Logotipo real.
- Datos de contacto reales extraídos y verificados.
- Instagram oficial.
- Enlaces legales.
- Sitemap corto.

## 6. Recursos ya añadidos a la plantilla

### Marca

`public/brand/`

- `logo-porton-hq.png`
- `logo-porton-transparent-hq.png`
- `icon-porton-hq.png`
- `icon-porton-on-green.png`

### Fotografías de referencia

`public/images/porton/`

Se han copiado las fotografías obtenidas del sitio original disponibles en el paquete de referencia para que Claude pueda utilizarlas directamente en la primera adaptación.

### Investigación

Toda la información obtenida de la web e Instagram está disponible en:

`project-reference/`

Claude debe leer esa carpeta antes de modificar contenido.

## 7. Orden técnico recomendado

1. Crear commit/tag de baseline.
2. Auditar y comprobar que `npm/pnpm build` funciona.
3. Aplicar branding, metadata e idioma.
4. Sustituir Header/Footer.
5. Adaptar Hero.
6. Adaptar secciones existentes una por una.
7. Recuperar `ProjectsSection` como espacios.
8. Crear contenido desacoplado de componentes (`data/content.ts` o equivalente).
9. Construir rutas secundarias.
10. Implementar formulario real y backend de leads.
11. Implementar `/admin` y CRM.
12. Añadir analítica, tracking, SEO y documentación TFM.

## 8. Restricción principal

**No destruir la plantilla para montar otra web.** El objetivo es conservar su lenguaje visual y transformar contenido, navegación y funcionalidad con cambios progresivos y verificables.
