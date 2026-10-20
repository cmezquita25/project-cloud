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
 * quedan intactos. Es el mismo contenido que el ZIP del instalador
 * (scripts/release/installer.mjs).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { PRIVATE_SITE_PATHS, ROOT, collectPackageEntries, siteEntries } from './release/lib.mjs'

const dist = resolve(ROOT, 'frontend/dist')
const versionInfo = JSON.parse(readFileSync(resolve(ROOT, 'version.json'), 'utf8'))

let entries
try {
  entries = siteEntries(collectPackageEntries(), versionInfo)
} catch (err) {
  console.error(`✖ ${err.message}`)
  process.exit(1)
}

let apiCount = 0
for (const { name, data } of entries) {
  // La salida de Vite ya está en dist; solo falta lo que añade este paso.
  if (!name.startsWith('api/') && name !== '.htaccess') continue
  const target = resolve(dist, name)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, data)
  if (name.startsWith('api/') && !name.startsWith('api/var/')) apiCount++
}

// Última barrera: jamás subir configuración o datos locales al servidor.
const leaked = PRIVATE_SITE_PATHS.filter((p) => existsSync(resolve(dist, p)))
if (leaked.length > 0) {
  console.error(`✖ dist/ contiene archivos que NO deben subirse: ${leaked.join(', ')}`)
  process.exit(1)
}

console.log(`[deploy-dist] dist/ listo para subir a httpdocs: v${versionInfo.version} · .htaccess · api/ (${apiCount} archivos) · api/var/release.json`)
