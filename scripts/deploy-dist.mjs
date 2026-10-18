/**
 * Completa frontend/dist para subirlo de una sola vez a la raíz del sitio
 * (httpdocs) con la extensión SFTP/FTP. Se ejecuta solo después de
 * `npm run build` (postbuild).
 *
 * Añade a la salida de Vite:
 *   .htaccess                 ← .htaccess raíz del repo
 *   api/…                     ← backend, SIN config.php, install.lock, var/ ni scripts de depuración
 *   api/var/release.json      ← registro de los archivos instalados (lo usa el actualizador
 *                               para saber qué archivos retirar en la siguiente versión)
 *   api/var/.htaccess         ← deniega el acceso web a api/var
 *
 * Nunca se incluyen datos de los usuarios ni la configuración del servidor: al
 * subir dist/ sobre httpdocs, storage/, assets/, avatars/ y api/config/config.php
 * quedan intactos.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { ROOT, collectPackageEntries, releaseDescriptor } from './release/lib.mjs'

const dist = resolve(ROOT, 'frontend/dist')
const versionInfo = JSON.parse(readFileSync(resolve(ROOT, 'version.json'), 'utf8'))

let entries
try {
  entries = collectPackageEntries()
} catch (err) {
  console.error(`✖ ${err.message}`)
  process.exit(1)
}

let apiCount = 0
for (const { name, data } of entries) {
  // public/* ya está en dist (salida de Vite), salvo el .htaccess raíz.
  if (name.startsWith('public/') && name !== 'public/.htaccess') continue
  const target = resolve(dist, name === 'public/.htaccess' ? '.htaccess' : name)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, data)
  if (name.startsWith('api/')) apiCount++
}

mkdirSync(resolve(dist, 'api/var'), { recursive: true })
writeFileSync(resolve(dist, 'api/var/release.json'), JSON.stringify(releaseDescriptor(entries, versionInfo)))
writeFileSync(
  resolve(dist, 'api/var/.htaccess'),
  '# Carpeta privada del sistema (backups, temporales, estado del actualizador).\n# Nunca se sirve por web.\nRequire all denied\n<IfModule !mod_authz_core.c>\n    Order deny,allow\n    Deny from all\n</IfModule>\n'
)

// Última barrera: jamás subir configuración o datos locales al servidor.
const forbidden = ['api/config/config.php', 'api/config/install.lock', 'api/config/maintenance.json', 'api/var/backups', 'storage', 'assets']
const leaked = forbidden.filter((p) => existsSync(resolve(dist, p)))
if (leaked.length > 0) {
  console.error(`✖ dist/ contiene archivos que NO deben subirse: ${leaked.join(', ')}`)
  process.exit(1)
}

console.log(`[deploy-dist] dist/ listo para subir a httpdocs: v${versionInfo.version} · .htaccess · api/ (${apiCount} archivos) · api/var/release.json`)
