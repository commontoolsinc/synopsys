import * as Type from '../type.js'
import * as Error from '../error.js'

/**
 * @param {bigint|number} source
 */
export const toBytes = (source) => {
  let value = BigInt(source)

  if (value < 0n) {
    throw new RangeError('Unsigned LEB128 cannot encode negative numbers')
  }

  let bytes = []

  do {
    let byte = Number(value & 0x7fn)
    value >>= 7n

    if (value !== 0n) {
      byte |= 0x80
    }

    bytes.push(byte)
  } while (value !== 0n)

  return new Uint8Array(bytes)
}

/**
 * @param {Type.BufferReader} buffer
 */
export function* decode(buffer) {
  let result = 0n
  let shift = 0n
  let byte = 0

  do {
    byte = buffer.take() ?? (yield* Error.incomplete({ segment: 'LEB128' }))

    result |= BigInt(byte & 0x7f) << shift
    shift += 7n
  } while ((byte & 0x80) !== 0)

  return result
}
