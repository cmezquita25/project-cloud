# Publicar una versión de Project Cloud

Las instalaciones buscan versiones nuevas en
`https://techmaleon.com.mx/project-cloud/manifest.json` y solo instalan paquetes
firmados con la llave privada de releases.

## Una sola vez: la llave de firma

```bash
node scripts/release/keygen.mjs
```

- La **privada** queda en `~/.project-cloud/release-signing.key`. **Respáldala**
  (gestor de contraseñas o memoria cifrada) y no la subas a ningún sitio. Si se
  pierde, no se pueden firmar versiones nuevas.
- La **pública** se escribe en `api/src/Updater/ReleaseKey.php` y va en el código.

## Cada versión

1. Sube la versión en `version.json` (`version`, `schema` si hay migraciones y
   `released_at` con la fecha de hoy).
2. Escribe las notas en `release/notes/<versión>.json`: changelog, features,
   `min_from_version`, requisitos y si las migraciones son reversibles.
3. Haz commit de todo.
4. Genera y verifica el paquete:

   ```bash
   node scripts/release/build.mjs
   node scripts/release/verify.mjs
   ```

5. Sube el **contenido** de `release/out/` a `techmaleon.com.mx/project-cloud/`
   (Administrador de archivos de Plesk o FTP), en este orden:
   1. `.htaccess` (solo la primera vez)
   2. `releases/project-cloud-<versión>.zip`
   3. `manifest.json` **al final**, para que ninguna instalación vea la versión
      antes de que exista su paquete.

Los ZIP de versiones anteriores pueden quedarse en `releases/`; solo cuenta el
que indica `manifest.json`.

## Instalación nueva en un hosting (ZIP del instalador)

```bash
node scripts/release/installer.mjs            # compila el frontend y arma el ZIP
node scripts/release/installer.mjs --skip-frontend   # usa frontend/dist ya compilado
```

`build.mjs` también lo genera al final de cada release. Queda en
`release/installer/project-cloud-<versión>-installer.zip`, **aparte** de
`release/out/`: el instalador no se sube al servidor de versiones.

El ZIP trae la plataforma completa **sin configuración ni datos** (sin
`config.php`, `install.lock`, `storage/` ni copias): `index.html`, `.htaccess`,
`app-assets/` y `api/` (con `api/var/release.json`, para que la instalación pueda
actualizarse después desde el panel). Los archivos van en la raíz del ZIP, sin
carpeta contenedora.

En el hosting (Plesk; en cPanel la carpeta es `public_html`):

1. **Dominio o subdominio propio.** La app va en la raíz del dominio; no funciona
   en una subcarpeta (`dominio.com/drive`).
2. **Base de datos vacía** (MySQL 8+ o MariaDB 10.4+): *Bases de datos → Añadir
   base de datos*, con un usuario asociado. Anota nombre, usuario y contraseña.
3. *Archivos* → `httpdocs`. Si el sitio es nuevo, borra la página de bienvenida
   del panel (`index.html`, `css/`, `img/`, `favicon.ico`…).
4. Sube el ZIP a `httpdocs`, márcalo y elige **Extraer archivos** en esa misma
   carpeta. Deben quedar `index.html`, `.htaccess`, `app-assets/` y `api/`
   directamente en `httpdocs`, no dentro de otra carpeta. (`.htaccess` es un
   archivo oculto: si no lo ves, activa «mostrar archivos ocultos».)
5. **Borra el ZIP** de `httpdocs` (se podría descargar por URL).
6. Abre el dominio: el asistente revisa los requisitos, pide la base de datos y
   crea el administrador.

**Solo para instalaciones nuevas.** No lo descomprimas sobre una instalación
existente: reemplazaría el `.htaccess` raíz (y tus reglas propias) y el registro
de archivos del actualizador. Para actualizar, usa el actualizador del panel.

`npm run build` (en `frontend/`) deja ese mismo contenido en `frontend/dist`, por
si se prefiere subir por SFTP.
