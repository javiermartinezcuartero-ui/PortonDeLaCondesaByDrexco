# Imágenes y recursos visuales

## Imágenes ya descargadas directamente del dominio oficial

La carpeta `images/original-site` contiene recursos recuperados directamente desde `elportondelacondesa.com/wp-content/uploads/...`:

1. `01-boda-civil-jardin.jpg` — ceremonia civil exterior.
2. `02-salon-celebraciones.jpg` — salón preparado para banquete.
3. `03-boda-civil-invitados.jpg` — ceremonia/jardín con invitados.
4. `04-exterior-finca.jpg` — vista exterior de las instalaciones.
5. `05-salon-porton-decoracion.jpg` — salón con decoración vegetal.

## Descarga masiva local

Ejecuta desde la raíz del proyecto:

```bash
node project-reference/scripts/download-porton-assets.mjs
```

El script:

- recorre páginas internas del dominio;
- detecta `img src`, `srcset`, lazy loading y URLs de `wp-content/uploads`;
- extrae también imágenes referenciadas desde CSS inline;
- evita dominios externos;
- elimina duplicados;
- descarga los originales cuando puede;
- genera `downloaded-assets/manifest.json`;
- conserva la URL de origen de cada recurso.

## Uso en el nuevo front

No hacer hotlinking. Copiar las imágenes seleccionadas a `public/images/...` y utilizar rutas locales. Optimizar después en WebP/AVIF conservando el original como master si el flujo de trabajo lo permite.

## Recursos de marca añadidos

El logotipo actual facilitado como referencia se ha preparado para uso directo en el nuevo proyecto.

Ruta:

`project-reference/assets/brand/`

- `logo-porton-current-reference.png`: referencia exacta recibida.
- `logo-porton-hq.png`: versión 3344×852 con fondo corporativo.
- `logo-porton-transparent-hq.png`: versión 3344×852 transparente.
- `icon-porton-hq.png`: símbolo aislado para favicon/app icon.
- `icon-porton-on-green.png`: variante cuadrada sobre fondo verde.

El logotipo debe tratarse como activo de marca prioritario. No utilizar OCR ni intentar reconstruir el nombre mediante una fuente genérica.
