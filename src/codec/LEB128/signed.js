import * as Type from '../type.js'
import * as Error from '../error.js'

/**
 * @param {bigint|number} source
 * @param {number} offset
 */
export const encode = (source, offset = 0) => {
  let value = BigInt(source)
  let bytes = []
  let more = true

  while (more) {
    let byte = value & 0x7fn
    value >>= 7n

    if (
      (value === 0n && (byte & 0x40n) === 0n) ||
      (value === -1n && (byte & 0x40n) !== 0n)
    ) {
      more = false
    } else {
      byte |= 0x80n
    }

    bytes.push(Number(byte))
  }
  const content = new Uint8Array(bytes.length + offset)
  content.set(bytes, offset)

  return content
}

/**
 * @param {Type.BufferReader} buffer
 */
export function* decode(buffer) {
  let result = 0n
  let shift = 0n
  let size = 0
  let byte = 0

  do {
    byte = buffer.take() ?? (yield* Error.incomplete({ segment: 'LEB128' }))

    result |= BigInt(byte & 0x7f) << shift
    shift += 7n
  } while ((byte & 0x80) !== 0)

  if ((byte & 0x40) !== 0) {
    result |= -(1n << shift)
  }

  return result
}
