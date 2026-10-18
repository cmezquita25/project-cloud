/**
 * Genera la llave de firma de releases (Ed25519). Se ejecuta UNA sola vez.
 *
 *   node scripts/release/keygen.mjs            (falla si ya existe una llave)
 *   node scripts/release/keygen.mjs --force    (rota la llave: ver advertencia)
 *
 * - Llave PRIVADA → ~/.project-cloud/release-signing.key (fuera del repo).
 *   Respáldala en un gestor de contraseñas. Si se pierde, no se pueden firmar
 *   versiones nuevas y cada instalación tendría que actualizarse a mano.
 * - Llave PÚBLICA → api/src/Updater/ReleaseKey.php (va en el código; cada
 *   instalación la usa para verificar los paquetes antes de instalarlos).
 *
 * Rotar la llave invalida la verificación en las instalaciones existentes:
 * el primer release firmado con la llave nueva debe instalarse a mano.
 */
import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEFAULT_KEY_PATH, ROOT, publicKeyInfo, writeReleaseKeyPhp } from './lib.mjs'

const force = process.argv.includes('--force')

if (existsSync(DEFAULT_KEY_PATH) && !force) {
  console.error(`Ya existe una llave en ${DEFAULT_KEY_PATH}. No se sobrescribe.`)
  console.error('Si de verdad quieres rotarla, usa --force (lee la advertencia del encabezado).')
  process.exit(1)
}

const { privateKey, publicKey } = generateKeyPairSync('ed25519')

mkdirSync(resolve(DEFAULT_KEY_PATH, '..'), { recursive: true })
writeFileSync(DEFAULT_KEY_PATH, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })

const info = publicKeyInfo(publicKey)
writeReleaseKeyPhp(info)

console.log('Llave de firma creada.')
console.log(`  Privada : ${DEFAULT_KEY_PATH}   ← RESPÁLDALA, no la subas a ningún sitio`)
console.log(`  Pública : ${resolve(ROOT, 'api/src/Updater/ReleaseKey.php')}`)
console.log(`  Key ID  : ${info.keyId}`)
