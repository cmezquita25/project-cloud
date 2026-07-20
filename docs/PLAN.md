# ☁️ Project Cloud — Plan de trabajo por fases

> Clon de Google Drive auto-hosteado en Plesk · `drive.techmaleon.mx`
> Frontend: **React + TypeScript + Vite + Tailwind** (build estático) · Backend: **API PHP vanilla** · BD: **MySQL (phpMyAdmin de Plesk)**

---

## 1. Visión general

Plataforma de gestión de archivos multiusuario tipo Google Drive, pero aprovechando el potencial del hosting Plesk:

- Cada usuario administra sus archivos y ve su almacenamiento (cuota asignada por el admin).
- Todos los archivos son **públicos por URL directa**: `https://drive.techmaleon.mx/storage/{usuario}/carpeta/archivo.png` — copiar URL con un clic, como el administrador de archivos de Plesk.
- Explorador avanzado: migas de pan, crear carpetas, copiar, mover, duplicar, renombrar, papelera, drag & drop, vista lista y mosaicos.
- Instalador web tipo WordPress: al primer arranque configura BD y crea el primer admin desde cero.
- UX/UI: réplica del lenguaje visual de Google Drive, 100% responsive (menús de escritorio → bottom sheets en móvil), modo oscuro.

## 2. Decisiones de arquitectura (confirmadas)

| Tema | Decisión |
|---|---|
| Servido de archivos | **Todo público por URL directa.** El árbol en disco (`/storage/{usuario}/...`) espeja el árbol virtual de la BD. Apache sirve los archivos directamente (rápido, sin pasar por PHP). |
| Backend | **PHP 8.x vanilla, sin Composer.** Arquitectura en capas: Front Controller → Router → Middleware → Controllers → Services → Repositories (PDO). Deploy = subir carpeta por FTP/File Manager. |
| Autenticación | **JWT (access ~15 min + refresh ~30 días)** con rotación de refresh tokens, almacenados **hasheados** en BD. Implementación HS256 propia (sin dependencias). |
| Instalador | **Wizard web** de 4 pasos que genera `config.php`, crea tablas y primer admin, y se bloquea con `install.lock`. |
| Branding | Identidad visual Google Drive: azul `#1a73e8`, verde `#188038`, amarillo `#fbbc04`, rojo `#d93025`, tipografía Google Sans → Roboto → system-ui. Modo claro/oscuro. |
| Theming | Tokens semánticos vía **CSS variables + Tailwind** (`bg-surface`, `text-primary`, etc.). Dark mode con estrategia `class` + detección de preferencia del sistema. |
| Front architecture | **Screaming Architecture estricta**: `src/features/{feature}/` con `components/ hooks/ services/ types/ index.ts`. Nada de carpetas técnicas globales tipo `src/components`. |

## 3. Estructura del monorepo

```
proyecto-cloud/
├── PLAN.md                      # este documento
├── frontend/                    # React + TS + Vite + Tailwind
│   ├── index.html
│   ├── vite.config.ts           # base relativa, output dist/ listo para Plesk
│   ├── tailwind.config.ts       # theme tokenizado (ver Fase 0)
│   └── src/
│       ├── app/                 # bootstrap: providers, router, layouts
│       │   ├── providers/       # ThemeProvider, AuthProvider, QueryProvider
│       │   ├── router/          # rutas + guards
│       │   └── layouts/         # AppLayout (sidebar+topbar), AuthLayout
│       ├── features/            # 🗣️ Screaming Architecture
│       │   ├── auth/            # login, sesión, refresh transparente
│       │   ├── drive-explorer/  # navegación, vistas, menú contextual, breadcrumbs
│       │   ├── file-operations/ # crear/renombrar/mover/copiar/duplicar/eliminar
│       │   ├── uploads/         # cola de subida, chunks, drag & drop
│       │   ├── storage-quota/   # uso y cuota del usuario
│       │   ├── trash/           # papelera, restaurar, vaciar
│       │   ├── search/          # búsqueda global
│       │   ├── preview/         # visor imagen/PDF/video/audio/texto
│       │   ├── share-link/      # copiar URL pública
│       │   ├── admin/           # gestión de usuarios, cuotas, actividad
│       │   └── settings/        # perfil, apariencia (tema)
│       └── shared/
│           ├── ui/              # design system: Button, Menu, Dialog, BottomSheet…
│           ├── api/             # cliente HTTP + interceptor de refresh
│           ├── hooks/           # useMediaQuery, useClickOutside…
│           └── lib/             # formatBytes, formatDate, cn()…
├── api/                         # PHP vanilla
│   ├── public/
│   │   ├── index.php            # front controller único
│   │   └── .htaccess            # rewrite → index.php
│   ├── src/
│   │   ├── Core/                # Router, Request, Response, Database(PDO), Jwt, Validator, Config
│   │   ├── Middleware/          # Auth, Cors, RateLimit, AdminOnly
│   │   ├── Controllers/         # AuthController, FolderController, FileController, UploadController, AdminController, InstallController
│   │   ├── Services/            # AuthService, FileSystemService, QuotaService, UploadService…
│   │   ├── Repositories/        # UserRepository, FolderRepository, FileRepository…
│   │   └── Installer/           # requirements check, migraciones, seed admin
│   └── config/
│       ├── config.sample.php
│       └── (config.php + install.lock — generados por el instalador)
├── database/
│   └── schema.sql               # referencia; el instalador lo ejecuta
└── docs/
    └── DEPLOY.md                # guía paso a paso de deploy en Plesk
```

**Layout en producción (httpdocs de Plesk):**

```
httpdocs/
├── index.html + assets/         # build de Vite (frontend)
├── .htaccess                    # SPA fallback + rewrite /api + headers seguridad
├── api/                         # carpeta api/ completa
└── storage/                     # archivos de usuarios (público, PHP deshabilitado)
    └── {username}/...
```

## 4. Esquema de base de datos (resumen)

| Tabla | Propósito | Campos clave |
|---|---|---|
| `users` | Cuentas | id, username (slug para /storage/), email, password_hash (Argon2id), role (`admin`/`user`), quota_bytes, max_upload_bytes, status, timestamps |
| `refresh_tokens` | Sesiones JWT | id, user_id, token_hash (SHA-256), expires_at, revoked_at, user_agent, ip |
| `folders` | Árbol de carpetas | id, user_id, parent_id (NULL = raíz), name, path (materializado), deleted_at |
| `files` | Metadatos | id, user_id, folder_id, name, path, size_bytes, mime_type, extension, is_starred, deleted_at |
| `activity_log` | Auditoría | id, user_id, action, entity_type, entity_id, details(JSON), ip, created_at |
| `settings` | Config global | key, value (nombre del sitio, registro abierto, cuota default…) |

- Papelera = **soft delete** (`deleted_at`); al borrar se mueve el archivo físico a `/storage/.trash/{user}/` para que la URL pública deje de funcionar.
- Índices: `folders(user_id, parent_id)`, `files(user_id, folder_id)`, `files(name)` para búsqueda.
- Toda operación disco↔BD es transaccional: primero disco, si falla → rollback de BD.

## 5. Seguridad (transversal a todas las fases)

- **SQL**: 100% PDO prepared statements, nunca concatenación.
- **Passwords**: `password_hash()` con Argon2id (fallback bcrypt).
- **JWT**: HS256 con secret de 64 bytes generado por el instalador; validación estricta de `exp`, `iat`, firma con `hash_equals()`.
- **Refresh tokens**: rotación en cada uso, hash en BD, revocación en logout y detección de reuso (invalida toda la familia).
- **Rate limiting**: login y endpoints sensibles (por IP, ventana deslizante en BD/archivo).
- **Path traversal**: sanitización de nombres (`basename`, whitelist de caracteres), verificación con `realpath()` de que toda ruta resuelta cae dentro de `/storage/{usuario}/`.
- **Subidas**: validación de extensión (blacklist ejecutables: `.php .phtml .htaccess .cgi…`), MIME real con `finfo`, tamaño contra `max_upload_bytes` y cuota.
- **`/storage`**: `.htaccess` con `php_flag engine off` + handler removido → jamás se ejecuta código subido.
- **`api/config/` y `api/src/`**: bloqueados por `.htaccess` (`Deny from all`); solo `api/public/` es accesible.
- **Headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP básica en el front.
- **CORS**: innecesario en producción (mismo dominio); en dev, whitelist explícita de `localhost:5173`.
- **Instalador**: se autobloquea con `install.lock`; toda ruta `/install` devuelve 404 después.

## 6. Contrato de la API (prefijo `/api/v1`)

Respuesta uniforme: `{ "success": bool, "data": …, "error": { "code", "message" } | null }`

| Área | Endpoints |
|---|---|
| Install | `GET /install/status` · `POST /install/check` · `POST /install/database` · `POST /install/admin` |
| Auth | `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` |
| Folders | `GET /folders/{id}/children` (contenido + breadcrumbs) · `POST /folders` · `PATCH /folders/{id}` (rename/move) · `POST /folders/{id}/copy` · `DELETE /folders/{id}` |
| Files | `PATCH /files/{id}` (rename/move/star) · `POST /files/{id}/copy` · `POST /files/{id}/duplicate` · `DELETE /files/{id}` · `GET /files/{id}/url` (URL pública) · `GET /files/{id}/download` |
| Uploads | `POST /uploads/init` (valida cuota, crea sesión) · `POST /uploads/{id}/chunk` · `POST /uploads/{id}/complete` |
| Trash | `GET /trash` · `POST /trash/{type}/{id}/restore` · `DELETE /trash/{type}/{id}` · `DELETE /trash` (vaciar) |
| Search | `GET /search?q=` |
| Quota | `GET /quota` (usado / total / desglose por tipo) |
| Admin | `GET/POST/PATCH/DELETE /admin/users` · `PATCH /admin/users/{id}/quota` · `GET /admin/stats` · `GET /admin/activity` |

---

# 🗺️ FASES

## Fase 0 — Fundaciones y Design System ✅ criterio: app corre con layout base en claro/oscuro

**Objetivo:** monorepo funcionando, theme tokenizado, esqueleto Screaming Architecture y componentes UI base.

- [ ] Scaffolding `frontend/` (Vite + React 18 + TS estricto) y `api/` (estructura de carpetas).
- [ ] Tailwind con **tokens semánticos** sobre CSS variables (`--color-surface`, `--color-on-surface`, `--color-primary`…), paleta Google Drive completa claro/oscuro.
- [ ] `ThemeProvider`: modo claro/oscuro/sistema, persistido en `localStorage`, clase `dark` en `<html>`.
- [ ] Design system en `shared/ui`: Button, IconButton, Menu/Dropdown, Dialog, **BottomSheet**, Tooltip, Input, Checkbox, Spinner, Toast, Avatar, ProgressBar.
- [ ] `AppLayout` clon de Drive: topbar (logo, búsqueda, avatar, toggle tema), sidebar (botón "Nuevo" prominente, navegación, barra de almacenamiento), área de contenido.
- [ ] Router con rutas placeholder: `/`, `/folder/:id`, `/recent`, `/starred`, `/trash`, `/search`, `/admin`, `/login`, `/install`.
- [ ] Iconografía (lucide-react) + iconos por tipo de archivo con colores estilo Drive.

## Fase 1 — Base de datos y núcleo API PHP ✅ criterio: `GET /api/v1/health` responde y el Core pasa pruebas manuales

**Objetivo:** cimientos del backend: routing, BD, JWT, validación y hardening base.

- [ ] `schema.sql` completo (sección 4) con FKs, índices y charset `utf8mb4`.
- [ ] Core: `Router` (métodos + params `{id}`), `Request`, `Response` (JSON uniforme), `Database` (PDO singleton), `Config`, `Validator`, `Jwt` (HS256 manual).
- [ ] Middlewares: `AuthMiddleware` (Bearer token), `AdminOnly`, `RateLimit`, `Cors` (solo dev).
- [ ] `.htaccess` de `api/public` (rewrite), de `api/` (bloquear src y config), y plantilla del de `/storage` (PHP off).
- [ ] `FileSystemService`: primitivas seguras (crear dir, mover, copiar recursivo, borrar, sanitizar nombres, resolución segura de rutas con `realpath`).
- [ ] Endpoint `GET /health` (estado + versión PHP + extensiones).

## Fase 2 — Instalador web ✅ criterio: instalación completa desde cero en un Plesk limpio

**Objetivo:** experiencia de producto instalable.

- [ ] Front: feature `install` con wizard de 4 pasos (UI estilo Drive): 1) chequeo de requisitos (PHP ≥ 8.1, pdo_mysql, fileinfo, mbstring, permisos de escritura) → 2) credenciales MySQL con test de conexión → 3) ejecución de migraciones → 4) creación del admin (username, email, password fuerte) + cuota default.
- [ ] API: `InstallController` + `Installer` (genera `config.php` con credenciales y JWT secret aleatorio, corre `schema.sql`, crea admin, escribe `install.lock`).
- [ ] Detección en el front: si `GET /install/status` dice "no instalado" → redirigir a `/install`; si instalado → `/install` no existe.

## Fase 3 — Autenticación completa ✅ criterio: login/logout/refresh funcionan con expiración y rotación verificadas

- [ ] API: `POST /auth/login` (rate limited, mensajes genéricos anti-enumeración), `POST /auth/refresh` (rotación + detección de reuso), `POST /auth/logout`, `GET /auth/me`.
- [ ] Front: página de login clon de Google (card centrada, logo, dark mode), `AuthProvider` con estado de sesión, guards (`RequireAuth`, `RequireAdmin`, `RedirectIfAuth`).
- [ ] Cliente HTTP en `shared/api`: inyección del access token, auto-refresh transparente en 401 con cola de reintentos, logout forzado si el refresh falla.

## Fase 4 — Explorador de archivos (núcleo) ✅ criterio: navegar, crear, renombrar, mover, copiar, duplicar y borrar carpetas/archivos con paridad disco↔BD

**Objetivo:** el corazón del producto.

- [ ] API Folders/Files completa (sección 6): cada operación ejecuta el cambio físico en `/storage` y el de BD en transacción; breadcrumbs calculados por la cadena de `parent_id`.
- [ ] `GET /files/{id}/url` devuelve la URL pública directa (`https://drive.techmaleon.mx/storage/{user}/{path}`).
- [ ] Front `drive-explorer`: **vista lista** (tabla: nombre, propietario, modificado, tamaño — ordenable) y **vista mosaicos** (grid de cards con thumbnail/icono), toggle persistido.
- [ ] Breadcrumbs con navegación y menú contextual por miga; colapso inteligente en rutas largas.
- [ ] Menú contextual (clic derecho y botón ⋮): abrir, renombrar, mover a (dialog con árbol de carpetas), copiar a, duplicar, **copiar URL pública**, destacar, descargar, eliminar.
- [ ] Selección múltiple (click+ctrl/shift, banda de selección en escritorio) con toolbar de acciones en lote.
- [ ] Panel de detalles lateral (metadatos, URL pública con botón copiar).
- [ ] Estados vacíos ilustrados + skeletons de carga.

## Fase 5 — Subidas y Drag & Drop ✅ criterio: subir archivo de 200 MB con límite PHP de 8 MB, con progreso, cancelación y cuota aplicada

- [ ] API: subida **por chunks** (2–5 MB): `init` valida nombre/extensión/tamaño total contra cuota y `max_upload_bytes` → `chunk` (append con offset, sesión en disco temporal) → `complete` (ensambla, verifica MIME real con `finfo`, mueve a destino, inserta en BD, actualiza uso).
- [ ] Limpieza de sesiones de subida huérfanas (> 24 h).
- [ ] Front `uploads`: **tarjeta de progreso flotante estilo Drive** (esquina inferior derecha; en móvil bottom sheet): cola, progreso por archivo y global, pausar/cancelar/reintentar, minimizar.
- [ ] Drag & drop desde el SO: overlay "Suelta para subir" sobre la carpeta actual; soporte de carpetas completas (`webkitGetAsEntry`, recrea el árbol).
- [ ] Drag & drop **interno**: arrastrar archivos/carpetas a otra carpeta o a una miga de pan para mover (con ghost image y drop targets resaltados).
- [ ] Botón "Nuevo" (subir archivo, subir carpeta, crear carpeta) — FAB en móvil.

## Fase 6 — Admin, usuarios y cuotas ✅ criterio: el admin crea un usuario con cuota de 1 GB y el sistema la aplica en subidas

- [ ] API Admin: CRUD de usuarios (crear = provisiona `/storage/{username}/`), asignar `quota_bytes` y `max_upload_bytes`, suspender/activar, reset de password, stats globales (uso total, por usuario), `activity_log` paginado.
- [ ] `QuotaService`: cálculo de uso (agregado en BD + recálculo real de disco bajo demanda), enforcement en `uploads/init` y en copias/duplicados.
- [ ] Front `admin`: tabla de usuarios responsiva (cards en móvil), formularios con slider/input de cuota, dashboard con stats (usuarios, espacio usado/total), log de actividad.
- [ ] Front `storage-quota`: barra de uso en sidebar estilo Drive ("X GB de Y GB usados") + vista de desglose por tipo de archivo.

## Fase 7 — Funciones avanzadas ✅ criterio: papelera, destacados, recientes, búsqueda y previews operativos

- [ ] Papelera: listado con origen y fecha, restaurar (revive URL pública), eliminar definitivo, vaciar papelera, aviso de auto-purga a 30 días (cron o purga oportunista).
- [ ] Destacados (`is_starred`) y Recientes (por `updated_at`).
- [ ] Búsqueda global: input del topbar con dropdown de resultados instantáneos + página de resultados con filtros por tipo.
- [ ] `preview`: visor modal a pantalla estilo Drive con navegación ←/→ entre archivos: imágenes (zoom), PDF (iframe), video/audio (player nativo), texto/código (con resaltado), fallback de descarga.
- [ ] Atajos de teclado (Del, F2, Ctrl+C/V/X, Esc, flechas) + tooltip de ayuda "?".

## Fase 8 — Responsive y pulido móvil ✅ criterio: flujo completo usable en 360px con Lighthouse a11y > 90

- [ ] Auditoría móvil integral: **todo menú contextual/dropdown → BottomSheet** deslizable en < 768px (hook `useResponsiveMenu`).
- [ ] Sidebar → drawer con overlay; tabla de archivos → filas compactas (nombre + meta + ⋮); mosaicos a 2 columnas.
- [ ] Selección múltiple móvil: long-press activa modo selección con checkboxes y action bar superior.
- [ ] Áreas táctiles ≥ 44px, safe areas iOS, `viewport-fit`.
- [ ] Accesibilidad: focus visible, navegación por teclado completa, `aria-*` en menús/dialogs, contraste AA en ambos temas.
- [ ] Micro-interacciones: transiciones de tema, hover states, animación de bottom sheet, feedback de drop.

## Fase 9 — Build, deploy a Plesk y hardening final ✅ criterio: `drive.techmaleon.mx` en producción pasando el checklist de seguridad

- [ ] `vite build` optimizado: code-splitting por feature, assets con hash, `base` correcta.
- [ ] `.htaccess` raíz de producción: SPA fallback (excepto `/api` y `/storage`), rewrite de `/api` → `api/public/index.php`, headers de seguridad, compresión y cache de assets.
- [ ] `docs/DEPLOY.md`: guía paso a paso — crear BD en Plesk, subir `dist/`, subir `api/`, permisos de `/storage`, ejecutar el instalador, HTTPS (Let's Encrypt en Plesk), ajustar `memory_limit`/`max_execution_time` recomendados.
- [ ] Checklist de seguridad final: instalador bloqueado, PHP off en storage, config inaccesible, rate limits activos, headers presentes, prueba de path traversal y de subida de `.php` rechazada.
- [ ] QA end-to-end sobre el dominio real: instalación limpia → crear usuario → subir → organizar → compartir URL → papelera → admin.

---

## Orden de ejecución y dependencias

```
Fase 0 ──► Fase 1 ──► Fase 2 ──► Fase 3 ──► Fase 4 ──► Fase 5 ──► Fase 6 ──► Fase 7 ──► Fase 8 ──► Fase 9
(front)    (api)      (installer) (auth)    (core)     (uploads)  (admin)    (extras)   (mobile)   (deploy)
```

Cada fase termina en estado demostrable. Las fases 4–7 admiten iteración en paralelo una vez cerrada la 3.
