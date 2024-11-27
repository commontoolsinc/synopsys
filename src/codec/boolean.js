import { Boolean } from './tag.js'
import * as Error from './error.js'
import * as Type from './type.js'

const buffer = new Uint8Array([Boolean.code, 0])
const size = buffer.byteLength

/**
 * @param {boolean} source
 */
export const toBytes = (source) => {
  buffer[0] = Boolean.code
  buffer[1] = source ? 1 : 0
  return buffer.slice(0)
}

/**
 * @param {boolean} source
 */
export function* encode(source) {
  yield toBytes(source)
  return size
}

/**
 * @param {Type.BufferReader} buffer
 */
export function* decode(buffer) {
  yield* Boolean.decode(buffer)

  const byte =
    buffer.take() ?? (yield* Error.incomplete({ segment: 'Boolean' }))

  return byte === 0
}
