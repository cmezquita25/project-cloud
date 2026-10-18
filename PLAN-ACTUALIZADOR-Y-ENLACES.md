# Plan de implementación — Actualizador OTA, copias programadas y enlaces compartidos (QR)

> Estado: **propuesta revisada (decisiones confirmadas en §7)** · Fecha: 2026-10-17 · Versión base: `v2.0.0` (schema `4`)
> Prioridad acordada: **primero el actualizador**, para poder probar con él las siguientes entregas.
> Producción: `https://drive.techmaleon.com.mx/` · Servidor de releases: `https://techmaleon.com.mx/project-cloud/` · Sin canal beta ni staging: se prueba en local y se publica directo a producción.

---

## 0. Resumen ejecutivo

Son tres bloques que comparten infraestructura:

| Bloque | Qué resuelve | Orden |
| :--- | :--- | :--- |
| **A. Actualizador OTA** | Las instalaciones self-hosted reciben versiones nuevas desde un servidor de releases, con respaldo previo, modo mantenimiento y reversión. | 1º |
| **B. Copias programadas y restauración con diagnóstico** | Backups por cron, rotación (máx. 3), contenido configurable y un analizador que avisa de conflictos antes de restaurar. | 2º |
| **C. Enlaces compartidos + QR** | Enlaces con token, nivel de acceso, caducidad, contador de visitas, QR y un panel para revocarlos. | 3º |

Los tres se apoyan en un **núcleo común** que conviene construir una sola vez:

```
                ┌───────────────────────── Núcleo común ─────────────────────────┐
                │  Versión única (backend+frontend)   Modo mantenimiento           │
                │  Programador de tareas (cron)       Cierre global de sesiones    │
                │  Runner de trabajos por pasos       Notificaciones a admins      │
                │  Carpeta privada del sistema (api/var/)                          │
                └───────────────┬───────────────────────┬──────────────────────────┘
                                │                       │
              A. Actualizador ──┤   B. Backups/Restore ─┤   C. Enlaces/QR (usa cron para caducidad
                                │                       │      y limpieza de registros de visitas)
```

**Regla de oro:** la **URL pública directa** (`/storage/{usuario}/ruta/archivo.ext`) **se queda tal cual**. Es la función que distingue al proyecto (usar archivos como CDN o referencia en código). Los enlaces compartidos son una capa **adicional**, no la sustituyen.

---

## 1. Hallazgos del código actual (punto de partida)

Lo que ya existe y se reutiliza:

- `CronService` (`api/src/Services/CronService.php`) se ejecuta cada 60 s (CLI o HTTP con `cron_secret`). Hoy revisa cuotas y limpia `.uploads`.
- `DatabaseManagerService` crea ZIP (dump SQL + `storage/` + `config.php` + `install.lock` + unidad compartida), lista, restaura y borra.
- `SchemaMigrator` aplica `schema.sql` de forma idempotente más migraciones manuales; `settings.schema_version = 4`.
- `shared_access` + `SharePermissionService`: invitaciones a unidad, carpeta o archivo con permiso `read`/`full`.
- La unidad compartida de la organización (`AssetsService`, carpeta `storage/platform`) vive solo en disco (sin ids en BD). El acceso es para el admin más una lista de usuarios permitidos.
- La versión solo existe en el frontend (`frontend/src/shared/config/version.ts` → `2.0.0`). **El backend no sabe qué versión tiene.**
- El `.htaccess` raíz sirve `/storage/*` directo con Apache (`RewriteRule ^storage/ - [L]`) y manda todo `/api/*` a `api/index.php`.

### ⚠️ Problemas que hay que corregir antes (Fase 0)

1. **Las copias de seguridad se pueden descargar por URL pública.** Se guardan en `storage/backups/`. `storage/.htaccess` solo bloquea `.uploads`, `.ratelimit` y `.trash`, y el nombre es predecible (`backup_YYYY-MM-DD_HH-MM-SS.zip`). Cada ZIP incluye `config.php`, es decir, **la contraseña de la BD y el secreto JWT**. Hay que mover las copias fuera de la zona pública y bloquear la ruta antigua.
2. **El dump SQL se arma en memoria** (`exportDatabaseToSql()` concatena todo en un string). Con una BD grande se acaba la memoria. Hay que escribirlo en streaming a un archivo.
3. **La restauración no elimina archivos creados después de la copia.** Hoy copia encima y deja huérfanos. El diagnóstico (Bloque B) debe detectarlos.
4. **Pueden chocar los nombres de usuario.** `storage/` mezcla carpetas de sistema (`backups`, `platform`) con carpetas de usuarios (`storage/{username}`). Un usuario llamado `backups` o `platform` rompería todo. Hay que reservar esos nombres.
5. **Hay scripts de depuración en la raíz** (`check_db.php`, `api/check_assets.php`, `api/debug_assets.php`, `api/migrate_assets.php`). No deben ir en ningún release.
6. **El cron hace todo cada 60 s** (revisa la cuota de cada usuario en cada pasada). Con más tareas hay que pasar a un programador con intervalo por tarea.

### Hallazgos adicionales durante la Fase 0 (ya corregidos en `feat/f0-cimientos`)

7. **La restauración rompía datos con `;` o `--`.** El volcado se dividía por `;` y se borraba todo lo que siguiera a `--`, incluso dentro de los valores (HTML de plantillas de correo, estilos CSS). Se reemplazó por `SqlStatementReader`, que respeta comillas y comentarios.
8. **La unidad compartida nunca entraba en las copias.** El código leía una propiedad privada (`AssetsService->root`) con `??`, que devolvía vacío sin dar error.
9. **Los logos de la plataforma (`storage/platform`) se excluían de las copias.**
10. **El cron por URL no funcionaba.** La URL mostrada (`/cron.php?token=`) caía en el SPA. Ahora es `/api/v1/system/cron?token=…`.
11. **El nombre de la carpeta de la unidad compartida aceptaba nombres del sistema** (`api`, `storage`, `app-assets`…). En local está configurada como `app-assets`, la misma carpeta donde Vite publica los JS y CSS de la app. Los nombres nuevos ya se validan; **hay que confirmar el valor en producción** antes de la Fase 2.

---

## 2. Núcleo común (prerrequisito de todo)

### 2.1 Carpeta privada del sistema: `api/var/`

Todo lo que no debe ser público se guarda aquí: estado del actualizador, paquetes descargados, staging, `old-files`, backups y locks.

- **Por qué `api/var/`:** el `.htaccess` raíz envía **cualquier** petición `/api/*` a `api/index.php`, así que nada dentro de `api/var/` se sirve como archivo. Además lleva su propio `.htaccess` con `Require all denied` y una nota para Nginx.
- **Por qué no `old-files/` en la raíz del hosting:** la regla `6d` del `.htaccess` sirve cualquier archivo físico que exista. Un `old-files/api/src/*.php` en la raíz **se ejecutaría como PHP** desde el navegador. Se conserva el nombre `old-files`, pero en `api/var/old-files/`. ✅ *Confirmado.*
- El actualizador **nunca toca** `api/var/` ni `api/config/`.

```
api/var/
├── .htaccess            (Require all denied)
├── backups/             (antes: storage/backups — se migra en Fase 0)
├── update/
│   ├── state.json       (estado del job en curso)
│   ├── lock
│   ├── package.zip
│   └── staging/
├── old-files/           (código de la versión anterior; existe solo tras actualizar)
└── release.json         (manifiesto de archivos de la versión instalada)
```

### 2.2 Versión única (backend + frontend)

- Fuente de verdad: `version.json` en la raíz del repo, con `version`, `schema` y `released_at`.
- El script de build genera:
  - `api/version.php` → `return ['version' => '2.1.0', 'schema' => 5, 'released_at' => '…'];`
  - el `define` de Vite para `version.ts`. `APP_VERSION` deja de editarse a mano.
- `GET /v1/settings/public` también devuelve `app_version`. Si el frontend detecta una versión distinta a la compilada, hace **recarga forzada**. Así nadie se queda con bundles viejos después de actualizar.

### 2.3 Modo mantenimiento

- Bandera: `api/config/maintenance.json` (`started_at`, `by_user_id`, `reason: update|restore`, `target_version`).
- `api/index.php` la revisa al inicio. Con la bandera activa responde `503 MAINTENANCE` a todo, salvo `/v1/health`, `/v1/system/status` y el runner del actualizador.
- **`/storage/*` sigue funcionando durante el mantenimiento**, porque lo sirve Apache sin PHP: las URL públicas de los desarrolladores no se caen durante una actualización. En cambio, los enlaces `/s/{token}` (que pasan por PHP) muestran la pantalla de mantenimiento.
- Frontend: el interceptor de `api` detecta `503 MAINTENANCE` y muestra `<MaintenanceScreen>`:
  > **Actualización en curso**
  > Estamos aplicando mejoras a la plataforma. Inténtalo de nuevo en unos minutos o consulta a tu administrador.
  > *(Reintenta automáticamente cada 30 s.)*

### 2.4 Cierre global de sesiones

Revocar los refresh tokens no basta, porque el access token sigue vivo hasta 15 min. Por eso:

- Se agrega el setting `auth_epoch` (entero) y el access token incluye el claim `ep`.
- `AuthMiddleware` rechaza los tokens con `ep < auth_epoch` (`401 SESSION_REVOKED`).
- «Cerrar todas las sesiones» = `auth_epoch++` y `UPDATE refresh_tokens SET revoked_at = NOW() WHERE revoked_at IS NULL`.
- Se reutiliza también en «Cerrar sesión en todos los dispositivos» del perfil.

### 2.5 Programador de tareas (refactor de `CronService`)

```php
interface ScheduledTask {
    public function key(): string;              // 'quota_check', 'update_check', 'backup', 'links_expire'
    public function isDue(DateTimeImmutable $now, ?DateTimeImmutable $lastRun): bool;
    public function run(): array;               // métricas para el log
}
```

- `cron_task_last_run:{key}` en `settings`.
- Un lock con `flock` evita que dos cron se pisen.
- Intervalos: `quota_check` 1 h · `update_check` 12 h · `backup` según la programación · `links_expire` 1 h · `stale_uploads` 6 h · `share_hits_prune` 1 día.
- La pantalla **Tareas Cron** muestra cada tarea con su última ejecución y resultado.

### 2.6 Runner de trabajos por pasos

En hosting compartido, `max_execution_time`, el proxy y Cloudflare cortan peticiones largas. **Ninguna operación pesada se hace en una sola petición.**

- El estado se guarda en `api/var/update/state.json`, en un archivo y no en la BD, porque la BD puede estar en plena migración.
- Cada llamada `POST …/step` avanza un paso acotado (~15 s de trabajo) y responde `{ step, progress, log[] }`.
- El frontend llama en bucle mientras el paso no sea terminal. Si el navegador se cierra, el trabajo **continúa donde quedó** al volver.
- Si el cron corre por CLI (sin límite de tiempo), también puede avanzar trabajos programados, como los backups automáticos.
- Lo usan el actualizador, la restauración y los backups grandes.

---

## 3. Bloque A — Actualizador OTA (prioridad 1)

### 3.1 Servidor de actualizaciones

✅ **Confirmado:** se usa prestado el sitio `techmaleon.com.mx`, en el subdirectorio `project-cloud/`. Basta con archivos estáticos (sin PHP ni base de datos), subidos por el Administrador de archivos de Plesk o por FTP:

```
techmaleon.com.mx/            (httpdocs del sitio)
└── project-cloud/
    ├── .htaccess                    ← sin listado de carpetas; manifest.json sin caché
    ├── manifest.json                ← última versión publicada (un solo canal)
    └── releases/
        ├── project-cloud-2.1.0.zip
        └── project-cloud-2.1.1.zip
```

URL que consulta la plataforma: `https://techmaleon.com.mx/project-cloud/manifest.json` (se puede sobreescribir en `settings.update_server_url` para pruebas locales).

`.htaccess` de `project-cloud/`:

```apache
Options -Indexes
<Files "manifest.json">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
</Files>
```

> Si `techmaleon.com.mx` es un WordPress, o tiene un plugin de caché o Cloudflare, hay que excluir `/project-cloud/` de la caché. Si no, las instalaciones podrían ver un `manifest.json` viejo. Como las carpetas físicas tienen prioridad sobre las reglas de WordPress, los archivos se sirven sin tocar el sitio.
>
> El día que haya un subdominio propio (`updates.…`), basta con cambiar la URL por defecto en un release: las instalaciones la toman al actualizar.

**`manifest.json`**

```json
{
  "product": "project-cloud",
  "channel": "stable",
  "version": "2.1.1",
  "released_at": "2026-11-02T18:00:00Z",
  "schema": 5,
  "min_from_version": "2.1.0",
  "requirements": { "php": "8.1", "extensions": ["zip", "pdo_mysql", "curl", "sodium"] },
  "package": {
    "url": "releases/project-cloud-2.1.1.zip",
    "size_bytes": 4821331,
    "sha256": "9f2c…"
  },
  "migrations": { "reversible": true },
  "changelog": [
    { "type": "feature", "text": "Enlaces compartidos con QR y caducidad" },
    { "type": "fix",     "text": "Las copias de seguridad ya no son accesibles por URL" }
  ],
  "features": ["share_links", "scheduled_backups"],
  "signature": { "alg": "ed25519", "key_id": "637f4a7d43b7ddba", "value": "base64(…)" }
}
```

La URL del paquete es **relativa al manifiesto**: si algún día el servidor de versiones se muda de dominio, los paquetes no cambian. La firma cubre producto, versión, schema, `min_from_version`, sha256 y tamaño del ZIP y si las migraciones son reversibles (`ReleaseVerifier::signedMessage()` ↔ `scripts/release/lib.mjs`). Cómo publicar: [release/README.md](release/README.md).

### 3.2 Seguridad del actualizador (la «llave única»)

Conviene separar **dos llaves distintas**, porque cumplen funciones diferentes:

| Llave | Dónde vive | Para qué |
| :--- | :--- | :--- |
| **Llave privada de firma (Ed25519)** | **Solo en tu máquina de build o en un secreto de CI.** Nunca en el servidor de releases ni en los clientes. | Firma cada release. |
| **Llave pública de firma** | Incluida en el código: `api/src/Updater/release.pub` | Cada instalación verifica la firma antes de extraer el ZIP. |

Con esto, **aunque alguien comprometa el servidor de actualizaciones (el sitio `techmaleon.com.mx`), no puede distribuir código malicioso**: sin la llave privada, la firma no valida y la plataforma rechaza el paquete. PHP trae `sodium` desde la 7.2 (`sodium_crypto_sign_verify_detached`).

**Custodia de la llave privada:**
- Se genera una sola vez (`scripts/release/keygen.mjs`) en `~/.project-cloud/release-signing.key`, **fuera del repositorio**. Además se agrega `*.key` a `.gitignore` como protección extra.
- **Guárdala en un gestor de contraseñas o en una memoria cifrada.** Si se pierde, no se pueden firmar nuevas versiones y cada instalación tendría que reinstalarse a mano con una llave nueva. Si se filtra, hay que rotarla (release manual con la llave pública nueva).

> **Descartado: `instance_id`.** Era un identificador anónimo que cada instalación habría enviado al buscar actualizaciones, solo para saber cuántas instalaciones existen y en qué versión está cada una. No cambia el funcionamiento. Como hoy solo existe `drive`, **no se implementa**: la consulta es anónima y solo descarga el `manifest.json`.

Verificaciones obligatorias antes de tocar un solo archivo:

1. HTTPS con verificación de certificado (`CURLOPT_SSL_VERIFYPEER`).
2. `sha256(package.zip) === manifest.package.sha256`.
3. Firma Ed25519 válida.
4. `version > instalada` y `instalada >= min_from_version`.
5. **Zip-slip:** se rechaza cualquier entrada con `..`, ruta absoluta o fuera de la lista permitida (`public/`, `api/`, `release.json`).
6. `release.json` del paquete: el hash de cada archivo extraído coincide.

### 3.3 Estructura del paquete (lo genera el build)

```
project-cloud-2.1.1.zip
├── release.json          ← versión, schema y lista de TODOS los archivos con sha256
├── public/               ← contenido de frontend/dist (index.html, app-assets/…) → raíz del hosting
└── api/                  ← backend SIN config/config.php, install.lock, var/ ni scripts de depuración
```

Script: `scripts/release/build.mjs` (Node, porque ya se usa para el frontend):

1. Lee `version.json`, genera `api/version.php` y ejecuta `npm run build`.
2. Copia `dist/` → `public/` y `api/` → `api/`, aplicando la lista de exclusión.
3. Calcula los sha256 por archivo y escribe `release.json`.
4. Arma el ZIP, calcula su sha256 y lo firma con `crypto.sign(null, data, privateKeyEd25519)`.
5. Escribe `manifest.json`. La publicación (subir al subdominio) se hace a mano o con CI.

### 3.4 Rutas protegidas: el actualizador NUNCA las toca

```
storage/            (unidades de usuarios y platform/ con los logos — cualquiera que sea storage.path)
<assets_folder_name>/  (unidad compartida de la organización, hermana de storage — AssetsService)
avatars/   thumbs/  (hermanas de storage, ver AvatarService / ThumbnailService)
api/config/         (config.php, install.lock, maintenance.json)
api/var/            (backups, old-files, estado del updater)
.well-known/
cualquier archivo que NO aparezca en el release.json de la versión instalada
```

**`.htaccess` raíz:** cada hosting puede tenerlo personalizado. Se usa el patrón de WordPress: el release solo reemplaza el bloque entre `# BEGIN Project Cloud` y `# END Project Cloud`, y lo que esté fuera de esos marcadores se conserva. Si no hay marcadores (instalaciones viejas), se escribe `.htaccess.new` y se avisa al admin.

**Archivos obsoletos:** solo se borran los que estaban en el `release.json` anterior y ya no están en el nuevo. Un archivo que el admin agregó a mano jamás se borra.

**Unidad compartida:** su carpeta física la decide cada instalación (`settings.assets_folder_name`; si nunca se cambió, `assets`). El actualizador **lee el valor en uso al momento de actualizar**, nunca un valor fijo. El `preflight` **bloquea la actualización** si ese nombre coincide con una carpeta que trae el paquete (hoy solo `app-assets/`) y le explica al admin cómo renombrarla. El build garantiza que `public/` solo contiene `index.html`, `.htaccess` y `app-assets/`. En `drive` la carpeta es `assets` y no hay conflicto; en el entorno local está como `app-assets` y habrá que cambiarla antes de probar la Fase 2.

### 3.5 Flujo en la interfaz

**Detección (cron cada 12 h + botón «Buscar actualizaciones»):**
- **No depende del cron.** Si el cron no está configurado o falla, la verificación también se dispara cuando un admin abre el dashboard y la última verificación tiene más de 12 h.
- Descarga el manifiesto (timeout 10 s) y guarda `update_available` en `settings`.
- Una vez por versión, crea una notificación `system.update_available` **solo para admins**.
- **Dashboard (solo admins):** banner «Hay una nueva versión disponible: v2.1.1 → Ver detalles».
- **Sidebar:** badge en «Configuración». **Pestaña nueva** en `SETTINGS_NAV`: «Actualizaciones» (icono `RefreshCw`) con su propio badge.

**Página `/admin/settings/updates`:**

```
┌ Versión instalada ──────────────────────────────────────────────┐
│ v2.0.0 · schema 4 · última verificación: hace 2 h  [Buscar ahora]│
└──────────────────────────────────────────────────────────────────┘
┌ Disponible: v2.1.1 (2 nov 2026) ────────────────────────────────┐
│ • Enlaces compartidos con QR y caducidad                         │
│ • Las copias de seguridad ya no son accesibles por URL           │
│ Requisitos: PHP 8.1 ✓  zip ✓  sodium ✓  espacio libre 1.2 GB ✓   │
│                                            [Actualizar ahora]    │
└──────────────────────────────────────────────────────────────────┘
┌ Respaldo de la versión anterior (old-files) — v2.0.0, 48 MB ────┐   ← solo si existe api/var/old-files
│ [Revertir a v2.0.0]   [Eliminar respaldo]                        │
└──────────────────────────────────────────────────────────────────┘
┌ Historial de actualizaciones ───────────────────────────────────┐
│ 02 nov 2026  2.0.0 → 2.1.1  ✓ completada  (ver registro)         │
└──────────────────────────────────────────────────────────────────┘
```

> Sugiero renombrar **«Limpiar registros»** como **«Eliminar respaldo de la versión anterior»**. Lo que se borra es el código de respaldo, no un log, y el nombre actual se presta a confusión. El botón aparece **solo si existe `old-files`**; al pulsarlo se borra la carpeta y el bloque desaparece.

**Modal previo (obligatorio):**

> ### Antes de actualizar
> Vas a actualizar **Project Cloud v2.0.0 → v2.1.1**.
>
> - La plataforma entrará en **modo mantenimiento** unos minutos y **se cerrarán todas las sesiones activas**. Los usuarios tendrán que volver a iniciar sesión.
> - **Los archivos de tus usuarios no se modifican.** Las URL públicas seguirán funcionando durante el proceso.
> - Se guardará una copia del código actual para que puedas revertir si algo falla.
>
> **Te recomendamos crear una copia de seguridad antes de continuar.** Tu última copia es del **29 oct 2026 (hace 4 días)**.
>
> ( ) **Crear copia del sistema ahora y continuar** *(recomendado — base de datos + configuración, unos segundos)*
> ( ) Ir a Copias de seguridad
> ( ) Continuar sin copia nueva
>
> ☐ Entiendo que la plataforma no estará disponible durante la actualización.
>
> [Cancelar]  [Actualizar]

Detalle importante: para actualizar basta una **copia del sistema** (BD + config, que pesa poco), porque el código ya queda en `old-files` y el actualizador no toca los archivos de usuarios. La **copia completa** (con `storage/`) puede pesar decenas de GB, así que no se fuerza.

### 3.6 Pasos del runner (con %)

| # | Paso | % | Qué hace | Si falla |
| :-- | :--- | :-- | :--- | :--- |
| 1 | `preflight` | 0–3 | Vuelve a validar requisitos, espacio (≥ 3× tamaño del ZIP) y permisos de escritura; toma el `lock` | Aborta, sin cambios |
| 2 | `backup` | 3–15 | Copia del sistema (si se eligió) | Aborta, sin cambios |
| 3 | `maintenance_on` | 15 | Escribe `maintenance.json`, `auth_epoch++` y revoca los refresh tokens | — |
| 4 | `download` | 15–45 | Descarga por bloques (`Range`) a `api/var/update/package.zip`; % por bytes | Reintenta 3 veces y luego aborta |
| 5 | `verify` | 45–50 | sha256 + firma Ed25519 | **Aborta y borra el paquete** |
| 6 | `extract` | 50–60 | Extrae a `staging/` con protección zip-slip | Aborta |
| 7 | `validate` | 60–62 | Hashes de `release.json`; archivos críticos presentes | Aborta |
| 8 | `snapshot` | 62–70 | Borra el `old-files` previo y **mueve** ahí los archivos actuales que se van a reemplazar o borrar; guarda `old-files/meta.json` (versión origen) | Aborta |
| 9 | `swap` | 70–85 | Copia staging → destino (archivo temporal + `rename` atómico). **`index.html` va al final** | **Rollback automático** desde `old-files` |
| 10 | `cleanup_obsolete` | 85–88 | Borra los archivos obsoletos según el manifiesto | Rollback |
| 11 | `migrate` | 88–95 | `SchemaMigrator` (código nuevo) + migraciones versionadas; actualiza `schema_version` | Rollback de código (ver 3.7) |
| 12 | `post_check` | 95–98 | `opcache_reset()`, autollamada a `/v1/health`, guarda el nuevo `api/var/release.json` | Rollback |
| 13 | `finalize` | 100 | `app_version`, quita mantenimiento, notifica a los admins, registra en `activity_log`, limpia staging | — |

**El runner se actualiza a sí mismo al final.** El punto de entrada es `api/update-runner.php`: un script independiente (sin router) que se autentica con un **token de actualización de un solo uso** emitido en `start`. Se reemplaza en `finalize`, para que el proceso nunca cambie de código a mitad de camino.

**Pantalla «Actualizando»** (solo para el admin que lanzó el proceso; los demás ven `MaintenanceScreen`):

```
            Actualizando Project Cloud a v2.1.1
            ████████████████████░░░░░░░░  68 %
            ✓ Requisitos   ✓ Copia del sistema   ✓ Descarga (4.8 MB)
            ✓ Verificación de firma   ✓ Extracción   ● Guardando versión anterior…
            No cierres esta ventana. Si se cierra, el proceso continuará al volver.
```

Al terminar: «Actualización completada. Inicia sesión de nuevo» → login. El admin también vuelve a iniciar sesión.

**Copia previa a la actualización:** es una copia **del sistema** (BD + config, pocos MB), con la etiqueta `pre-update-2.1.1`. Tiene una cola propia de **1** (cada actualización reemplaza la anterior), para no desplazar las copias completas de la rotación (§4.1) ni consumir espacio.

### 3.7 Reversión y política de migraciones

- **Revertir** = restaurar el código desde `old-files` (mismo runner, en modo mantenimiento) y devolver `app_version` a la versión anterior.
- Para que revertir el código sea seguro **sin** restaurar la BD, las migraciones siguen la regla **expand-only** dentro de una misma versión mayor: solo se agregan tablas, columnas con default o índices; no se borra ni se renombra nada. El código anterior ignora lo nuevo y sigue funcionando.
- Si un release necesita una migración destructiva, el manifiesto lo marca con `migrations.reversible: false`. En ese caso la UI **exige** una copia de seguridad y avisa que revertir requiere restaurar esa copia.
- Las migraciones pasan de `applyManualMigrations()` a archivos versionados: `api/database/migrations/0005_share_links.php`. Cada uno tiene `up()` idempotente y se registra en `settings.schema_version`.

### 3.8 Cómo probarlo (y el primer salto)

- **El primer salto es manual.** `drive` está en `v2.0.0` y no tiene actualizador; la `v2.1.0`, que lo trae, se sube a mano por única vez. A partir de ahí todo es OTA.
- ✅ **Sin beta ni staging:** solo existe `drive` (producción). Para compensar, **toda prueba destructiva se hace primero en local**, y en producción solo se publica lo que ya pasó la lista:
  1. Entorno local: el proyecto en `php -S` (o XAMPP) con su BD, **simulando el layout de `httpdocs`** (ver §8). Se instala `v2.1.0` en él.
  2. Servidor de releases local: `php -S localhost:8090 -t ./_releases` y `settings.update_server_url = http://localhost:8090/manifest.json` (solo se permite `http` con `env=development`).
  3. Se generan releases de prueba `2.1.1` y `2.1.2` (cambios triviales) y se corren todos los escenarios de abajo.
  4. Producción: copia completa de `drive` y descarga local de esa copia (además de tus respaldos de storage) → subir `v2.1.0` a mano → publicar `2.1.1` en `techmaleon.com.mx/project-cloud/` → primera OTA real.
- Escenarios de prueba:
  - [ ] 2.1.0 → 2.1.1 normal (con y sin copia previa)
  - [ ] Firma inválida / sha256 alterado → rechazo sin cambios
  - [ ] ZIP con `../` → rechazo
  - [ ] Cerrar el navegador en `download` y en `swap` → al volver, el proceso continúa
  - [ ] Error forzado en `migrate` → rollback automático y la plataforma funciona en la versión anterior
  - [ ] Revertir manual y luego eliminar el respaldo (el botón desaparece)
  - [ ] Usuario conectado durante la actualización → ve la pantalla de mantenimiento y luego tiene que iniciar sesión de nuevo
  - [ ] Durante el mantenimiento, `/storage/usuario/archivo.png` sigue respondiendo 200
  - [ ] `.htaccess` personalizado fuera de los marcadores se conserva
  - [ ] Poco espacio en disco → `preflight` bloquea

### 3.9 API

```
GET    /v1/system/status                      (público) { maintenance, reason, app_version }
GET    /v1/admin/updates                      estado: instalada, disponible, requisitos, old_files, historial
POST   /v1/admin/updates/check                verificar ahora
POST   /v1/admin/updates/start                { version, backup: "system"|"none", ack: true } → { run_token }
POST   /api/update-runner.php?op=step         (X-Update-Token) avanza un paso
GET    /api/update-runner.php?op=progress     (X-Update-Token) estado para reanudar
POST   /v1/admin/updates/rollback             revertir a old-files
DELETE /v1/admin/updates/old-files            eliminar respaldo de la versión anterior
```

Settings nuevos: `app_version`, `update_server_url` (default `https://techmaleon.com.mx/project-cloud/manifest.json`), `update_last_check`, `update_available` (JSON), `update_notified_version`, `auth_epoch`.

---

## 4. Bloque B — Copias programadas, rotación y restauración con diagnóstico

### 4.1 Programación

Nueva sección en **Base de datos → Copias automáticas**:

| Opción | Valores | Default |
| :--- | :--- | :--- |
| Frecuencia | Desactivada · Diaria · Semanal · Cada 15 días · Mensual | Semanal |
| Hora | 00:00–23:00 (hora del sitio) | 03:00 |
| Copias a conservar | 1 · 2 · 3 | 3 (máximo absoluto) |
| Tipo | Sistema (BD + config) · Completa (sistema + archivos) | Completa |

✅ **Confirmado: límite estricto, sin copias fijadas.** El máximo es 3, configurable a 2 o 1 para ahorrar espacio en hostings o VPS pequeños. Ninguna copia queda fuera de la cuenta.

**Rotación (FIFO):** al terminar **con éxito** una copia nueva, manual o automática, se borran definitivamente las más antiguas hasta quedar en el máximo. La antigua se borra **después** de que la nueva quedó bien. Si se borrara antes y la nueva fallara, podrías quedarte sin ninguna copia.

Consecuencia que hay que aceptar: mientras se crea la copia nueva, hay **máximo + 1** copias en disco por unos minutos. El `preflight` de la copia revisa que haya espacio para esa copia extra; si no lo hay, avisa y no empieza.

Única excepción: la copia del sistema **pre-actualización** (§3.6) tiene su propia cola de 1, porque pesa unos pocos MB.

> **Sobre «3-2-1»:** en backups, «3-2-1» suele significar *3 copias, en 2 medios distintos, 1 fuera del servidor*. Aquí el selector es de 1, 2 o 3 copias **en el mismo hosting**, lo que protege contra errores y malas actualizaciones, pero **no contra la pérdida del servidor**. Para más adelante: enviar una copia a un destino externo (S3, FTP o Google Drive).

### 4.2 Contenido configurable

- **Siempre incluido:** dump de la BD, `config.php`, `install.lock`, `release.json` y `backup.json` (manifiesto de la copia: versión, schema, fecha, alcance, conteos y hashes). Sin el manifiesto, el diagnóstico de 4.4 no es posible.
- **Opcional (casillas):** unidades de usuarios · unidad compartida de la organización · papeleras · avatares. Las miniaturas se excluyen siempre, porque se regeneran.
- **Filtro por extensiones:**
  - Fuente de datos: `SELECT extension, COUNT(*), SUM(size_bytes) FROM files WHERE deleted_at IS NULL GROUP BY extension`, más un escaneo de `storage/platform`, porque la unidad compartida no está en la tabla `files`.
  - Modos: *Todas* · *Solo las seleccionadas* · *Todas excepto las seleccionadas*.
  - La UI muestra el **tamaño estimado** de la copia y el **espacio libre** del disco. Si no alcanza, avisa antes de empezar.
- **Rendimiento:** dump en streaming a archivo, ZIP por lotes con el runner de pasos y, cuando el cron es CLI, avance en segundo plano. Al terminar se notifica a los admins (éxito o error).

### 4.3 Restauración — mismo proceso que la actualización

Mantenimiento → cierre de sesiones → pasos con % → mantenimiento off. La misma pantalla y el mismo runner.

### 4.4 Analizador previo a restaurar

El botón **«Analizar»** (que se ejecuta automáticamente antes de «Restaurar») devuelve un semáforo:

| Revisión | Ejemplo de resultado |
| :--- | :--- |
| **Integridad** | ZIP abre con `ZipArchive::CHECKCONS`, CRC de cada entrada, dump presente y con marcador final `-- END OF DUMP`, hashes de `backup.json` |
| **Versión** | Copia `2.1.0` / plataforma `2.1.1` → ✓ la BD se migra hacia arriba al restaurar. Copia **más nueva** que la plataforma → ⛔ bloqueado: actualiza primero |
| **Funciones que se pierden** | Con `features` de los manifiestos: «La copia es anterior a *Enlaces compartidos*: se perderán 14 enlaces activos creados después del 29 oct» |
| **Archivos faltantes** | «312 archivos registrados en la BD no están en la copia (excluidos por el filtro de extensiones `.mp4`). Quedarán como rotos» → opciones: restaurar igual / solo BD / cancelar |
| **Huérfanos** | «58 archivos en disco no existen en la copia (subidos después)» → moverlos a cuarentena `api/var/restore-orphans/{fecha}` o conservarlos |
| **Usuarios** | Carpetas de `storage/` sin usuario en la BD, o al revés |
| **Entorno** | Espacio libre, permisos de escritura, extensiones PHP |

Resultado: **✓ Todo en orden** · **⚠ Advertencias** (permite continuar con confirmación) · **⛔ Bloqueante**.

### 4.5 API

```
GET  /v1/admin/backups/settings        PUT /v1/admin/backups/settings
GET  /v1/admin/backups/extensions      (conteo y tamaño por extensión)
POST /v1/admin/backups/{file}/analyze  → informe de diagnóstico
POST /v1/admin/backups/{file}/restore  → inicia el job (requiere análisis sin bloqueantes)
```

Las rutas actuales `/v1/admin/database/backups*` se conservan como alias durante una versión.

---

## 5. Bloque C — Enlaces compartidos y QR

### 5.1 Ajustes al planteamiento (incoherencias que conviene resolver antes)

**① Un archivo con URL pública no puede tener un enlace «restringido».**
Hoy **todo** archivo es accesible en `/storage/{usuario}/{ruta}`. Si creas un enlace «Solo miembros de la organización» para `contrato.pdf`, cualquiera que conozca o adivine `/storage/carlos/docs/contrato.pdf` lo descarga igual. El enlace restringido sería una ilusión.

**Propuesta: visibilidad por archivo o carpeta.**

| Visibilidad | Comportamiento | Para quién |
| :--- | :--- | :--- |
| **Pública** (default, comportamiento actual) | URL directa `/storage/…`, servida por Apache; ideal para referenciar en código | Desarrolladores, assets, CDN |
| **Privada** | El binario se mueve físicamente a `storage/.private/{usuario}/…` (bloqueado por `.htaccess`, igual que `.trash`). Solo se sirve desde PHP, por enlace con token o con sesión | Documentos sensibles |

- **El default de las subidas nuevas sigue siendo «Pública»**, así que nada cambia para quien usa el drive como CDN. Cada usuario puede cambiar su default en el perfil.
- Al elegir el acceso «Solo miembros» o al poner contraseña, la UI pide hacer el archivo privado: «Este archivo también es accesible por su URL pública. ¿Hacerlo privado? La URL directa dejará de funcionar».
- También hay que proteger `GET /v1/files/{id}/thumb`, que hoy es público y se adivina por id numérico, para los archivos privados.

**② «Quien tenga el enlace» y «Público general» casi se superponen.** Propongo tres niveles claros (más las invitaciones que ya existen):

| Nivel | URL | Caducidad | Contador | Revocable |
| :--- | :--- | :--- | :--- | :--- |
| 🌐 **Público (URL directa)** | `/storage/carlos/img/logo.png` — predecible, permanente | No | No* | Solo moviendo o haciendo privado el archivo |
| 🔗 **Cualquiera con el enlace** | `/s/7Gk2pQ9xLm3vRt8yBn4wZa` | Sí | Sí | Sí |
| 🏢 **Solo miembros de la organización** | `/s/…` + inicio de sesión obligatorio | Sí | Sí (con quién) | Sí |
| 👤 *Personas específicas* | Invitaciones actuales (`shared_access`) | — | — | Sí |

\* Contar visitas en la URL directa obligaría a pasar cada archivo por PHP, y eso mata justo lo que la hace valiosa (velocidad, caché, CDN). **No se cuenta, a propósito.**

**③ QR y enlace no son dos cosas distintas.** Un QR es solo **otra forma de mostrar un enlace**. No tiene sentido caducidad «del QR» y caducidad «del enlace» por separado. Si quieres reglas distintas (por ejemplo, un QR para un evento que caduque mañana y un enlace permanente para un cliente), creas **dos enlaces** del mismo archivo, cada uno con su etiqueta. Por eso se permiten **varios enlaces por archivo**.

**④ ¿La URL va encriptada o enmascarada?** No se encripta: se usa un **token aleatorio** sin relación con el archivo.
- `https://drive.techmaleon.com.mx/s/7Gk2pQ9xLm3vRt8yBn4wZa`: 22 caracteres base62 ≈ **131 bits** de `random_bytes()`. Es imposible de adivinar por fuerza bruta.
- La URL **no revela** nombre, carpeta, usuario ni id. El nombre solo se ve en la página una vez que se otorga el acceso.
- Además: `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer` y rate-limit en `/s/*` para frenar el escaneo.
- El token se guarda en claro (con índice único) para poder volver a mostrar el enlace y el QR desde el panel, como hace Google Drive. La contraseña opcional del enlace sí se guarda con hash (`password_hash`).

**⑤ Quién puede crear enlaces** (lo que planteas, con dos precisiones):

| Unidad | Puede crear enlaces y QR | No puede |
| :--- | :--- | :--- |
| **Mi unidad** | Solo el **propietario** | Los invitados, aunque tengan permiso `full`. Ejemplo: Pedro, invitado a la carpeta de Carlos, **no** puede generar enlaces ni QR; solo Carlos |
| **Unidad compartida de la organización** | Solo los **admins** | Los usuarios permitidos de la unidad |
| **Global** | Los admins **ven y revocan** cualquier enlace de la instancia (auditoría) | Los admins **no crean** enlaces sobre la unidad privada de otro usuario (privacidad) |

- *Precisión 1:* el «Copiar URL pública» que hoy ve el invitado es coherente con la regla mientras el archivo sea público, porque esa URL ya es pública. En archivos **privados**, el invitado deja de ver la URL directa.
- *Precisión 2:* un invitado con permiso de lectura **siempre** puede descargar y volver a subir el archivo a su propia unidad. Esto no se puede impedir técnicamente; conviene que quede claro en la documentación. Más adelante se puede agregar «Bloquear descarga» a nivel de invitación.
- *A futuro (opcional):* el interruptor por invitación «Permitir a este usuario compartir», como el «Los editores pueden compartir» de Google Drive. Queda apagado por defecto.

**⑥ Ciclo de vida del archivo y su enlace.** El enlace apunta al `file_id`, no a la ruta:

| Evento | Efecto en el enlace |
| :--- | :--- |
| Renombrar o mover | Sigue funcionando (la URL directa sí cambia, como hoy) |
| A la papelera | Queda **suspendido** («Este archivo ya no está disponible») |
| Restaurar de la papelera | Se reactiva si no ha caducado |
| Borrado definitivo | Se elimina (`ON DELETE CASCADE`) |
| Propietario suspendido o eliminado | Deja de funcionar o se elimina |
| Unidad compartida (sin ids) | El enlace guarda la ruta; `AssetsService::move/rename` actualiza los enlaces afectados |

**⑦ Alcance de la primera entrega:** enlaces de **archivo** y de **carpeta** (estilo MEGA o MediaFire). El ZIP de carpeta queda para después. **No** se ofrecen enlaces de unidad completa: para eso existen las invitaciones.

**⑧ Todo aplica a las dos unidades.** Enlaces, QR, caducidad, contador, revocación y el panel funcionan igual en **Mi unidad** (los crea solo el propietario) y en la **unidad compartida de la organización** (los crean solo los admins). La única diferencia interna: en Mi unidad el enlace apunta al id del archivo o carpeta; en la unidad compartida, a su ruta (§5.1-⑥).

**⑨ Carpeta compartida por enlace: vista pública de solo lectura.** Alguien **sin cuenta y sin iniciar sesión** abre el enlace de una carpeta y entra a una vista limitada:

| Puede | No puede |
| :--- | :--- |
| Ver los archivos y **subcarpetas** de la carpeta compartida y navegar dentro de ellas | Subir, crear carpetas, renombrar, mover, borrar, destacar ni compartir |
| Abrir la vista previa (imagen, PDF, video, audio, texto) | Ver cualquier cosa **por encima** de la carpeta compartida |
| Descargar archivos uno a uno (si el enlace permite descarga) | Ver el árbol de la unidad, búsqueda, recientes, papelera, cuota ni el nombre de usuario del dueño |
| Cambiar el tema (claro u oscuro) | Ver menús de acciones o clic derecho con opciones de edición |

Diseño de la vista (`/s/{token}` y `/s/{token}/f/{subcarpeta}`):
- **Sidebar vacía.** Solo el logo de la organización y el botón de tema; sin «Mi unidad», «Compartidos», cuota ni accesos.
- **Topbar mínima.** Nombre de la carpeta compartida, selector de vista (cuadrícula o lista), orden y tema. Sin buscador global, notificaciones ni avatar. A la derecha, «Iniciar sesión» si la organización lo permite.
- **Migas de pan acotadas.** Empiezan en la carpeta compartida (que hace de raíz) y solo llegan hasta donde está el visitante. Ejemplo: se compartió `Proyectos/Cliente X` → el visitante ve `Cliente X › Entregables › Fotos`, nunca `Proyectos` ni `Mi unidad`.
- **Reutiliza el explorador actual** (`FileGridView`, `FileListView`, `PreviewModal`) con un adaptador de solo lectura (`PublicFolderAdapter`) que declara todas las capacidades de edición en `false`. Así los botones de edición no se ocultan con CSS: simplemente no existen.

Seguridad del backend (no basta con ocultar botones):
- Las rutas públicas (`/v1/public/links/{token}/…`) son **solo GET** (más el desbloqueo con contraseña). No existe ninguna ruta pública de escritura.
- Cada petición recibe la subcarpeta como **id o ruta relativa a la carpeta compartida** y el backend comprueba que realmente sea descendiente de ella (`isDescendantOf`, y en la unidad compartida `realpath` + prefijo). Cualquier intento de subir con `..` o con un id ajeno responde 404.
- Archivos en la papelera o eliminados no aparecen. Las subcarpetas **privadas** (§5.1-①) dentro de una carpeta compartida **sí** se ven por el enlace: el propietario la compartió entera, y la UI de compartir avisa cuántos elementos privados contiene.
- El contador registra la visita al abrir el enlace (no por cada subcarpeta) y las descargas por archivo.

**⑩ Paso a miembro.** Si quien recibió el enlace necesita **editar o subir**, el camino es el de siempre: el admin le crea una cuenta en la organización y el propietario lo **invita** a la carpeta (`shared_access`). El enlace público nunca escala a permisos de escritura.

### 5.2 Modelo de datos

```sql
ALTER TABLE files   ADD COLUMN visibility ENUM('public','private') NOT NULL DEFAULT 'public';
ALTER TABLE folders ADD COLUMN visibility ENUM('public','private') NOT NULL DEFAULT 'public';

CREATE TABLE share_links (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token            CHAR(22) NOT NULL,                       -- base62, 131 bits
  created_by       BIGINT UNSIGNED NOT NULL,                -- propietario (o admin en unidad org)
  scope            ENUM('drive','org') NOT NULL,            -- Mi unidad | Unidad compartida
  target_type      ENUM('file','folder') NOT NULL,
  target_id        BIGINT UNSIGNED NULL,                    -- files.id / folders.id (scope=drive)
  target_path      VARCHAR(1024) NULL,                      -- ruta relativa (scope=org)
  access           ENUM('anyone','members') NOT NULL DEFAULT 'anyone',
  label            VARCHAR(120) NULL,                       -- "QR stand expo", "Cliente X"
  allow_download   TINYINT(1) NOT NULL DEFAULT 1,
  password_hash    VARCHAR(255) NULL,
  expires_at       DATETIME NULL,                           -- NULL = no caduca
  max_views        INT UNSIGNED NULL,                       -- opcional
  view_count       INT UNSIGNED NOT NULL DEFAULT 0,
  download_count   INT UNSIGNED NOT NULL DEFAULT 0,
  last_accessed_at DATETIME NULL,
  revoked_at       DATETIME NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_share_links_token (token),
  KEY idx_share_links_owner (created_by, revoked_at),
  KEY idx_share_links_target (scope, target_type, target_id),
  CONSTRAINT fk_share_links_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE share_link_hits (                              -- detalle; retención 90 días (cron)
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  link_id    BIGINT UNSIGNED NOT NULL,
  kind       ENUM('view','download') NOT NULL,
  user_id    BIGINT UNSIGNED NULL,                          -- si access=members
  ip_hash    CHAR(64) NOT NULL,                             -- sha256(ip + instance salt), no IP en claro
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hits_link (link_id, created_at),
  CONSTRAINT fk_hits_link FOREIGN KEY (link_id) REFERENCES share_links (id) ON DELETE CASCADE
);
```

**Contador:** `view_count` sube al abrir la página del enlace y `download_count` al descargar. Para no inflar las cifras con recargas, se cuenta una visita por `ip_hash` por enlace cada 30 min.

### 5.3 Caducidad

- Al crear: **1 hora · 24 horas · 7 días · 30 días · Fecha personalizada · Sin caducidad**.
- Editable en cualquier momento: **extender**, **hacer permanente** o **volver a limitar**.
- Al caducar, el enlace muestra «Este enlace ha caducado» y en el panel queda en «Caducados». Se puede **reactivar** con una nueva fecha sin cambiar el token: el QR impreso sigue sirviendo.
- **Políticas del admin** (Configuración → Espacio de trabajo): permitir o desactivar los enlaces · caducidad máxima obligatoria (por ejemplo, ≤ 30 días) · permitir o no «Sin caducidad» · permitir o no «Cualquiera con el enlace».

### 5.4 QR

- Se genera **en el cliente** con la librería `qrcode` (npm), sin depender de servicios externos.
- Codifica el enlace `/s/{token}`, o la URL directa si se eligió «Público».
- Opciones: **mostrar en pantalla completa** (para que lo escaneen desde el teléfono o en una reunión), **descargar PNG o SVG** e incluir el logo de la marca al centro (corrección de errores nivel H).
- En móvil: botón «Compartir» nativo (`navigator.share`) con el enlace.

### 5.5 Interfaz

**Diálogo «Compartir» unificado** (reemplaza o extiende el `ShareDialog` actual), con dos pestañas:

```
┌ Compartir "contrato.pdf" ─────────────────────────────────────────┐
│ [ Personas ]  [ Enlace y QR ]                                      │
│                                                                    │
│ Acceso:  ▾ Cualquiera con el enlace                                │
│          · Público (URL directa)                                   │
│          · Cualquiera con el enlace                                │
│          · Solo miembros de la organización                        │
│ Caduca:  ▾ En 7 días (24 oct 2026)                                 │
│ Etiqueta: QR stand expo         ☐ Contraseña   ☑ Permitir descarga │
│                                                                    │
│ https://drive.techmaleon.com.mx/s/7Gk2pQ9xLm3vRt8yBn4wZa   [Copiar]    │
│ ┌──────┐                                                           │
│ │ ▓▓▓▓ │  [Pantalla completa] [PNG] [SVG]                          │
│ └──────┘                                                           │
│ Otros enlaces de este archivo (2) ›                                │
└────────────────────────────────────────────────────────────────────┘
```

Si el usuario no es el propietario (o no es admin en la unidad org), la pestaña «Enlace y QR» no aparece. Solo se muestra «Copiar URL pública» si el archivo es público.

**Página pública `/s/{token}`:** vista previa (imagen, PDF, video), nombre, tamaño y botón «Descargar», con la marca de la instancia. Variantes: pedir contraseña, pedir inicio de sesión (miembros), caducado, revocado o no disponible.

**Perfil → «Mis enlaces compartidos»:**

| Archivo | Acceso | Caduca | Visitas / Descargas | Último acceso | |
| :--- | :--- | :--- | :--- | :--- | :--- |
| contrato.pdf · *Cliente X* | 🔗 Cualquiera | 24 oct 2026 | 31 / 12 | hace 2 h | Editar · QR · Revocar |
| menu.pdf · *QR stand* | 🔗 Cualquiera | Sin caducidad | 1,204 / 380 | hace 5 min | … |

Filtros: Activos · Por caducar (< 48 h) · Caducados · Revocados. Acciones: **Revocar seleccionados** y **Revocar todos** (confirmación escribiendo `REVOCAR`).

**Admin → «Enlaces compartidos»:** los mismos datos de toda la instancia, con filtro por usuario, más «Revocar todos los enlaces de la instancia».

### 5.6 API

```
GET    /s/{token}                       página pública (SPA) → GET /v1/public/links/{token}
POST   /v1/public/links/{token}/unlock  { password } (rate-limit)
GET    /v1/public/links/{token}/content binario / descarga (cuenta hit)          ← enlace de archivo
GET    /v1/public/links/{token}/items?folder={id|ruta}  hijos de la carpeta      ← enlace de carpeta (solo descendientes)
GET    /v1/public/links/{token}/files/{id|ruta}/content  vista previa / descarga de un archivo de la carpeta
GET    /v1/public/links/{token}/files/{id|ruta}/thumb    miniatura

GET    /v1/links?target_type=&target_id=     enlaces de un archivo o carpeta
POST   /v1/links                              crear
PATCH  /v1/links/{id}                         acceso, caducidad, etiqueta, contraseña, descarga, reactivar
DELETE /v1/links/{id}                         revocar
GET    /v1/links/mine                          panel "Mis enlaces" (paginado, filtros)
POST   /v1/links/revoke-all                   revocar todos los míos
GET    /v1/links/{id}/hits                    detalle de accesos

PATCH  /v1/files/{id}   { visibility }        mueve el binario public ↔ .private
PATCH  /v1/folders/{id} { visibility }        aplica al subárbol

GET    /v1/admin/links                         todos (admin)
POST   /v1/admin/links/revoke-all              revocar todos los de la instancia
```

Servicio central: `ShareLinkPolicy::canCreate(user, target)`, junto a `SharePermissionService`, con las reglas de 5.1-⑤.

---

## 6. Fases y orden de entrega

| Fase | Contenido | Entregable verificable | Tamaño |
| :--- | :--- | :--- | :--- |
| **0. Seguridad y cimientos** ✅ *implementada y probada en local (rama `feat/f0-cimientos`, sin publicar)* | Mover backups a `api/var/backups` y bloquear `storage/backups` · corregir los defaults `drive.techmaleon.mx` → `drive.techmaleon.com.mx` en el código · dump en streaming · nombres de usuario reservados · `version.json` → `api/version.php` · `auth_epoch` · modo mantenimiento + `MaintenanceScreen` · programador de tareas · guía de cron en pantalla (§8.1-bis) | `storage/backups/x.zip` da 404 · el backend reporta su versión · activar mantenimiento bloquea la app y no `/storage` | M |
| **1. Pipeline de releases** ✅ *implementada y probada en local (llave generada, ZIP firmado verificable en Node y PHP, 13 casos de alteración rechazados)* | Llaves Ed25519 · `scripts/release/build.mjs` · `release.json` · `manifest.json` · carpeta `techmaleon.com.mx/project-cloud/` · marcadores en `.htaccess` | Un ZIP firmado de `2.1.0` y su manifiesto, verificables en local | S |
| **2. Actualizador** ✅ *implementada y probada de punta a punta en un sitio aislado (ver §9)* | Detección por cron · notificación, banner y badges · página Actualizaciones · modal previo · runner por pasos · `old-files` · rollback · eliminar respaldo · migraciones versionadas | Todos los escenarios de 3.8 pasan con `2.1.0 → 2.1.1 → 2.1.2` contra el servidor local | L |
| **→ Release v2.1.0** | Fases 0–2. **Instalación manual única** en `drive` (con copia completa previa) | — | — |
| **3. Copias programadas** | Programación · rotación estricta 1–3 · cola pre-actualización · contenido y extensiones · estimación de tamaño · job por pasos | La copia programada corre sola y nunca hay más de N | M |
| **4. Restauración con diagnóstico** | `backup.json` · analizador · restauración con runner y mantenimiento · cuarentena de huérfanos | El informe detecta los faltantes por filtro y las copias más nuevas que la plataforma | M |
| **→ Release v2.2.0** | **Primera actualización OTA real** (prueba de fuego del actualizador) | — | — |
| **5. Visibilidad privada** | Columna `visibility` · `storage/.private` · mover binarios · proteger thumbs · default de subidas en el perfil | Un archivo privado da 404 en `/storage/…` y funciona dentro de la app | M |
| **6. Enlaces + QR** | `share_links` · `ShareLinkPolicy` · página `/s/{token}` · **vista pública de carpeta de solo lectura** (sidebar vacía, migas acotadas, subcarpetas, vista previa y descarga) · diálogo unificado · QR · caducidad · contador · en **Mi unidad y en la unidad compartida** | Carlos crea un QR; Pedro (invitado) no ve la opción; un visitante sin cuenta navega la carpeta pero no puede subir ni salir de ella; el enlace caduca a la hora indicada | L |
| **7. Panel de enlaces** | Mis enlaces · revocar todos · panel admin · políticas · limpieza de hits | «Revocar todos» deja todos los enlaces en 410 | S |
| **→ Release v2.3.0** | Fases 5–7, distribuidas por OTA | — | — |

---

## 7. Decisiones

### 7.1 Confirmadas (2026-10-17)

| # | Tema | Decisión |
| :-- | :--- | :--- |
| 1 | Servidor de releases | `https://techmaleon.com.mx/project-cloud/` (prestado; se puede migrar a un subdominio propio más adelante) |
| 2 | Beta / staging | No hay. Se prueba en local y se publica directo a `drive`; si algo falla, se revierte o se restaura (hay respaldos de storage) |
| 3 | `instance_id` | **No se implementa.** La consulta de actualizaciones es anónima |
| 4 | `old-files` | `api/var/old-files/` (fuera del alcance web) |
| 5 | Invitados (incluso `full`) | **Nunca** generan enlaces ni QR; solo el propietario |
| 6 | Admins y unidades ajenas | Pueden **revocar**, no **crear** |
| 7 | Visibilidad por defecto | **Pública** (se conserva el uso como CDN) |
| 8 | Copias | Límite estricto **1–3** (default 3), **sin copias fijadas**; solo la copia pre-actualización tiene su propia cola de 1 |
| 9 | Botón «Limpiar registros» | Se llama **«Eliminar respaldo de la versión anterior»** |
| 10 | Dominios | Producción: `drive.techmaleon.com.mx` · Releases: `techmaleon.com.mx/project-cloud/`. El código todavía trae `drive.techmaleon.mx` en defaults y comentarios; se corrige en la Fase 0 (no afecta a producción: el `config.php` real se generó con el dominio correcto) |
| 11 | `techmaleon.com.mx` | Web estática sin WordPress ni caché: basta el `.htaccess` de §3.1 |
| 12 | Ruta de `storage` | **Verificado en el código:** el instalador siempre escribe `storage.path = httpdocs/storage` (`Installer.php`). Además, el actualizador lee la ruta real de `config.php` en tiempo de ejecución y la protege esté donde esté |
| 13 | Cron | Recomendación en §8.1 (tarea de Plesk tipo «Ejecutar un script PHP»), con **guía paso a paso dentro de la pantalla Tareas Cron** para Plesk, cPanel, VPS y servicio externo (§8.1-bis). **No bloquea** las fases 0–2: el actualizador también verifica al abrir el dashboard |
| 14 | Despliegue de `drive` | Se asume **subida manual** (Administrador de archivos o FTP), como describe el `README`. Comprobación rápida en §8.2 |

### 7.2 Pendientes

Ninguno bloqueante. Antes del primer release manual (`v2.1.0`) conviene hacer las dos comprobaciones de §8.1 y §8.2 en Plesk (5 minutos).

---

## 8. Entorno de despliegue (Plesk)

Layout deducido del código (`.htaccess` raíz, `Installer.php`, `AvatarService`, `ThumbnailService`, `README`). De aquí salen las rutas que el actualizador reemplaza y las que nunca toca. La ruta de `storage` está verificada (§7.1-12); el resto se valida en el `preflight` de cada actualización, que muestra al admin la lista de «rutas protegidas» antes de empezar.

```
/var/www/vhosts/<suscripción>/        ← raíz de la suscripción (fuera de la web)
└── httpdocs/                         ← document root de drive (raíz del front)
    ├── .htaccess                     ← reemplazado solo entre marcadores BEGIN/END
    ├── index.html                    ← REEMPLAZADO (al final del swap)
    ├── app-assets/                   ← REEMPLAZADO (bundles con hash; obsoletos se borran)
    ├── favicon, logos estáticos…     ← REEMPLAZADOS si vienen en release.json
    ├── api/                          ← REEMPLAZADO, excepto:
    │   ├── config/                   ←   NUNCA (config.php, install.lock, maintenance.json)
    │   └── var/                      ←   NUNCA (backups, old-files, update/)  [nuevo]
    ├── storage/                      ← NUNCA (unidades de usuarios, platform/ = logos, .trash, .uploads…)
    ├── <assets_folder_name>/         ← NUNCA (unidad compartida de la organización; hermana de storage,
    │                                    nombre configurable en settings, por defecto "assets")
    ├── avatars/                      ← NUNCA
    └── thumbs/                       ← NUNCA
```

Supuestos técnicos de Plesk que da por hechos el plan:

- **PHP corre como el usuario del sistema de la suscripción** (PHP-FPM o FastCGI, el default de Plesk). Por eso puede escribir sobre `httpdocs/` sin cambiar permisos. Si corriera como Apache (módulo), el actualizador no podría reemplazar archivos. El `preflight` lo detecta probando a escribir en `httpdocs/` y en `api/`.
- **OPcache activo:** se llama a `opcache_reset()` después del swap. Si Plesk tiene `opcache.validate_timestamps=0`, sin ese reset se seguiría ejecutando el código viejo.
- **Límites PHP:** `max_execution_time` y el timeout de nginx (proxy delante de Apache en Plesk, ~60–180 s). El runner por pasos (~15 s por paso) queda muy por debajo de ambos.
- **Salida HTTPS** desde el servidor de `drive` hacia `techmaleon.com.mx` (curl con verificación de certificado). Si los dos sitios están en el mismo servidor Plesk, la petición es local y funciona igual.
- **La extensión `sodium`** viene habilitada por defecto en los PHP 8.x de Plesk; el `preflight` la verifica.

### 8.1 Cron recomendado (Plesk)

**Recomendación: tarea programada de tipo «Ejecutar un script PHP»** (modo CLI). Es la más estable y segura:
- **Sin límite de tiempo web:** las copias completas pueden avanzar en segundo plano sin cortes del proxy.
- **Sin token en una URL:** no queda `cron.php?token=…` expuesto en logs ni historiales.
- **Usa el mismo PHP** que el sitio (misma versión y extensiones).

Pasos:
1. Plesk → **Sitios web y dominios** → `drive.techmaleon.com.mx` → **Tareas programadas** (*Scheduled Tasks*).
2. Si ya hay una tarea que apunta a `cron.php`, ábrela y revisa que coincida con lo de abajo; si no hay ninguna, **Añadir tarea**.
3. Tipo: **Ejecutar un script PHP** → Ruta del script: `httpdocs/api/cron.php` → Versión de PHP: la misma del sitio.
4. Ejecutar: **Cron style** `* * * * *` (cada minuto; el programador interno de §2.5 decide qué tarea toca).
5. Notificar: **Solo errores**.

Cómo saber si funciona: en la plataforma, **Configuración → Tareas Cron**, «Última ejecución» debe actualizarse cada minuto.

Si en algún hosting solo se puede llamar por URL, el sistema sigue funcionando: los trabajos pesados avanzan por pasos en cada llamada (§2.6).

### 8.1-bis Guía de configuración dentro de la plataforma (Configuración → Tareas Cron)

✅ **Confirmado:** las instrucciones viven **en la pantalla**, no solo en este documento, para que cualquier admin (en Plesk, cPanel o un VPS) pueda configurarlo sin ayuda. Se mejora la `CronSettings.tsx` actual, que hoy tiene el estado, dos opciones con «Copiar» y la lista de procesos:

**1. Tarjeta de estado (arriba, siempre visible)**

| Estado | Condición | Mensaje |
| :--- | :--- | :--- |
| 🟢 Funcionando | Última ejecución hace < 2 min | «El cron se ejecuta correctamente cada minuto» |
| 🟡 Retrasado | Entre 2 min y 1 h | «El cron se ejecuta con retraso. Revisa que la frecuencia sea `* * * * *`» |
| 🔴 Detenido | > 1 h | «El cron no se ejecuta desde hace X. Las copias automáticas y la búsqueda de actualizaciones no funcionarán» |
| ⚪ Sin configurar | Nunca se ejecutó | «Aún no se ha configurado. Sigue la guía de abajo» |

Si el estado es 🔴 o ⚪, también aparece un aviso en el **dashboard (solo admins)** con el enlace «Configurar cron».

**2. Tarjeta «Cómo configurarlo» con pestañas por proveedor**

Cada pestaña trae **pasos numerados** y los **valores reales de esta instalación ya rellenados** con botón «Copiar». El backend calcula la ruta absoluta de `cron.php`, el binario de PHP (`PHP_BINARY`) y la URL con token:

- **Plesk** *(recomendado)*: Sitios web y dominios → *tu dominio* → Tareas programadas → Añadir tarea → «Ejecutar un script PHP» → ruta `httpdocs/api/cron.php` → misma versión de PHP → Cron style `* * * * *` → Notificar: solo errores.
- **cPanel:** Avanzado → Trabajos de Cron → Configuración común «Una vez por minuto» → Comando: `/usr/local/bin/php /home/<usuario>/public_html/api/cron.php >/dev/null 2>&1` (rellenado con la ruta real).
- **VPS / Linux (crontab):** `crontab -e` con el usuario dueño de los archivos (no `root`) → pegar la línea → guardar. Incluye el comando para comprobarlo: `crontab -l`.
- **Servicio externo (URL)**, solo si el hosting no permite tareas programadas: cron-job.org o similar, URL con token, cada 1 min. Incluye la advertencia de no compartir esa URL y el botón **«Regenerar token»**.

**3. Botón «Verificar configuración»**

Tras guardar la tarea en el panel, el admin pulsa **«Verificar»**. La pantalla consulta el estado cada 10 s durante 3 min y muestra «Esperando la primera ejecución…» → ✅ «¡Listo! El cron respondió a las 14:32:01 (CLI)». Detecta si la llamada llegó **por CLI o por URL** y lo muestra; si es por URL, sugiere pasar a CLI.

**4. Tabla de tareas (reemplaza la lista estática de procesos)**

Se genera desde el programador de §2.5: tarea · cada cuánto corre · última ejecución · resultado (✓ o error con detalle) · botón «Ejecutar ahora» por tarea. Ejemplo: *Búsqueda de actualizaciones — cada 12 h — hace 3 h — ✓ sin novedades*.

### 8.2 Comprobar que `drive` no usa Git de Plesk

Plesk → `drive.techmaleon.com.mx` → busca el icono **Git**. Si no existe, o no hay repositorio con «Despliegue automático», todo está bien (subida manual). Si lo hay, hay que desactivar el despliegue automático: Git y el actualizador escribirían sobre los mismos archivos.

---

## 9. Fase 2 — resultado de las pruebas (2026-10-17)

Se probó en un sitio aislado (copia instalada desde el paquete 2.1.0 real, base de datos clonada, servidor de versiones local con 2.1.1 y 2.1.2 firmados). Ningún archivo del proyecto ni la base local se modificaron.

| Escenario | Resultado |
| :--- | :--- |
| Unidad compartida en `app-assets` | ✔ La actualización se bloquea con un mensaje que explica cómo corregirlo |
| Fallo con el sitio en mantenimiento, antes de tocar archivos (paso «copia») | ✔ Se cancela, se quita el mantenimiento, huella del sitio idéntica |
| Fallo **después** de reemplazar archivos (paso «base de datos») | ✔ Reversión automática a 2.1.0, huella idéntica, sin cambios en la BD, mantenimiento desactivado |
| Proceso interrumpido a mitad (respuesta perdida) | ✔ Se retoma desde el paso pendiente con el token de paso guardado en el navegador |
| 2.1.0 → 2.1.1 desde la interfaz | ✔ Migración aplicada (schema 5), bundles viejos retirados, archivos de usuarios intactos, reglas propias del `.htaccess` conservadas, copia pre-actualización (cola de 1) |
| Visitante durante la actualización | ✔ Ve «Actualización en curso» y la página se recarga sola al terminar |
| 2.1.1 → 2.1.2 (con registro de la versión anterior) | ✔ Retira los archivos que la versión nueva ya no trae |
| Revertir desde la interfaz | ✔ Vuelve a 2.1.1 con huella idéntica, incluidos los archivos retirados |
| Eliminar respaldo de la versión anterior | ✔ Borra `old-files` y el bloque desaparece |
| Actualizar sin copia previa | ✔ |
| Manifiesto alterado en el servidor de versiones | ✔ Rechazado: «La firma de la actualización no es válida» |
| Tarea de cron «Búsqueda de actualizaciones» | ✔ |

Correcciones que salieron de las pruebas: limpieza de la caché del navegador al recargar tras actualizar o revertir; aviso de PHP 8.5 en la copia de seguridad; la retirada de archivos en la primera actualización tras una instalación manual solo toca bundles con formato de Vite (`nombre-HASH.ext`) en `app-assets/`.

Límite conocido: si el admin pierde el token de paso a mitad de la actualización (por ejemplo, borra los datos del navegador), queda fuera hasta que termine el mantenimiento. Recuperación: borrar `api/config/maintenance.json` desde el Administrador de archivos y volver a Configuración → Actualizaciones, que retoma el proceso.

## 10. Primera subida manual — v2.1.0 en `drive.techmaleon.com.mx`

Única vez: la 2.0.0 no tiene actualizador. A partir de aquí todo llega por **Configuración → Actualizaciones**.

**Preparación (local):** `version.json` a `2.1.0` → `node scripts/release/build.mjs` (compila, completa `frontend/dist` y firma el paquete) → `node scripts/release/verify.mjs`.

`npm run build` deja ahora **todo** en `frontend/dist`, listo para subir de una con la extensión SFTP (contexto `frontend/dist` → `/` del FTP = `httpdocs`):

```
frontend/dist/
├── .htaccess            ← .htaccess raíz (con marcadores BEGIN/END)
├── index.html
├── app-assets/          ← bundles de Vite
└── api/                 ← backend SIN config.php, install.lock, var/ local ni scripts de depuración
    └── var/
        ├── .htaccess    ← deniega el acceso web
        └── release.json ← registro de lo instalado (lo usa la siguiente actualización)
```

Es idéntico, archivo por archivo, al ZIP firmado del actualizador (mismo `collectPackageEntries()` en `scripts/release/lib.mjs`). Al subirlo sobre `httpdocs` no toca `storage/`, `assets/`, `avatars/`, `thumbs/` ni `api/config/config.php`.

**Antes de subir (Plesk):**
1. Copia completa desde **Configuración → Base de datos** (o la de Plesk) y descárgala.
2. Respaldo de `httpdocs/api/config/config.php` e `install.lock` en tu PC (✅ ya hecho).
3. PHP con **sodium**, **zip** y **curl** activas (✅ confirmado: PHP 8.2.34).

**Subida:** con la extensión SFTP, sube la carpeta `frontend/dist` (Upload / Sync Local → Remote). La configuración actual **no borra** archivos remotos, que es lo correcto: nunca actives `syncOption.delete`, borraría `storage/` y `config.php`. Opcional, recomendado: borra de producción los scripts de depuración si existen (`httpdocs/check_db.php`, `httpdocs/api/check_assets.php`, `debug_assets.php`, `migrate_assets.php`).

**Servidor de versiones (`techmaleon.com.mx`):** sube el contenido de `release/out/` a `httpdocs/project-cloud/` (`.htaccess`, `releases/…zip` y, al final, `manifest.json`). Así la plataforma ya encuentra el servidor y muestra «Tu plataforma está al día».

**Comprobación:**
- Pie de página y Configuración → General muestran **v2.1.0**.
- Configuración → Actualizaciones: «Tu plataforma está al día», sin errores de conexión.
- Configuración → Tareas Cron: configurar la tarea de Plesk con la guía y pulsar «Verificar configuración».
- Configuración → Base de datos: las copias antiguas siguen listadas (se movieron solas a `api/var/backups`) y `https://drive.techmaleon.com.mx/storage/backups/` responde 404.
- Una URL pública de un archivo cualquiera sigue funcionando.
