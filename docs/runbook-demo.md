# Runbook de la demo

Cómo preparar, enseñar y retirar la demostración del proyecto. Pensado para
ejecutarse tal cual, de arriba abajo.

---

## 1. Qué siembra la demo

`npm run demo:seed` deja el proyecto presentable. Sin ella el panel se ve correcto
pero vacío, y un CRM vacío no demuestra nada.

| Pieza | Cantidad | Detalle |
|---|---|---|
| Fichas VIP publicadas | 6 | 3 bodas reales + 3 eventos de catering, todas `isDemo = true` |
| Usuarios del equipo | 3 | ADMIN, SALES y CONTENT, **sin contraseña**: no pueden iniciar sesión |
| Cuenta de evaluación | 1 | ADMIN con contraseña. Es la única que entra al panel |
| Contactos | 8 | Con teléfono, tipo de evento, invitados, fecha y atribución |
| Solicitudes | 8 | Repartidas por **todas** las fases: Contacto, Presentación, Propuesta, Cliente y Perdida con su motivo |
| Tareas | 4 | Una vencida, una de hoy, dos futuras; prioridades distintas |
| Notas internas | 4 | Con autor y fecha |
| Consentimientos | 8+ | Privacidad en todas; marketing solo donde se concedió |
| Actividades y auditoría | ~40 cada una | Generadas por el propio recorrido, no escritas a mano |

Los estados del pipeline se alcanzan **moviendo cada solicitud por las transiciones
reales** del dominio, no escribiendo el estado final. Por eso el historial y la
auditoría de la demo son exactamente los que produciría el uso normal: si un
evaluador abre el historial de una solicitud ganada, ve los seis movimientos que la
llevaron ahí, cada uno con su autor.

### Datos ficticios, y comprobable

Todos los emails de la demo terminan en **`@demo.portondelacondesa.test`**. `.test`
es un TLD reservado por la RFC 2606: no resuelve y nunca resolverá. Ninguna
dirección de la demo puede recibir un correo por error, ni siquiera si alguien
activase el proveedor de correo por accidente.

Ese dominio es además la marca que usa `demo:clean` para saber qué borrar, así que
un contacto real nunca puede confundirse con uno de demostración.

---

## 2. Preparar la demo

Sobre una base ya migrada (`npx prisma migrate deploy`).

```bash
# 1. Configuración operativa. Sin esto, todos los contactos puntúan 0.
npm run db:seed

# 2. Cuenta de evaluación: se declara por entorno, nunca en el código.
#    Genera una contraseña larga y guárdala donde vaya a entregarse.
node -e "console.log(require('crypto').randomBytes(12).toString('base64url'))"

export DEMO_ADMIN_EMAIL="evaluacion@dominio-de-la-entrega"
export DEMO_ADMIN_PASSWORD="…"      # 12 caracteres mínimo

# 3. Sembrar
npm run demo:seed

# 4. Retirar la contraseña del entorno
unset DEMO_ADMIN_PASSWORD
```

El script **no imprime nunca la contraseña**. Solo confirma el email y el rol.

**Es idempotente.** Se puede ejecutar tantas veces como haga falta: cada pieza
comprueba si ya existe antes de crearla. En particular, no le cambia la contraseña a
una cuenta de evaluación que ya exista, para no dejar fuera a quien esté en medio de
una revisión.

### Entrega de la contraseña

Por **canal privado** y solo eso: mensaje directo, gestor de contraseñas compartido,
o en persona. Nunca en el repositorio, en un documento entregable, en un correo con
copia, ni en el propio texto del TFM.

Si en Vercel se han puesto `DEMO_ADMIN_EMAIL` y `DEMO_ADMIN_PASSWORD` como variables
de entorno para poder ejecutar el sembrado, **borrarlas después**. Una contraseña
guardada de forma permanente en la configuración de la plataforma es una contraseña
filtrada a plazo.

---

## 3. Guion de la demostración

Un recorrido de unos diez minutos que toca todo lo que el proyecto hace. El orden
importa: cada paso deja preparado el siguiente.

### Parte pública (sin sesión)

1. **Home.** Diseño, secciones, formulario. Cambiar el idioma a inglés y volver.
2. **`/bodas-reales`.** Aparece el gate. Aquí conviene abrir el código fuente de la
   página (Ctrl+U) y buscar el título de una ficha: **no está**. El contenido no se
   ha consultado, no es que esté oculto con CSS.
3. **Enviar el gate sin marcar la privacidad.** Se rechaza con su mensaje y el email
   escrito no se pierde.
4. **Marcar la privacidad y acceder.** Aparecen las tres bodas. Ir a `/catering`:
   también está desbloqueado, sin volver a pedir nada.
5. **Abrir una ficha.** Galería, minuta, timeline, proveedores, testimonio.
6. **Pulsar "Quiero una boda así".** Lleva al formulario con el tipo de evento y el
   asunto ya rellenos. Completar y enviar.

### Parte privada (cuenta de evaluación)

7. **Entrar por el engranaje** de la cabecera, arriba a la derecha. Es el único
   acceso al panel; no hay enlace en el pie ni en el menú.
8. **Resumen.** Métricas reales calculadas sobre los datos sembrados.
9. **Solicitudes.** Ahí está la solicitud que se acaba de enviar, como `Nueva`, con
   "desde una ficha" en su origen. Abrirla: mensaje, contacto, atribución completa y
   enlace a la ficha de la que vino.
10. **Moverla a Contactada** y mostrar que el historial registra el movimiento con su
    autor. Intentar moverla a `Perdida` sin motivo: el servidor lo rechaza.
11. **Contacto (360º).** Puntuación, historial completo, interacciones con las
    fichas, consentimientos con su versión de política, notas y tareas.
12. **Pipeline.** El tablero con las ocho solicitudes repartidas. Enseñar también la
    vista de tabla accesible.
13. **Tareas.** Vistas "Mías", "Vencidas", "Hoy". Completar una.
14. **Contenidos.** Crear un borrador, subir una imagen, previsualizar y publicar.
    Abrir la ruta pública en otra pestaña: ya aparece.
15. **Informes** y **Configuración** (los pesos del scoring, editables solo por
    ADMIN).
16. **Exportar a Excel** desde Captaciones y abrirlo: cabeceras en español en negrita,
    acentos correctos en Excel.

### Lo que conviene enseñar aunque no se pida

17. **La autorización de verdad.** Con la cuenta de evaluación abierta, escribir a
    mano `/admin/usuarios`: entra, porque es ADMIN. La demostración interesante es la
    contraria, y para eso está la suite E2E: `npm run e2e` incluye tres escenarios
    que comprueban que SALES no entra en Contenidos ni exporta, y que CONTENT recibe
    404 en todas las rutas con datos personales.
18. **`/api/health`.** Devuelve `{"status":"ok"}` y nada más: ni versiones, ni
    configuración, ni excepciones.
19. **Los derechos RGPD operativos.** En la ficha de un contacto, el panel de
    privacidad: exportar sus datos en JSON, revocar marketing, revocar accesos VIP y
    anonimizar (pide escribir `ANONIMIZAR`, porque es irreversible).

---

## 4. Si algo va mal durante la demostración

| Síntoma | Causa más probable | Qué hacer |
|---|---|---|
| Todo falla menos la home | Proyecto de Supabase pausado (plan gratuito) | `docs/despliegue-vercel.md` §13. Tarda un minuto |
| Las fichas se ven sin imágenes | URL firmadas fallando: Storage mal configurado o bucket público | Revisar `SUPABASE_SECRET_KEY` y que el bucket sea privado |
| Las bibliotecas están vacías con acceso concedido | Falta `ENABLE_DEMO_CONTENT=true` | Añadirla y redesplegar |
| "Email o contraseña incorrectos" con la contraseña buena | Se han hecho más de 3 intentos en 10 segundos | Esperar 10 segundos |
| El login rechaza sin decir nada | `BETTER_AUTH_URL` no coincide con el dominio real | `docs/despliegue-vercel.md` §10 |
| Todos los contactos con 0 puntos | Falta `npm run db:seed` | Ejecutarlo; recalcular desde la ficha del contacto |

**Antes de empezar**, dos minutos de comprobación evitan casi todos estos casos:

```bash
curl -s https://TU-DOMINIO/api/health          # {"status":"ok"}
curl -s -o /dev/null -w "%{http_code}\n" https://TU-DOMINIO/bodas-reales   # 200
```

Y entrar al panel con la cuenta de evaluación. Si el proyecto estaba pausado, esto lo
despierta con tiempo de sobra.

---

## 5. Retirar la demo

Dos niveles, según lo que se quiera.

### a) Ocultar las fichas de ejemplo sin borrar nada

Retirar `ENABLE_DEMO_CONTENT` del entorno y redesplegar. Las fichas siguen en la base
y vuelven a aparecer si se reactiva. Procedimiento completo en
`docs/despliegue-vercel.md` §14, incluido el orden sensato: publicar primero
contenido real, comprobarlo, y luego retirar la variable.

### b) Borrar los datos de demostración

```bash
# Primero en seco: dice qué borraría, sin tocar nada
npm run demo:clean -- --seco --cuenta

# Y de verdad
npm run demo:clean -- --cuenta
```

Qué hace:

- Borra los **contactos** cuyo email está en el dominio de la demo, con su historial
  completo por cascada: solicitudes, consentimientos, actividades, notas,
  interacciones, tareas, sesiones VIP y registro de avisos.
- Borra las **fichas** con `isDemo = true`. Si alguna tenía imágenes subidas al
  bucket (porque se editó desde el panel durante la demostración), **borra primero
  esos objetos de Supabase Storage** y aborta si no puede: es preferible dejar la
  ficha a dejar archivos huérfanos que nadie sabrá que están ahí.
- Borra los **usuarios** del equipo de demostración.
- Con `--cuenta`, **desactiva la cuenta de evaluación**: le revoca las sesiones y le
  retira las credenciales, de modo que no puede volver a entrar.

**No borra nada que no sea de la demo.** El criterio es el dominio del email y la
marca `isDemo`; un contacto real no puede cumplir ninguno de los dos.

### Por qué la cuenta de evaluación se desactiva y no se borra

Porque `AuditEvent.actorId` apunta a ella: fue quien movió las solicitudes durante la
demostración. Borrar el usuario dejaría ese registro sin autor, y un registro de
auditoría del que no se sabe quién hizo qué no sirve para nada. Sin credenciales, la
cuenta no puede entrar; con el usuario intacto, la auditoría sigue siendo legible.

Si de todas formas hay que borrarla del todo (por ejemplo porque el email es de una
persona real que ha pedido que se borre), se hace a mano y a conciencia, sabiendo que
la auditoría pierde el autor.

### Comprobación final

```bash
npm run demo:clean -- --seco     # debe decir 0 contactos y 0 fichas
```

Y en el panel: Contactos y Solicitudes vacíos, Contenidos sin fichas de ejemplo, y el
login rechazando la cuenta de evaluación.
