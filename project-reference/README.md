# El Portón de la Condesa — paquete de referencia y arranque

Este paquete sirve para arrancar una renovación web moderna a partir de una plantilla descargada de la plantilla base, conservando su diseño base y utilizando como fuente de contenido el sitio público de El Portón de la Condesa.

## Contenido

- `PROMPT_INICIAL_CLAUDE.txt`: primer prompt para Claude Code.
- `docs/01-extraccion-web.md`: inventario funcional y de contenidos de la web actual.
- `docs/02-prompts-claude-code.md`: secuencia completa de prompts.
- `docs/03-arquitectura-crm-leads.md`: backend de captación y CRM.
- `docs/04-imagenes.md`: inventario de imágenes y estrategia de descarga.
- `data/site-content.json`: datos estructurados para reutilizar en el front.
- `images/original-site/`: imágenes descargadas directamente del dominio `elportondelacondesa.com`.
- `scripts/download-porton-assets.mjs`: crawler local para descargar automáticamente imágenes públicas del dominio.

## Uso recomendado

1. Copia esta carpeta dentro de la raíz del proyecto con el nombre `project-reference`.
2. Ejecuta opcionalmente `node project-reference/scripts/download-porton-assets.mjs` para ampliar el banco de imágenes desde la web actual.
3. Abre Claude Code en la raíz del repositorio.
4. Pega el contenido de `project-reference/PROMPT_INICIAL_CLAUDE.txt`.
5. Continúa con los prompts numerados de `docs/02-prompts-claude-code.md`.

El backend se plantea con captación de leads, zona VIP, scoring, seguimiento comercial, pipeline y analítica de conversión.


## Plantilla real integrada

La plantilla seleccionada por el proyecto ya ha sido analizada. Antes de empezar con Claude Code utiliza `PROMPT_00_PLANTILLA_REAL_CLAUDE.txt` y consulta `docs/06-analisis-plantilla-base.md`.
