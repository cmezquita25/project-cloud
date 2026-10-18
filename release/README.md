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

## Subida manual (instalaciones nuevas o sin actualizador)

`npm run build` (en `frontend/`) deja en `frontend/dist` todo lo que va en la raíz
del sitio: `index.html`, `app-assets/`, `.htaccess` y `api/` (sin configuración ni
datos locales), más `api/var/release.json`. Se sube tal cual sobre `httpdocs`,
sin borrar nada del servidor. Es el mismo contenido que el ZIP firmado.
