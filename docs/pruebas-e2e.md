# Pruebas E2E

Cómo se ejecutan las pruebas de extremo a extremo, contra qué, y por qué están
montadas así. Amplía el README §Pruebas y resultados reales.

---

## 1. Qué cubren

Playwright recorre la aplicación **como la recorrería una persona**: navegador
real, formularios rellenados a mano, clics en los botones que existen. Nada se
prepara por detrás: si una prueba necesita un contacto, lo crea pasando por el
formulario público.

Los trece escenarios críticos del enunciado, y dónde está cada uno:

| # | Escenario | Archivo |
|---|---|---|
| 1 | El visitante entra en `/bodas-reales` y ve el gate | `e2e/01-gate-vip.spec.ts` |
| 2 | La privacidad es obligatoria | `e2e/01-gate-vip.spec.ts` |
| 3 | Un correo válido desbloquea las dos bibliotecas | `e2e/01-gate-vip.spec.ts` |
| 4 | El visitante abre una ficha | `e2e/01-gate-vip.spec.ts` |
| 5 | La interacción queda registrada | `e2e/01-gate-vip.spec.ts` |
| 6 | El CTA contextual crea una LeadRequest | `e2e/02-formulario.spec.ts` |
| 7 | El administrador inicia sesión | `e2e/03-panel-acceso.spec.ts` |
| 8 | CONTENT crea borrador, sube imagen, previsualiza y publica | `e2e/04-cms.spec.ts` |
| 9 | La publicación aparece en la ruta correcta | `e2e/04-cms.spec.ts` |
| 10 | SALES ve una solicitud, crea una tarea y cambia el estado | `e2e/05-crm.spec.ts` |
| 11 | CONTENT no accede a datos personales | `e2e/06-autorizacion.spec.ts` |
| 12 | Anónimo no accede al panel | `e2e/03-panel-acceso.spec.ts` |
| 13 | Cerrar sesión revoca la sesión | `e2e/03-panel-acceso.spec.ts` |

Los escenarios 4 y 5 comparten una sola prueba: son un mismo recorrido (abrir la
ficha y que eso se registre) y separarlos habría obligado a pasar dos veces por el
gate sin ganar cobertura.

Además de los trece, la suite incluye nueve comprobaciones que nacieron de
preguntarse "¿y si…?" sobre cada escenario: que el marketing se puede dejar sin
marcar y el envío sigue funcionando, que una contraseña incorrecta no distingue si
el email existe, que marcar una solicitud como perdida exige motivo, que un
borrador no se sirve por su ruta pública, que SALES no entra en `/admin/contenidos`
ni exporta, y que lo que CONTENT **sí** puede hacer sigue funcionando (una
autorización que lo cierra todo también está mal).

**23 pruebas en total.**

---

## 2. La base de datos: aislada y desechable

Las E2E son destructivas: cada ejecución vacía todas las tablas y vuelve a sembrar
el mismo escenario, para que dos ejecuciones seguidas den el mismo resultado.

Por eso **no se ejecutan nunca contra la base de la aplicación**. La base de
pruebas es un contenedor de PostgreSQL propio (`docker-compose.e2e.yml`), en el
puerto **55432** y publicado solo en `127.0.0.1`.

Y no se confía en que nadie se equivoque: `lib/testing/e2e-database-guard.ts`
aborta antes de abrir la primera conexión si la base indicada

- no está declarada,
- no es PostgreSQL o no nombra ninguna base,
- **coincide con la `DATABASE_URL` de la aplicación** (comparando host, puerto y
  nombre, así que un `?pgbouncer=true` de diferencia no la despista),
- está en un host que parece gestionado (Supabase, RDS, Neon…) sin permiso
  explícito,
- o está en un host remoto cuyo nombre de base no contiene `e2e`, `test` ni
  `prueba` — la base por defecto de Supabase se llama `postgres`, así que un
  copiar y pegar sigue abortando.

La guardia tiene sus propias pruebas (`lib/testing/e2e-database-guard.test.ts`, 13
casos, incluido que ningún mensaje de error filtre la contraseña). Una salvaguarda
sin pruebas no es una salvaguarda: es una intención.

### Puesta en marcha

```bash
npm run e2e:env      # crea .env.e2e con secretos aleatorios (no sobrescribe)
npm run e2e:setup    # levanta el contenedor, migra y siembra el escenario
npm run e2e          # ejecuta la suite
```

`npm run e2e` arranca por su cuenta el servidor bajo prueba si no está ya
escuchando, y siembra la base antes de empezar (`e2e/global-setup.ts`).

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm run e2e:db:up` | Levanta el contenedor y espera a que esté sano |
| `npm run e2e:db:down` | Lo para conservando los datos |
| `npm run e2e:db:reset` | Lo borra **con su volumen**: base virgen |
| `npm run e2e:db:migrate` | `prisma migrate deploy` sobre la base de pruebas |
| `npm run e2e:seed` | Vacía y vuelve a sembrar el escenario |
| `npm run e2e:ui` | Playwright en modo interactivo |
| `npm run e2e:report` | Abre el informe HTML de la última ejecución |

### En CI, o sin Docker

Cualquier PostgreSQL desechable sirve. Si no es local, hace falta
`E2E_ALLOW_NONLOCAL=true` **y** que el nombre de la base delate que es de pruebas.
Ver `.env.e2e.example`.

---

## 3. Supabase Storage: la única pieza no aislada

El escenario 8 sube una imagen de verdad, y Supabase Storage no tiene equivalente
local: su API no es S3, así que ni MinIO sirve como sustituto. Las pruebas usan el
**bucket real del proyecto**, heredando `SUPABASE_URL` y la clave privilegiada de
`.env`.

Esto se compensa con dos cosas:

1. `scripts/e2e-seed.ts` **borra del bucket** los objetos que subieron las
   ejecuciones anteriores, leyendo la lista de las propias filas `ContentMedia` de
   la base de pruebas. Lo hace *antes* de vaciar las tablas, porque después ya no
   habría lista.
2. El escenario 8 comprueba explícitamente que Storage esté configurado y falla
   con un mensaje que lo dice, en vez de con un error confuso.

**Riesgo aceptado:** si alguien borra el volumen de la base de pruebas sin haber
ejecutado el sembrado, los objetos de esa ejecución quedan huérfanos en el bucket.
Son unos pocos PNG de 40 KB generados por la propia prueba, bajo el prefijo del
identificador de su ficha.

---

## 4. Decisiones de la suite

**Build de producción, no `next dev`.** Las pruebas recorren el mismo código que se
va a desplegar. `next dev` además activa los orígenes de confianza de desarrollo de
Better Auth y ocultaría un problema de configuración de producción.

**Un solo trabajador, sin paralelismo.** Contra una única base compartida, dos
pruebas en paralelo se verían los datos. La suite entera tarda unos 45 segundos: la
determinación vale más que los segundos que se ahorrarían.

**Sesión iniciada una vez por rol.** El proyecto `setup` inicia sesión con cada rol
y guarda el estado en `e2e/.auth/` (que está en `.gitignore`: es una credencial
efímera). Los escenarios lo reutilizan. Sin esto, cada prueba consumiría uno de los
3 intentos por 10 segundos que Better Auth permite en el login, y la suite fallaría
por su propia protección. El escenario 7 **sí** hace un login interactivo completo:
lo que se optimiza es la preparación, no la prueba del login.

**Cada visitante tiene su propia IP ficticia.** El gate VIP limita a 5 accesos por
IP cada 10 minutos. En un servidor local sin proxy todas las peticiones comparten
identificador, así que las últimas pruebas fallaban por culpa de las anteriores,
con un resultado que además dependía del orden de ejecución. `newVisitor()` da a
cada contexto una `x-forwarded-for` distinta del rango 198.18.0.0/15 (reservado
para pruebas, RFC 2544). No relaja el límite: que un mismo visitante solo pueda
intentarlo cinco veces se comprueba en `lib/security/attack-surface.test.ts`.

**Nada de esperas fijas donde se puede esperar por una condición.** Las dos
excepciones son deliberadas y están comentadas: el tiempo mínimo de relleno del
formulario (3 segundos, filtro antibot) y la comprobación de que recargar una ficha
**no** registra una segunda visita, donde hay que esperar para poder afirmar que no
ha pasado nada.

**Datos ficticios y direcciones que no existen.** Todos los emails usan `.test`, un
TLD reservado por la RFC 2606 que no resuelve. Ninguna prueba puede escribir a una
persona real ni por accidente. Y el entorno de pruebas se arranca sin credenciales
de SendGrid a propósito: así el escenario 6 puede comprobar que la solicitud se
guarda igual y que el intento queda como `SKIPPED_CONFIG`, que es el principio de
la Fase 8 —la base de datos es la fuente de verdad— convertido en prueba.

---

## 5. Cuando una prueba falla

Playwright guarda, solo de los fallos, captura de pantalla, traza y un
`error-context.md` con el árbol de accesibilidad del momento exacto. Todo en
`e2e/.results/` (no versionado).

```bash
npx playwright show-trace e2e/.results/<carpeta>/trace.zip
```

La traza permite retroceder paso a paso y ver el DOM en cada momento. Es la
diferencia entre "falla en CI y no sé por qué" y "aquí está el clic que no llegó".

### Fallos con causa conocida

| Síntoma | Causa | Solución |
|---|---|---|
| `UnsafeTestDatabaseError` | La base indicada no es desechable | Revisar `E2E_DATABASE_URL`; §2 |
| `No se ha encontrado ninguna tabla` | Falta migrar | `npm run e2e:db:migrate` |
| "Demasiados intentos" en el gate | Una prueba nueva reutiliza una IP ya usada | Darle un octeto propio en `newVisitor` |
| No se puede iniciar sesión tras 3 intentos | Se está ejecutando una sola prueba y el límite del login está agotado | Esperar 10 s o ejecutar la suite completa |
| "Supabase Storage no está configurado" | Falta `SUPABASE_URL` o la clave privilegiada | §3 |

---

## 6. Lo que estas pruebas ya han encontrado

No es una lista teórica: son los defectos reales que la suite destapó al escribirse,
todos corregidos con su prueba de regresión.

1. **El CTA "Quiero una boda así" no precargaba el tipo de evento.** El asunto sí,
   el desplegable no, y el primer envío se rechazaba con "Selecciona el tipo de
   evento". Causa: Radix Select, dentro de un `<form>`, dispara un `change`
   sintético en su `<select>` nativo oculto cada vez que cambia su valor; con el
   desplegable cerrado ese select solo tiene la opción vacía, así que devolvía `""`
   y borraba la precarga. La prueba de la Fase 6 no lo veía porque volvía a elegir
   el tipo a mano.
2. **La cabecera pública tapaba el panel.** El layout raíz pintaba la cabecera
   `fixed` (z-50) también en `/admin`, dejando "Cerrar sesión" inalcanzable con el
   ratón en escritorio. Debajo aparecían además el pie comercial y el botón de
   WhatsApp.
3. **Una cookie de sesión revocada rompía el panel con `ERR_TOO_MANY_REDIRECTS`.**
   El panel redirigía al login por no haber sesión y el middleware devolvía al
   panel por haber cookie. Pasaba con cualquier sesión caducada, revocada, con el
   secreto rotado o con la base restaurada.
4. **Una imagen subida no aparecía en el editor hasta recargar la página.** El
   editor guarda la ficha en estado de cliente inicializado una sola vez, así que
   el refresco actualizaba los avisos del servidor ("falta el alt de 1 archivo")
   pero no la lista del panel, que seguía diciendo "todavía no hay archivos". Sin
   poder escribir el alt, no se podía publicar.
5. **`/admin/usuarios` respondía 200 con "Acceso no autorizado"** en vez de 404
   como el resto del panel. Autorizaba bien —nunca consultaba los usuarios—, pero
   era la única página con una comprobación de rol escrita a mano, y por tanto la
   única que podía desincronizarse de `PERMISSIONS`.
