# 🚀 Guía de despliegue en Plesk — Project Cloud

Guía para subir y probar Project Cloud en un hosting Plesk. Válida para
**cualquier dominio** (no está atada a `drive.techmaleon.mx`): la app detecta
su propio host automáticamente.

> Ejemplo de docroot real: `/var/www/vhosts/ia-lab.com.mx/drive.techmaleon.com.mx`

---

## ⚠️ Antes de empezar — lo más importante

1. **NO borres tu carpeta `assets/` existente.** El despliegue solo **agrega**
   archivos al docroot; nunca elimina nada. El instalador tampoco borra nada
   (solo crea `config/config.php` y la carpeta `storage/`). Sube los archivos
   **sin vaciar** el docroot.
2. **NO subas `config/config.php`.** Deja que el instalador lo cree en el host
   (así queda con la URL y credenciales correctas de ESE hosting). Es portable.

---

## 1. Generar el build del frontend

En tu equipo:

```bash
cd frontend
npm install        # solo la primera vez
npm run build      # genera frontend/dist/
```

Resultado en `frontend/dist/`:

```
dist/
├── index.html
└── app-assets/     ← JS/CSS de la app (no colisiona con tu /assets)
```

## 2. Estructura final en el docroot

Sube los archivos hasta dejar el docroot así:

```
{docroot}/
├── index.html            ← contenido de frontend/dist/
├── app-assets/           ← contenido de frontend/dist/
├── .htaccess             ← el .htaccess de la RAÍZ del repo
├── api/                  ← carpeta completa del repo (SIN config/config.php)
├── database/             ← carpeta del repo (schema.sql + .htaccess)
├── assets/               ← 🟢 YA EXISTE — NO LA TOQUES
└── storage/              ← 🔵 la crea el instalador automáticamente
```

**Qué subir exactamente:**

| Origen (repo) | Destino (docroot) |
|---|---|
| `frontend/dist/*` (index.html + app-assets/) | raíz del docroot |
| `.htaccess` (raíz del repo) | raíz del docroot |
| `api/` (carpeta completa) | `{docroot}/api/` |
| `database/` (carpeta completa) | `{docroot}/database/` |

**Qué NO subir:** `frontend/` (código fuente), `node_modules/`, `api/config/config.php`,
`api/config/install.lock`, `storage/`.

> 💡 Recomendado en Plesk: apunta el **Document Root** del subdominio a la
> carpeta raíz donde subiste esto (ya lo está). No hace falta subdominio para la API.

## 3. Permisos

La carpeta `api/config/` y el docroot deben permitir que PHP **escriba**
(el instalador crea `config/config.php` y la carpeta `storage/`). En Plesk esto
suele funcionar por defecto. Si el instalador reporta “no escribible”, en el
File Manager de Plesk da permiso de escritura al usuario del sitio sobre
`api/config/` y el docroot.

## 4. Ajustes de PHP en Plesk (opcional pero recomendado)

En **Plesk → Dominio → Configuración de PHP**. Tus valores actuales sirven para
instalar y usar la app; estos ayudan para subir archivos grandes (Fase 5):

| Ajuste | Actual | Recomendado |
|---|---|---|
| `upload_max_filesize` | 2M | **64M** |
| `post_max_size` | 8M | **64M** |
| `memory_limit` | 128M | 256M |
| `max_execution_time` | 30 | 60 |

> No es obligatorio: la subida por *chunks* (Fase 5) está diseñada para funcionar
> incluso con límites bajos. Pero subir estos valores mejora la experiencia.

## 5. Ejecutar el instalador

1. Abre `https://tu-dominio/` en el navegador.
2. Como no hay instalación, te redirige al **asistente** (`/install`).
3. Sigue los 4 pasos:
   - **Requisitos** — deben salir todos en verde.
   - **Base de datos** — introduce tus credenciales MySQL/MariaDB. El asistente
     prueba la conexión, crea la base (si no existe) y todas las tablas.
   - **Administrador** — crea tu cuenta principal.
   - **Listo** — el instalador se bloquea con `install.lock`.

Al terminar, `config/config.php` y `install.lock` existen, y la BD tiene las 6 tablas.

## 6. Verificación rápida

- `https://tu-dominio/api/v1/health` → JSON con `"status":"ok"` y
  `"database":{"reachable":true}`.
- Recargar una ruta interna (p.ej. `/trash`) no debe dar 404 (SPA fallback OK).
- Tus imágenes antiguas siguen accesibles: `https://tu-dominio/assets/....`

## 7. ¿Qué funciona en esta etapa?

| Función | Estado |
|---|---|
| Instalador (crea BD, tablas, admin) | ✅ Fase 2 |
| UI completa estilo Drive (claro/oscuro) | ✅ |
| Iniciar sesión de verdad | 🔜 Fase 3 |
| Explorador de archivos, subidas | 🔜 Fases 4–5 |

> En esta etapa puedes validar que **la instalación funciona en tu hosting real**
> y ver la interfaz. El login funcional y la gestión de archivos llegan en las
> siguientes fases.

## Solución de problemas

| Síntoma | Causa / solución |
|---|---|
| `/api/v1/health` da **403 Forbidden** | Sube la versión actual de `api/` (front controller en `api/index.php`, sin carpeta `public/`) y el `.htaccess` raíz. Verifica que el dominio use **Apache + nginx** en Plesk. |
| Abre el mock en `/` y **no** el instalador | Ocurre cuando la API responde error (p.ej. 403). Arreglado el acceso a `/api`, `/` redirige solo a `/install`. |
| `/api/v1/health` da **404** | El `.htaccess` raíz no se aplica (mod_rewrite/AllowOverride). Revisa que subiste el `.htaccess` a la raíz y que Plesk permite `.htaccess`. |
| “storage no escribible” en requisitos | Da permiso de escritura al usuario del sitio sobre el docroot y `api/config/`. |

## 8. Reinstalar (si necesitas repetir)

Borra `api/config/install.lock` (y opcionalmente `api/config/config.php`) desde
el File Manager. Al recargar, el asistente vuelve a aparecer.

## 9. Nota sobre Plesk + nginx

Si el dominio está en modo **“Apache + nginx”** (por defecto), el `.htaccess`
funciona. Si lo tienes en **“solo nginx”**, el enrutado SPA no aplicará y hay
que añadir reglas nginx equivalentes (pídemelas si es tu caso).
