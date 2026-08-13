# Plantilla de release / tag de entrega

Se copia al crear la release en GitHub y se rellenan los huecos. Los marcadores
`[PENDIENTE: ...]` son literales: si uno llega así a la release publicada, es que
falta ese dato, no que el dato sea ese.

**Regla que no se salta nunca: en una release no va ninguna credencial.** Ni la
cuenta de evaluación, ni su contraseña, ni una URL con token. Las credenciales
viajan solo por el formulario de entrega o el canal privado acordado
(`docs/formulario-entrega-tfm.md`).

---

## Convenio de tag

```
v1.0.0-tfm
```

Un tag anotado, no ligero, para que lleve fecha, autor y mensaje:

```bash
git tag -a v1.0.0-tfm -m "Entrega TFM — El Portón de la Condesa"
git push origin v1.0.0-tfm
```

Correcciones posteriores a la entrega, si el tribunal pide algo: `v1.0.1-tfm`,
`v1.0.2-tfm`. **No se mueve un tag ya entregado.** Un tag que cambia de sitio
convierte en mentira cualquier enlace que ya se haya enviado.

---

## Cuerpo de la release

### El Portón de la Condesa — Web pública y CRM de captación

Entrega de Trabajo Fin de Máster. Aplicación Next.js full-stack que combina la
web pública de una finca de celebraciones con un backend propio de captación,
cualificación y seguimiento comercial.

**Fecha de entrega:** `[PENDIENTE: fecha]`
**Autor:** Javier Martínez
**Commit:** `[PENDIENTE: sha completo]`

#### Qué incluye

- Web pública responsive con la marca real del negocio.
- Bibliotecas de Bodas Reales y Catering tras un gate de correo validado **en
  servidor**: sin sesión de acceso, el contenido no se consulta ni viaja en el
  HTML.
- CMS propio de fichas con borrador, media en bucket privado, previsualización y
  publicación inmediata.
- CRM con contactos, solicitudes, pipeline, tareas, notas, informes y
  exportación CSV, con permisos por rol comprobados en servidor.
- Correo transaccional desacoplado tras una interfaz de proveedor.
- `[N]` pruebas unitarias y de integración + `[N]` E2E de Playwright.

#### Estado

| | |
|---|---|
| Aplicación desplegada | `[PENDIENTE: URL o "no desplegada"]` |
| Migraciones aplicadas | `[PENDIENTE: sí/no · nº de migraciones]` |
| Datos de demostración | `[PENDIENTE: sembrados / retirados]` |
| Cuenta de evaluación | `[PENDIENTE: activa / desactivada]` — credenciales por canal privado |

#### Validación de esta entrega

Salidas reales, no previstas. Si un comando no se ejecutó, se dice.

| Comando | Resultado |
|---|---|
| `npm ci` | `[PENDIENTE]` |
| `npm run lint` | `[PENDIENTE]` |
| `npm run typecheck` | `[PENDIENTE]` |
| `npm test` | `[PENDIENTE]` |
| `npm run e2e` | `[PENDIENTE]` |
| `npm run build` | `[PENDIENTE]` |
| `npm run secrets:history` | `[PENDIENTE]` |

#### Documentación

- [README](../README.md) — referencia técnica completa y autocontenida
- [`docs/evidencias-tfm.md`](../docs/evidencias-tfm.md) — qué se puede comprobar y con qué comando
- [`docs/checklist-aceptacion.md`](../docs/checklist-aceptacion.md) — requisitos con su estado real
- [`docs/manual-admin.md`](../docs/manual-admin.md) — manual de uso del panel
- [`docs/despliegue-vercel.md`](../docs/despliegue-vercel.md) — procedimiento de despliegue

#### Limitaciones declaradas

Las conocidas están en README §Limitaciones conocidas, con su motivo. Las tres
que conviene repetir aquí:

1. Los textos legales necesitan revisión profesional: la base jurídica y el
   plazo de retención concretos no los fija el proyecto.
2. `[PENDIENTE: si aplica]` No hay métricas de Lighthouse / sí las hay.
3. Las E2E no están en integración continua: necesitan un PostgreSQL de
   servicio y las credenciales de Storage como secretos del repositorio.

#### Derechos

El contenido de El Portón de la Condesa —marca, logotipos, fotografías y textos
comerciales— **no** está cubierto por ninguna licencia de software de este
repositorio. Ver [NOTICE](../NOTICE).

---

## Comprobación antes de publicar la release

- [ ] El tag apunta al commit que realmente se entrega (`git log -1 <tag>`).
- [ ] CI verde en ese commit.
- [ ] `npm run secrets:history` limpio.
- [ ] Ningún `[PENDIENTE: ...]` sin rellenar en el cuerpo.
- [ ] Ninguna credencial, contraseña ni URL con token en el texto.
- [ ] Los enlaces del cuerpo abren desde una ventana de incógnito sin sesión.
- [ ] Los números de la tabla de validación son los de la ejecución real, no los
      de una anterior.
