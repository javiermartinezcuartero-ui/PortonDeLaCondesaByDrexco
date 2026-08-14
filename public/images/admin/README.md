# Fondo de la pantalla de acceso

La pantalla `/admin/login` espera aquí un archivo llamado exactamente:

```
acceso-fondo.jpg
```

Se declara en `app/globals.css`, en la variable `--admin-gate-image` de la clase
`.admin-gate`. Para cambiar la imagen basta con sustituir el archivo; no hay que
tocar el CSS.

**Si el archivo no existe, la pantalla sigue siendo usable:** debajo hay un
degradado azul noche que se ve en su lugar. Es deliberado — una pantalla de acceso
que se queda en blanco porque falta un asset es una pantalla que nadie puede usar.

## Qué imagen conviene

- **Apaisada y de al menos 2400 px de ancho.** Se sirve a pantalla completa y la
  animación la amplía hasta un 120 %, así que el recorte efectivo es mayor que el
  viewport.
- **Sin texto ni logotipos**, y con el centro despejado: encima va el formulario.
- **JPEG optimizado.** Es la primera petición de la pantalla y no pasa por
  `next/image` (es un `background-image`), así que su peso es el que se descarga.
  Por debajo de 400 KB es un buen objetivo.
- **Derechos comprobados.** Vale lo mismo que para el resto de los assets del
  proyecto: ver `NOTICE`.
