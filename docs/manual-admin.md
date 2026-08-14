# Manual del panel de administración

Guía de uso para el equipo de El Portón de la Condesa. No hace falta saber nada
técnico: aquí se explica qué hace cada pantalla y cómo se usa.

---

## 1. Entrar

El acceso está en el **icono de engranaje** de la cabecera del sitio, arriba a la
derecha. No hay enlace en el menú ni en el pie: es el único punto de entrada, y es
discreto a propósito.

También se puede escribir la dirección directamente: `/admin`.

Se entra con **email y contraseña**. No hay registro público: las cuentas las crea
una persona con perfil ADMIN desde el propio panel.

Si el mensaje de error dice "Email o contraseña incorrectos", puede ser cualquiera de
las dos cosas. Es intencionado: un mensaje más preciso le diría a un desconocido qué
correos existen en el sistema.

Tras tres intentos fallidos seguidos hay que esperar diez segundos. También es una
protección, no una avería.

### Cerrar sesión

El enlace **Cerrar sesión**, arriba a la derecha del panel. Cierra la sesión de
verdad: no basta con cerrar la pestaña. Si alguien copiase la cookie del navegador
antes de cerrar, dejaría de servirle en el momento en que se pulsa ese enlace.

---

## 2. Los tres perfiles

Cada persona ve exactamente lo que le corresponde. No es que los apartados estén
ocultos: es que no puede entrar en ellos ni escribiendo la dirección a mano.

| Apartado | ADMIN | SALES (comercial) | CONTENT (contenido) |
|---|:--:|:--:|:--:|
| Resumen | Sí | Sí | — |
| Contactos | Sí | Sí | — |
| Solicitudes | Sí | Sí | — |
| Pipeline | Sí | Sí | — |
| Tareas | Sí | Sí | — |
| Contenidos | Sí | — | Sí |
| Informes | Sí | Sí | — |
| Configuración | Sí | — | — |
| Usuarios | Sí | — | — |
| Exportar a Excel | Sí | — | — |
| Anonimizar un contacto | Sí | — | — |

**Quien edita reportajes no ve datos personales.** El perfil CONTENT no puede
acceder al teléfono ni al email de nadie. Es la separación que sostiene todo el
modelo de permisos, y está comprobada con pruebas automáticas.

Al entrar con perfil CONTENT, el panel saluda y lleva directamente a Contenidos: el
Resumen son métricas comerciales y no le corresponden.

---

## 3. Estatus Plataforma

La pantalla de inicio, en gráficas. De un vistazo:

- **Solicitudes sin trabajar**, las que siguen en la fase Contacto.
- **Reparto por fase** en un anillo. Pulsando una fase se abre su listado.
- **Acciones pendientes** repartidas por plazo: vencidas, próximos 7 días y más
  adelante. Pulsando un tramo se abre esa selección.
- **Conversión**: solicitudes que acabaron en Cliente sobre el total de cerradas
  (Cliente + Perdida). Cada porcentaje muestra su denominador, y si no hay datos
  suficientes **no se inventa un porcentaje**: dice que no se puede calcular.
- **Tiempo medio hasta el primer contacto**, con el número de casos sobre el que se
  ha calculado.
- **Embudo**: de quien accede a las bibliotecas a quien consulta una ficha, y de ahí
  a quien envía una solicitud.
- **Origen y campaña** y **contenido más consultado**, en barras.
- **Últimos movimientos** del equipo.

Debajo de cada gráfica hay una leyenda con la cifra y el porcentaje de cada parte: el
dibujo acompaña al dato, no lo sustituye.

---

## 4. Captaciones

La lista de todas las personas que han dejado sus datos, ordenada por actividad
reciente.

**Buscar** por nombre, apellidos, email o teléfono. La búsqueda funciona aunque el
teléfono se escribiese con espacios o sin el prefijo: se busca sobre una versión
normalizada del dato.

**Filtros** disponibles: origen (canal de la primera solicitud), etiqueta,
puntuación mínima, tipo de interacción, consentimiento de marketing (concedido / sin
conceder / indiferente) y rango de fechas. Los filtros quedan en la dirección de la
página, así que se puede guardar en favoritos una vista concreta o pasarla a un
compañero.

### Ficha del contacto (vista 360º)

Todo lo que se sabe de una persona, en una sola pantalla:

- **Datos de contacto**, con enlaces para llamar, escribir un email o abrir WhatsApp.
- **Puntuación** y el detalle de por qué la tiene.
- **Solicitudes** que ha enviado, cada una con su estado.
- **Interacciones**: qué reportajes ha visto y cuándo.
- **Consentimientos**, con la fecha y la versión de la política que aceptó. Es la
  prueba de que se le puede escribir, o de que no.
- **Notas internas** del equipo.
- **Tareas** de seguimiento.
- **Historial** completo, en orden.

### Notas

Son internas: el contacto no las ve nunca. Se guardan con autor y fecha, y editarlas
queda registrado. Sirven para lo que se ha hablado por teléfono, lo que quedó
pendiente, o el detalle que conviene recordar antes de la próxima llamada.

### Puntuación

Se calcula sola, sumando hitos: enviar el formulario, dejar el teléfono, indicar
fecha, indicar número de invitados, entrar en la zona VIP, ver tres o más reportajes,
descargar el dossier, pedir una visita. Cada hito cuenta **una sola vez**.

Los pesos los puede ajustar un ADMIN en Configuración. El botón **Recalcular** de la
ficha vuelve a puntuar desde cero con el historial real, útil después de cambiar los
pesos.

---

## 5. Solicitudes Formulario

Cada petición de información que llega por la web. Una persona puede tener varias: no
se sobrescriben nunca, se acumulan como historial.

La lista muestra asunto, contacto, estado, prioridad, tipo de evento, invitados,
responsable y próxima acción. Si la solicitud nació al pulsar "Quiero una boda así"
en un reportaje, se indica **"desde una ficha"**: eso dice qué estaba mirando la
persona cuando decidió escribir.

### Detalle de una solicitud

- **Lo que pidió**: tipo de evento, fecha prevista, invitados, espacio de interés,
  presupuesto orientativo y su mensaje, tal y como lo escribió.
- **Estado** y a dónde se puede mover desde aquí.
- **Gestión**: prioridad, responsable, próxima acción y fecha.
- **Historial** de esta solicitud concreta.
- **Contacto**, con sus enlaces de llamada y WhatsApp.
- **Origen**: por qué formulario entró, desde qué página, y la campaña si venía de
  una.

Si hay **otro contacto con datos parecidos**, el panel lo avisa y enlaza. No los une:
decidir si dos contactos son la misma persona no es algo que deba hacer un programa
por su cuenta.

### Mover una solicitud de estado

El desplegable **Mover a** solo ofrece los estados a los que se puede pasar desde el
actual. El recorrido es:

```
Nueva → Contactada → Cualificada → Visita agendada → Propuesta enviada
      → En negociación → Ganada
```

Desde casi cualquier punto se puede pasar a **Perdida** o a **En seguimiento** (para
quien vuelve más adelante). **Ganada** y **Perdida** son finales.

**Marcar como Perdida exige un motivo.** No es burocracia: una oportunidad perdida
sin motivo no enseña nada, y al final del año la diferencia entre "perdimos veinte" y
"perdimos veinte, catorce por fecha no disponible" es la que permite decidir algo.

Cada movimiento queda en el historial con quién lo hizo y cuándo.

---

## 6. Seguimiento clientes

El mismo trabajo, visto como tablero: **una columna por fase**, con las solicitudes
dentro. Las cinco fases son:

1. **Contacto** — la solicitud acaba de entrar y nadie la ha trabajado.
2. **Presentación** — ya se ha hablado con la persona y se le está mostrando la finca.
3. **Propuesta** — hay presupuesto sobre la mesa.
4. **Cliente** — cerrado a favor. Es la última: de aquí no se mueve.
5. **Perdida** — se puede reabrir, y vuelve a Contacto.

**Para mover una solicitud, arrastra su tarjeta a otra columna.** Mientras arrastras
solo se resaltan las columnas válidas desde donde está, porque no se puede saltar una
fase. Sí se permite volver un paso atrás, por si te equivocas de columna.

Al soltar en **Perdida** se pide el motivo, y es obligatorio: una oportunidad perdida
sin motivo no sirve para aprender nada.

**Si no puedes o no quieres arrastrar**, el tablero también se maneja con el teclado:
pulsa Tab hasta la tarjeta y luego Control (o Comando en Mac) más la flecha izquierda
o derecha. Cada movimiento se anuncia, así que también funciona con lector de
pantalla.

---

## 7. Acciones

Recordatorios atados a un contacto, y opcionalmente a una solicitud concreta.

Se crean **desde la ficha del contacto**, para que nazcan siempre ligadas a alguien.
Una tarea suelta que nadie sabe de quién es no se hace nunca.

Cada acción tiene título, fecha de vencimiento, prioridad y responsable, y **se edita
en la propia tabla**: cambia el desplegable o la fecha y se guarda solo; en el título,
escribe y pulsa Intro o sal del campo. A la derecha de cada fila aparece una marca
mientras guarda y otra cuando ha guardado.

La pantalla muestra **todas** las acciones, las pendientes primero. Si llegas desde
una cifra de Estatus Plataforma —«vencidas», «próximos 7 días»— verás solo esas, con
un enlace «Ver todas» para volver.

Una acción se **completa** o se **cancela** desde el desplegable de estado. Cancelar
no la borra: se queda con su estado, porque saber que algo se decidió no hacer también
es información. Y una vez cerrada **ya no se edita**: sus campos se muestran como
texto.

---

## 8. Contenidos Biblioteca

Los reportajes de las bibliotecas VIP: bodas reales y eventos de catering. Solo los
perfiles CONTENT y ADMIN.

### Crear un reportaje

`Contenidos → Nueva ficha`. Se elige el tipo (Boda real o Evento de catering), se
escribe el título en español y se acepta o ajusta la **dirección web** (el "slug")
que se propone. Se crea como **borrador**: no lo ve nadie fuera del panel.

### Rellenar la ficha

Título y subtítulo en español son lo mínimo. Después, todo lo que da vida al
reportaje: temporada, espacio, decoración, photocall, tiempo, soluciones de
restauración, testimonio, precios orientativos, minuta, horario del evento,
proveedores y detalles destacados. La versión en inglés es opcional.

### Fotos y vídeos

**Subir imagen** acepta JPG, PNG y WebP, hasta 10 MB. El servidor comprueba el
contenido real del archivo, no solo su extensión: un archivo renombrado a `.jpg` se
rechaza.

De cada imagen hay que escribir el **texto alternativo (alt)**: una frase que
describa qué se ve. Es obligatorio para publicar, y no es un trámite — es lo que
permite que una persona ciega sepa qué hay en la foto, y también lo que Google lee.

Una de las imágenes se marca como **principal**: es la que aparece en la tarjeta del
listado.

Las imágenes se pueden reordenar con las flechas. El orden es el de la galería
pública.

### Previsualizar

El enlace **Previsualizar** muestra la ficha exactamente como se verá, sin
publicarla. Se puede usar tantas veces como se quiera.

### Publicar

El botón **Publicar** solo se activa cuando no falta nada. Si está apagado, el aviso
de arriba dice qué falta: normalmente el texto alternativo de alguna imagen o la
imagen principal.

Al publicar, el reportaje aparece **inmediatamente** en su biblioteca. No hay que
esperar ni avisar a nadie.

**Despublicar** lo devuelve a borrador. **Archivar** lo retira sin borrarlo.

### Duplicar

Un reportaje se puede duplicar como borrador: útil para partir de uno parecido. La
copia comparte las mismas fotos, así que borrar una imagen de la copia no la quita
del original.

---

## 9. Informes captación

Las mismas métricas del Resumen, con **rango de fechas** y más desglose: embudo,
solicitudes por estado, por tipo de evento, por origen, y evolución.

Cada ratio muestra su denominador. Cuando no hay casos suficientes, se dice: es
mejor "no se puede calcular con 3 casos" que un 33 % que nadie debería usar para
decidir nada.

---

## 10. Puntuación Visitantes (solo ADMIN)

Los **pesos de la puntuación**: cuántos puntos vale cada cosa que hace un visitante.
Están agrupados en tres bloques —lo que cuenta en el formulario, lo que hace en las
bibliotecas y lo que pide expresamente— con la suma de cada bloque y el máximo
alcanzable al pie, que se actualizan mientras escribes.

Se edita en la propia tabla: escribe los puntos y sal del campo, o marca y desmarca la
casilla «Cuenta». Desactivar una regla la deja fuera del cálculo **sin perder su
peso**, para poder volver a activarla tal como estaba.

Cambiar un peso afecta a partir de ese momento; para recalcular una persona ya
existente está el botón **Recalcular** de su ficha.

Cada cambio queda registrado con quién lo hizo.

---

## 11. Usuarios (solo ADMIN)

Lista del equipo y **cambio de perfil**. No existe registro público.

**El alta de una persona nueva no se hace desde aquí todavía.** Esta pantalla
muestra a quien ya existe y permite cambiarle el perfil; no tiene formulario de
creación. Crear una cuenta hoy es una operación de consola:

```bash
ADMIN_BOOTSTRAP_NAME=... ADMIN_BOOTSTRAP_EMAIL=... ADMIN_BOOTSTRAP_PASSWORD=...
npm run admin:bootstrap
```

Con dos avisos que importan:

1. **Ese script crea siempre un ADMIN.** Para dar de alta a alguien de contenidos o
   de comercial, se crea la cuenta con el script y **después se le cambia el perfil
   desde esta pantalla** a CONTENT o SALES. No al revés, y no dejándolo en ADMIN
   "de momento".
2. **Hay que borrar las tres variables del entorno** en cuanto el script haya
   corrido. Una contraseña en las variables de Vercel es una contraseña compartida
   con todo el que tenga acceso a ese panel.

La contraseña inicial **se comunica por canal privado** —nunca por correo con copia
ni en un documento compartido— y la persona debe cambiarla al entrar.

**Nadie puede cambiarse su propio perfil**, ni siquiera un ADMIN: eso solo lo hace
otra persona con perfil de administración. Y **no se puede quitar el último perfil
de administración**: el sistema lo rechaza, porque quedarse sin ADMIN deja el panel
sin gestión de usuarios, sin configuración, sin exportación y sin las operaciones
de privacidad, y no hay forma de recuperarlo desde la interfaz.

Que el alta no tenga pantalla está anotado en README §Limitaciones conocidas.

---

## 12. Exportar a Excel (solo ADMIN)

En Contactos y en Solicitudes, el botón **Exportar**. Descarga lo que la vista está
mostrando: **respeta los filtros aplicados**.

El archivo se abre directamente en Excel con los acentos correctos y las cabeceras en
español.

Lo que el archivo **no** contiene, por diseño: contraseñas, tokens, identificadores
internos, ni las notas del equipo. Una hoja de cálculo se reenvía, se sube a sitios y se olvida en
carpetas compartidas; cuanto menos lleve, mejor.

Cada exportación queda registrada: quién, cuándo y con qué filtros.

---

## 13. Privacidad de un contacto (solo ADMIN)

En la ficha de cada contacto, el panel de privacidad. Existe para poder responder a
lo que la ley permite pedir:

- **Descargar sus datos** en un archivo JSON. Es la respuesta a un derecho de acceso.
- **Revocar el consentimiento de marketing.** No borra el consentimiento anterior:
  añade uno nuevo que dice que se retiró, con su fecha. El historial completo se
  conserva, que es justamente lo que prueba que se hizo bien.
- **Revocar los accesos VIP** de esa persona.
- **Anonimizar.** Borra nombre, email, teléfono, mensajes y notas, y conserva solo lo
  que sirve para estadísticas (tipo de evento, invitados, espacio, estado). Pide
  escribir la palabra `ANONIMIZAR` porque **no se puede deshacer**.

Una persona anonimizada deja de aparecer en las búsquedas y en las exportaciones.

---

## 14. Preguntas frecuentes

**He publicado un reportaje y no lo veo en la web.**
Comprueba que estás mirando la biblioteca correcta (una boda va a `/bodas-reales`) y
que has pasado el gate con un email. Si sigue sin aparecer, mira su estado en el
panel: puede que se haya quedado en borrador.

**El botón Publicar está apagado.**
Falta algo. El aviso de la parte superior dice exactamente qué: casi siempre el texto
alternativo de una imagen.

**No puedo entrar y estoy segura de la contraseña.**
Espera diez segundos: probablemente se ha alcanzado el límite de intentos. Si sigue
fallando, pide a un ADMIN que revise tu cuenta.

**¿Puedo borrar una solicitud?**
No, y es a propósito. Se puede **archivar**, que la quita de la vista sin perder el
registro. Borrar el historial de lo que un cliente pidió es perder información que
puede hacer falta después.

**¿Se envían correos automáticos?**
Solo si está configurado el proveedor de correo. Mientras no lo esté, el sitio
funciona igual y las solicitudes se guardan siempre: el correo es un aviso, no el
sitio donde vive el dato.

**¿Alguien puede ver los reportajes sin dejar su email?**
No. El contenido no se consulta hasta que hay un acceso válido: no está oculto en la
página esperando a que alguien mire el código fuente.
