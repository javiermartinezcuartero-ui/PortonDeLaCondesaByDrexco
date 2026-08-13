# Tipografías del proyecto

Las tres familias se sirven desde el propio repositorio con `next/font/local`, no
desde `next/font/google`.

## Por qué

`next/font/google` descarga los archivos **durante el build**. El build de este
proyecto llegó a fallar con doce errores `Error while requesting resource` por no
poder alcanzar `fonts.googleapis.com`, y volvió a funcionar sin cambiar nada al
reintentarlo. Un build que puede fallar por motivos de red no es reproducible, y
la reproducibilidad es justo lo que esta fase tenía que asegurar. Con los archivos
en el repositorio el build no sale a Internet para nada.

Efectos secundarios, todos a favor:

- La CSP deja de necesitar `fonts.googleapis.com` ni `fonts.gstatic.com`
  (`lib/security/headers.ts`).
- El navegador no hace ninguna petición a un tercero para pintar el texto, así que
  no hay transferencia de la IP del visitante a Google. Es también lo que dice la
  política de cookies del sitio.
- Una petición menos en la ruta crítica del primer render.

## Qué se ha descargado

Un único archivo **variable** por familia, subconjunto **latin**, que cubre todos
los pesos que el sitio usa (300–700) con un solo archivo en vez de cinco:

| Archivo | Familia | Origen |
|---|---|---|
| `dm-sans-latin-variable.woff2` | DM Sans | `fonts.gstatic.com/s/dmsans/v17/…` |
| `cormorant-garamond-latin-variable.woff2` | Cormorant Garamond | `fonts.gstatic.com/s/cormorantgaramond/v21/…` |
| `jetbrains-mono-latin-variable.woff2` | JetBrains Mono | `fonts.gstatic.com/s/jetbrainsmono/v24/…` |

No se incluyen los subconjuntos `latin-ext`, cirílico ni vietnamita: el sitio está
en español e inglés y no los necesita. Tampoco las cursivas, que no se usan.

## Licencias

Las tres familias están bajo **SIL Open Font License 1.1**, que permite
redistribuirlas —incluida la incrustación en un sitio web— siempre que se
acompañen de su licencia y su aviso de copyright. Los archivos originales de
licencia están aquí al lado, sin modificar:

- `dm-sans-OFL.txt` — Copyright 2014 The DM Sans Project Authors
- `cormorant-garamond-OFL.txt` — Copyright 2015 the Cormorant Project Authors
- `jetbrains-mono-OFL.txt` — Copyright 2020 The JetBrains Mono Project Authors

La OFL exige además que el nombre reservado de la fuente no se use en versiones
modificadas. Aquí no se modifica nada: son los archivos tal y como los sirve
Google Fonts.

## Cómo actualizarlas

1. Consultar la CSS de la familia en `https://fonts.googleapis.com/css2?family=…`
   con un `User-Agent` de navegador moderno (si no, Google devuelve `ttf` en vez de
   `woff2`).
2. Quedarse con el bloque `@font-face` cuyo `unicode-range` incluya `U+0000-00FF`
   (es el subconjunto latin) y descargar su `woff2`.
3. Sustituir el archivo conservando el nombre, y volver a descargar el `OFL.txt`
   del repositorio de la familia por si el aviso de copyright ha cambiado.
4. Comprobar el resultado con `npm run build` y una revisión visual: un archivo
   equivocado no rompe el build, solo cambia la letra.
