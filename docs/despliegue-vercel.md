# Despliegue en Vercel

Procedimiento completo para poner el proyecto en producción, y para deshacerlo si
algo sale mal.

> **Estado: el proyecto no está desplegado.** Este documento describe el
> procedimiento verificado sobre la configuración real del repositorio, no un
> despliegue ya hecho. Los pasos que aún no se han ejecutado contra Vercel están
> marcados como **[pendiente de ejecutar]**.

---

## 1. Requisitos

| Requisito | Detalle |
|---|---|
| Cuenta de Vercel | Plan Hobby basta para la demo. El proyecto no usa funciones de pago. |
| Proyecto de Supabase | PostgreSQL + Storage. El plan gratuito sirve, con la advertencia del §12. |
| Repositorio en GitHub | Vercel despliega desde la rama por defecto. |
| Node 22 o superior | Declarado en `package.json` (`engines.node`), que es lo que Vercel lee. |
| Bucket `vip-content` | Privado. Se crea con `npm run storage:bootstrap`. |
| Dominio (opcional) | Sin dominio propio, Vercel asigna uno `*.vercel.app`. **En este proyecto** se usa `elportondelacondesa.solucionesbonicas.com`, un subdominio del sitio de servicios del autor: no es el dominio del negocio, que sigue sirviendo su WordPress. Consecuencia de indexación en README §Limitaciones conocidas. |

**Lo que NO hace falta:** ningún servicio de correo. Sin `SENDGRID_API_KEY` el sitio
funciona igual, las solicitudes se guardan y cada intento de envío queda como
`SKIPPED_CONFIG` en `NotificationLog`.

---

## 2. Enlace del proyecto

**[pendiente de ejecutar]**

Desde la interfaz de Vercel:

1. `Add New → Project` e importar el repositorio de GitHub.
2. Framework: **Next.js** (se detecta solo).
3. Root Directory: la raíz del repositorio.
4. Build Command, Output Directory e Install Command: **dejar los valores por
   defecto**. El proyecto no necesita ninguna personalización, y `next build` ya
   está en `package.json`.
5. **No desplegar todavía**: primero las variables de entorno (§3). Un primer
   despliegue sin `DATABASE_URL` falla y solo genera ruido.

Alternativa por consola, si se prefiere:

```bash
npx vercel link          # asocia la carpeta local al proyecto
npx vercel env pull      # trae las variables a .env.local para depurar
```

`vercel env pull` escribe un archivo con **secretos reales**: está cubierto por
`.gitignore` (`.env*`), pero conviene borrarlo al terminar.

---

## 3. Variables de entorno por entorno

Vercel distingue tres entornos: **Development**, **Preview** y **Production**. Aquí
solo se listan los nombres: **ningún valor de este documento, ni de ningún otro
archivo del repositorio, es real.** Los valores se copian de Supabase y se generan
con los comandos indicados.

Leyenda: ● obligatoria · ○ opcional · — no ponerla.

| Variable | Prod | Preview | Dev | Notas |
|---|:--:|:--:|:--:|---|
| `DATABASE_URL` | ● | ● | ● | Pooler en modo **Transaction** (§4) |
| `DIRECT_URL` | ● | ● | ● | Pooler en modo **Session** (§5) |
| `SUPABASE_URL` | ● | ● | ● | URL del proyecto de Supabase |
| `SUPABASE_SECRET_KEY` | ● | ● | ● | Clave privilegiada (`sb_secret_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | ○ | ○ | ○ | Alternativa legacy a la anterior |
| `SUPABASE_PUBLISHABLE_KEY` | ○ | ○ | ○ | No se usa hoy; reservada |
| `SUPABASE_ANON_KEY` | ○ | ○ | ○ | Ídem, formato legacy |
| `BETTER_AUTH_SECRET` | ● | ● | ● | 32 bytes aleatorios, **distinto por entorno** |
| `BETTER_AUTH_URL` | ● | ● | ● | Origen real de cada entorno (§10) |
| `NEXT_PUBLIC_SITE_URL` | ● | ● | ● | Misma URL. Única variable pública |
| `RATE_LIMIT_HASH_SECRET` | ● | ● | ● | 32 bytes aleatorios |
| `VIP_TOKEN_HASH_SECRET` | ● | ● | ● | 32 bytes aleatorios. Rotarlo invalida los accesos VIP |
| `RATE_LIMIT_HASH_SECRET_PREVIOUS` | ○ | ○ | ○ | Solo durante una rotación |
| `VIP_TOKEN_HASH_SECRET_PREVIOUS` | ○ | ○ | ○ | Ídem |
| `ENABLE_DEMO_CONTENT` | ○ | ○ | ○ | `true` **solo** mientras haya demo (§13) |
| `CSP_ENFORCE` | ○ | ○ | ○ | Sin ella la CSP va en Report-Only |
| `DATA_RETENTION_MONTHS` | ○ | ○ | ○ | 36 por defecto |
| `SENDGRID_API_KEY` | ○ | — | — | Solo si se activa el correo |
| `LEADS_FROM_EMAIL` | ○ | — | — | Remitente verificado en SendGrid |
| `LEADS_NOTIFICATION_TO` | ○ | — | — | Destinatarios internos, separados por comas |
| `SEND_LEAD_ACKNOWLEDGEMENT` | ○ | — | — | Solo el valor exacto `true` activa el acuse |
| `ADMIN_BOOTSTRAP_NAME` | ◐ | — | — | Temporal, solo para §9 |
| `ADMIN_BOOTSTRAP_EMAIL` | ◐ | — | — | Ídem |
| `ADMIN_BOOTSTRAP_PASSWORD` | ◐ | — | — | Ídem. **Retirar tras usarla** |
| `DEMO_ADMIN_EMAIL` | ◐ | — | — | Temporal, solo para la demo |
| `DEMO_ADMIN_PASSWORD` | ◐ | — | — | Ídem. **Retirar tras usarla** |

◐ = ponerla, ejecutar el comando una vez, y **borrarla**.

Generación de los tres secretos:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Tres reglas que no conviene saltarse:

- **`BETTER_AUTH_SECRET` distinto en cada entorno.** Compartirlo haría que una
  sesión de Preview valiese en Producción.
- **Preview y Production no deben compartir base de datos.** Una rama en pruebas
  escribiendo sobre los contactos reales es el accidente más fácil de cometer y el
  más difícil de deshacer. Si no hay un segundo proyecto de Supabase, dejar Preview
  sin `DATABASE_URL`: el despliegue de Preview fallará al arrancar, que es
  preferible.
- **Ninguna variable con datos personales o secretos lleva el prefijo
  `NEXT_PUBLIC_`.** Todo lo que lo lleve acaba en el navegador. La única del
  proyecto es `NEXT_PUBLIC_SITE_URL`, y `lib/security/secrets-scan.test.ts` falla si
  aparece otra.

---

## 4. Conexión de runtime (pooled)

La aplicación corre en funciones serverless: muchas instancias efímeras, cada una
abriendo su conexión. Una base PostgreSQL se queda sin conexiones enseguida así, por
lo que `DATABASE_URL` debe apuntar al **pooler de Supabase en modo Transaction**:

```
postgresql://USUARIO:CONTRASEÑA@HOST.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

- **Puerto 6543** = modo Transaction. Cada consulta toma una conexión del pool y la
  devuelve al terminar.
- **`pgbouncer=true`** es obligatorio: le dice a Prisma que no use sentencias
  preparadas con nombre, que PgBouncer en modo Transaction no soporta. Sin este
  parámetro aparecen errores intermitentes de "prepared statement already exists"
  que son un infierno de diagnosticar.
- **`connection_limit=1`** por instancia: el pool ya está del lado de Supabase, y
  cada función solo atiende una petición a la vez.

En Supabase: `Project Settings → Database → Connection string → Transaction pooler`.

---

## 5. Conexión de migraciones (directa)

`prisma migrate` necesita una sesión persistente: crea tipos, bloquea el catálogo y
usa sentencias que PgBouncer en modo Transaction no deja pasar. Por eso `DIRECT_URL`
es otra:

```
postgresql://USUARIO:CONTRASEÑA@HOST.pooler.supabase.com:5432/postgres
```

**Puerto 5432** = modo Session. Sin `pgbouncer=true`.

`prisma/schema.prisma` ya declara `directUrl = env("DIRECT_URL")`, así que Prisma usa
cada una donde toca sin que haya que hacer nada más.

> Si `DIRECT_URL` acabase apuntando también al 6543, las migraciones fallarían con
> errores oscuros sobre transacciones. Es el error de configuración más frecuente de
> esta pareja de variables.

---

## 6. Supabase Storage

El bucket `vip-content` es **privado**: nada se sirve público. Las imágenes viajan
como URL firmadas que caducan (10 minutos en el panel, 1 hora en las páginas
públicas), generadas en servidor **después** de validar el acceso.

```bash
npm run storage:bootstrap
```

Crea el bucket si no existe, con su límite de tamaño (10 MB) y sus tipos permitidos
(`image/jpeg`, `image/png`, `image/webp`). Es idempotente.

Comprobar en Supabase (`Storage → vip-content → Configuration`) que **Public bucket
está desactivado**. Si estuviera activo, cualquiera con la URL del objeto vería las
fotos de las bodas sin pasar por el gate, y las URL firmadas dejarían de tener
sentido.

El optimizador de imágenes de Next solo tiene autorizado el host de Supabase y
**únicamente** la ruta `/storage/v1/object/sign/**` (`next.config.mjs`): no se puede
usar como proxy de cualquier archivo del proyecto.

---

## 7. Build

Vercel ejecuta `npm ci && npm run build`. No hace falta configurar nada.

Dos cosas que hacen el build reproducible y que conviene no romper:

- **Un único lockfile**, `package-lock.json`. `npm ci` instala exactamente lo que
  dice; si hubiese además un `pnpm-lock.yaml` o un `yarn.lock`, Vercel podría elegir
  otro gestor y otra resolución de dependencias.
- **El build no sale a Internet.** Las tipografías se sirven desde el propio
  repositorio con `next/font/local` (ver `app/fonts/README.md`). Con
  `next/font/google` el build descargaba las fuentes durante la compilación y llegó
  a fallar con doce errores de red.

`prisma generate` se ejecuta solo: `@prisma/client` lo dispara en su `postinstall`.
No hace falta añadirlo al Build Command.

**El build no toca la base de datos.** Todas las páginas que consultan datos son
dinámicas (`force-dynamic`), así que un build correcto no garantiza que la conexión
funcione: eso lo dicen los smoke tests del §11.

---

## 8. Migraciones

Vercel **no** aplica migraciones. Es deliberado: una migración lanzada por cada
despliegue, en paralelo desde varias instancias, es una forma excelente de corromper
una base de datos.

Se aplican a mano, desde un equipo con `DIRECT_URL` en el entorno:

```bash
npx prisma migrate deploy
```

Orden, contenido de cada migración y qué hacer si una falla: **`docs/migraciones.md`**.

Secuencia de un despliegue con cambios de esquema:

1. Aplicar las migraciones (la aplicación antigua sigue funcionando: ninguna
   migración del proyecto borra nada, así que el esquema nuevo es compatible con el
   código viejo).
2. Desplegar.

Si alguna migración futura **no** fuese compatible hacia atrás, hay que partirla en
dos despliegues (añadir → migrar el código → retirar). Ese patrón está descrito en
`docs/migraciones.md` §3.

---

## 9. Primer usuario ADMIN

El alta pública está deshabilitada a propósito (`emailAndPassword.disableSignUp`):
no hay ninguna pantalla de registro que alguien pueda encontrar. El primer ADMIN se
crea con un comando:

```bash
# 1. Poner las tres variables en el entorno LOCAL (no en Vercel), apuntando
#    DATABASE_URL/DIRECT_URL a la base de producción.
ADMIN_BOOTSTRAP_NAME="Nombre Apellidos"
ADMIN_BOOTSTRAP_EMAIL="persona@dominio"
ADMIN_BOOTSTRAP_PASSWORD="…"      # 12 caracteres mínimo

# 2. Ejecutar una vez
npm run admin:bootstrap

# 3. Retirar las tres variables del entorno
```

Es idempotente: si el email ya existe, no toca nada (ni contraseña ni rol).

A partir de ahí, los demás usuarios se crean desde `/admin/usuarios` con una cuenta
ADMIN. La contraseña inicial se comunica por canal privado y se cambia al entrar.

Después: `npm run db:seed` para las reglas de scoring. Es configuración operativa,
no datos de ejemplo; sin ella el CRM puntúa a todo el mundo con cero.

---

## 10. Dominio

**[pendiente de ejecutar]**

1. `Project Settings → Domains → Add`, escribir el dominio.
2. Crear en el DNS los registros que Vercel indique (normalmente `A` a su IP para el
   dominio raíz y `CNAME` a `cname.vercel-dns.com` para `www`).
3. Esperar la propagación. Vercel emite el certificado TLS automáticamente.
4. **Actualizar `BETTER_AUTH_URL` y `NEXT_PUBLIC_SITE_URL`** al dominio definitivo y
   volver a desplegar.

Este último paso es el que se olvida. Si `BETTER_AUTH_URL` no coincide con el origen
real, Better Auth rechaza el login con `INVALID_ORIGIN`: en producción la lista de
orígenes de confianza está **vacía** a propósito y el único válido es el de esa
variable. En desarrollo se aceptan los puertos 3000 y 3001 de localhost; en
producción, nada más.

`Strict-Transport-Security` la pone Vercel en todos los dominios que sirve por
HTTPS. La aplicación no la envía a propósito: hacerlo en desarrollo, sobre
`http://localhost`, obligaría al navegador a recordar que ese host es solo-HTTPS y
rompería el desarrollo local durante meses.

---

## 11. Smoke tests

Después de cada despliegue, en este orden. Son cinco minutos y evitan descubrir un
problema por un mensaje del cliente.

```bash
SITIO="https://tu-dominio"
```

| # | Comprobación | Comando | Esperado |
|---|---|---|---|
| 1 | La aplicación llega a su base de datos | `curl -s $SITIO/api/health` | `{"status":"ok"}` y nada más |
| 2 | La home responde | `curl -s -o /dev/null -w "%{http_code}" $SITIO/` | `200` |
| 3 | Cabeceras de seguridad | `curl -sI $SITIO/ \| grep -i "content-security\|x-frame\|referrer\|permissions"` | Las cuatro presentes |
| 4 | No se anuncia la versión de Next | `curl -sI $SITIO/ \| grep -i x-powered-by` | Sin resultados |
| 5 | El panel exige sesión | `curl -s -o /dev/null -w "%{http_code}" $SITIO/admin` | `307` hacia `/admin/login` |
| 6 | **El contenido VIP no se filtra** | `curl -s $SITIO/bodas-reales \| grep -ci "$(alguna palabra de una ficha)"` | `0` |
| 7 | La exportación exige ADMIN | `curl -s -o /dev/null -w "%{http_code}" "$SITIO/api/admin/crm/export?entity=leads"` | `401` |
| 8 | Los textos legales están | `for p in politica-privacidad politica-cookies aviso-legal; do curl -s -o /dev/null -w "$p %{http_code}\n" $SITIO/$p; done` | `200` los tres |
| 9 | `robots.txt` no indexa el panel | `curl -s $SITIO/robots.txt` | `Disallow: /admin` |

Y a mano, en un navegador:

10. Entrar en `/admin/login` con la cuenta ADMIN y llegar al Resumen.
11. Enviar el formulario de contacto con datos ficticios y comprobar que la
    solicitud aparece en `/admin/solicitudes`.
12. Pasar el gate VIP con un email ficticio y abrir una ficha.
13. Cerrar sesión y comprobar que `/admin` vuelve a pedir credenciales.

El punto 6 es el que más importa: es la promesa central del producto. Y el 12 es el
único que confirma que Storage está bien configurado, porque si las URL firmadas
fallan la ficha se ve sin imágenes.

---

## 12. Rollback

**La aplicación** se revierte en segundos y sin perder nada:

`Deployments`, elegir el despliegue anterior que funcionaba, `⋯ → Promote to
Production`. Vercel conserva todos los despliegues, así que siempre hay a dónde
volver.

**La base de datos no se revierte con eso.** Si el despliegue que falla venía con una
migración, ver `docs/migraciones.md` §4. Resumen: volver primero al despliegue
anterior (instantáneo), arreglar la migración con calma después. Rehacer el
despliegue con la migración aún rota solo repite el fallo.

**Un secreto comprometido** no se arregla con un rollback:

| Secreto | Al rotarlo |
|---|---|
| `BETTER_AUTH_SECRET` | Se invalidan todas las sesiones del panel: hay que volver a entrar |
| `VIP_TOKEN_HASH_SECRET` | Se invalidan los accesos VIP: los visitantes pasan otra vez el gate |
| `RATE_LIMIT_HASH_SECRET` | Se reinician los contadores del limitador |
| Claves de Supabase | Rotar en Supabase **y** actualizarlas en Vercel a la vez |

Los dos primeros aceptan una variable `*_PREVIOUS` con la clave antigua durante una
ventana de rotación, para no echar a todo el mundo de golpe.

---

## 13. Recuperación si el proyecto de Supabase está pausado

El plan gratuito de Supabase **pausa los proyectos tras una semana sin actividad**.
Es la causa más probable de que la demo aparezca caída, y no tiene nada que ver con
el código.

Síntomas: `/api/health` devuelve `503`, la home carga (es estática) pero
`/bodas-reales`, `/admin` y el formulario fallan.

Qué hacer:

1. Entrar en el panel de Supabase. El proyecto aparece como `Paused`.
2. `Restore project`. Tarda entre uno y varios minutos.
3. Comprobar `curl -s $SITIO/api/health` → `{"status":"ok"}`.
4. **No hace falta redesplegar** ni tocar ninguna variable: las cadenas de conexión
   no cambian al reanudar.

Si el proyecto llevaba pausado **más de 90 días**, Supabase puede haberlo borrado.
En ese caso hay que crear uno nuevo y:

1. Crear el bucket: `npm run storage:bootstrap`.
2. Aplicar las migraciones: `npx prisma migrate deploy`.
3. Sembrar la configuración: `npm run db:seed`.
4. Crear el ADMIN: `npm run admin:bootstrap`.
5. Sembrar la demo si procede: `npm run demo:seed`.
6. Actualizar en Vercel `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL` y las claves.
7. Redesplegar y pasar los smoke tests.

**Cómo evitarlo durante una evaluación:** basta una petición al día. Cualquier
monitor externo gratuito apuntado a `/api/health` cada 12 horas mantiene el proyecto
despierto. El endpoint hace una consulta mínima —lo justo para distinguir "el
proceso vive" de "el proceso llega a su base de datos"— y no devuelve versiones ni
configuración.

---

## 14. Cómo retirar `ENABLE_DEMO_CONTENT`

Las seis fichas de ejemplo están marcadas con `isDemo = true`, y
`lib/domain/content.ts` **las oculta en producción** salvo que
`ENABLE_DEMO_CONTENT` valga exactamente `true`. Esa variable es el interruptor de la
demo.

Cuando la demo deje de hacer falta:

1. `Project Settings → Environment Variables`, borrar `ENABLE_DEMO_CONTENT` de
   Production (o poner cualquier otro valor: solo `true` la activa).
2. Redesplegar, o esperar al siguiente despliegue. Las páginas son dinámicas, así
   que el cambio se nota en la primera petición tras el redespliegue.
3. Comprobar que `/bodas-reales` y `/catering`, con acceso VIP concedido, muestran
   el estado vacío en vez de las fichas de ejemplo.

Nada se borra: las fichas siguen en la base y vuelven a aparecer si se reactiva la
variable. Para borrarlas de verdad, junto con los contactos ficticios y la cuenta de
evaluación, está `npm run demo:clean` (ver `docs/runbook-demo.md`).

**El orden importa.** Retirar la variable *antes* de publicar contenido real deja las
bibliotecas vacías, y una biblioteca vacía es peor carta de presentación que unas
fichas de ejemplo. La secuencia sensata es: publicar los primeros reportajes reales
→ comprobar que se ven → retirar la variable → comprobar otra vez.
