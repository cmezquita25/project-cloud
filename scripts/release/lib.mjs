/**
 * Utilidades compartidas por los scripts de release (build, keygen, verify).
 */
import { createHash, createPublicKey } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const PRODUCT = 'project-cloud'

/** Archivos de api/ que NUNCA se distribuyen (rutas relativas a api/). */
export const API_EXCLUDE = [
  /^config\/config\.php$/,
  /^config\/install\.lock$/,
  /^config\/maintenance\.json/,
  /^config\/.*\.tmp$/,
  /^var\//, // backups, temporales, estado del actualizador
  /^storage\//, // sesiones de subida locales
  /^(check_assets|debug_assets|migrate_assets)\.php$/, // scripts de depuración
  /(^|\/)\.DS_Store$/,
  /\.log$/,
]

/** En la raíz del sitio solo pueden ir estas carpetas del frontend: el resto pertenece a los usuarios. */
export const PUBLIC_ALLOWED_DIRS = ['app-assets']

export const HTACCESS_BEGIN = '# BEGIN Project Cloud'
export const HTACCESS_END = '# END Project Cloud'

/** Carpetas que el paso de despliegue añade a frontend/dist (no son salida de Vite). */
const DIST_ADDED = /^(api\/|\.htaccess$)/

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(full))
    else if (entry.isFile()) files.push(full)
  }
  return files
}

const toPosix = (p) => p.split(sep).join('/')

/**
 * Archivos que forman una versión de la plataforma, con su ruta de paquete:
 *   public/…  → raíz del sitio (salida de Vite + .htaccess raíz)
 *   api/…     → carpeta api/ (sin configuración, datos locales ni depuración)
 * Lo usan el ZIP del actualizador y la carpeta dist/ de la subida manual,
 * así ambos contienen exactamente lo mismo.
 *
 * @returns {{ name: string, data: Buffer }[]}
 */
export function collectPackageEntries() {
  const distDir = resolve(ROOT, 'frontend/dist')
  if (!existsSync(resolve(distDir, 'index.html'))) throw new Error('frontend/dist/index.html no existe. Compila el frontend.')

  const entries = []
  for (const file of walk(distDir)) {
    const rel = toPosix(relative(distDir, file))
    if (DIST_ADDED.test(rel)) continue
    const top = rel.split('/')[0]
    if (rel.includes('/') && !PUBLIC_ALLOWED_DIRS.includes(top)) {
      throw new Error(`frontend/dist contiene la carpeta "${top}/". Solo se permiten: ${PUBLIC_ALLOWED_DIRS.join(', ')} (el resto de la raíz pertenece a los usuarios).`)
    }
    entries.push({ name: `public/${rel}`, data: readFileSync(file) })
  }

  const htaccess = readFileSync(resolve(ROOT, '.htaccess'))
  const text = htaccess.toString('utf8')
  if (!text.includes(HTACCESS_BEGIN) || !text.includes(HTACCESS_END)) {
    throw new Error(`El .htaccess raíz debe tener los marcadores "${HTACCESS_BEGIN}" y "${HTACCESS_END}".`)
  }
  entries.push({ name: 'public/.htaccess', data: htaccess })

  const apiDir = resolve(ROOT, 'api')
  for (const file of walk(apiDir)) {
    const rel = toPosix(relative(apiDir, file))
    if (API_EXCLUDE.some((re) => re.test(rel))) continue
    entries.push({ name: `api/${rel}`, data: readFileSync(file) })
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name))
}

/** release.json: versión y sha256 de cada archivo del paquete. */
export function releaseDescriptor(entries, { version, schema, released_at: releasedAt }) {
  const files = {}
  for (const { name, data } of entries) files[name] = { sha256: sha256(data), size: data.length }
  return { product: PRODUCT, version, schema, released_at: releasedAt, built_at: new Date().toISOString(), files }
}

/** api/var/.htaccess: la carpeta privada del sistema nunca se sirve por web. */
export const VAR_HTACCESS =
  '# Carpeta privada del sistema (backups, temporales, estado del actualizador).\n# Nunca se sirve por web.\nRequire all denied\n<IfModule !mod_authz_core.c>\n    Order deny,allow\n    Deny from all\n</IfModule>\n'

/** Rutas del sitio que jamás pueden ir en lo que se sube a un servidor (configuración y datos). */
export const PRIVATE_SITE_PATHS = ['api/config/config.php', 'api/config/install.lock', 'api/config/maintenance.json', 'api/var/backups', 'storage', 'assets']

/**
 * Archivos tal como quedan en la raíz del sitio (httpdocs) en una instalación
 * manual: public/… va a la raíz, api/… se queda igual y se añaden
 * api/var/release.json (registro de los archivos instalados; el actualizador lo
 * usa para saber qué retirar en la siguiente versión) y api/var/.htaccess.
 * Es el contenido de frontend/dist y del ZIP del instalador.
 *
 * @param {{ name: string, data: Buffer }[]} entries  salida de collectPackageEntries()
 * @returns {{ name: string, data: Buffer }[]}
 */
export function siteEntries(entries, versionInfo) {
  const site = entries.map(({ name, data }) => ({ name: name.replace(/^public\//, ''), data }))
  site.push({ name: 'api/var/release.json', data: Buffer.from(JSON.stringify(releaseDescriptor(entries, versionInfo))) })
  site.push({ name: 'api/var/.htaccess', data: Buffer.from(VAR_HTACCESS) })

  const leaked = site.filter(({ name }) => PRIVATE_SITE_PATHS.some((p) => name === p || name.startsWith(`${p}/`)))
  if (leaked.length > 0) throw new Error(`El paquete contiene archivos que NO deben subirse: ${leaked.map((e) => e.name).join(', ')}`)

  return site.sort((a, b) => a.name.localeCompare(b.name))
}
export const DEFAULT_KEY_PATH = resolve(homedir(), '.project-cloud', 'release-signing.key')
const RELEASE_KEY_PHP = resolve(ROOT, 'api/src/Updater/ReleaseKey.php')

export const sha256 = (data) => createHash('sha256').update(data).digest('hex')

/** Llave pública cruda (32 bytes, base64) e identificador corto. */
export function publicKeyInfo(publicKey) {
  const raw = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url')
  return { publicKey: raw.toString('base64'), keyId: sha256(raw).slice(0, 16) }
}

export function writeReleaseKeyPhp({ publicKey, keyId }) {
  writeFileSync(
    RELEASE_KEY_PHP,
    `<?php

declare(strict_types=1);

namespace ProjectCloud\\Updater;

/**
 * Llave PÚBLICA de firma de releases (Ed25519).
 * GENERADO por scripts/release/keygen.mjs — no editar a mano.
 *
 * El actualizador solo instala paquetes cuya firma valide con esta llave. La
 * llave privada correspondiente vive fuera del repositorio, en la máquina de
 * quien publica las versiones.
 */
final class ReleaseKey
{
    public const ALGORITHM = 'ed25519';
    public const KEY_ID = '${keyId}';
    public const PUBLIC_KEY = '${publicKey}';
}
`
  )
}

/** Lee la llave pública incluida en el código. */
export function readReleaseKeyPhp() {
  const php = readFileSync(RELEASE_KEY_PHP, 'utf8')
  const keyId = php.match(/KEY_ID = '([0-9a-f]+)'/)?.[1]
  const publicKey = php.match(/PUBLIC_KEY = '([A-Za-z0-9+/=]+)'/)?.[1]
  if (!keyId || !publicKey) throw new Error('api/src/Updater/ReleaseKey.php no tiene una llave válida. Ejecuta keygen.mjs.')
  return { keyId, publicKey }
}

/** Objeto KeyObject de Node a partir de la llave pública cruda. */
export function publicKeyObject(publicKeyB64) {
  return createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(publicKeyB64, 'base64').toString('base64url') }, format: 'jwk' })
}

/**
 * Mensaje que se firma. Cubre todo lo que decide QUÉ se instala y CUÁNDO es
 * válido instalarlo; el contenido del ZIP queda cubierto por su sha256.
 * Debe coincidir byte a byte con ReleaseVerifier::signedMessage() (PHP).
 */
export function signedMessage(m) {
  return [
    m.product,
    m.version,
    String(m.schema),
    m.min_from_version,
    m.package.sha256,
    String(m.package.size_bytes),
    m.migrations.reversible ? '1' : '0',
  ].join('\n')
}
