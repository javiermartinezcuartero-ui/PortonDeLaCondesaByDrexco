# Guion del vídeo de demostración (OBS)

Grabación de **8 minutos** que recorre el sistema completo: del visitante anónimo
al equipo comercial gestionando la solicitud que ese visitante acaba de enviar.

Se graba con OBS Studio y se sube a Google Drive con visualización mediante
enlace. La URL va en `docs/checklist-entrega-tfm.md` y en el formulario de
entrega.

---

## 1. Preparación de la escena

### Pantalla

| Ajuste | Valor | Por qué |
|---|---|---|
| Resolución de captura | 1920 × 1080 | Es lo que se reproduce sin reescalar. Un 2560 de ancho reducido a 1080p deja el texto ilegible |
| Escala de la interfaz de Windows | 100 % | Con 125 % o 150 % el navegador captura menos página |
| Zoom del navegador | 100 %, o 110 % si el texto queda pequeño | Igual en toda la grabación: cambiarlo a media toma se nota |
| Ventana | Maximizada, **no** pantalla completa | En pantalla completa se pierde la barra de direcciones, y la URL es parte de la evidencia |
| Segundo monitor | Desconectado o fuera de la captura | Un arrastre de ratón fuera de cuadro deja al espectador perdido |

Usar **una sola ventana de navegador**, en modo incógnito, con dos pestañas
preparadas: la aplicación y el panel. Sin barra de marcadores (`Ctrl+Shift+B`).
Sin extensiones visibles.

### Fuentes de OBS

1. **Captura de ventana** del navegador (no «captura de pantalla completa»: así
   nada de fuera puede colarse).
2. **Cámara**, opcional, en un círculo pequeño en una esquina inferior. Si se
   incluye, comprobar que no tapa contenido en ningún momento del recorrido.
3. **Micrófono** con filtros: supresión de ruido y compresor. Nada más.

### Audio

- Probar 30 segundos y **escuchar la prueba** antes de grabar los 8 minutos.
  Descubrir un micrófono saturado al final es rehacerlo todo.
- Hablar a volumen normal, sin acercarse al micrófono.
- Silencio absoluto de fondo: ventana cerrada, sin ventilador, sin música.

### Antes de pulsar «grabar»

- [ ] **Notificaciones apagadas.** Windows: Asistente de concentración → Solo
      alarmas. Cerrar Slack, Teams, correo y WhatsApp Web. Una notificación con
      el nombre de otra persona es un dato personal en el vídeo, y ese vídeo se
      entrega.
- [ ] **Gestor de contraseñas cerrado.** No solo bloqueado: cerrado.
- [ ] **Sin terminal en pantalla.** El recorrido es de producto; no hace falta.
- [ ] **Sin editor de código abierto** con archivos del proyecto. Si en el bloque
      final se muestra código, se abre solo el archivo concreto y en ese momento.
- [ ] **Ningún `.env` abierto en ninguna pestaña ni pestaña de editor.**
- [ ] **Ninguna consola del navegador abierta** que pueda mostrar datos
      personales en un registro.
- [ ] Sesión del panel **ya iniciada** en la segunda pestaña, para no teclear la
      contraseña en cámara.
- [ ] Datos de demostración sembrados y comprobados hoy (`npm run demo:seed`).
- [ ] Batería conectada y actualizaciones automáticas pospuestas.

**Lo que no debe aparecer en el vídeo, en una línea:** ninguna contraseña,
ningún archivo de entorno, ningún dato personal de una persona real, ninguna URL
con token, ningún nombre de otra persona en una notificación.

---

## 2. Recorrido, minuto a minuto

Los tiempos son de referencia. Si una toma sale mal, se rehace desde el inicio
del bloque, no desde el principio del vídeo: OBS permite pausar.

### 0:00 — 0:40 · Introducción

**Pantalla:** la home cargada, quieta.

**Se dice:** qué es el proyecto en dos frases y qué se va a ver. «El Portón de la
Condesa es una finca de celebraciones en Molina de Segura. Esto es su web, y
detrás lleva un sistema propio de captación y seguimiento comercial. Voy a
recorrerlo entero: primero como visitante, después como equipo.»

**Nota:** no presentarse con el currículum. No leer el índice.

### 0:40 — 1:40 · Web pública

**Pantalla:** recorrido por la home, sin prisa. Espacios, gastronomía, y una
bajada hasta el pie.

**Se dice:** que se conserva el diseño y la marca reales, que es responsive, y
que las tipografías se sirven desde el propio dominio, así que el navegador del
visitante no le pide nada a Google.

**Nota:** mover el ratón despacio. Un desplazamiento brusco marea y obliga a
retroceder el vídeo.

### 1:40 — 2:40 · El gate

**Pantalla:** clic en «Bodas reales». Aparece el formulario de acceso.

**Se dice:** que el contenido más persuasivo se entrega a cambio de un correo, y
—esto es lo importante— que **no está oculto, no se ha consultado**.

**Evidencia en pantalla:** `Ctrl+U` para ver el código fuente, `Ctrl+F`, buscar
una palabra que solo esté en una ficha. **Cero resultados.** Dejarlo tres
segundos en pantalla.

**Se dice:** «Si esto se ocultara con CSS, aquí saldría el contenido y bastaría
con F12. No sale porque la base de datos no se ha consultado.»

**Nota:** este es **el** momento del vídeo. Ensayarlo. Tener elegida de antemano
la palabra a buscar y comprobado que da cero.

### 2:40 — 3:20 · Desbloqueo

**Pantalla:** escribir un correo ficticio con dominio `.test`, marcar privacidad,
**dejar marketing sin marcar**, enviar.

**Se dice:** que privacidad y marketing son consentimientos separados, que el de
marketing es opcional y está desmarcado de origen, y que cada uno queda
registrado como evento inmutable con la versión de la política que se aceptó.

**Nota:** el correo que se teclee debe acabar en `.test` (dominio reservado para
documentación). Nunca uno real, ni siquiera propio: aparece en pantalla.

### 3:20 — 4:20 · Consulta de un caso

**Pantalla:** la biblioteca abierta. Entrar en una ficha y recorrerla:
fotografías, decoración, minuta, cronología, proveedores, testimonio,
presupuesto.

**Se dice:** que la etiqueta «Ejemplo ilustrativo» está ahí porque estos casos
son ficticios mientras el equipo no publique reales, y que con un solo acceso
quedan desbloqueadas **las dos** bibliotecas — mostrarlo entrando en Catering sin
volver a pedir nada.

### 4:20 — 5:10 · Envío de la solicitud

**Pantalla:** botón «Quiero una boda así». El formulario llega con el tipo de
evento ya seleccionado y el asunto sugerido. Rellenar y enviar. Esperar el
mensaje de confirmación.

**Se dice:** que la solicitud se guarda con su origen —qué ficha la generó, de
qué campaña venía— y que eso es lo que después permite saber qué contenido
convierte.

**Nota:** rellenar con datos ficticios coherentes. El teléfono, de la franja
`600 00 00 00`, no uno real.

### 5:10 — 5:40 · Acceso al panel

**Pantalla:** cambiar a la pestaña del panel, **ya con sesión iniciada**.

**Se dice:** que el acceso es por correo y contraseña, con alta pública
desactivada, tres roles, y que cada página y cada operación vuelve a comprobar el
permiso en el servidor — la navegación oculta lo que el rol no puede usar, pero
eso es interfaz, no protección.

**Nota:** **no teclear la contraseña en cámara.** Si hay que mostrar el login, se
muestra la pantalla y se cambia de pestaña a la sesión ya abierta.

### 5:40 — 6:40 · CRM

**Pantalla:** la solicitud que acaba de entrar, en su listado. Abrirla: se ve el
mensaje, el origen y la ficha que la generó. Asignar responsable, crear una tarea
con fecha, mover el estado. Enseñar el historial. Pasar por el pipeline y por
Informes.

**Se dice:** que el estado no se mueve libremente —solo transiciones válidas— y
que cada movimiento queda en el historial y en la auditoría, en la misma
transacción. En Informes, señalar que donde no hay datos dice «sin datos» y no
0 %.

### 6:40 — 7:30 · CMS y publicación

**Pantalla:** Contenidos → nueva ficha. Rellenar lo mínimo, subir una imagen,
intentar publicar **sin** texto alternativo: la interfaz dice qué falta.
Añadirlo, previsualizar, publicar. Abrir la ruta pública y verla ahí.

**Se dice:** que toda ficha nace borrador, que el texto alternativo es
obligatorio porque sin él la ficha es inaccesible, y que publicar se ve al
instante en la web.

**Nota:** el «intento fallido de publicar» es deliberado y es lo mejor del
bloque. No saltárselo.

### 7:30 — 8:00 · Cierre

**Pantalla:** volver a la home.

**Se dice:** una frase de resultado —«cada consulta queda registrada, puntuada y
con responsable»— y dónde está el resto: repositorio, README y documentación.

**Nota:** no enumerar pendientes en el vídeo. Están en el README y en la
presentación.

---

## 3. Si algo falla durante la grabación

- **La aplicación tarda.** Pausar OBS, esperar, reanudar. Mejor un corte que 40
  segundos de una ruleta girando.
- **Aparece una notificación.** Cortar y rehacer el bloque. No sirve editarlo
  después: el sonido queda.
- **Un dato real aparece en pantalla.** Cortar y rehacer el bloque. Un vídeo
  entregado no se puede corregir.
- **Se equivoca la narración.** Seguir. Un titubeo es humano; rehacer el vídeo
  entero por una palabra es perder la tarde.

---

## 4. Comprobaciones antes de subir a Drive

Verlo **entero**, con sonido, antes de subirlo. Es lo único que descubre la mitad
de estos problemas.

- [ ] Duración entre 7 y 9 minutos.
- [ ] Se ve y se oye de principio a fin, sin silencios de más de 3 segundos.
- [ ] El texto se lee al 100 % de zoom en una pantalla normal.
- [ ] **Ninguna contraseña visible en ningún fotograma.**
- [ ] **Ningún archivo de entorno, ni terminal con variables, en ningún
      fotograma.**
- [ ] Ningún dato personal de una persona real: ni correo, ni teléfono, ni nombre
      en una notificación.
- [ ] Ninguna URL con token en la barra de direcciones (las URL firmadas de las
      imágenes llevan token: si alguna aparece expandida, cortar ese fragmento).
- [ ] Ninguna notificación del sistema.
- [ ] La demostración del código fuente con cero resultados se ve con claridad.
- [ ] El vídeo empieza directamente: sin 10 segundos de escritorio al principio.
- [ ] Archivo en MP4, H.264. Nada de MKV: Drive lo reproduce peor.
- [ ] Tamaño razonable (por debajo de 500 MB para 8 minutos a 1080p).

### Al subirlo

- [ ] Nombre descriptivo: `TFM-ElPortonDeLaCondesa-demostracion.mp4`.
- [ ] Compartir → **«Cualquier persona con el enlace» · Lector**.
- [ ] **Comprobarlo en una ventana de incógnito**: debe reproducirse sin pedir
      cuenta de Google. Es el error de entrega más frecuente: en la ventana del
      autor funciona siempre, porque tiene sesión.
- [ ] Copiar la URL en `docs/checklist-entrega-tfm.md` con la fecha de la prueba
      en incógnito.
- [ ] Guardar el archivo original en local. Si Drive falla el día de la entrega,
      es lo único que queda.

---

## 5. Ajustes de OBS

Para quien no lo tenga configurado. Ajustes → Salida → modo Avanzado.

| Ajuste | Valor |
|---|---|
| Codificador | Hardware (NVENC o AMF) si existe; si no, x264 |
| Control de tasa | CBR |
| Tasa de bits | 8000 Kbps |
| Intervalo de fotogramas clave | 2 s |
| Preajuste | Calidad |
| Perfil | high |
| Vídeo → Resolución base y de salida | 1920 × 1080 las dos |
| Vídeo → FPS | 30 |
| Salida → Grabación → Formato | MP4 |
| Audio → Frecuencia de muestreo | 48 kHz |
| Audio → Canales | Estéreo |

60 FPS no aportan nada aquí y duplican el tamaño: no hay movimiento rápido en
pantalla.
