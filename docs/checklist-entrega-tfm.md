# Checklist de entrega TFM

Estado real de cada entregable de la entrega académica. Una sola tabla que
responde a la pregunta que importa: **¿está esto entregado, accesible y
comprobado por alguien que no sea yo?**

Última revisión: **19 de agosto de 2026**.

Los marcadores son literales y no se sustituyen por nada parecido a una URL:

- `[PENDIENTE: URL]` — el entregable no existe todavía.
- `[NO PROCEDE]` — no aplica a ese entregable.
- `[PENDIENTE: fecha]` — no se ha comprobado aún.

**Ninguna celda de este documento contiene una credencial.** La cuenta de
evaluación y su contraseña viajan solo por el formulario de entrega o el canal
privado acordado — ver `docs/formulario-entrega-tfm.md` y §4 de este documento.

---

## 1. Entregables

| Entregable | Estado | URL | Permiso | Última prueba en incógnito | Responsable | Pendiente |
|---|---|---|---|---|---|---|
| **Aplicación pública usable** | **Desplegada** en Vercel | https://elportondelacondesa.solucionesbonicas.com | Pública y usable | 14/08/2026 — `/`, `/robots.txt`, `/sitemap.xml` y `/admin/login` responden 200 sin sesión | Javier | Recorrer el flujo completo del visitante en incógnito: gate, formulario y páginas legales |
| **Repositorio GitHub público** | **Publicado y público** | https://github.com/javiermartinezcuartero-ui/PortonDeLaCondesaByDrexco | Público | `[PENDIENTE: fecha]` | Javier | Confirmar en incógnito que se lee sin sesión de GitHub |
| **URL directa del README** | Depende del anterior | https://github.com/javiermartinezcuartero-ui/PortonDeLaCondesaByDrexco/blob/main/README.md | Pública con el repositorio | `[PENDIENTE: fecha]` | Javier | Comprobar que se lee sin sesión de GitHub y que ningún enlace interno da 404 |
| **Google Slides** | **Creado** y verificado | https://docs.google.com/presentation/d/14L8D95c2vqTkQTHp6n94fpqZSJUrF6N2sbCGjEEpkA4/edit?usp=sharing | «Cualquier persona con el enlace puede ver» | 18/08/2026 — se abre en incógnito sin pedir cuenta y sin botón de editar | Javier | Comprobar que las 14 diapositivas siguen `docs/guion-presentacion-tfm.md` |
| **Vídeo OBS en Google Drive** | **Grabado, subido y verificado** | https://drive.google.com/file/d/1LMFmwPcavI7Nf59l0JnjH45q--Ki2x4l/view?usp=sharing | Visualización mediante enlace | 19/08/2026 — se abre en incógnito con un navegador distinto y se reproduce bien | Javier | — |
| **Dashboard (panel de administración)** | **Desplegado** y protegido | https://elportondelacondesa.solucionesbonicas.com/admin | **Protegido**: exige sesión | 14/08/2026 — `/admin` responde 307 a `/admin/login` sin cookie | Javier | Verificar en incógnito que las 9 rutas del panel no filtran nada |
| **Cuenta para calificación y revisión** | Se usan las cuentas ya existentes; no hay cuenta demo independiente | `[NO PROCEDE]` — se entra por el panel | Solo evaluación | `[NO PROCEDE]` | Javier | Decisión de Javier: sin cuenta demo separada. Ver nota de seguridad en §4 |
| **Formulario de entrega** | Listo para enviar | `[PENDIENTE: URL del formulario de la institución]` | Según la institución | `[NO PROCEDE]` | Javier | Enviar `docs/formulario-entrega-tfm.md` ya con las URL anteriores |
| **Justificante final** | Lo gestiona Javier con la empresa (Fundae) | `[NO PROCEDE]` | Copia privada del autor | `[NO PROCEDE]` | Javier | Fuera del alcance de este repositorio |

---

## 2. Qué se ha desbloqueado y qué sigue pendiente

Hasta la Fase 12 casi todo estaba pendiente por una razón deliberada: los
enunciados de las Fases 10 y 11 pidieron expresamente **preparar** el despliegue
y la publicación **sin ejecutarlos**, y el resto de entregables colgaba de esos
dos. La Fase 13 los ejecutó, y con ellos cayó la mitad del árbol:

```
desplegar la aplicación ──────────────────────────── HECHO
    ├── URL pública ──────┬── vídeo (grabado, subido, verificado)  HECHO
    │                     └── dashboard accesible ───────────────  HECHO
    └── calificación con cuentas existentes ──────────────────── decidido

publicar el repositorio ─────────────────────────────────────── HECHO
    ├── URL del README ──────────────────────────────────────────  conocida
    ├── enlace de las Slides ─────────────────────────────────────  HECHO
    └── enlace del vídeo ─────────────────────────────────────────  HECHO

las dos cosas
    └── formulario de entrega ── justificante ─── listo para enviar / a cargo de Javier
```

Solo queda una cosa técnica: rellenar y enviar el formulario de entrega con las
URL de arriba. Lo demás está terminado y verificado: la aplicación completa y
en línea, el repositorio publicado en GitHub, las Slides y el vídeo montados y
comprobados en incógnito, las 698 pruebas + 23 E2E, los datos de demostración
con su retirada y los cuatro guiones de entrega.

---

## 3. Permisos exigidos, uno a uno

Lo que hay que dejar configurado, y qué comprobar en cada caso.

| Recurso | Permiso correcto | Cómo se comprueba | Qué sale mal si se equivoca |
|---|---|---|---|
| Google Slides | «Cualquier persona con el enlace puede ver» | Abrir en incógnito: debe verse sin pedir cuenta y **sin** botón de editar | «Restringido» es el valor por defecto de Drive: el tribunal vería una pantalla de solicitud de acceso |
| Vídeo en Drive | «Cualquier persona con el enlace puede ver» | Abrir en incógnito y reproducir hasta el final | Un vídeo que no se puede ver es una entrega no presentada |
| Repositorio GitHub | Público | Abrir en incógnito | Un repositorio privado da 404, indistinguible de una URL mal escrita |
| README | Público con el repositorio | Abrir la URL `blob/main/README.md` en incógnito | — |
| Aplicación | Pública y usable | Recorrer home → gate → ficha → formulario en incógnito | — |
| Dashboard | Protegido | En incógnito, `/admin` debe redirigir a `/admin/login`; **no** debe abrirse | Un panel accesible sin sesión con datos personales dentro es una brecha, no un fallo de entrega |
| Cuentas de calificación | Las que ya existen; sin cuenta demo separada | Iniciar sesión una vez y comprobar que se ve el CRM | Al no rotarse tras la evaluación como haría una cuenta demo, conviene revisar después quién conserva acceso |

**La prueba en incógnito no es opcional.** Una ventana normal arrastra las
sesiones de Google y de GitHub del autor, así que todo parece accesible aunque
esté restringido. Es el error de entrega más común y el más fácil de evitar: un
atajo de teclado.

Recomendación práctica: hacer las comprobaciones **en el mismo orden de la
tabla y de una sola vez**, con una única ventana de incógnito recién abierta, y
anotar la fecha en la columna correspondiente. Comprobar cada cosa un día
distinto no demuestra que todo funcionara a la vez.

---

## 4. Cuenta de evaluación

**Decisión de Javier para esta entrega: no se crea cuenta demo independiente.**
La calificación y revisión del TFM se hace con las cuentas ya existentes en
producción. El procedimiento de cuenta demo de más abajo queda documentado
para un uso futuro, pero no se ejecuta en esta entrega.

Nota de seguridad a tener presente: al usar una cuenta real en lugar de una
desechable, no hay un paso de "desactivar después de la evaluación" como el
del punto 4 de abajo. Conviene revisar el acceso una vez terminada la
calificación.

Procedimiento completo (no usado en esta entrega) en `docs/runbook-demo.md`.
Lo imprescindible:

1. **Crear.** `npm run demo:seed` con `DEMO_ADMIN_EMAIL` y `DEMO_ADMIN_PASSWORD`
   en el entorno. La contraseña necesita 12 caracteres como mínimo. El script no
   la imprime nunca por consola.
2. **Retirar del entorno.** Borrar las dos variables de Vercel en cuanto el
   script haya corrido. Son de uso puntual.
3. **Entregar.** Solo por el formulario de entrega o el canal privado acordado.
   **Nunca** en el README, ni en el repositorio, ni en las Slides, ni en el
   vídeo, ni en el cuerpo de la release.
4. **Desactivar después de la evaluación.** `npm run demo:clean -- --cuenta`:
   revoca las sesiones y le quita las credenciales, de modo que no puede volver a
   entrar. El usuario sigue existiendo a propósito, porque `AuditEvent.actorId`
   apunta a él y borrarlo dejaría el registro de auditoría de la demo sin autor.
5. **Comprobar la retirada.** Intentar iniciar sesión con esas credenciales: debe
   fallar con el mensaje genérico.

Es una cuenta **independiente** del ADMIN real del negocio. El ADMIN real se crea
con `npm run admin:bootstrap` y su contraseña no se comparte con nadie.

---

## 5. Antes de dar la entrega por cerrada

- [ ] Ninguna celda de la tabla §1 contiene `[PENDIENTE: ...]` salvo la URL del
      formulario de la institución.
- [ ] Las comprobaciones de §3 hechas en una sola sesión de incógnito, con su
      fecha anotada.
- [ ] Las credenciales de las cuentas de calificación han viajado **solo** por
      el canal privado acordado.
- [ ] Formulario de entrega enviado. El justificante lo gestiona Javier
      directamente con la empresa para Fundae, fuera de este repositorio.
- [ ] Fecha de esta revisión actualizada en la cabecera.

Y una comprobación que no está en ninguna lista oficial: **pedirle a otra persona
que abra los cinco enlaces desde su equipo.** Es la única forma de descubrir un
permiso mal puesto que en el equipo del autor funciona por caché.

---

## 6. Documentos relacionados

| Documento | Para qué |
|---|---|
| `docs/guion-presentacion-tfm.md` | Las 14 diapositivas, con mensaje, evidencia, tiempo y notas del orador |
| `docs/guion-video-obs.md` | Grabación: escena, qué no debe salir en pantalla, recorrido y comprobaciones antes de subir |
| `docs/formulario-entrega-tfm.md` | Plantilla del formulario y del canal privado de credenciales |
| `docs/publicacion-github.md` | Preparación de la publicación, escaneo de secretos y decisión de licencia |
| `docs/runbook-demo.md` | Preparar, enseñar y retirar la demostración |
| `docs/despliegue-vercel.md` | Despliegue paso a paso, smoke tests y rollback |
| `docs/evidencias-tfm.md` | Qué puede comprobar el tribunal, con qué comando y qué salida da |
| `docs/checklist-aceptacion.md` | Requisitos funcionales y técnicos con su estado real |
