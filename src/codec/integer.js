import * as Error from './error.js'
import * as Type from './type.js'
import { Integer } from './tag.js'
import * as Leb128 from './LEB128.js'

/**
 * @param {number|bigint} source
 */
export const toBytes = (source) => {
  const integer = Leb128.Signed.encode(source)
  const content = new Uint8Array(integer.byteLength + 1)
  content[0] = Integer.code
  content.set(integer, 1)
  return content
}

/**
 * @param {number|bigint} source
 * @returns
 */
export function* encode(source) {
  const content = toBytes(source)
  yield content
  return content.byteLength
}

/**
 * @param {Type.BufferReader} source
 */
export function* decode(source) {
  yield* Integer.decode(source)

  const integer = yield* Leb128.Signed.decode(source)

  return integer
}
