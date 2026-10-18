/**
 * Escritor ZIP mínimo (sin dependencias), suficiente para los paquetes de
 * release: deflate o store por archivo, nombres UTF-8 y fechas fijas para que
 * el mismo contenido produzca siempre el mismo ZIP. Sin ZIP64 (límite 4 GB).
 */
import { crc32, deflateRawSync } from 'node:zlib'

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, day }
}

/**
 * @param {{ name: string, data: Buffer }[]} entries
 * @param {Date} mtime
 * @returns {Buffer}
 */
export function createZip(entries, mtime) {
  const { time, day } = dosDateTime(mtime)
  const chunks = []
  const central = []
  let offset = 0

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8')
    const crc = crc32(data)
    const deflated = deflateRawSync(data, { level: 9 })
    const useDeflate = deflated.length < data.length
    const body = useDeflate ? deflated : data
    const method = useDeflate ? 8 : 0

    if (offset > 0xffffffff || body.length > 0xffffffff) throw new Error('El paquete supera 4 GB (no soportado).')

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // versión necesaria
    local.writeUInt16LE(0x0800, 6) // bit 11: nombre en UTF-8
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(day, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)

    const header = Buffer.alloc(46)
    header.writeUInt32LE(0x02014b50, 0)
    header.writeUInt16LE(0x0314, 4) // creado en Unix, v2.0
    header.writeUInt16LE(20, 6)
    header.writeUInt16LE(0x0800, 8)
    header.writeUInt16LE(method, 10)
    header.writeUInt16LE(time, 12)
    header.writeUInt16LE(day, 14)
    header.writeUInt32LE(crc, 16)
    header.writeUInt32LE(body.length, 20)
    header.writeUInt32LE(data.length, 24)
    header.writeUInt16LE(nameBuf.length, 28)
    header.writeUInt32LE(((0o100644 << 16) >>> 0), 38) // permisos rw-r--r--
    header.writeUInt32LE(offset, 42)

    chunks.push(local, nameBuf, body)
    central.push(header, nameBuf)
    offset += local.length + nameBuf.length + body.length
  }

  const centralBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)

  return Buffer.concat([...chunks, centralBuf, end])
}
