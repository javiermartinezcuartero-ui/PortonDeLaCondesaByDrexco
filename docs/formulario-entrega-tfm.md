# Formulario de entrega TFM

Plantilla para rellenar y volcar en el formulario de la institución. Se completa
cuando existan las URL; hasta entonces, los marcadores se quedan como están.

**Este archivo está versionado y el repositorio va a ser público.** Por tanto:

> **La cuenta de evaluación y su contraseña NO se escriben aquí.**
> Van por el canal privado de §4. Si al rellenar la plantilla aparece la tentación
> de pegar una contraseña «solo un momento para no perderla», es exactamente el
> momento de no hacerlo: quedaría en el historial de Git para siempre, y ahí ya no
> se borra con un commit.

---

## 1. Datos de la entrega

| Campo | Valor |
|---|---|
| Título del trabajo | El Portón de la Condesa — Web pública y CRM de captación |
| Autor | Javier Martínez |
| Titulación | `[PENDIENTE: titulación]` |
| Tutor | `[PENDIENTE: nombre del tutor]` |
| Convocatoria | `[PENDIENTE: convocatoria]` |
| Fecha y hora de envío | `[PENDIENTE: fecha y hora]` |

---

## 2. URL a entregar

Todas deben abrirse **en una ventana de incógnito recién abierta**, sin sesión de
Google ni de GitHub. Sin excepción.

| # | Entregable | URL | Permiso que debe tener | Comprobado en incógnito |
|---|---|---|---|---|
| 1 | Aplicación | https://elportondelacondesa.solucionesbonicas.com | Pública y usable | `[PENDIENTE: fecha]` |
| 2 | Repositorio GitHub | https://github.com/javiermartinezcuartero-ui/PortonDeLaCondesaByDrexco | Público | `[PENDIENTE: fecha]` |
| 3 | README | https://github.com/javiermartinezcuartero-ui/PortonDeLaCondesaByDrexco/blob/main/README.md | Público con el repositorio | `[PENDIENTE: fecha]` |
| 4 | Google Slides | https://docs.google.com/presentation/d/14L8D95c2vqTkQTHp6n94fpqZSJUrF6N2sbCGjEEpkA4/edit?usp=sharing | Cualquier persona con el enlace puede ver | 18/08/2026 |
| 5 | Vídeo (Drive) | https://drive.google.com/file/d/1LMFmwPcavI7Nf59l0JnjH45q--Ki2x4l/view?usp=sharing | Cualquier persona con el enlace puede ver | 19/08/2026 — navegador distinto, reproduce bien |
| 6 | Dashboard | https://elportondelacondesa.solucionesbonicas.com/admin | **Protegido**: debe pedir sesión | `[PENDIENTE: fecha]` |

El repositorio ya es público. Quedan por confirmar en incógnito las dos URL de
GitHub (repositorio y README).

El dashboard es el único que se comprueba **al revés**: lo que hay que verificar
es que **no** se abre. Si `/admin` carga en incógnito, hay un problema de
seguridad, no un permiso mal puesto.

---

## 3. Observaciones para el tribunal

Texto propuesto para el campo de observaciones. Ajustar según el estado real el
día del envío.

> El proyecto es una aplicación Next.js full-stack: web pública de una finca de
> celebraciones real, con un backend propio de captación, cualificación y
> seguimiento comercial de clientes potenciales.
>
> El README del repositorio es la referencia técnica completa y autocontenida:
> problema, objetivos, alcance, arquitectura, modelo de datos, decisiones,
> instalación, pruebas con resultados reales, seguridad, privacidad y despliegue.
> No hace falta leer nada más para entender y reproducir el proyecto.
>
> Para comprobar afirmaciones concretas sin instalar nada,
> `docs/evidencias-tfm.md` lista cada una con el comando que la demuestra y la
> salida que da. La más significativa: el contenido protegido no está oculto con
> CSS, sino que no se consulta hasta validar el acceso en servidor, y eso se
> verifica con un `curl` sobre el HTML servido.
>
> Las credenciales de la cuenta de evaluación se entregan por el canal indicado
> más abajo, nunca en el repositorio ni en los materiales públicos. La cuenta se
> desactiva tras la evaluación.
>
> Limitaciones declaradas: los textos legales necesitan revisión profesional —el
> proyecto no fija la base jurídica ni el plazo de retención, y donde falta hay un
> aviso explícito en lugar de una cifra inventada—; las pruebas end-to-end no
> están en integración continua; y las fichas de las bibliotecas son ejemplos
> ilustrativos con datos ficticios, etiquetados como tales, mientras el negocio no
> publique casos reales. La lista completa está en README §Limitaciones conocidas.

---

## 4. Canal privado para las credenciales

Rellenar **al enviar**, no antes, y con el canal que la institución acepte.

| Campo | Valor |
|---|---|
| Canal utilizado | `[PENDIENTE: campo privado del formulario / correo al tutor / otro]` |
| Enviado a | `[PENDIENTE: destinatario]` |
| Fecha y hora del envío | `[PENDIENTE: fecha y hora]` |
| Correo de la cuenta de calificación | `[se indica en el canal privado]` |
| Contraseña | `[se indica en el canal privado]` |
| Caducidad prevista | `[NO PROCEDE]` — cuenta existente, no una demo desechable. Revisar el acceso una vez terminada la calificación |

### Texto para el canal privado

> Credenciales de acceso al panel del TFM «El Portón de la Condesa».
>
> Panel: https://elportondelacondesa.solucionesbonicas.com/admin
> Usuario: `[correo]`
> Contraseña: `[contraseña]`
>
> Cuenta con rol ADMIN ya existente, usada para la calificación y revisión del
> TFM.
>
> El manual de uso del panel está en `docs/manual-admin.md` del repositorio.

### Orden de preferencia del canal

1. **Campo privado del propio formulario de entrega**, si existe. Es el mejor
   sitio: queda con la entrega y no se pierde.
2. **Correo directo al tutor.** Aceptable.
3. **Un servicio de nota autodestructiva** con enlace de un solo uso, si la
   institución lo permite.

Lo que **no** vale, aunque parezca cómodo: el cuerpo del formulario público, una
issue del repositorio, el README, las Slides, el vídeo, un mensaje en un grupo, ni
un documento de Drive compartido por enlace.

---

## 5. Comprobación externa

Que funcione en el equipo del autor no demuestra nada: tiene sesiones abiertas y
caché. Hace falta que alguien más lo abra.

| Campo | Valor |
|---|---|
| Persona que lo ha comprobado | `[PENDIENTE: nombre]` |
| Desde qué equipo y red | `[PENDIENTE: equipo y red distintos a los del autor]` |
| Fecha y hora | `[PENDIENTE: fecha y hora]` |
| Resultado | `[PENDIENTE]` |

Qué se le pide exactamente:

1. Abrir las cinco URL públicas. Las cinco deben cargar sin pedir cuenta.
2. Recorrer la aplicación: home → gate → dejar un correo → abrir una ficha →
   enviar el formulario.
3. Intentar entrar en `/admin`. **Debe redirigir al acceso.**
4. Reproducir el vídeo hasta el final.
5. Abrir las Slides y comprobar que **no** aparece el botón de editar.

Si algo falla, se corrige y se repite la comprobación completa. No basta con
arreglar lo que falló: un permiso mal puesto suele venir acompañado.

---

## 6. Justificante

Es la única prueba de que la entrega llegó. Sin él, la palabra del autor contra
un servidor.

| Campo | Valor |
|---|---|
| Formulario enviado el | `[PENDIENTE: fecha y hora]` |
| Justificante recibido | `[PENDIENTE: sí / no]` |
| Forma del justificante | `[PENDIENTE: correo de confirmación / PDF / captura]` |
| Guardado en | `[PENDIENTE: ubicación]` — copia local **y** en la nube |
| Número de referencia | `[PENDIENTE: si la institución lo asigna]` |

Si a las 24 horas no ha llegado ningún justificante, escribir al tutor antes de
que se cierre el plazo. Un formulario que no confirma no es una entrega
realizada.

---

## 7. Antes de enviar

- [ ] Los seis enlaces de §2 comprobados en **una sola** sesión de incógnito.
- [ ] `/admin` **no** se abre sin sesión.
- [ ] La cuenta de evaluación funciona (probada una vez).
- [ ] Credenciales enviadas **solo** por el canal de §4.
- [ ] Ninguna credencial en este archivo, ni en el repositorio, ni en las Slides,
      ni en el vídeo.
- [ ] Comprobación externa (§5) hecha por otra persona.
- [ ] `docs/checklist-entrega-tfm.md` actualizado con las URL y las fechas.
- [ ] Ningún `[PENDIENTE: ...]` sin rellenar en este documento.
