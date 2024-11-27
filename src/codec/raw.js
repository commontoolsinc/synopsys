import * as Varint from './varint.js'
import { Raw } from './tag.js'
import * as Type from './type.js'
import * as Error from './error.js'

/**
 * @param {Uint8Array} source
 */
export function* encode(source) {
  const prefix = new Uint8Array(Varint.length(source.byteLength) + 1)
  prefix[0] = Raw.code
  Varint.write(source.byteLength, prefix, 1)

  yield prefix
  yield source

  return prefix.byteLength + source.byteLength
}

/**
 * @param {Type.BufferReader} buffer
 */
export const decode = function* (buffer) {
  yield* Raw.decode(buffer)

  const length = yield* Varint.decode(buffer)
  return buffer.read(length) ?? (yield* Error.incomplete({ segment: 'Raw' }))
}
