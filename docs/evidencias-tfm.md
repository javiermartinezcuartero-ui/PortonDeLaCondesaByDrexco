# Evidencias

Qué se puede comprobar, con qué comando, y qué salida da. Pensado para que un
tribunal pueda reproducir cualquier afirmación del proyecto sin tener que creerse
nada.

Todas las salidas de este documento son **reales**, obtenidas en el equipo de
desarrollo el 13 de agosto de 2026. Ninguna está inventada ni retocada.

---

## 1. Cómo reproducirlo todo

```bash
git clone <repositorio> && cd porton_claude_starter_v4
npm ci

cp .env.example .env         # y rellenar (ver README §Variables de entorno)
npx prisma migrate deploy
npm run db:seed
npm run admin:bootstrap      # con las tres variables ADMIN_BOOTSTRAP_*

npm run lint
npm run typecheck
npm test
npm run build
npm run secrets:history      # escáner de secretos sobre todo el historial de Git

npm run e2e:env              # crea .env.e2e con secretos aleatorios
npm run e2e:setup            # contenedor de PostgreSQL + migraciones + escenario
npm run e2e
```

Requisitos: Node 22 o superior, y Docker para las E2E (o cualquier PostgreSQL
desechable; ver `docs/pruebas-e2e.md` §2).

---

## 2. Validación de la Fase 10

| Comando | Resultado | Notas |
|---|---|---|
| `npm ci` | Correcto | Un único lockfile (`package-lock.json`) |
| `npm run lint` | **0 errores, 0 advertencias** | ESLint 9 con `eslint-config-next` y las reglas del compilador de React |
| `npm run typecheck` | **Sin errores** | `tsc --noEmit`, modo estricto, sin `any` ni `ts-ignore` |
| `npm test` | **698 pruebas en 58 archivos, todas verdes** | Vitest. Las de dominio hablan con PostgreSQL real |
| `npm run e2e` | **23 pruebas, todas verdes** (≈40 s) | Playwright, Chromium, build de producción |
| `npm run build` | **Correcto** | Sin ninguna petición de red durante la compilación |
| `npx prisma validate` | Esquema válido | |
| `npx prisma generate` | Cliente generado | |
| `npm audit` | 3 vulnerabilidades altas | Heredadas de `next@16.0.10`; ver `docs/checklist-aceptacion.md` L5 |

## 2.1. Validación de la Fase 11

| Comando | Resultado | Notas |
|---|---|---|
| `npm run secrets:history` | **5 commits, 288 versiones de archivo, 0 hallazgos** | Escáner propio sobre todo el historial de Git, no solo el árbol. Ver más abajo por qué hacen falta los dos |
| Escáner del árbol | **8 pruebas verdes, 11 patrones, 0 hallazgos** | Dentro de `npm test`. Incluye ahora los archivos de texto sin extensión (`NOTICE`) |
| Simulación del entorno de CI | **329 pruebas pasan, 325 se saltan solas, exit 0** | Ejecutado sin `.env`, que es exactamente lo que ve el runner de GitHub Actions |
| `.env` versionable | Ninguno | Solo `.env.example` y `.env.e2e.example`, las dos sin valores |
| Volcados, exportaciones y subidas en el árbol | Ninguno | Los únicos `.sql` son las 9 migraciones de Prisma |
| Datos personales de particulares en el árbol | Ninguno | Detalle de lo que **sí** hay, y por qué puede publicarse, en `docs/publicacion-github.md` §3 |

### Por qué dos escáneres de secretos y no uno

Son dos estados distintos. **Limpiar el árbol no limpia el historial:** un secreto
añadido en un commit y borrado en el siguiente sigue estando en el primero, y en
GitHub ese commit sigue siendo consultable por su URL para siempre. El escáner
del árbol —el que corre con `npm test`— diría que todo está bien.

Salida real del escáner del historial:

```
Commits revisados:      5
Versiones de archivo:   288 (deduplicadas por contenido)
Patrones aplicados:     9
Excepciones conocidas:  1
  - project-reference/data/image-manifest.json: secreto hexadecimal de 64 caracteres

Historial limpio: ningún secreto en ninguna versión de ningún archivo.
```

Esa excepción es además la prueba de que la detección funciona: el escáner
encontró los checksums SHA-256 del manifiesto de imágenes —64 caracteres
hexadecimales, la misma forma que un secreto— y los clasificó como falso positivo
conocido. Si la detección estuviera rota, esa línea no aparecería.

### Cobertura de las pruebas por área

| Área | Archivos | Qué comprueban |
|---|---|---|
| Validación | 6 | Esquemas compartidos cliente/servidor, límites, normalización |
| Dominio | 14 | Contactos, solicitudes, contenido, scoring, tareas, notas, privacidad |
| Seguridad | 7 | Cabeceras, CSP, rate limit, hashes, texto, **ataques**, **secretos** |
| API | 5 | Endpoints públicos y privados, con y sin sesión |
| Componentes | 6 | Gate, tarjetas, fichas, formulario, precarga desde CTA |
| Correo | 3 | Configuración, proveedor, plantillas |
| Contenido | 2 | Equivalencia con la fuente estática, publicación |
| Observabilidad | 1 | Que ningún log filtre datos personales ni stack |
| Pruebas de las pruebas | 1 | La guardia de la base de datos E2E |
| Middleware | 1 | Redirecciones de `/admin` |
| E2E | 6 | Los 13 escenarios críticos del recorrido completo |

---

## 3. Lo que se puede comprobar en un minuto

Cada fila es una afirmación del proyecto y el comando que la demuestra. Contra un
servidor local (`npm run dev`) o contra el desplegado, cambiando la URL.

### El contenido protegido no se filtra

```bash
curl -s http://localhost:3000/bodas-reales | grep -c -i "<palabra de una ficha>"
# 0
```

Es la promesa central del producto. El contenido no está oculto con CSS ni
difuminado: **no se ha consultado**. La comprobación va sobre el HTML servido,
que es lo que vería quien mirase el código fuente.

Prueba automática equivalente: E2E escenario 1, y
`components/vip/access-boundary.test.tsx`.

### El panel exige sesión

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/admin
# 307   (hacia /admin/login)
```

### Los endpoints privados rechazan sin sesión y sin filtrar nada

```bash
curl -s "http://localhost:3000/api/admin/crm/export?entity=leads"
# {"ok":false,"code":"unauthenticated"}   — sin datos, sin rastro de Prisma, sin stack
```

### El healthcheck no cuenta nada de más

```bash
curl -s http://localhost:3000/api/health
# {"status":"ok"}
```

Ni versiones —un healthcheck que anuncia "Next 16.0.10" es un catálogo gratis de
vulnerabilidades—, ni configuración, ni excepciones. Hace una consulta mínima para
distinguir "el proceso vive" de "el proceso llega a su base de datos".

### Las cabeceras de seguridad se sirven

```bash
curl -sI http://localhost:3000/ | grep -iE "content-security|x-frame|x-content-type|referrer|permissions|cross-origin"
```

Siete cabeceras. La CSP va en `Report-Only` salvo que `CSP_ENFORCE=true`: es una
decisión documentada en `docs/checklist-aceptacion.md` L2.

### No se anuncia la versión del framework

```bash
curl -sI http://localhost:3000/ | grep -i x-powered-by
# (sin resultados)
```

### Las tipografías no salen a Internet

```bash
curl -s http://localhost:3000/ | grep -c "fonts.googleapis\|fonts.gstatic"
# 0
curl -s http://localhost:3000/ | grep -o '/_next/static/media/[^"]*woff2' | sort -u
# tres archivos, servidos desde el propio dominio
```

El navegador del visitante no le pide nada a Google para pintar el texto, así que su
IP no viaja a un tercero. Y el build no depende de la red.

### El panel no se indexa

```bash
curl -s http://localhost:3000/robots.txt | grep -i admin
# Disallow: /admin
```

---

## 4. Evidencias que necesitan la interfaz

Doce comprobaciones que no se pueden hacer con `curl` y que la suite E2E automatiza.
`npm run e2e` las ejecuta todas en unos cuarenta segundos y deja **traza navegable**
de cualquier fallo.

Para verlas ocurrir:

```bash
npm run e2e -- --headed        # con navegador visible
npm run e2e:ui                 # modo interactivo, paso a paso
npm run e2e:report             # informe HTML de la última ejecución
```

Y el recorrido a mano, para una demostración en directo:
**`docs/runbook-demo.md`** §3.

---

## 5. Defectos reales encontrados por las pruebas

La evidencia más honesta de que una suite sirve es la lista de lo que encontró. Todos
corregidos, cada uno con su prueba de regresión.

### Fase 10 (las E2E, al escribirse)

1. **El CTA "Quiero una boda así" no precargaba el tipo de evento.** El asunto sí, el
   desplegable no, y el primer envío se rechazaba. Causa: Radix Select, dentro de un
   `<form>`, dispara un `change` sintético en su `<select>` nativo oculto cada vez que
   cambia su valor; con el desplegable cerrado ese select solo tiene la opción vacía,
   así que devolvía `""` y borraba la precarga. La prueba de la Fase 6 lo tapaba
   porque volvía a elegir el tipo a mano.
   → `components/sections/contact-prefill.test.tsx` (3 pruebas)
2. **La cabecera pública tapaba el panel.** El layout raíz pintaba la cabecera `fixed`
   (z-50) también en `/admin`, dejando "Cerrar sesión" **materialmente inalcanzable**
   con el ratón en escritorio.
   → `components/public-chrome.tsx`; E2E 13
3. **Una cookie de sesión revocada rompía el panel** con `ERR_TOO_MANY_REDIRECTS`: el
   panel redirigía al login por no haber sesión y el middleware devolvía al panel por
   haber cookie. Pasaba con cualquier sesión caducada, revocada, con el secreto rotado
   o con la base restaurada.
   → `middleware.test.ts`; E2E 13
4. **Una imagen subida no aparecía en el editor hasta recargar la página**, y sin
   poder escribir su texto alternativo no se podía publicar.
   → E2E 8
5. **`/admin/usuarios` respondía 200** con "Acceso no autorizado" en vez de 404 como el
   resto del panel, y era la única página con una comprobación de rol escrita a mano.
   → E2E 11
6. **Dos archivos de prueba se borraban los contadores de rate limit entre sí**, con un
   `deleteMany` por prefijo demasiado ancho. Producía un fallo intermitente que
   dependía del orden de ejecución.

### Fase 11 (al revisar las afirmaciones del proyecto)

7. **`robots.txt` no llevaba el `Disallow` que tres documentos afirmaban.** Este
   documento (§3), `docs/checklist-aceptacion.md` (requisito 1.7) y
   `docs/despliegue-vercel.md` (smoke test 9) daban por hecho un
   `Disallow: /admin` que `app/robots.ts` no emitía: solo había `allow: "/"`. El
   `noindex` del panel sí era real, así que la protección efectiva existía, pero
   **el smoke test del despliegue habría fallado el primer día en producción** y
   la afirmación era falsa. Se corrigió en el código, que es donde la afirmación
   se vuelve cierta.
   → `app/robots.test.ts` (5 pruebas)
8. **El escáner de secretos no miraba los archivos de texto sin extensión.**
   Filtraba por extensión, así que `NOTICE` no se habría revisado, ni `LICENSE`
   cuando exista. Un escáner que da por revisado lo que no ha abierto es peor que
   no tenerlo, porque tranquiliza.
   → prueba que comprueba que `NOTICE` entra en el conjunto escaneado

### Fases anteriores

7. **Falso 429 en el limitador** (Fase 9): `updateMany` con 0 filas afectadas se
   interpretaba como "límite agotado", cuando también puede significar "la fila ya no
   está". Rechazaba a alguien que no había hecho nada.
   → `lib/security/rate-limit.test.ts`
8. **Anonimización incompleta** (Fase 9): solo tocaba las columnas del contacto y
   dejaba a la persona identificable en el texto libre de sus solicitudes y en las
   notas del equipo. Anonimizar a medias es no anonimizar.
   → `lib/domain/privacy.test.ts`
9. **Una contraseña en el README** (Fase 6): se detectó antes de subir nada. De ahí
   nació el escáner de secretos, que convierte esa clase de fuga en un fallo de test.
   → `lib/security/secrets-scan.test.ts`
10. **Páginas del CMS que devolvían 500 a un usuario SALES** en lugar de 404 (Fase 7):
    protegían, pero informaban mal.
    → `app/admin/(protected)/guards.ts`

---

## 6. Documentos del proyecto

| Documento | Qué contiene |
|---|---|
| `README.md` | Resumen técnico completo, variables, comandos e historial de fases |
| `docs/despliegue-vercel.md` | Despliegue paso a paso, smoke tests, rollback, recuperación |
| `docs/migraciones.md` | Las 9 migraciones, su orden, y qué hacer si una falla |
| `docs/pruebas-e2e.md` | Cobertura, aislamiento de la base y decisiones de la suite |
| `docs/runbook-demo.md` | Preparar, enseñar y retirar la demostración |
| `docs/manual-admin.md` | Manual de uso del panel, sin tecnicismos |
| `docs/checklist-aceptacion.md` | Requisitos con su estado real y las limitaciones conocidas |
| `docs/modelo-amenazas.md` | Activos, actores, amenazas, OWASP y riesgos aceptados |
| `docs/arquitectura-backend.md` | Decisiones de infraestructura y conexiones |
| `docs/modelo-datos.md` | Esquema narrado y diagrama ER |
| `docs/autenticacion.md` | Better Auth, sesiones, roles |
| `docs/gate-vip.md` | Diseño del acceso a las bibliotecas |
| `docs/flujo-captacion.md` | Recorrido del visitante hasta el CRM |
| `docs/crm.md` | Pipeline, scoring, exportación |
| `docs/cms.md` | Ciclo de vida del contenido y media |
| `docs/email.md` | Correo transaccional desacoplado |
| `docs/openapi.yaml` | Contrato de la API pública |
| `docs/publicacion-github.md` | Preparación de la publicación, escaneo de secretos, remediación y licencia |
| `docs/checklist-entrega-tfm.md` | Estado, URL y permisos de cada entregable de la entrega |
| `docs/guion-presentacion-tfm.md` | 14 diapositivas con mensaje, evidencia, tiempo y notas del orador |
| `docs/guion-video-obs.md` | Grabación de la demostración: escena, recorrido y comprobaciones |
| `docs/formulario-entrega-tfm.md` | Plantilla del formulario y canal privado de credenciales |
| `app/fonts/README.md` | Origen y licencias de las tipografías |
| `NOTICE` | Derechos de terceros: marca, fotografías, textos y tipografías |
| `CONTRIBUTING.md` | Reglas de trabajo, en versión corta |

---

## 7. Lo que no está, y por qué

Cuatro cosas que un tribunal podría echar en falta, dichas antes de que las busque:

1. **No hay despliegue.** El enunciado de esta fase pedía preparar el despliegue, no
   ejecutarlo. Todo lo necesario está en `docs/despliegue-vercel.md`, verificado contra
   la configuración real del repositorio.
2. **No hay métricas de Lighthouse.** Requieren el sitio en producción. La preparación
   sí está hecha: imágenes optimizadas, tipografías locales, sin peticiones a terceros
   y páginas estáticas donde se puede.
3. **Las E2E no están en integración continua.** Necesitan un PostgreSQL de servicio y
   las credenciales de Storage como secretos del repositorio. La guardia de base de
   datos ya contempla ese caso (`E2E_ALLOW_NONLOCAL`), así que es configuración, no
   desarrollo.
4. **Los textos legales necesitan revisión profesional.** El plazo de retención
   concreto y la base jurídica de cada tratamiento los tiene que fijar alguien
   cualificado. El proyecto **no se los inventa**: donde falta, hay un aviso.
5. **El repositorio no es público todavía y no tiene licencia.** Las dos cosas son
   decisiones del titular, no tareas pendientes de programación: la Fase 11 dejó
   las comprobaciones hechas —árbol e historial escaneados y limpios, sin datos
   personales, `NOTICE` escrito— y el procedimiento en
   `docs/publicacion-github.md`. Sin archivo `LICENSE`, el código queda bajo
   todos los derechos reservados por defecto, que para una entrega académica
   puede ser exactamente lo que se quiere.
6. **Las URL de la entrega no existen.** Aplicación, README público, Slides, vídeo
   y dashboard cuelgan del despliegue y de la publicación. En
   `docs/checklist-entrega-tfm.md` figuran como `[PENDIENTE: URL]`, un marcador
   literal: **este proyecto no inventa una URL para que una tabla parezca
   completa.**

Las limitaciones técnicas conocidas, con su motivo, están en
`docs/checklist-aceptacion.md` §Limitaciones, y los riesgos de seguridad aceptados en
`docs/modelo-amenazas.md` §7.
