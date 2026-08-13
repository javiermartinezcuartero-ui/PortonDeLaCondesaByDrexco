# Guion de la presentación TFM

Catorce diapositivas para una defensa de **20 minutos**, con margen para
preguntas. Cada una lleva su mensaje único, la evidencia que va en pantalla, el
tiempo asignado y las notas del orador.

Cómo usarlo: montar las Slides con esta estructura y **no leer las notas**. Están
escritas para ensayar y para tener a mano el dato exacto si alguien pregunta.

Dos reglas que se aplican a todas las diapositivas:

1. **Ninguna credencial en pantalla.** Ni usuario, ni contraseña, ni URL con
   token, ni una terminal con un `.env` abierto detrás.
2. **Un mensaje por diapositiva.** Si hacen falta dos frases para decir de qué va
   una, es que son dos.

Tiempo total: **19 minutos**, dejando un minuto de colchón.

---

## Reparto del tiempo

| Bloque | Diapositivas | Minutos |
|---|---|---|
| Planteamiento | 1–3 | 3 |
| Producto | 4–7 | 6 |
| Ingeniería | 8–10 | 4,5 |
| Método y prueba | 11–12 | 2,5 |
| Cierre | 13–14 | 3 |

El bloque de producto es el más largo a propósito: es lo que demuestra que existe
algo que funciona. La arquitectura interesa al tribunal, pero solo después de
haber visto que la aplicación hace lo que dice.

---

## 1. Portada

**Mensaje:** qué es esto y quién lo firma.

**En pantalla:** título del proyecto, nombre y apellidos, titulación, fecha,
logotipo de El Portón de la Condesa y, abajo, tres enlaces cortos o un QR:
aplicación, repositorio, README.

**Tiempo:** 0:30

**Notas del orador:**
- Una frase: «una finca de celebraciones en Molina de Segura, y el sistema con el
  que capta y gestiona sus clientes».
- Si los enlaces son QR, comprobar antes que se leen desde la última fila. Un QR
  de 2 cm no se lee.
- No empezar disculpándose por nada.

---

## 2. Problema y oportunidad

**Mensaje:** la finca genera interés y lo pierde por el camino.

**En pantalla:** el recorrido del cliente antes del proyecto, con el punto de
fuga marcado:

```
Instagram / Bodas.net → web → formulario → correo → ¿?
                                                     └── sin registro
                                                         sin seguimiento
                                                         sin saber qué funciona
```

**Tiempo:** 1:15

**Notas del orador:**
- Tres carencias concretas, no genéricas: el formulario original enviaba a un
  servicio de terceros (Web3Forms) y **no quedaba nada** en ningún sistema
  propio; nadie sabía qué contenido genera consultas; no había forma de saber si
  una solicitud se había contestado.
- La oportunidad: el contenido que más convence —bodas ya celebradas— era justo
  el que se regalaba sin pedir nada a cambio.
- No decir «no tenían CRM». Decir qué les pasaba por no tenerlo.

---

## 3. Objetivos y alcance

**Mensaje:** qué se propuso construir, y qué se decidió no construir.

**En pantalla:** dos columnas. Objetivos a la izquierda, fuera de alcance a la
derecha, con la misma tipografía y el mismo peso.

| Objetivos | Fuera de alcance |
|---|---|
| Captar con contrapartida (gate de correo) | Facturación y contratos |
| CMS propio para el equipo | Reserva y pago en línea |
| CRM con pipeline y seguimiento | App móvil nativa |
| Privacidad y seguridad desde el diseño | Multi-finca / multi-tenant |

**Tiempo:** 1:15

**Notas del orador:**
- El «fuera de alcance» es tan importante como el resto: un proyecto que no dice
  dónde para es un proyecto sin terminar.
- Detalle completo en README §Alcance y fuera de alcance.
- Si preguntan por la reserva en línea: la finca trabaja con visita previa y
  presupuesto a medida; un carrito de la compra no encaja con cómo vende.

---

## 4. Experiencia pública

**Mensaje:** la web conserva el diseño de marca y ahora tiene un backend detrás.

**En pantalla:** captura de la home a pantalla completa. Si se puede, la misma
vista en móvil al lado.

**Tiempo:** 1:15

**Notas del orador:**
- Se partió de una plantilla Next.js y se adaptó a la marca real: tipografías,
  color, fotografía y textos del negocio.
- Tres decisiones que se ven poco y valen la pena mencionar: las tipografías se
  sirven desde el propio dominio, así que **el navegador del visitante no le pide
  nada a Google** y su IP no viaja a un tercero; no hay ninguna petición a
  terceros en la home; las imágenes se optimizan en servidor.
- Bilingüe en navegación, home, contacto y legal. Las fichas VIP, no —dicho en
  README §Limitaciones conocidas, no se esconde.

---

## 5. Gate y flujo de captación

**Mensaje:** el contenido que más convence se entrega a cambio de un correo, y la
protección es real.

**En pantalla:** dos capturas una al lado de la otra, con el mismo pie que se va
a decir en voz alta:

```
┌────────────────────────┐  ┌────────────────────────┐
│  /bodas-reales         │  │  Ver el código fuente  │
│  sin acceso            │  │  de esa misma página   │
│                        │  │                        │
│  [ formulario ]        │  │  0 coincidencias con   │
│                        │  │  el contenido          │
└────────────────────────┘  └────────────────────────┘
```

**Tiempo:** 1:45

**Notas del orador:**
- **Esta es la diapositiva técnica más importante de la presentación.** El
  contenido protegido no está oculto con CSS ni difuminado: no se ha consultado.
  Sin sesión de acceso válida, la base de datos no se toca.
- La diferencia importa: un gate de CSS se salta con la tecla F12. Este no,
  porque no hay nada que revelar.
- Cómo se comprueba en un segundo: `curl` de la página y buscar una palabra de
  una ficha. Cero. Está en `docs/evidencias-tfm.md` §3.
- Hay una prueba automática que espía la capa de datos y comprueba que **no se la
  llama**: `components/vip/access-boundary.test.tsx`.
- Privacidad obligatoria y marketing separado y opcional. Cada consentimiento
  queda como evento inmutable con la versión de la política que se aceptó.

---

## 6. CMS

**Mensaje:** el equipo publica sin tocar código, y no puede publicar algo roto.

**En pantalla:** el editor con el panel de media, y al lado el aviso de
publicación incompleta diciendo exactamente qué falta.

**Tiempo:** 1:30

**Notas del orador:**
- Toda ficha nace borrador. Publicar exige título, slug, texto en español, imagen
  principal y **texto alternativo** en todas las imágenes. La interfaz dice qué
  falta; no se limita a rechazar.
- El texto alternativo obligatorio no es burocracia: sin él la ficha es
  inaccesible para quien usa lector de pantalla, y el equipo no volvería a
  añadirlo nunca.
- Las imágenes van a un bucket **privado**, se validan por la firma real de los
  bytes —un `.exe` renombrado a `.png` se rechaza— y las URL son firmadas y
  temporales.
- No hay botón de «eliminar» para una ficha publicada. Se despublica o se
  archiva; el rastro se conserva.
- Dos personas editando la misma ficha: la segunda recibe un aviso, no pisa el
  trabajo de la primera.

---

## 7. CRM

**Mensaje:** de un correo perdido a un pipeline con responsable, tarea y fecha.

**En pantalla:** el tablero del pipeline con datos de demostración. Si el
proyector es pequeño, mejor la vista de tabla: se lee.

**Tiempo:** 1:30

**Notas del orador:**
- Recorrido: solicitud entra → puntúa sola → se asigna → tarea con fecha →
  transición de estado → queda en el historial.
- **Sin arrastrar y soltar, por decisión.** Cada tarjeta ofrece un desplegable
  con solo las transiciones válidas: funciona con teclado y con lector de
  pantalla sin trabajo extra, y el servidor revalida la transición de todos
  modos. Si preguntan, es una decisión razonada, no una carencia:
  `docs/crm.md` §6.
- La puntuación se **recalcula** desde el historial, nunca se acumula: el mismo
  hito no puede sumar dos veces.
- Informes con una regla que conviene decir en voz alta: **un ratio sin
  denominador devuelve «sin datos», no 0 %.** Un 0 % afirma que nadie convierte,
  que es distinto de no tener datos todavía.
- Exportación CSV solo para ADMIN, y es un permiso distinto de consultar el CRM.
  Neutraliza fórmulas para que un texto escrito en el formulario público no se
  ejecute al abrir el archivo en Excel.

---

## 8. Arquitectura

**Mensaje:** un solo proyecto full-stack, con las capas separadas de verdad.

**En pantalla:** el diagrama de componentes del README (§Arquitectura), sin
adornos.

```
Navegador
    │
    ▼
Next.js 16 App Router ── middleware (solo redirige)
    │
    ├── Rutas públicas ─── gate VIP ── sesión en servidor (cookie HttpOnly)
    ├── /admin ─────────── Better Auth ── roles ADMIN / SALES / CONTENT
    └── /api ───────────── validación Zod compartida
    │
    ▼
lib/domain  (toda la lógica de negocio y las transacciones)
    │
    ▼
Prisma ──► PostgreSQL (Supabase)      Supabase Storage (bucket privado)
```

**Tiempo:** 1:30

**Notas del orador:**
- Un único proyecto Next.js, no un backend aparte: menos superficie, un solo
  despliegue, tipos compartidos entre cliente y servidor.
- La interfaz **nunca** habla con Prisma. Pasa por validación y por dominio.
- El middleware solo redirige según exista o no la cookie. **No autoriza.** La
  autorización real se comprueba en cada página, Server Action y endpoint, contra
  la base de datos. Un middleware que autoriza es un único punto que, si se
  equivoca, lo abre todo.
- Acceso sin permiso: **404, no 403.** Un 403 confirma que el apartado existe.

---

## 9. Modelo de datos

**Mensaje:** 25 tablas, y tres decisiones que explican el resto.

**En pantalla:** el diagrama ER simplificado, con `Lead → LeadRequest`,
`ConsentEvent`, `ContentEntry` y `VipAccessSession` destacados. El ER completo
está en `docs/modelo-datos.md`; aquí solo el núcleo.

**Tiempo:** 1:30

**Notas del orador:**

Las tres decisiones, que es lo único que hay que recordar de esta diapositiva:

1. **`Lead` separado de `LeadRequest`.** Una persona, varias solicitudes. Nunca
   se sobrescribe una anterior: quien pregunta por su boda y dos años después por
   una comunión es la misma persona con dos peticiones distintas, y las dos
   cuentan.
2. **Los consentimientos son eventos inmutables**, no una casilla. Revocar es un
   evento nuevo, nunca un `UPDATE`. Solo así se puede demostrar **qué** se
   consintió, **cuándo** y **sobre qué versión** de la política.
3. **La sesión de acceso VIP vive en la base de datos**, y la cookie lleva solo un
   token. En la base solo su HMAC. Ni el correo ni el identificador salen del
   servidor.

Si preguntan por qué no se guarda la IP: no se usa para nada, así que no se
guarda. El limitador funciona con un HMAC irreversible del identificador.

---

## 10. Seguridad y privacidad

**Mensaje:** no es un capítulo del final; condicionó el diseño.

**En pantalla:** cuatro o cinco puntos, grandes. Nada de una lista de veinte.

**Tiempo:** 1:30

**Notas del orador:**
- Autorización en servidor en **cada** lectura y mutación privada. Hay pruebas
  que invocan cada mutación con la sesión equivocada y comprueban que **la base
  de datos no cambia**.
- Nunca se guarda una IP en claro, ni un token en claro. HMAC con rotación de
  clave.
- Anonimización **completa**: cuando se encontró que solo vaciaba las columnas
  del contacto y dejaba a la persona identificable en el texto libre de sus
  solicitudes y en las notas del equipo, se corrigió. Anonimizar a medias es no
  anonimizar.
- Derechos RGPD operativos: copia de los datos de una persona, revocación de
  marketing, revocación de accesos. Todo auditado.
- Retención configurable que **solo identifica** candidatos. Nada se anonimiza
  solo: es irreversible y no puede depender de una tarea programada mal
  configurada.
- **Lo que falta, dicho antes de que lo pregunten:** la CSP se sirve en modo
  informe y no en bloqueo; no hay segundo factor; el gate no verifica que el
  correo sea de quien lo escribe; y el plazo de retención concreto y la base
  jurídica los tiene que fijar un profesional — el proyecto **no se los
  inventa**. Riesgos aceptados en `docs/modelo-amenazas.md` §7.

---

## 11. Uso de IA y metodología

**Mensaje:** el asistente escribió código; las decisiones y la verificación son
mías.

**En pantalla:** el ciclo de trabajo por fases, y el contrato de reglas.

```
prompt de fase → inspección del código → implementación
      ▲                                        │
      │                                        ▼
   revisión ◄── lint · typecheck · tests · build
```

**Tiempo:** 1:15

**Notas del orador:**
- Once fases, cada una con su enunciado, su validación con comandos reales y su
  entrada en el historial del README. Nada se marca como terminado sin haberse
  probado.
- `CLAUDE.md` fija las reglas: fuente de verdad en el código, sin inventar datos
  de negocio, sin ocultar errores con `any` o `ignoreBuildErrors`, sin commits ni
  despliegues sin petición explícita, documentación obligatoria por fase.
- El dato honesto, y el que mejor responde a «¿esto lo has hecho tú?»: **las
  pruebas encontraron defectos reales** que ni el asistente ni yo habíamos visto
  leyendo el código. Uno de ellos impedía enviar el formulario desde el botón de
  una ficha. Están enumerados en `docs/evidencias-tfm.md` §5.
- Si preguntan por el reparto: el asistente acelera la escritura; el criterio de
  qué construir, qué rechazar y qué dar por bueno no se delega.

---

## 12. Pruebas

**Mensaje:** los números, y para qué han servido.

**En pantalla:** la tabla, con la última fila destacada.

| | |
|---|---|
| Unitarias y de integración | **698** en 58 archivos |
| End-to-end (Playwright) | **23**, los 13 escenarios críticos |
| Lint · typecheck · build | 0 errores, 0 advertencias |
| **Defectos reales encontrados** | **5 de producto + 2 de aislamiento** |

**Tiempo:** 1:15

**Notas del orador:**
- Las E2E corren contra el **build de producción** y contra una base PostgreSQL
  aislada en Docker, con una guardia que aborta si la URL apunta a la base de la
  aplicación. Esa guardia tiene sus propias 13 pruebas.
- La lista de defectos es la evidencia de que la suite sirve. Contar el más
  vistoso: el botón «Quiero una boda así» precargaba el asunto pero no el tipo de
  evento, y el primer envío se rechazaba. Causa: un componente de la librería de
  interfaz escribía una cadena vacía sobre el valor precargado. Ninguna prueba
  anterior lo vio porque todas volvían a elegir el tipo a mano.
- Si preguntan por cobertura: no se ha medido porcentaje a propósito. Un
  porcentaje alto no dice nada sobre si las pruebas comprueban lo que importa; la
  lista de defectos encontrados, sí.

---

## 13. Demostración

**Mensaje:** funciona; vamos a verlo.

**En pantalla:** nada. Se cambia a la aplicación.

**Tiempo:** 2:00 (recorrido corto; el largo va en el vídeo)

**Notas del orador:**

Recorrido mínimo, en este orden, sin improvisar:

1. `/bodas-reales` sin acceso → se ve el gate.
2. Correo + privacidad → se abre. Mencionar que **las dos bibliotecas** quedan
   desbloqueadas con un solo acceso.
3. Abrir una ficha. «Quiero una boda así» → el formulario llega con el tipo de
   evento puesto.
4. Enviar.
5. Entrar al panel **con la sesión ya iniciada de antes** y mostrar la solicitud
   que acaba de entrar, con su origen y su ficha.

Precauciones, aprendidas de que siempre falla algo:
- Iniciar sesión en el panel **antes** de empezar, en otra pestaña. Teclear una
  contraseña en directo es lento y se ve.
- Datos de demostración ya sembrados y comprobados el mismo día.
- Capturas de respaldo de los cinco pasos, por si falla la red. Si falla, se
  pasa a las capturas sin dramatizar y se sigue.
- No enseñar la terminal. No abrir el `.env`. No abrir el gestor de contraseñas.
- Guion detallado y plan B: `docs/runbook-demo.md` §3.

---

## 14. Conclusiones y roadmap

**Mensaje:** qué se consiguió, qué falta y qué viene después.

**En pantalla:** tres columnas cortas.

| Conseguido | Falta | Siguiente |
|---|---|---|
| Web + CMS + CRM en producción-listo | Revisión jurídica de los textos | CSP en bloqueo y 2FA |
| Captación con contrapartida | Métricas de Lighthouse | Verificación del correo del gate |
| Seguridad y privacidad verificadas | E2E en integración continua | Entrega garantizada de correo |

**Tiempo:** 1:00

**Notas del orador:**
- Cerrar con el resultado, no con la lista de tareas: la finca pasa de perder las
  consultas a tener cada una registrada, puntuada y con responsable.
- Decir con naturalidad lo que falta. Un tribunal confía más en quien enumera sus
  pendientes que en quien afirma que todo está terminado.
- Última frase preparada y **corta**. Después, callarse y esperar preguntas.

---

## Preguntas probables

Cinco que conviene tener contestadas, con la respuesta ya pensada.

**«¿Por qué no has usado un CRM comercial?»**
Se valoró. Un HubSpot o un Pipedrive resuelven el pipeline pero no el gate de
contenido, que es la pieza que capta: exigiría un desarrollo propio de todas
formas, más una integración, más una cuota mensual. Y los datos de los contactos
acabarían en un tercero, lo que complica el cumplimiento en lugar de
simplificarlo.

**«¿Esto está desplegado?»**
`[Ajustar según el estado real el día de la defensa.]` Si no lo está: el
procedimiento completo está verificado contra la configuración real del
repositorio, y lo único que falta son nueve variables de entorno que el proyecto
no puede inventarse. `docs/despliegue-vercel.md`.

**«¿Cuánto ha escrito la IA?»**
La mayor parte del código. Y las decisiones de arquitectura, los rechazos —el
arrastrar y soltar, el CAPTCHA, Prisma 7— y la verificación, no. La prueba está
en el historial del README: cada fase con su validación y sus defectos
encontrados.

**«¿Cómo sabes que el gate no se puede saltar?»**
Porque no hay nada que saltar: sin sesión válida el contenido no se consulta.
Comprobable con un `curl` en un segundo, y hay una prueba que espía la capa de
datos para verificar que no se la llama.

**«¿Y el RGPD?»**
Consentimientos separados e inmutables con versión de la política, minimización
—no se guardan IP ni user-agent—, anonimización completa, derechos operativos y
retención configurable. Lo que **no** hace el proyecto es fijar el plazo de
retención ni la base jurídica: eso lo tiene que validar un profesional, y donde
falta hay un aviso explícito en lugar de una cifra inventada.

---

## Antes de la defensa

- [ ] Slides con permiso «cualquier persona con el enlace puede ver», comprobado
      en incógnito.
- [ ] Enlaces y QR probados desde un móvil ajeno.
- [ ] Sesión del panel iniciada en otra pestaña.
- [ ] Datos de demostración sembrados y comprobados **el mismo día**.
- [ ] Capturas de respaldo de los cinco pasos de la demostración.
- [ ] Notificaciones del sistema silenciadas.
- [ ] Ninguna credencial visible en ninguna diapositiva ni en ninguna pestaña
      abierta.
- [ ] Ensayo completo con cronómetro. Si pasa de 20 minutos, se recorta contenido,
      no se habla más rápido.
